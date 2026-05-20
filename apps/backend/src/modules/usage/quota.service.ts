import { Types } from 'mongoose';
import { DEFAULT_CREDITS_LIMIT } from '@nirex/shared';
import { AppError } from '../../types/index.js';
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
  overQuota: boolean;
  periodStart: Date;
  periodEnd: Date;
}

export interface QuotaDebit {
  debitId?: string;
  idempotencyKey?: string;
  credits: number;
  duplicate: boolean;
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
  return value === 'free' || value === 'pro' || value === 'enterprise' || value === 'custom';
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
    'Credit quota exceeded. Upgrade your plan or wait for the next billing period.',
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
    const existingBucket = await QuotaBucketModel.findOneAndUpdate(
      {
        user_id: userId,
        period_start: context.creditPeriod.periodStart,
      },
      {
        $set: {
          period_end: context.creditPeriod.periodEndExclusive,
          limit_credits: context.includedCredits,
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
          limit_credits: context.includedCredits,
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

    return {
      planId: context.planId,
      creditsUsed,
      includedCredits,
      remainingCredits,
      overQuota: creditsUsed >= includedCredits,
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
      return {
        debitId: existingDebit._id.toString(),
        idempotencyKey: existingDebit.idempotency_key,
        credits: existingDebit.credits,
        duplicate: true,
      };
    }

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
          limit_credits: context.includedCredits,
          period_end: context.creditPeriod.periodEndExclusive,
        },
      },
      {
        new: true,
      }
    ).exec();

    if (!updatedBucket) {
      throw quotaExceededError();
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
          ...(input.metadata || {}),
        },
      });

      return {
        debitId: debit._id.toString(),
        idempotencyKey: debit.idempotency_key,
        credits,
        duplicate: false,
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
          return {
            debitId: debit._id.toString(),
            idempotencyKey: debit.idempotency_key,
            credits: debit.credits,
            duplicate: true,
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

    await QuotaBucketModel.updateOne(
      { _id: updatedDebit.bucket_id },
      { $inc: { used_credits: -roundCredits(updatedDebit.credits) } }
    ).exec();
  }
}

export const quotaService = new QuotaService();
