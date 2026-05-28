import { Types } from 'mongoose';
import { DEFAULT_CREDITS_LIMIT } from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { getBillingPlan } from '../billing/billing.catalog.js';
import { billingRepository } from '../billing/billing.repository.js';
import type { BillingPlanId } from '../billing/billing.types.js';
import type { BillingSubscriptionStatus } from '../billing/billing.model.js';
import {
  resolveMonthlyCreditPeriod,
  type CreditPeriod,
} from '../billing/domain/credit-period.js';
import { usageRepository } from './usage.repository.js';
import {
  QuotaBucketModel,
  QuotaDebitModel,
  type IQuotaBucketDocument,
} from './quota.model.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { userRepository } from '../user/user.repository.js';
import { UserModel } from '../user/user.model.js';
import { sendUsageThresholdEmail } from '../../utils/mailer.js';
import { sendNotificationEmailSafely } from '../../utils/notify-email.js';

const ACTIVE_SUBSCRIPTION_STATUSES: Array<Exclude<BillingSubscriptionStatus, 'NONE'>> = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
];

const CREDIT_PRECISION = 4;

interface QuotaContext {
  includedCredits: number;
  planId: BillingPlanId;
  creditPeriod: CreditPeriod;
}

export interface QuotaStatus {
  planId: BillingPlanId;
  creditsUsed: number;
  includedCredits: number;
  remainingCredits: number;
  topupBalance: number;
  overQuota: boolean;
  periodStart: Date;
  periodEnd: Date;
}

export interface QuotaDebit {
  debitId?: string;
  idempotencyKey?: string;
  credits: number;
  duplicate: boolean;
  source?: 'included' | 'topup';
}

