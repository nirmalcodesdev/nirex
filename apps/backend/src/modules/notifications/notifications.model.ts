import mongoose, { Document, Schema, Types } from 'mongoose';
import type { NotificationKind, NotificationSeverity } from '@nirex/shared';

export interface INotificationDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  readAt?: Date;
  archivedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['system', 'billing', 'usage', 'security', 'project'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      required: true,
      default: 'info',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    actionUrl: {
      type: String,
      required: false,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
    dedupeKey: {
      type: String,
      required: false,
      trim: true,
      maxlength: 120,
      index: true,
    },
    readAt: {
      type: Date,
      required: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      required: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, archivedAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: { $type: 'string' },
    },
  },
);

// Automatic cleanup for expiring notifications.
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<INotificationDocument>) ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
