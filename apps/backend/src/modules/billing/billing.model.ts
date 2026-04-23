import mongoose, { Document, Schema, Types } from 'mongoose';

export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface PaymentMethodSnapshot {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding?: string | null;
}

export interface IBillingCustomerDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  stripeCustomerId: string;
  email: string;
  name?: string;
  defaultPaymentMethod?: PaymentMethodSnapshot;
  lastStripeSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingSubscriptionDocument extends Document {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingInvoiceDocument extends Document {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingWebhookEventDocument extends Document {
  _id: Types.ObjectId;
  stripeEventId: string;
  eventType: string;
  status: 'processing' | 'processed' | 'failed' | 'ignored';
  attempts: number;
  receivedAt: Date;
  processedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSnapshotSchema = new Schema<PaymentMethodSnapshot>(
  {
    id: { type: String, required: true },
    brand: { type: String, required: true },
    last4: { type: String, required: true },
    expMonth: { type: Number, required: true },
    expYear: { type: Number, required: true },
    funding: { type: String, required: false },
  },
  { _id: false },
);

const BillingCustomerSchema = new Schema<IBillingCustomerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    stripeCustomerId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: false, trim: true },
    defaultPaymentMethod: {
      type: PaymentMethodSnapshotSchema,
      required: false,
    },
    lastStripeSyncAt: { type: Date, required: false },
  },
  { timestamps: true },
);

BillingCustomerSchema.index({ userId: 1 }, { unique: true });
BillingCustomerSchema.index({ stripeCustomerId: 1 }, { unique: true });

const BillingSubscriptionSchema = new Schema<IBillingSubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    stripeCustomerId: { type: String, required: true, index: true },
    stripeSubscriptionId: { type: String, required: true },
    stripePriceId: { type: String, required: false },
    planId: { type: String, required: true },
    billingCycle: {
      type: String,
      enum: ['month', 'year'],
      required: true,
      default: 'month',
    },
    status: {
      type: String,
      enum: [
        'trialing',
        'active',
        'incomplete',
        'incomplete_expired',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ],
      required: true,
    },
    currency: { type: String, required: true, default: 'usd' },
    amountCents: { type: Number, required: true, default: 0 },
    cancelAtPeriodEnd: { type: Boolean, required: true, default: false },
    currentPeriodStart: { type: Date, required: false },
    currentPeriodEnd: { type: Date, required: false },
    canceledAt: { type: Date, required: false },
    endedAt: { type: Date, required: false },
    trialStart: { type: Date, required: false },
    trialEnd: { type: Date, required: false },
    latestInvoiceId: { type: String, required: false },
  },
  { timestamps: true },
);

BillingSubscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });
BillingSubscriptionSchema.index({ userId: 1, createdAt: -1 });

const BillingInvoiceSchema = new Schema<IBillingInvoiceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    stripeCustomerId: { type: String, required: true, index: true },
    stripeInvoiceId: { type: String, required: true },
    stripeSubscriptionId: { type: String, required: false },
    number: { type: String, required: false },
    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'uncollectible', 'void', 'unknown'],
      required: true,
      default: 'unknown',
    },
    currency: { type: String, required: true, default: 'usd' },
    subtotalCents: { type: Number, required: true, default: 0 },
    taxCents: { type: Number, required: true, default: 0 },
    totalCents: { type: Number, required: true, default: 0 },
    amountDueCents: { type: Number, required: true, default: 0 },
    amountPaidCents: { type: Number, required: true, default: 0 },
    amountRemainingCents: { type: Number, required: true, default: 0 },
    hostedInvoiceUrl: { type: String, required: false },
    invoicePdfUrl: { type: String, required: false },
    dueDate: { type: Date, required: false },
    paidAt: { type: Date, required: false },
    periodStart: { type: Date, required: false },
    periodEnd: { type: Date, required: false },
    stripeCreatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

BillingInvoiceSchema.index({ stripeInvoiceId: 1 }, { unique: true });
BillingInvoiceSchema.index({ userId: 1, stripeCreatedAt: -1 });
BillingInvoiceSchema.index({ userId: 1, paidAt: -1 });

const BillingWebhookEventSchema = new Schema<IBillingWebhookEventDocument>(
  {
    stripeEventId: { type: String, required: true },
    eventType: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'processed', 'failed', 'ignored'],
      required: true,
      default: 'processing',
    },
    attempts: { type: Number, required: true, default: 1 },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date, required: false },
    lastError: { type: String, required: false },
  },
  { timestamps: true },
);

BillingWebhookEventSchema.index({ stripeEventId: 1 }, { unique: true });
BillingWebhookEventSchema.index({ status: 1, receivedAt: -1 });

export const BillingCustomerModel = (mongoose.models.BillingCustomer ||
  mongoose.model<IBillingCustomerDocument>(
    'BillingCustomer',
    BillingCustomerSchema,
  )) as mongoose.Model<IBillingCustomerDocument>;

export const BillingSubscriptionModel = (mongoose.models.BillingSubscription ||
  mongoose.model<IBillingSubscriptionDocument>(
    'BillingSubscription',
    BillingSubscriptionSchema,
  )) as mongoose.Model<IBillingSubscriptionDocument>;

export const BillingInvoiceModel = (mongoose.models.BillingInvoice ||
  mongoose.model<IBillingInvoiceDocument>(
    'BillingInvoice',
    BillingInvoiceSchema,
  )) as mongoose.Model<IBillingInvoiceDocument>;

export const BillingWebhookEventModel = (mongoose.models.BillingWebhookEvent ||
  mongoose.model<IBillingWebhookEventDocument>(
    'BillingWebhookEvent',
    BillingWebhookEventSchema,
  )) as mongoose.Model<IBillingWebhookEventDocument>;