export interface ConsumeQuotaInput {
  userId: Types.ObjectId;
  credits: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

function roundCredits(value: number): number {
  return Number(value.toFixed(CREDIT_PRECISION));
}

function isBillingPlanId(value: string | undefined): value is BillingPlanId {
  return value === 'free' || value === 'go' || value === 'pro' || value === 'plus' || value === 'max' || value === 'enterprise' || value === 'custom';
}

function normalizePlanId(value: string | undefined): BillingPlanId {
  if (value === 'hobby' || value === 'free') return 'free';
  if (isBillingPlanId(value)) return value;
  return 'free';
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

function quotaExceededError(): AppError {
  return new AppError(
    'Balance limit reached. Upgrade your plan or wait for the next billing period.',
    402,
    'QUOTA_EXCEEDED'
  );
}

export class QuotaService {
  private async resolveContext(userId: Types.ObjectId): Promise<QuotaContext> {
    const freePlan = getBillingPlan('free');

    try {
      const subscription = await billingRepository.findLatestSubscriptionByUserId(
        userId,
        ACTIVE_SUBSCRIPTION_STATUSES
      );

      const now = new Date();
      const subscriptionWindowActive =
        subscription !== null &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > now);

      const subscriptionPeriodStart = subscriptionWindowActive
        ? subscription?.currentPeriodStart ?? null
        : null;
      const subscriptionPeriodEnd = subscriptionWindowActive
        ? subscription?.currentPeriodEnd ?? null
        : null;
      const billingCycle =
        subscriptionWindowActive && subscription ? subscription.billingCycle : null;
      const creditPeriod = resolveMonthlyCreditPeriod({
        now,
        billingCycle,
        subscriptionPeriodStart,
        subscriptionPeriodEnd,
      });
      const planId = normalizePlanId(subscriptionWindowActive ? subscription?.planCode : 'free');
      const plan = planId === 'custom' ? null : getBillingPlan(planId);

      return {
        planId,
        includedCredits: Math.max(
          1,
          planId === 'custom'
            ? DEFAULT_CREDITS_LIMIT
            : plan?.includedCredits ?? freePlan?.includedCredits ?? DEFAULT_CREDITS_LIMIT
        ),
        creditPeriod,
      };
    } catch {
      const now = new Date();
      return {
        planId: 'free',
        includedCredits: Math.max(1, freePlan?.includedCredits ?? DEFAULT_CREDITS_LIMIT),
        creditPeriod: resolveMonthlyCreditPeriod({
          now,
          billingCycle: null,
          subscriptionPeriodStart: null,
          subscriptionPeriodEnd: null,
        }),
      };
    }
  }

  private async ensureBucket(
    userId: Types.ObjectId,
    context: QuotaContext
  ): Promise<IQuotaBucketDocument> {
    const userDoc = await UserModel.findById(userId).select('includedCredits').lean().exec();
    const bucketLimit = Math.max(context.includedCredits, userDoc?.includedCredits ?? 0);

    const existingBucket = await QuotaBucketModel.findOneAndUpdate(
      {
        user_id: userId,
        period_start: context.creditPeriod.periodStart,
      },
      {
        $set: {
          period_end: context.creditPeriod.periodEndExclusive,
          limit_credits: bucketLimit,
        },
      },
      { new: true }
    ).exec();

    if (existingBucket) {
      return existingBucket;
    }

    const rangeEndMs = Math.min(
      Date.now(),
      context.creditPeriod.periodEndExclusive.getTime() - 1
    );
    const historicalTotals = await usageRepository.getEventTotals(userId, {
      start: context.creditPeriod.periodStart,
      end: new Date(Math.max(context.creditPeriod.periodStart.getTime(), rangeEndMs)),
    });

    const bucket = await QuotaBucketModel.findOneAndUpdate(
      {
        user_id: userId,
        period_start: context.creditPeriod.periodStart,
      },
      {
        $set: {
          period_end: context.creditPeriod.periodEndExclusive,
          limit_credits: bucketLimit,
        },
        $setOnInsert: {
          user_id: userId,
          period_start: context.creditPeriod.periodStart,
          used_credits: roundCredits(historicalTotals.credits || 0),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).exec();

    if (!bucket) {
      throw new AppError('Failed to initialize quota bucket.', 500, 'INTERNAL_ERROR');
    }

    return bucket;
  }

  async getStatus(userId: Types.ObjectId): Promise<QuotaStatus> {
    const context = await this.resolveContext(userId);
    const bucket = await this.ensureBucket(userId, context);
    const creditsUsed = roundCredits(bucket.used_credits || 0);
    const includedCredits = Math.max(1, bucket.limit_credits || context.includedCredits);
    const remainingCredits = roundCredits(Math.max(0, includedCredits - creditsUsed));

    const userDoc = await UserModel.findById(userId).select('topupBalance').lean().exec();
    const topupBalance = userDoc?.topupBalance ?? 0;

    const overQuota = creditsUsed >= includedCredits && topupBalance <= 0;

    return {
      planId: context.planId,
      creditsUsed,
      includedCredits,
      remainingCredits,
      topupBalance,
      overQuota,
      periodStart: bucket.period_start,
      periodEnd: bucket.period_end,
    };
  }

  async assertWithinQuota(userId: Types.ObjectId): Promise<QuotaStatus> {
    const status = await this.getStatus(userId);

    if (status.overQuota) {
      throw quotaExceededError();
    }

    return status;
  }

  async consumeCredits(input: ConsumeQuotaInput): Promise<QuotaDebit> {
    const credits = roundCredits(Math.max(0, input.credits));

    if (credits === 0) {
      await this.assertWithinQuota(input.userId);
      return {
        credits: 0,
        duplicate: false,
      };
    }

    const context = await this.resolveContext(input.userId);
    const bucket = await this.ensureBucket(input.userId, context);
    const existingDebit = await QuotaDebitModel.findOne({
      user_id: input.userId,
      idempotency_key: input.idempotencyKey,
      status: 'committed',
    }).exec();

    if (existingDebit) {
      const source = (existingDebit.metadata?.source as 'included' | 'topup' | undefined) ?? 'included';
      return {
        debitId: existingDebit._id.toString(),
        idempotencyKey: existingDebit.idempotency_key,
        credits: existingDebit.credits,
        duplicate: true,
        source,
      };
    }

    logger.info('Quota consume: trying included pool', {
      userId: input.userId.toString(),
      credits,
      bucketLimit: bucket.limit_credits,
      bucketUsed: bucket.used_credits,
      remaining: roundCredits(Math.max(0, (bucket.limit_credits || 0) - (bucket.used_credits || 0))),
    });

    const updatedBucket = await QuotaBucketModel.findOneAndUpdate(
      {
        _id: bucket._id,
        user_id: input.userId,
        period_start: context.creditPeriod.periodStart,
        $expr: {
          $gte: [
            {
              $subtract: ['$limit_credits', '$used_credits'],
            },
            credits,
          ],
        },
      },
      {
        $inc: {
          used_credits: credits,
        },
        $set: {
          limit_credits: Math.max(context.includedCredits, bucket.limit_credits || 0),
          period_end: context.creditPeriod.periodEndExclusive,
        },
      },
      {
        new: true,
      }
    ).exec();

    if (!updatedBucket) {
      logger.info('Quota consume: included pool exhausted, falling back to topup', {
        userId: input.userId.toString(),
        credits,
        bucketLimit: bucket.limit_credits,
        bucketUsed: bucket.used_credits,
      });
      return this.consumeFromTopup(input, credits, context, bucket);
    }

    try {
      const debit = await QuotaDebitModel.create({
        user_id: input.userId,
        bucket_id: updatedBucket._id,
        period_start: context.creditPeriod.periodStart,
        period_end: context.creditPeriod.periodEndExclusive,
        idempotency_key: input.idempotencyKey,
        credits,
        status: 'committed',
        metadata: {
          plan_id: context.planId,
          source: 'included',
          ...(input.metadata || {}),
        },
      });

      void this.notifyThresholdCrossings({
        userId: input.userId,
        bucket: updatedBucket,
        planId: context.planId,
        previousUsed: roundCredits((updatedBucket.used_credits ?? 0) - credits),
      });

      return {
        debitId: debit._id.toString(),
        idempotencyKey: debit.idempotency_key,
        credits,
        duplicate: false,
        source: 'included',
      };
    } catch (error) {
      await QuotaBucketModel.updateOne(
        { _id: updatedBucket._id },
        { $inc: { used_credits: -credits } }
      ).exec();

      if (isDuplicateKeyError(error)) {
        const debit = await QuotaDebitModel.findOne({
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          status: 'committed',
        }).exec();

        if (debit) {
          const source = (debit.metadata?.source as 'included' | 'topup' | undefined) ?? 'included';
          return {
            debitId: debit._id.toString(),
            idempotencyKey: debit.idempotency_key,
            credits: debit.credits,
            duplicate: true,
            source,
          };
        }
      }

      throw error;
    }
  }

  private async consumeFromTopup(
    input: ConsumeQuotaInput,
    credits: number,
    context: QuotaContext,
    bucket: IQuotaBucketDocument
  ): Promise<QuotaDebit> {
    const userBefore = await UserModel.findById(input.userId).select('topupBalance').lean().exec();
    logger.info('Quota consume: attempting topup debit', {
      userId: input.userId.toString(),
      credits,
      currentTopupBalance: userBefore?.topupBalance ?? 0,
    });

    const updatedUser = await UserModel.findOneAndUpdate(
      {
        _id: input.userId,
        $expr: {
          $gte: ['$topupBalance', credits],
        },
      },
      {
        $inc: { topupBalance: -credits },
      },
      { new: true }
    ).exec();

    if (!updatedUser) {
      logger.warn('Quota consume: topup balance insufficient', {
        userId: input.userId.toString(),
        credits,
        currentTopupBalance: userBefore?.topupBalance ?? 0,
      });
      throw quotaExceededError();
    }

    try {
      const debit = await QuotaDebitModel.create({
        user_id: input.userId,
        bucket_id: bucket._id,
        period_start: context.creditPeriod.periodStart,
        period_end: context.creditPeriod.periodEndExclusive,
        idempotency_key: input.idempotencyKey,
        credits,
        status: 'committed',
        metadata: {
          plan_id: context.planId,
          source: 'topup',
          ...(input.metadata || {}),
        },
      });

      logger.info('Consumed credits from topup balance', {
        userId: input.userId.toString(),
        credits,
        remainingTopup: updatedUser.topupBalance,
      });

      return {
        debitId: debit._id.toString(),
        idempotencyKey: debit.idempotency_key,
        credits,
        duplicate: false,
        source: 'topup',
      };
    } catch (error) {
      await UserModel.updateOne(
        { _id: input.userId },
        { $inc: { topupBalance: credits } }
      ).exec();

      if (isDuplicateKeyError(error)) {
        const debit = await QuotaDebitModel.findOne({
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          status: 'committed',
        }).exec();

        if (debit) {
          const source = (debit.metadata?.source as 'included' | 'topup' | undefined) ?? 'included';
          return {
            debitId: debit._id.toString(),
            idempotencyKey: debit.idempotency_key,
            credits: debit.credits,
            duplicate: true,
            source,
          };
        }
      }

      throw error;
    }
  }

  async refundDebit(debit: QuotaDebit | undefined, reason: string): Promise<void> {
    if (!debit?.debitId || debit.credits <= 0 || debit.duplicate) {
      return;
    }

    const updatedDebit = await QuotaDebitModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(debit.debitId),
        status: 'committed',
      },
      {
        $set: {
          status: 'refunded',
          refunded_at: new Date(),
          refund_reason: reason,
        },
      },
      { new: false }
    ).exec();

    if (!updatedDebit) {
      return;
    }

    const source = (updatedDebit.metadata?.source as 'included' | 'topup' | undefined) ?? 'included';

    if (source === 'topup') {
      await UserModel.updateOne(
        { _id: updatedDebit.user_id },
        { $inc: { topupBalance: roundCredits(updatedDebit.credits) } }
      ).exec();
    } else {
      await QuotaBucketModel.updateOne(
        { _id: updatedDebit.bucket_id },
        { $inc: { used_credits: -roundCredits(updatedDebit.credits) } }
      ).exec();
    }
  }

  private async notifyThresholdCrossings(input: {
    userId: Types.ObjectId;
    bucket: IQuotaBucketDocument;
    planId: BillingPlanId;
    previousUsed: number;
  }): Promise<void> {
    const limit = Math.max(1, input.bucket.limit_credits || 1);
    const used = roundCredits(input.bucket.used_credits || 0);
    const previousFraction = input.previousUsed / limit;
    const currentFraction = used / limit;

    const thresholds = env.USAGE_QUOTA_WARNING_THRESHOLDS;
    if (!thresholds.length) return;

    const crossed = thresholds.filter(
      (t) => previousFraction < t && currentFraction >= t,
    );
    if (!crossed.length) return;

    // Only emit the highest crossed threshold this turn so a single big debit
    // that jumps 0% → 100% sends "you're at 100%" rather than two emails.
    const threshold = crossed[crossed.length - 1]!;
    const planName = input.planId === 'custom'
      ? 'Custom Plan'
      : getBillingPlan(input.planId)?.name ?? 'Free Plan';
    const dedupeKey = `usage:quota-threshold:${input.bucket._id.toString()}:${threshold}`;
    const exhausted = threshold >= 1;

    try {
      await notificationsService.createNotification(input.userId, {
        kind: 'usage',
        severity: exhausted ? 'error' : 'warning',
        title: exhausted
          ? 'Balance limit reached'
          : `You've used ${Math.round(threshold * 100)}% of your balance`,
        message: exhausted
          ? `You've used all the balance included with ${planName} for this period. New requests will be blocked until your balance resets or you upgrade.`
          : `You've used ${Math.round(threshold * 100)}% ($${(used / 100).toFixed(2)} / $${(limit / 100).toFixed(2)}) of your balance on ${planName} for the current period.`,
        dedupe_key: dedupeKey,
        metadata: {
          threshold,
          used_credits: used,
          included_credits: limit,
          plan_id: input.planId,
          period_end: input.bucket.period_end.toISOString(),
        },
      });
    } catch (error) {
      logger.warn('Failed to create usage threshold notification.', {
        userId: input.userId.toHexString(),
        threshold,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const owner = await userRepository.findById(input.userId);
      if (!owner?.email) return;
      await sendNotificationEmailSafely({
        category: 'usage',
        notificationType: `usage_threshold_${Math.round(threshold * 100)}`,
        send: () => sendUsageThresholdEmail({
          to: owner.email,
          customerName: owner.fullName ?? null,
          planName,
          thresholdPercent: threshold,
          usedCredits: used,
          includedCredits: limit,
          periodEnd: input.bucket.period_end,
        }),
        context: {
          userId: input.userId.toHexString(),
          threshold,
          bucketId: input.bucket._id.toString(),
        },
      });
    } catch (error) {
      logger.warn('Failed to dispatch usage threshold email.', {
        userId: input.userId.toHexString(),
        threshold,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const quotaService = new QuotaService();
