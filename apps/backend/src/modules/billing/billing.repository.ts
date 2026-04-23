import { Types } from 'mongoose';
import {
  BillingCustomerModel,
  BillingInvoiceModel,
  BillingSubscriptionModel,
  BillingWebhookEventModel,
  type BillingSubscriptionStatus,
  type IBillingCustomerDocument,
  type IBillingInvoiceDocument,
  type IBillingSubscriptionDocument,
  type PaymentMethodSnapshot,
} from './billing.model.js';

interface UpsertCustomerInput {
  userId: Types.ObjectId;
  stripeCustomerId: string;
  email: string;
  name?: string;
  defaultPaymentMethod?: PaymentMethodSnapshot;
}

interface UpsertSubscriptionInput {
  userId: Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId?: string;
  planId: string;
  billingCycle: 'month' | 'year';
  status: BillingSubscriptionStatus;
  currency: string;
  amountCents: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  latestInvoiceId?: string;
}

interface UpsertInvoiceInput {
  userId: Types.ObjectId;
  stripeCustomerId: string;
  stripeInvoiceId: string;
  stripeSubscriptionId?: string;
  number?: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | 'unknown';
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  dueDate?: Date;
  paidAt?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  stripeCreatedAt: Date;
}

interface WebhookEventClaimResult {
  shouldProcess: boolean;
  duplicate: boolean;
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export class BillingRepository {
  async findCustomerByUserId(
    userId: Types.ObjectId,
  ): Promise<IBillingCustomerDocument | null> {
    return BillingCustomerModel.findOne({ userId }).exec();
  }

  async findCustomerByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<IBillingCustomerDocument | null> {
    return BillingCustomerModel.findOne({ stripeCustomerId }).exec();
  }

  async upsertCustomer(
    input: UpsertCustomerInput,
  ): Promise<IBillingCustomerDocument> {
    const update: Record<string, unknown> = {
      stripeCustomerId: input.stripeCustomerId,
      email: input.email.toLowerCase().trim(),
    };
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.defaultPaymentMethod !== undefined) {
      update.defaultPaymentMethod = input.defaultPaymentMethod;
    }

    const doc = await BillingCustomerModel.findOneAndUpdate(
      { userId: input.userId },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();

    if (!doc) {
      throw new Error('Failed to upsert billing customer.');
    }

    return doc;
  }

  async markCustomerStripeSynced(
    userId: Types.ObjectId,
    syncedAt: Date = new Date(),
  ): Promise<void> {
    await BillingCustomerModel.updateOne(
      { userId },
      {
        $set: {
          lastStripeSyncAt: syncedAt,
        },
      },
    ).exec();
  }

  async findLatestSubscriptionByUserId(
    userId: Types.ObjectId,
    statuses?: BillingSubscriptionStatus[],
  ): Promise<IBillingSubscriptionDocument | null> {
    const filter: {
      userId: Types.ObjectId;
      status?: { $in: BillingSubscriptionStatus[] };
    } = { userId };
    if (statuses && statuses.length > 0) {
      filter.status = { $in: statuses };
    }

    return BillingSubscriptionModel.findOne(filter)
      .sort({ currentPeriodEnd: -1, createdAt: -1 })
      .exec();
  }

  async upsertSubscription(
    input: UpsertSubscriptionInput,
  ): Promise<IBillingSubscriptionDocument> {
    const doc = await BillingSubscriptionModel.findOneAndUpdate(
      { stripeSubscriptionId: input.stripeSubscriptionId },
      {
        $set: {
          userId: input.userId,
          stripeCustomerId: input.stripeCustomerId,
          stripePriceId: input.stripePriceId,
          planId: input.planId,
          billingCycle: input.billingCycle,
          status: input.status,
          currency: input.currency,
          amountCents: input.amountCents,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          canceledAt: input.canceledAt,
          endedAt: input.endedAt,
          trialStart: input.trialStart,
          trialEnd: input.trialEnd,
          latestInvoiceId: input.latestInvoiceId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    if (!doc) {
      throw new Error('Failed to upsert billing subscription.');
    }

    return doc;
  }

  async upsertInvoice(input: UpsertInvoiceInput): Promise<IBillingInvoiceDocument> {
    const doc = await BillingInvoiceModel.findOneAndUpdate(
      { stripeInvoiceId: input.stripeInvoiceId },
      {
        $set: {
          userId: input.userId,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          number: input.number,
          status: input.status,
          currency: input.currency,
          subtotalCents: input.subtotalCents,
          taxCents: input.taxCents,
          totalCents: input.totalCents,
          amountDueCents: input.amountDueCents,
          amountPaidCents: input.amountPaidCents,
          amountRemainingCents: input.amountRemainingCents,
          hostedInvoiceUrl: input.hostedInvoiceUrl,
          invoicePdfUrl: input.invoicePdfUrl,
          dueDate: input.dueDate,
          paidAt: input.paidAt,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          stripeCreatedAt: input.stripeCreatedAt,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();

    if (!doc) {
      throw new Error('Failed to upsert billing invoice.');
    }

    return doc;
  }

  async listInvoicesByUserId(
    userId: Types.ObjectId,
    limit: number = 20,
  ): Promise<IBillingInvoiceDocument[]> {
    return BillingInvoiceModel.find({ userId })
      .sort({ stripeCreatedAt: -1 })
      .limit(limit)
      .exec();
  }

  async getPaidInvoicesYtdTotalCents(
    userId: Types.ObjectId,
    year: number,
  ): Promise<number> {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

    const result = await BillingInvoiceModel.aggregate<{
      totalPaid: number;
    }>([
      {
        $match: {
          userId,
          status: 'paid',
          paidAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amountPaidCents' },
        },
      },
    ]);

    return result[0]?.totalPaid ?? 0;
  }

  async claimWebhookEventForProcessing(
    eventId: string,
    eventType: string,
    staleProcessingAfterSeconds: number,
  ): Promise<WebhookEventClaimResult> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - Math.max(60, staleProcessingAfterSeconds) * 1000,
    );

    const reclaimed = await BillingWebhookEventModel.findOneAndUpdate(
      {
        stripeEventId: eventId,
        $or: [
          { status: 'failed' },
          { status: 'processing', updatedAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: {
          eventType,
          status: 'processing',
          receivedAt: now,
        },
        $unset: {
          processedAt: '',
          lastError: '',
        },
        $inc: {
          attempts: 1,
        },
      },
      { new: true },
    ).exec();

    if (reclaimed) {
      return { shouldProcess: true, duplicate: false };
    }

    try {
      await BillingWebhookEventModel.create({
        stripeEventId: eventId,
        eventType,
        status: 'processing',
        attempts: 1,
        receivedAt: new Date(),
      });
      return { shouldProcess: true, duplicate: false };
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        await BillingWebhookEventModel.updateOne(
          { stripeEventId: eventId },
          { $inc: { attempts: 1 } },
        ).exec();
        return { shouldProcess: false, duplicate: true };
      }
      throw error;
    }
  }

  async markWebhookEventProcessed(eventId: string): Promise<void> {
    await BillingWebhookEventModel.updateOne(
      { stripeEventId: eventId },
      {
        $set: {
          status: 'processed',
          processedAt: new Date(),
        },
        $unset: {
          lastError: '',
        },
      },
    ).exec();
  }

  async markWebhookEventIgnored(eventId: string): Promise<void> {
    await BillingWebhookEventModel.updateOne(
      { stripeEventId: eventId },
      {
        $set: {
          status: 'ignored',
          processedAt: new Date(),
        },
        $unset: {
          lastError: '',
        },
      },
    ).exec();
  }

  async markWebhookEventFailed(eventId: string, error: string): Promise<void> {
    await BillingWebhookEventModel.updateOne(
      { stripeEventId: eventId },
      {
        $set: {
          status: 'failed',
          processedAt: new Date(),
          lastError: error.slice(0, 2000),
        },
      },
    ).exec();
  }
}

export const billingRepository = new BillingRepository();
