import mongoose, { Document, Schema, Types } from 'mongoose';
import { invalidateDashboardOverviewCache } from '../dashboard/dashboard.cache.js';
import { invalidateUsageOverviewCache } from './usage.cache.js';

export type UsageEventType =
  | 'credits'
  | 'requests'
  | 'response_time_ms';

export interface IUsageEventDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  project_id?: string;
  session_id?: Types.ObjectId;
  message_id?: string;
  event_type: UsageEventType;
  quantity: number;
  timestamp: Date;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const UsageEventSchema = new Schema<IUsageEventDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    project_id: {
      type: String,
      required: false,
      maxlength: 200,
    },
    session_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: false,
      index: true,
    },
    message_id: {
      type: String,
      required: false,
      maxlength: 200,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: [
        'credits',
        'requests',
        'response_time_ms',
      ],
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    idempotency_key: {
      type: String,
      required: false,
      maxlength: 300,
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

UsageEventSchema.index({ user_id: 1, timestamp: -1 });
UsageEventSchema.index({ user_id: 1, event_type: 1, timestamp: -1 });
UsageEventSchema.index({ user_id: 1, project_id: 1, event_type: 1, timestamp: -1 });
UsageEventSchema.index({ user_id: 1, session_id: 1, event_type: 1, timestamp: -1 });
UsageEventSchema.index(
  { user_id: 1, event_type: 1, idempotency_key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotency_key: { $type: 'string' },
    },
  }
);

UsageEventSchema.post('save', async (doc: IUsageEventDocument) => {
  await Promise.all([
    invalidateUsageOverviewCache(doc.user_id),
    invalidateDashboardOverviewCache(doc.user_id),
  ]);
});

export const UsageEventModel =
  (mongoose.models.UsageEvent as mongoose.Model<IUsageEventDocument>) ||
  mongoose.model<IUsageEventDocument>('UsageEvent', UsageEventSchema);
