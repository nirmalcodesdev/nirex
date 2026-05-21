import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose';
import type {
  BillingActorType,
  BillingAuditOutcome,
  BillingCycle,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  BillingPlanId,
  BillingRefundStatus,
  BillingSubscriptionStatus,
  BillingWebhookStatus,
  JsonObject,
} from '@nirex/shared';
import {
  BillingAuditLogModel,
  BillingCouponModel,
  BillingCustomerModel,
  BillingDiscountModel,
  BillingDunningAttemptModel,
  BillingIdempotencyKeyModel,
  BillingInvoiceLineItemModel,
  BillingInvoiceModel,
  BillingPaymentMethodModel,
  BillingPaymentModel,
  BillingPlanModel,
  BillingReconciliationAlertModel,
  BillingRefundModel,
  BillingSubscriptionModel,
  BillingUsageRecordModel,
  BillingWebhookEventModel,
  type IBillingAuditLogDocument,
  type IBillingCouponDocument,
  type IBillingCustomerDocument,
  type IBillingDunningAttemptDocument,
  type IBillingIdempotencyKeyDocument,
  type IBillingInvoiceDocument,
  type IBillingInvoiceLineItemDocument,
  type IBillingPaymentDocument,
  type IBillingPaymentMethodDocument,
  type IBillingPlanDocument,
  type IBillingReconciliationAlertDocument,
  type IBillingRefundDocument,
  type IBillingSubscriptionDocument,
  type IBillingUsageRecordDocument,
  type IBillingWebhookEventDocument,
} from './billing.model.js';

export type BillingSession = ClientSession;

export interface CustomerInput {
  userId: Types.ObjectId;
  providerCustomerId?: string;
  defaultPaymentMethodId?: Types.ObjectId;
}

export interface PaymentMethodInput {
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  providerPaymentMethodId: string;
  type: 'card' | 'bank_account' | 'wallet' | 'unknown';
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  funding?: string;
  isDefault?: boolean;
}

export interface PlanInput {
  code: BillingPlanId;
  name: string;
  description: string;
  features: string[];
  includedCredits?: number | null;
  trialDays: number;
  currency: string;
  amountMinor: number;
  billingCycle: BillingCycle;
  providerPriceId?: string;
  providerProductId?: string;
  active: boolean;
}

export interface SubscriptionInput {
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  planCode: BillingPlanId;
  billingCycle: BillingCycle;
  status: Exclude<BillingSubscriptionStatus, 'NONE'>;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  currency: string;
  amountMinor: number;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: JsonObject;
}

export interface InvoiceInput {
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  providerInvoiceId?: string;
  invoiceNumber?: string;
  description?: string;
  status: BillingInvoiceStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  amountDueMinor: number;
  amountPaidMinor: number;
  amountRemainingMinor: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  dueAt?: Date;
  paidAt?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  providerCreatedAt?: Date;
}

export interface InvoiceLineItemInput {
  invoiceId: Types.ObjectId;
  userId: Types.ObjectId;
  customerId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
  currency: string;
  planCode?: BillingPlanId;
  usageRecordId?: Types.ObjectId;
}

export interface PaymentInput {
  invoiceId?: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  paymentMethodId?: Types.ObjectId;
  providerPaymentId?: string;
  idempotencyKey: string;
  status: BillingPaymentStatus;
  amountMinor: number;
  currency: string;
  failureCode?: string;
  failureMessage?: string;
  requiresActionUrl?: string;
  attemptedAt?: Date;
}

export interface RefundInput {
  paymentId: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  providerRefundId?: string;
  idempotencyKey: string;
  status: BillingRefundStatus;
  amountMinor: number;
  currency: string;
  reason?: string;
  requestedByActorType: BillingActorType;
  requestedByActorId?: string;
}

export interface AuditLogInput {
  userId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  actorType: BillingActorType;
  actorId?: string;
  action: string;
  outcome: BillingAuditOutcome;
  before?: JsonObject;
  after?: JsonObject;
  metadata?: JsonObject;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  errorCode?: string;
  occurredAt?: Date;
}

export interface ReconciliationAlertInput {
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  diff: JsonObject;
}

export interface ListInvoicesInput {
  userId: Types.ObjectId;
  limit: number;
  cursor?: string;
  status?: BillingInvoiceStatus;
}

