import mongoose, { Document, Schema, Types } from 'mongoose';
import type {
  BillingActorType,
  BillingAuditOutcome,
  BillingCycle,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  BillingPlanId,
  BillingProvider,
  BillingRefundStatus,
  BillingSubscriptionStatus,
  BillingWebhookStatus,
} from '@nirex/shared';

export type {
  BillingActorType,
  BillingAuditOutcome,
  BillingCycle,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  BillingPlanId,
  BillingProvider,
  BillingRefundStatus,
  BillingSubscriptionStatus,
  BillingWebhookStatus,
};

type BillingMetadata = Record<string, unknown>;

export interface SoftDeleteFields {
  deletedAt?: Date;
}

export interface IBillingCustomerDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: BillingProvider;
  providerCustomerId?: string;
  defaultPaymentMethodId?: Types.ObjectId;
  lastProviderSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingPaymentMethodDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: BillingProvider;
  providerPaymentMethodId: string;
  type: 'card' | 'bank_account' | 'wallet' | 'unknown';
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  funding?: string;
  isDefault: boolean;
  status: 'ACTIVE' | 'DETACHED';
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingPlanDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  code: BillingPlanId;
  name: string;
  description: string;
  features: string[];
  includedCredits?: number | null;
  trialDays: number;
  currency: string;
  amountMinor: number;
  billingCycle: BillingCycle;
  provider: BillingProvider;
  providerProductId?: string;
  providerPriceId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingSubscriptionDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  planCode: BillingPlanId;
  billingCycle: BillingCycle;
  status: Exclude<BillingSubscriptionStatus, 'NONE'>;
  provider: BillingProvider;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  currency: string;
  amountMinor: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  pausedAt?: Date;
  endedAt?: Date;
  latestInvoiceId?: Types.ObjectId;
  metadata?: BillingMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingInvoiceDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  provider: BillingProvider;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingInvoiceLineItemDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingPaymentDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  paymentMethodId?: Types.ObjectId;
  provider: BillingProvider;
  providerPaymentId?: string;
  idempotencyKey: string;
  status: BillingPaymentStatus;
  amountMinor: number;
  currency: string;
  failureCode?: string;
  failureMessage?: string;
  requiresActionUrl?: string;
  attemptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingRefundDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: BillingProvider;
  providerRefundId?: string;
  idempotencyKey: string;
  status: BillingRefundStatus;
  amountMinor: number;
  currency: string;
  reason?: string;
  requestedByActorType: BillingActorType;
  requestedByActorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingWebhookEventDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  rawPayload: string;
  signature?: string;
  status: BillingWebhookStatus;
  attempts: number;
  receivedAt: Date;
  nextRetryAt?: Date;
  processingStartedAt?: Date;
  processedAt?: Date;
  lastError?: string;
  lockedBy?: string;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingAuditLogDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  actorType: BillingActorType;
  actorId?: string;
  action: string;
  outcome: BillingAuditOutcome;
  before?: BillingMetadata;
  after?: BillingMetadata;
  metadata?: BillingMetadata;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  errorCode?: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingUsageRecordDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  meterKey: string;
  quantity: number;
  idempotencyKey: string;
  occurredAt: Date;
  aggregatedAt?: Date;
  metadata?: BillingMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingCouponDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  percentOff?: number;
  amountOffMinor?: number;
  currency?: string;
  maxRedemptions?: number;
  redeemedCount: number;
  expiresAt?: Date;
  active: boolean;
  singleUse: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingDiscountDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  couponId: Types.ObjectId;
  customerId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  amountMinor: number;
  currency: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingTaxRateDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  jurisdiction: string;
  displayName: string;
  percentageBasisPoints: number;
  inclusiveMode: 'INCLUSIVE' | 'EXCLUSIVE';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingIdempotencyKeyDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  key: string;
  operation: string;
  requestHash: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  response?: BillingMetadata;
  errorCode?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingDunningAttemptDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  customerId: Types.ObjectId;
  userId: Types.ObjectId;
  day: number;
  status: 'SCHEDULED' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  scheduledAt: Date;
  attemptedAt?: Date;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingReconciliationAlertDocument extends Document<Types.ObjectId>, SoftDeleteFields {
  _id: Types.ObjectId;
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  diff: BillingMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const jsonMixed = { type: Schema.Types.Mixed, required: false };
const softDeleteFields = {
  deletedAt: { type: Date, required: false, index: true },
};

const BillingCustomerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerCustomerId: { type: String, required: false, trim: true },
    defaultPaymentMethodId: { type: Schema.Types.ObjectId, ref: 'BillingPaymentMethod', required: false },
    lastProviderSyncAt: { type: Date, required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingCustomerSchema.index({ userId: 1, provider: 1 }, { unique: true });
BillingCustomerSchema.index(
  { provider: 1, providerCustomerId: 1 },
  { unique: true, partialFilterExpression: { providerCustomerId: { $type: 'string' } } },
);

const BillingPaymentMethodSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerPaymentMethodId: { type: String, required: true, trim: true },
    type: { type: String, enum: ['card', 'bank_account', 'wallet', 'unknown'], required: true, default: 'unknown' },
    brand: { type: String, required: false, trim: true },
    last4: { type: String, required: false, trim: true, minlength: 4, maxlength: 4 },
    expMonth: { type: Number, required: false, min: 1, max: 12 },
    expYear: { type: Number, required: false, min: 2000, max: 9999 },
    funding: { type: String, required: false, trim: true },
    isDefault: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ['ACTIVE', 'DETACHED'], required: true, default: 'ACTIVE' },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingPaymentMethodSchema.index({ customerId: 1, isDefault: 1 });
BillingPaymentMethodSchema.index({ provider: 1, providerPaymentMethodId: 1 }, { unique: true });

const BillingPlanSchema = new Schema(
  {
    code: { type: String, enum: ['free', 'pro', 'enterprise', 'custom'], required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    features: { type: [String], required: true, default: [] },
    includedCredits: { type: Number, required: false },
    trialDays: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    amountMinor: { type: Number, required: true, min: 0 },
    billingCycle: { type: String, enum: ['month', 'year'], required: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerProductId: { type: String, required: false, trim: true },
    providerPriceId: { type: String, required: false, trim: true },
    active: { type: Boolean, required: true, default: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingPlanSchema.index({ code: 1, billingCycle: 1, currency: 1 }, { unique: true });
BillingPlanSchema.index({ active: 1, code: 1 });

const BillingSubscriptionSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planCode: { type: String, enum: ['free', 'pro', 'enterprise', 'custom'], required: true, index: true },
    billingCycle: { type: String, enum: ['month', 'year'], required: true },
    status: { type: String, enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'PAUSED', 'CANCELED'], required: true, index: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerSubscriptionId: { type: String, required: false, trim: true },
    providerPriceId: { type: String, required: false, trim: true },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    amountMinor: { type: Number, required: true, min: 0 },
    cancelAtPeriodEnd: { type: Boolean, required: true, default: false },
    currentPeriodStart: { type: Date, required: false },
    currentPeriodEnd: { type: Date, required: false, index: true },
    trialStart: { type: Date, required: false },
    trialEnd: { type: Date, required: false, index: true },
    canceledAt: { type: Date, required: false },
    pausedAt: { type: Date, required: false },
    endedAt: { type: Date, required: false },
    latestInvoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: false },
    metadata: jsonMixed,
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingSubscriptionSchema.index({ userId: 1, status: 1, currentPeriodEnd: -1 });
BillingSubscriptionSchema.index(
  { provider: 1, providerSubscriptionId: 1 },
  { unique: true, partialFilterExpression: { providerSubscriptionId: { $type: 'string' } } },
);

const BillingInvoiceSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerInvoiceId: { type: String, required: false, trim: true, index: true },
    invoiceNumber: { type: String, required: false, trim: true, index: true },
    description: { type: String, required: false, trim: true },
    status: { type: String, enum: ['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'], required: true, index: true },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    subtotalMinor: { type: Number, required: true, min: 0, default: 0 },
    taxMinor: { type: Number, required: true, min: 0, default: 0 },
    discountMinor: { type: Number, required: true, min: 0, default: 0 },
    totalMinor: { type: Number, required: true, min: 0, default: 0 },
    amountDueMinor: { type: Number, required: true, min: 0, default: 0 },
    amountPaidMinor: { type: Number, required: true, min: 0, default: 0 },
    amountRemainingMinor: { type: Number, required: true, min: 0, default: 0 },
    hostedInvoiceUrl: { type: String, required: false },
    invoicePdfUrl: { type: String, required: false },
    dueAt: { type: Date, required: false, index: true },
    paidAt: { type: Date, required: false, index: true },
    periodStart: { type: Date, required: false },
    periodEnd: { type: Date, required: false },
    providerCreatedAt: { type: Date, required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingInvoiceSchema.index({ userId: 1, createdAt: -1 });
BillingInvoiceSchema.index({ userId: 1, status: 1, createdAt: -1 });

const BillingInvoiceLineItemSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitAmountMinor: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    planCode: { type: String, enum: ['free', 'pro', 'enterprise', 'custom'], required: false },
    usageRecordId: { type: Schema.Types.ObjectId, ref: 'BillingUsageRecord', required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingInvoiceLineItemSchema.index({ invoiceId: 1, createdAt: 1 });

const BillingPaymentSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: false, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentMethodId: { type: Schema.Types.ObjectId, ref: 'BillingPaymentMethod', required: false },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerPaymentId: { type: String, required: false, trim: true },
    idempotencyKey: { type: String, required: true, trim: true, immutable: true },
    status: { type: String, enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'REQUIRES_ACTION', 'REFUNDED', 'PARTIALLY_REFUNDED'], required: true, index: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    failureCode: { type: String, required: false, trim: true },
    failureMessage: { type: String, required: false, trim: true },
    requiresActionUrl: { type: String, required: false },
    attemptedAt: { type: Date, required: true, default: Date.now, index: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingPaymentSchema.index({ provider: 1, providerPaymentId: 1 });
BillingPaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
BillingPaymentSchema.index({ userId: 1, attemptedAt: -1 });

const BillingRefundSchema = new Schema(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'BillingPayment', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerRefundId: { type: String, required: false, trim: true },
    idempotencyKey: { type: String, required: true, trim: true, immutable: true },
    status: { type: String, enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED'], required: true, index: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    reason: { type: String, required: false, trim: true },
    requestedByActorType: { type: String, enum: ['USER', 'ADMIN', 'SYSTEM', 'WEBHOOK', 'JOB', 'API_KEY'], required: true },
    requestedByActorId: { type: String, required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingRefundSchema.index({ idempotencyKey: 1 }, { unique: true });
BillingRefundSchema.index({ userId: 1, createdAt: -1 });

const BillingWebhookEventSchema = new Schema(
  {
    provider: { type: String, enum: ['stripe'], required: true, default: 'stripe' },
    providerEventId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true, index: true },
    rawPayload: { type: String, required: true },
    signature: { type: String, required: false },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD', 'IGNORED'], required: true, default: 'PENDING', index: true },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    receivedAt: { type: Date, required: true, default: Date.now, index: true },
    nextRetryAt: { type: Date, required: false, index: true },
    processingStartedAt: { type: Date, required: false },
    processedAt: { type: Date, required: false },
    lastError: { type: String, required: false },
    lockedBy: { type: String, required: false },
    lockedAt: { type: Date, required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingWebhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
BillingWebhookEventSchema.index({ status: 1, nextRetryAt: 1, receivedAt: 1 });

const BillingAuditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: false, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: false, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'BillingPayment', required: false, index: true },
    actorType: { type: String, enum: ['USER', 'ADMIN', 'SYSTEM', 'WEBHOOK', 'JOB', 'API_KEY'], required: true, index: true },
    actorId: { type: String, required: false },
    action: { type: String, required: true, trim: true, index: true },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'IGNORED'], required: true, index: true },
    before: jsonMixed,
    after: jsonMixed,
    metadata: jsonMixed,
    ip: { type: String, required: false },
    userAgent: { type: String, required: false },
    requestId: { type: String, required: false },
    errorCode: { type: String, required: false },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingAuditLogSchema.index({ customerId: 1, occurredAt: -1 });
BillingAuditLogSchema.index({ userId: 1, occurredAt: -1 });

const BillingUsageRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: false, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    meterKey: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: true, trim: true, immutable: true },
    occurredAt: { type: Date, required: true, index: true },
    aggregatedAt: { type: Date, required: false, index: true },
    metadata: jsonMixed,
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingUsageRecordSchema.index({ idempotencyKey: 1 }, { unique: true });
BillingUsageRecordSchema.index({ userId: 1, meterKey: 1, occurredAt: -1 });

const BillingCouponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
    type: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
    percentOff: { type: Number, required: false, min: 1, max: 100 },
    amountOffMinor: { type: Number, required: false, min: 0 },
    currency: { type: String, required: false, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    maxRedemptions: { type: Number, required: false, min: 1 },
    redeemedCount: { type: Number, required: true, min: 0, default: 0 },
    expiresAt: { type: Date, required: false, index: true },
    active: { type: Boolean, required: true, default: true },
    singleUse: { type: Boolean, required: true, default: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

const BillingDiscountSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'BillingCoupon', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: false, index: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 3 },
    appliedAt: { type: Date, required: true, default: Date.now, index: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

const BillingTaxRateSchema = new Schema(
  {
    jurisdiction: { type: String, required: true, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    percentageBasisPoints: { type: Number, required: true, min: 0 },
    inclusiveMode: { type: String, enum: ['INCLUSIVE', 'EXCLUSIVE'], required: true, default: 'EXCLUSIVE' },
    active: { type: Boolean, required: true, default: true, index: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingTaxRateSchema.index({ jurisdiction: 1, active: 1 });

const BillingIdempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true, trim: true, unique: true, index: true },
    operation: { type: String, required: true, trim: true, index: true },
    requestHash: { type: String, required: true, trim: true },
    status: { type: String, enum: ['IN_PROGRESS', 'SUCCEEDED', 'FAILED'], required: true, default: 'IN_PROGRESS', index: true },
    response: jsonMixed,
    errorCode: { type: String, required: false },
    expiresAt: { type: Date, required: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingIdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BillingDunningAttemptSchema = new Schema(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'BillingInvoice', required: false, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    day: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['SCHEDULED', 'SUCCEEDED', 'FAILED', 'CANCELED'], required: true, default: 'SCHEDULED', index: true },
    scheduledAt: { type: Date, required: true, index: true },
    attemptedAt: { type: Date, required: false },
    errorCode: { type: String, required: false },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingDunningAttemptSchema.index({ subscriptionId: 1, day: 1 }, { unique: true });
BillingDunningAttemptSchema.index({ status: 1, scheduledAt: 1 });

const BillingReconciliationAlertSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer', required: false, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription', required: false, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'BillingPayment', required: false, index: true },
    severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], required: true, default: 'WARNING', index: true },
    status: { type: String, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], required: true, default: 'OPEN', index: true },
    diff: { type: Schema.Types.Mixed, required: true },
    ...softDeleteFields,
  },
  { timestamps: true },
);

BillingReconciliationAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });

export const BillingCustomerModel = (mongoose.models.BillingCustomer ||
  mongoose.model<IBillingCustomerDocument>('BillingCustomer', BillingCustomerSchema)) as mongoose.Model<IBillingCustomerDocument>;

export const BillingPaymentMethodModel = (mongoose.models.BillingPaymentMethod ||
  mongoose.model<IBillingPaymentMethodDocument>('BillingPaymentMethod', BillingPaymentMethodSchema)) as mongoose.Model<IBillingPaymentMethodDocument>;

export const BillingPlanModel = (mongoose.models.BillingPlan ||
  mongoose.model<IBillingPlanDocument>('BillingPlan', BillingPlanSchema)) as mongoose.Model<IBillingPlanDocument>;

export const BillingSubscriptionModel = (mongoose.models.BillingSubscription ||
  mongoose.model<IBillingSubscriptionDocument>('BillingSubscription', BillingSubscriptionSchema)) as mongoose.Model<IBillingSubscriptionDocument>;

export const BillingInvoiceModel = (mongoose.models.BillingInvoice ||
  mongoose.model<IBillingInvoiceDocument>('BillingInvoice', BillingInvoiceSchema)) as mongoose.Model<IBillingInvoiceDocument>;

export const BillingInvoiceLineItemModel = (mongoose.models.BillingInvoiceLineItem ||
  mongoose.model<IBillingInvoiceLineItemDocument>('BillingInvoiceLineItem', BillingInvoiceLineItemSchema)) as mongoose.Model<IBillingInvoiceLineItemDocument>;

export const BillingPaymentModel = (mongoose.models.BillingPayment ||
  mongoose.model<IBillingPaymentDocument>('BillingPayment', BillingPaymentSchema)) as mongoose.Model<IBillingPaymentDocument>;

export const BillingRefundModel = (mongoose.models.BillingRefund ||
  mongoose.model<IBillingRefundDocument>('BillingRefund', BillingRefundSchema)) as mongoose.Model<IBillingRefundDocument>;

export const BillingWebhookEventModel = (mongoose.models.BillingWebhookEvent ||
  mongoose.model<IBillingWebhookEventDocument>('BillingWebhookEvent', BillingWebhookEventSchema)) as mongoose.Model<IBillingWebhookEventDocument>;

export const BillingAuditLogModel = (mongoose.models.BillingAuditLog ||
  mongoose.model<IBillingAuditLogDocument>('BillingAuditLog', BillingAuditLogSchema)) as mongoose.Model<IBillingAuditLogDocument>;

export const BillingUsageRecordModel = (mongoose.models.BillingUsageRecord ||
  mongoose.model<IBillingUsageRecordDocument>('BillingUsageRecord', BillingUsageRecordSchema)) as mongoose.Model<IBillingUsageRecordDocument>;

export const BillingCouponModel = (mongoose.models.BillingCoupon ||
  mongoose.model<IBillingCouponDocument>('BillingCoupon', BillingCouponSchema)) as mongoose.Model<IBillingCouponDocument>;

export const BillingDiscountModel = (mongoose.models.BillingDiscount ||
  mongoose.model<IBillingDiscountDocument>('BillingDiscount', BillingDiscountSchema)) as mongoose.Model<IBillingDiscountDocument>;

export const BillingTaxRateModel = (mongoose.models.BillingTaxRate ||
  mongoose.model<IBillingTaxRateDocument>('BillingTaxRate', BillingTaxRateSchema)) as mongoose.Model<IBillingTaxRateDocument>;

export const BillingIdempotencyKeyModel = (mongoose.models.BillingIdempotencyKey ||
  mongoose.model<IBillingIdempotencyKeyDocument>('BillingIdempotencyKey', BillingIdempotencyKeySchema)) as mongoose.Model<IBillingIdempotencyKeyDocument>;

export const BillingDunningAttemptModel = (mongoose.models.BillingDunningAttempt ||
  mongoose.model<IBillingDunningAttemptDocument>('BillingDunningAttempt', BillingDunningAttemptSchema)) as mongoose.Model<IBillingDunningAttemptDocument>;

export const BillingReconciliationAlertModel = (mongoose.models.BillingReconciliationAlert ||
  mongoose.model<IBillingReconciliationAlertDocument>('BillingReconciliationAlert', BillingReconciliationAlertSchema)) as mongoose.Model<IBillingReconciliationAlertDocument>;
