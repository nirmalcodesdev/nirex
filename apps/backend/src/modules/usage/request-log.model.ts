import mongoose, { Document, Schema, Types } from 'mongoose';
import type { RequestLogStatus } from '@nirex/shared';

export interface IRequestLogDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  session_id: Types.ObjectId;
  message_id: string;
  timestamp: Date;
  ai_model: string;
  mode: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  timing_ms: number | null;
  status: RequestLogStatus;
  created_at: Date;
  updated_at: Date;
}

const RequestLogSchema = new Schema<IRequestLogDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    message_id: {
      type: String,
      required: true,
      maxlength: 200,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    ai_model: {
      type: String,
      required: true,
      maxlength: 200,
    },
    mode: {
      type: String,
      required: true,
      maxlength: 100,
    },
    input_tokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    output_tokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total_tokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total_cost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    timing_ms: {
      type: Number,
      required: false,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'failed'],
      default: 'success',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Primary query: user's logs sorted by time
RequestLogSchema.index({ user_id: 1, timestamp: -1 });

// Range queries per user
RequestLogSchema.index({ user_id: 1, timestamp: -1, status: 1 });

// Idempotency: one log per message
RequestLogSchema.index(
  { message_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      message_id: { $type: 'string' },
    },
  }
);

export const RequestLogModel =
  (mongoose.models.RequestLog as mongoose.Model<IRequestLogDocument>) ||
  mongoose.model<IRequestLogDocument>('RequestLog', RequestLogSchema);