export interface ListInvoicesResult {
  items: IBillingInvoiceDocument[];
  nextCursor: string | null;
}

export interface IdempotencyStartResult {
  record: IBillingIdempotencyKeyDocument;
  existing: boolean;
}

function optionalSession(session?: ClientSession): { session?: ClientSession } {
  return session ? { session } : {};
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export class BillingRepository {
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      if (result === undefined) {
        throw new Error('Billing transaction did not return a result.');
      }
      return result;
    } finally {
      await session.endSession();
    }
  }

  async findCustomerByUserId(
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingCustomerDocument | null> {
    return BillingCustomerModel.findOne({ userId, deletedAt: { $exists: false } })
      .session(session ?? null)
      .exec();
  }

  async findCustomerById(
    customerId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingCustomerDocument | null> {
    return BillingCustomerModel.findOne({ _id: customerId, deletedAt: { $exists: false } })
      .session(session ?? null)
      .exec();
  }

  async findCustomerByProviderCustomerId(
    providerCustomerId: string,
    session?: ClientSession,
  ): Promise<IBillingCustomerDocument | null> {
    return BillingCustomerModel.findOne({
      provider: 'stripe',
      providerCustomerId,
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async upsertCustomer(
    input: CustomerInput,
    session?: ClientSession,
  ): Promise<IBillingCustomerDocument> {
    const update: Record<string, unknown> = {
      provider: 'stripe',
      deletedAt: undefined,
    };
    if (input.providerCustomerId !== undefined) update.providerCustomerId = input.providerCustomerId;
    if (input.defaultPaymentMethodId !== undefined) update.defaultPaymentMethodId = input.defaultPaymentMethodId;

    const doc = await BillingCustomerModel.findOneAndUpdate(
      { userId: input.userId, provider: 'stripe' },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();

    if (!doc) throw new Error('Failed to upsert billing customer.');
    return doc;
  }

  async markCustomerSynced(
    customerId: Types.ObjectId,
    syncedAt: Date,
    session?: ClientSession,
  ): Promise<void> {
    await BillingCustomerModel.updateOne(
      { _id: customerId },
      { $set: { lastProviderSyncAt: syncedAt } },
      optionalSession(session),
    ).exec();
  }

  async upsertPlan(input: PlanInput, session?: ClientSession): Promise<IBillingPlanDocument> {
    const doc = await BillingPlanModel.findOneAndUpdate(
      { code: input.code, billingCycle: input.billingCycle, currency: input.currency.toLowerCase() },
      {
        $set: {
          ...input,
          provider: 'stripe',
          currency: input.currency.toLowerCase(),
          deletedAt: undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();
    if (!doc) throw new Error('Failed to upsert billing plan.');
    return doc;
  }

  async listActivePlans(session?: ClientSession): Promise<IBillingPlanDocument[]> {
    return BillingPlanModel.find({ active: true, deletedAt: { $exists: false } })
      .sort({ code: 1, billingCycle: 1 })
      .session(session ?? null)
      .exec();
  }

  async findLatestSubscriptionByUserId(
    userId: Types.ObjectId,
    statuses?: Exclude<BillingSubscriptionStatus, 'NONE'>[],
    session?: ClientSession,
  ): Promise<IBillingSubscriptionDocument | null> {
    const filter: FilterQuery<IBillingSubscriptionDocument> = {
      userId,
      deletedAt: { $exists: false },
    };
    if (statuses && statuses.length > 0) {
      filter.status = { $in: statuses };
    }

    return BillingSubscriptionModel.findOne(filter)
      .sort({ currentPeriodEnd: -1, createdAt: -1 })
      .session(session ?? null)
      .exec();
  }

  async hasUsedTrialForPlan(
    userId: Types.ObjectId,
    planCode: BillingPlanId,
    session?: ClientSession,
  ): Promise<boolean> {
    const doc = await BillingSubscriptionModel.findOne({
      userId,
      planCode,
      deletedAt: { $exists: false },
      $or: [
        { trialStart: { $exists: true, $ne: null } },
        { trialEnd: { $exists: true, $ne: null } },
        { status: 'TRIALING' },
      ],
    })
      .select({ _id: 1 })
      .session(session ?? null)
      .lean()
      .exec();

    return Boolean(doc);
  }

  async findSubscriptionById(
    subscriptionId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingSubscriptionDocument | null> {
    return BillingSubscriptionModel.findOne({
      _id: subscriptionId,
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async findSubscriptionByProviderId(
    providerSubscriptionId: string,
    session?: ClientSession,
  ): Promise<IBillingSubscriptionDocument | null> {
    return BillingSubscriptionModel.findOne({
      provider: 'stripe',
      providerSubscriptionId,
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async upsertSubscription(
    input: SubscriptionInput,
    session?: ClientSession,
  ): Promise<IBillingSubscriptionDocument> {
    const filter = input.providerSubscriptionId
      ? { provider: 'stripe', providerSubscriptionId: input.providerSubscriptionId }
      : { customerId: input.customerId, status: { $ne: 'CANCELED' }, planCode: input.planCode };

    const doc = await BillingSubscriptionModel.findOneAndUpdate(
      filter,
      {
        $set: {
          ...input,
          provider: 'stripe',
          currency: input.currency.toLowerCase(),
          cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
          deletedAt: undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();
    if (!doc) throw new Error('Failed to upsert billing subscription.');
    return doc;
  }

  async updateSubscriptionState(
    subscriptionId: Types.ObjectId,
    status: Exclude<BillingSubscriptionStatus, 'NONE'>,
    fields: Partial<Pick<IBillingSubscriptionDocument, 'cancelAtPeriodEnd' | 'canceledAt' | 'pausedAt' | 'endedAt' | 'currentPeriodStart' | 'currentPeriodEnd'>> = {},
    session?: ClientSession,
  ): Promise<IBillingSubscriptionDocument | null> {
    return BillingSubscriptionModel.findByIdAndUpdate(
      subscriptionId,
      { $set: { status, ...fields } },
      { new: true, ...optionalSession(session) },
    ).exec();
  }

  async listActiveSubscriptions(session?: ClientSession): Promise<IBillingSubscriptionDocument[]> {
    return BillingSubscriptionModel.find({
      status: { $in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async listPaymentMethods(
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingPaymentMethodDocument[]> {
    return BillingPaymentMethodModel.find({
      userId,
      status: 'ACTIVE',
      deletedAt: { $exists: false },
    })
      .sort({ isDefault: -1, createdAt: -1 })
      .session(session ?? null)
      .exec();
  }

  async findPaymentMethodById(
    paymentMethodId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingPaymentMethodDocument | null> {
    return BillingPaymentMethodModel.findOne({
      _id: paymentMethodId,
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async upsertPaymentMethod(
    input: PaymentMethodInput,
    session?: ClientSession,
  ): Promise<IBillingPaymentMethodDocument> {
    const doc = await BillingPaymentMethodModel.findOneAndUpdate(
      { provider: 'stripe', providerPaymentMethodId: input.providerPaymentMethodId },
      {
        $set: {
          ...input,
          provider: 'stripe',
          isDefault: input.isDefault ?? false,
          status: 'ACTIVE',
          deletedAt: undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();
    if (!doc) throw new Error('Failed to upsert billing payment method.');
    return doc;
  }

  async setDefaultPaymentMethod(
    customerId: Types.ObjectId,
    paymentMethodId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await BillingPaymentMethodModel.updateMany(
      { customerId },
      { $set: { isDefault: false } },
      optionalSession(session),
    ).exec();
    await BillingPaymentMethodModel.updateOne(
      { _id: paymentMethodId, customerId },
      { $set: { isDefault: true } },
      optionalSession(session),
    ).exec();
    await BillingCustomerModel.updateOne(
      { _id: customerId },
      { $set: { defaultPaymentMethodId: paymentMethodId } },
      optionalSession(session),
    ).exec();
  }

  async detachPaymentMethod(
    paymentMethodId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await BillingPaymentMethodModel.updateOne(
      { _id: paymentMethodId },
      { $set: { status: 'DETACHED', deletedAt: new Date(), isDefault: false } },
      optionalSession(session),
    ).exec();
  }

  async createInvoice(input: InvoiceInput, session?: ClientSession): Promise<IBillingInvoiceDocument> {
    const docs = await BillingInvoiceModel.create([{ ...input, provider: 'stripe', currency: input.currency.toLowerCase() }], optionalSession(session));
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create billing invoice.');
    return doc;
  }

  async upsertInvoice(input: InvoiceInput, session?: ClientSession): Promise<IBillingInvoiceDocument> {
    if (!input.providerInvoiceId) {
      return this.createInvoice(input, session);
    }

    const doc = await BillingInvoiceModel.findOneAndUpdate(
      {
        provider: 'stripe',
        userId: input.userId,
        providerInvoiceId: input.providerInvoiceId,
      },
      {
        $set: {
          ...input,
          provider: 'stripe',
          currency: input.currency.toLowerCase(),
          deletedAt: undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();
    if (!doc) throw new Error('Failed to upsert billing invoice.');
    return doc;
  }

  async createInvoiceLineItem(
    input: InvoiceLineItemInput,
    session?: ClientSession,
  ): Promise<IBillingInvoiceLineItemDocument> {
    const docs = await BillingInvoiceLineItemModel.create([{ ...input, currency: input.currency.toLowerCase() }], optionalSession(session));
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create invoice line item.');
    return doc;
  }

  async listInvoiceLineItems(
    invoiceIds: Types.ObjectId[],
    session?: ClientSession,
  ): Promise<IBillingInvoiceLineItemDocument[]> {
    return BillingInvoiceLineItemModel.find({ invoiceId: { $in: invoiceIds }, deletedAt: { $exists: false } })
      .sort({ createdAt: 1 })
      .session(session ?? null)
      .exec();
  }

  async findInvoiceById(
    invoiceId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingInvoiceDocument | null> {
    return BillingInvoiceModel.findOne({ _id: invoiceId, deletedAt: { $exists: false } })
      .session(session ?? null)
      .exec();
  }

  async listInvoicesByUserId(input: ListInvoicesInput, session?: ClientSession): Promise<ListInvoicesResult> {
    const limit = Math.max(1, Math.min(100, input.limit));
    const filter: FilterQuery<IBillingInvoiceDocument> = {
      userId: input.userId,
      deletedAt: { $exists: false },
    };
    if (input.status) filter.status = input.status;
    if (input.cursor && Types.ObjectId.isValid(input.cursor)) {
      filter._id = { $lt: new Types.ObjectId(input.cursor) };
    }

    const docs = await BillingInvoiceModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .session(session ?? null)
      .exec();
    const items = docs.slice(0, limit);
    const nextCursor = docs.length > limit ? items[items.length - 1]?._id.toString() ?? null : null;
    return { items, nextCursor };
  }

  async getPaidInvoicesYtdTotalMinor(userId: Types.ObjectId, year: number): Promise<number> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const result = await BillingInvoiceModel.aggregate<{ totalPaid: number }>([
      {
        $match: {
          userId,
          // Also catch invoices where Stripe collected payment but hasn't yet
          // transitioned status from 'open' → 'paid' (brief post-checkout window).
          $or: [{ status: 'PAID' }, { amountPaidMinor: { $gt: 0 } }],
          deletedAt: { $exists: false },
        },
      },
      {
        $addFields: {
          effectivePaidAt: {
            // Cap to $$NOW: Stripe test clocks produce future paidAt values.
            // In production paidAt is always past, so $min is a no-op there.
            $min: [
              { $ifNull: ['$paidAt', { $ifNull: ['$providerCreatedAt', '$createdAt'] }] },
              '$$NOW',
            ],
          },
        },
      },
      {
        $match: {
          effectivePaidAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, totalPaid: { $sum: '$amountPaidMinor' } } },
    ]);
    return result[0]?.totalPaid ?? 0;
  }

  async createPayment(input: PaymentInput, session?: ClientSession): Promise<IBillingPaymentDocument> {
    const docs = await BillingPaymentModel.create(
      [{
        ...input,
        provider: 'stripe',
        currency: input.currency.toLowerCase(),
        attemptedAt: input.attemptedAt ?? new Date(),
      }],
      optionalSession(session),
    );
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create billing payment.');
    return doc;
  }

  async findPaymentById(paymentId: Types.ObjectId, session?: ClientSession): Promise<IBillingPaymentDocument | null> {
    return BillingPaymentModel.findOne({ _id: paymentId, deletedAt: { $exists: false } })
      .session(session ?? null)
      .exec();
  }

  async listRecentPayments(session?: ClientSession): Promise<IBillingPaymentDocument[]> {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
    return BillingPaymentModel.find({ attemptedAt: { $gte: since }, deletedAt: { $exists: false } })
      .sort({ attemptedAt: -1 })
      .limit(1000)
      .session(session ?? null)
      .exec();
  }

  async createRefund(input: RefundInput, session?: ClientSession): Promise<IBillingRefundDocument> {
    const docs = await BillingRefundModel.create(
      [{ ...input, provider: 'stripe', currency: input.currency.toLowerCase() }],
      optionalSession(session),
    );
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create billing refund.');
    return doc;
  }

  async createWebhookEvent(
    input: {
      providerEventId: string;
      eventType: string;
      rawPayload: string;
      signature?: string;
      status?: BillingWebhookStatus;
    },
    session?: ClientSession,
  ): Promise<{ doc: IBillingWebhookEventDocument | null; duplicate: boolean }> {
    try {
      const docs = await BillingWebhookEventModel.create(
        [{
          provider: 'stripe',
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          rawPayload: input.rawPayload,
          signature: input.signature,
          status: input.status ?? 'PENDING',
          attempts: 0,
          receivedAt: new Date(),
        }],
        optionalSession(session),
      );
      return { doc: docs[0] ?? null, duplicate: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return { doc: null, duplicate: true };
      }
      throw error;
    }
  }

  async findWebhookEventByProviderId(
    providerEventId: string,
    session?: ClientSession,
  ): Promise<IBillingWebhookEventDocument | null> {
    return BillingWebhookEventModel.findOne({ provider: 'stripe', providerEventId })
      .session(session ?? null)
      .exec();
  }

  async findWebhookEventById(
    id: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBillingWebhookEventDocument | null> {
    return BillingWebhookEventModel.findById(id).session(session ?? null).exec();
  }

  async claimWebhookEvent(
    id: Types.ObjectId,
    workerId: string,
    staleBefore?: Date,
    session?: ClientSession,
  ): Promise<IBillingWebhookEventDocument | null> {
    const retryableStatuses: BillingWebhookStatus[] = ['PENDING', 'FAILED', 'DEAD'];
    const statusFilter: FilterQuery<IBillingWebhookEventDocument> = staleBefore
      ? {
        $or: [
          { status: { $in: retryableStatuses } },
          { status: 'PROCESSING', lockedAt: { $lt: staleBefore } },
        ],
      }
      : { status: { $in: retryableStatuses } };

    return BillingWebhookEventModel.findOneAndUpdate(
      {
        _id: id,
        ...statusFilter,
      },
      {
        $set: {
          status: 'PROCESSING',
          lockedBy: workerId,
          lockedAt: new Date(),
          processingStartedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { new: true, ...optionalSession(session) },
    ).exec();
  }

  async markWebhookEventStatus(
    id: Types.ObjectId,
    status: BillingWebhookStatus,
    error?: string,
    session?: ClientSession,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      processedAt: ['PROCESSED', 'IGNORED', 'DEAD'].includes(status) ? new Date() : undefined,
      lockedBy: undefined,
      lockedAt: undefined,
    };
    if (error) {
      update.lastError = error.slice(0, 2000);
    }
    await BillingWebhookEventModel.updateOne(
      { _id: id },
      { $set: update },
      optionalSession(session),
    ).exec();
  }

  async recordAuditLog(input: AuditLogInput, session?: ClientSession): Promise<IBillingAuditLogDocument> {
    const docs = await BillingAuditLogModel.create(
      [{ ...input, occurredAt: input.occurredAt ?? new Date() }],
      optionalSession(session),
    );
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create billing audit log.');
    return doc;
  }

  async listAuditLogsByCustomer(
    customerId: Types.ObjectId,
    limit: number,
    session?: ClientSession,
  ): Promise<IBillingAuditLogDocument[]> {
    return BillingAuditLogModel.find({ customerId, deletedAt: { $exists: false } })
      .sort({ occurredAt: -1 })
      .limit(Math.max(1, Math.min(200, limit)))
      .session(session ?? null)
      .exec();
  }

  async startIdempotency(
    key: string,
    operation: string,
    requestHash: string,
    expiresAt: Date,
    session?: ClientSession,
  ): Promise<IdempotencyStartResult> {
    try {
      const docs = await BillingIdempotencyKeyModel.create(
        [{ key, operation, requestHash, expiresAt, status: 'IN_PROGRESS' }],
        optionalSession(session),
      );
      const record = docs[0];
      if (!record) throw new Error('Failed to create idempotency key.');
      return { record, existing: false };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const record = await BillingIdempotencyKeyModel.findOne({ key }).session(session ?? null).exec();
      if (!record) throw error;
      return { record, existing: true };
    }
  }

  async completeIdempotency(
    key: string,
    status: 'SUCCEEDED' | 'FAILED',
    response?: JsonObject,
    errorCode?: string,
    session?: ClientSession,
  ): Promise<void> {
    await BillingIdempotencyKeyModel.updateOne(
      { key },
      { $set: { status, response, errorCode } },
      optionalSession(session),
    ).exec();
  }

  async findCouponByCode(code: string, session?: ClientSession): Promise<IBillingCouponDocument | null> {
    return BillingCouponModel.findOne({
      code: code.toUpperCase(),
      active: true,
      deletedAt: { $exists: false },
    })
      .session(session ?? null)
      .exec();
  }

  async createDiscount(
    input: {
      couponId: Types.ObjectId;
      customerId: Types.ObjectId;
      subscriptionId?: Types.ObjectId;
      invoiceId?: Types.ObjectId;
      amountMinor: number;
      currency: string;
    },
    session?: ClientSession,
  ): Promise<void> {
    await BillingDiscountModel.create(
      [{ ...input, currency: input.currency.toLowerCase(), appliedAt: new Date() }],
      optionalSession(session),
    );
    await BillingCouponModel.updateOne(
      { _id: input.couponId },
      { $inc: { redeemedCount: 1 } },
      optionalSession(session),
    ).exec();
  }

  async createUsageRecord(
    input: {
      userId: Types.ObjectId;
      customerId?: Types.ObjectId;
      subscriptionId?: Types.ObjectId;
      meterKey: string;
      quantity: number;
      idempotencyKey: string;
      occurredAt: Date;
      metadata?: JsonObject;
    },
    session?: ClientSession,
  ): Promise<IBillingUsageRecordDocument> {
    const docs = await BillingUsageRecordModel.create([input], optionalSession(session));
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create usage record.');
    return doc;
  }

  async createDunningAttempt(
    input: {
      subscriptionId: Types.ObjectId;
      invoiceId?: Types.ObjectId;
      customerId: Types.ObjectId;
      userId: Types.ObjectId;
      day: number;
      scheduledAt: Date;
    },
    session?: ClientSession,
  ): Promise<IBillingDunningAttemptDocument> {
    const doc = await BillingDunningAttemptModel.findOneAndUpdate(
      { subscriptionId: input.subscriptionId, day: input.day },
      { $setOnInsert: { ...input, status: 'SCHEDULED' } },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...optionalSession(session) },
    ).exec();
    if (!doc) throw new Error('Failed to create dunning attempt.');
    return doc;
  }

  async listDueDunningAttempts(now: Date, session?: ClientSession): Promise<IBillingDunningAttemptDocument[]> {
    return BillingDunningAttemptModel.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now },
      deletedAt: { $exists: false },
    })
      .sort({ scheduledAt: 1 })
      .limit(200)
      .session(session ?? null)
      .exec();
  }

  async updateDunningAttempt(
    id: Types.ObjectId,
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELED',
    errorCode?: string,
    session?: ClientSession,
  ): Promise<void> {
    await BillingDunningAttemptModel.updateOne(
      { _id: id },
      { $set: { status, attemptedAt: new Date(), errorCode } },
      optionalSession(session),
    ).exec();
  }

  async createReconciliationAlert(
    input: ReconciliationAlertInput,
    session?: ClientSession,
  ): Promise<IBillingReconciliationAlertDocument> {
    const docs = await BillingReconciliationAlertModel.create(
      [{ ...input, status: 'OPEN' }],
      optionalSession(session),
    );
    const doc = docs[0];
    if (!doc) throw new Error('Failed to create reconciliation alert.');
    return doc;
  }

  async listOpenReconciliationAlerts(
    limit: number,
    session?: ClientSession,
  ): Promise<IBillingReconciliationAlertDocument[]> {
    return BillingReconciliationAlertModel.find({ status: 'OPEN', deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(500, limit)))
      .session(session ?? null)
      .exec();
  }
}

export const billingRepository = new BillingRepository();
