import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuotaBucketDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  period_start: Date;
  period_end: Date;
  limit_credits: number;
  used_credits: number;
  created_at: Date;
  updated_at: Date;
}

export type QuotaDebitStatus = 'committed' | 'refunded';

export interface IQuotaDebitDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  bucket_id: Types.ObjectId;
  period_start: Date;
  period_end: Date;
  idempotency_key: string;
  credits: number;
  status: QuotaDebitStatus;
  refunded_at?: Date;
  refund_reason?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const QuotaBucketSchema = new Schema<IQuotaBucketDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    period_start: {
      type: Date,
      required: true,
    },
    period_end: {
      type: Date,
      required: true,
    },
    limit_credits: {
      type: Number,
      required: true,
      min: 0,
    },
    used_credits: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

QuotaBucketSchema.index(
  { user_id: 1, period_start: 1 },
  { unique: true }
);
QuotaBucketSchema.index({ user_id: 1, period_end: 1 });

const QuotaDebitSchema = new Schema<IQuotaDebitDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bucket_id: {
      type: Schema.Types.ObjectId,
      ref: 'QuotaBucket',
      required: true,
      index: true,
    },
    period_start: {
      type: Date,
      required: true,
    },
    period_end: {
      type: Date,
      required: true,
    },
    idempotency_key: {
      type: String,
      required: true,
      maxlength: 300,
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ['committed', 'refunded'],
      default: 'committed',
      index: true,
    },
    refunded_at: {
      type: Date,
      required: false,
    },
    refund_reason: {
      type: String,
      required: false,
      maxlength: 200,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

QuotaDebitSchema.index(
  { user_id: 1, idempotency_key: 1 },
  { unique: true }
);
QuotaDebitSchema.index({ user_id: 1, period_start: 1, status: 1 });

export const QuotaBucketModel =
  (mongoose.models.QuotaBucket as mongoose.Model<IQuotaBucketDocument>) ||
  mongoose.model<IQuotaBucketDocument>('QuotaBucket', QuotaBucketSchema);

export const QuotaDebitModel =
  (mongoose.models.QuotaDebit as mongoose.Model<IQuotaDebitDocument>) ||
  mongoose.model<IQuotaDebitDocument>('QuotaDebit', QuotaDebitSchema);
