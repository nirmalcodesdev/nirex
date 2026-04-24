import { Types } from 'mongoose';
import type { NotificationKind, NotificationSeverity } from '@nirex/shared';
import { NotificationModel, type INotificationDocument } from './notifications.model.js';

interface ListNotificationsInput {
  userId: Types.ObjectId;
  limit: number;
  cursor?: { createdAt: Date; id: Types.ObjectId };
  includeRead: boolean;
  includeArchived: boolean;
  kinds: NotificationKind[];
  severities: NotificationSeverity[];
}

interface CreateNotificationInput {
  userId: Types.ObjectId;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  expiresAt?: Date;
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export class NotificationsRepository {
  async create(input: CreateNotificationInput): Promise<INotificationDocument> {
    const doc = await NotificationModel.create(input);
    return doc;
  }

  async findByUserIdAndDedupeKey(
    userId: Types.ObjectId,
    dedupeKey: string,
  ): Promise<INotificationDocument | null> {
    return NotificationModel.findOne({ userId, dedupeKey }).exec();
  }

  async createWithDedupe(
    input: CreateNotificationInput,
  ): Promise<INotificationDocument> {
    if (!input.dedupeKey) {
      return this.create(input);
    }

    try {
      return await this.create(input);
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      const existing = await this.findByUserIdAndDedupeKey(input.userId, input.dedupeKey);
      if (!existing) throw error;
      return existing;
    }
  }

  async list(input: ListNotificationsInput): Promise<INotificationDocument[]> {
    const filter: {
      userId: Types.ObjectId;
      readAt?: null;
      archivedAt?: null;
      kind?: { $in: NotificationKind[] };
      severity?: { $in: NotificationSeverity[] };
      $or?: Array<{ createdAt: { $lt: Date } } | { createdAt: Date; _id: { $lt: Types.ObjectId } }>;
    } = {
      userId: input.userId,
    };

    if (!input.includeRead) {
      filter.readAt = null;
    }

    if (!input.includeArchived) {
      filter.archivedAt = null;
    }

    if (input.kinds.length > 0) {
      filter.kind = { $in: input.kinds };
    }

    if (input.severities.length > 0) {
      filter.severity = { $in: input.severities };
    }

    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: input.cursor.id } },
      ];
    }

    return NotificationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit)
      .exec();
  }

  async countUnread(userId: Types.ObjectId): Promise<number> {
    return NotificationModel.countDocuments({
      userId,
      readAt: null,
      archivedAt: null,
    }).exec();
  }

  async findByIdAndUserId(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<INotificationDocument | null> {
    return NotificationModel.findOne({ _id: notificationId, userId }).exec();
  }

  async markRead(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
    readAt: Date = new Date(),
  ): Promise<INotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, userId, archivedAt: null },
      { $set: { readAt } },
      { new: true },
    ).exec();
  }

  async markUnread(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<INotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, userId, archivedAt: null },
      { $unset: { readAt: '' } },
      { new: true },
    ).exec();
  }

  async markAllRead(userId: Types.ObjectId, readAt: Date = new Date()): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId, readAt: null, archivedAt: null },
      { $set: { readAt } },
    ).exec();
    return result.modifiedCount;
  }

  async archive(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId,
    archivedAt: Date = new Date(),
  ): Promise<INotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, userId, archivedAt: null },
      { $set: { archivedAt } },
      { new: true },
    ).exec();
  }
}

export const notificationsRepository = new NotificationsRepository();
