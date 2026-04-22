import mongoose, { Document, Schema, Types } from 'mongoose';

export type UsageEventType =
  | 'compute_hours'
  | 'storage_gb'
  | 'bandwidth_gb'
  | 'edge_requests'
  | 'response_time_ms';

export interface IUsageEventDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  project_id?: string;
  event_type: UsageEventType;
  quantity: number;
  timestamp: Date;
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
    event_type: {
      type: String,
      required: true,
      enum: [
        'compute_hours',
        'storage_gb',
        'bandwidth_gb',
        'edge_requests',
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

export const UsageEventModel =
  (mongoose.models.UsageEvent as mongoose.Model<IUsageEventDocument>) ||
  mongoose.model<IUsageEventDocument>('UsageEvent', UsageEventSchema);
