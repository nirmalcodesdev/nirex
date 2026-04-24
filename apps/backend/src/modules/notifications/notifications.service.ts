import { Types } from 'mongoose';
import type {
  CreateNotificationRequest,
  ListNotificationsResponse,
  NotificationItem,
  ReadAllNotificationsResponse,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { notificationsRepository } from './notifications.repository.js';
import type { INotificationDocument } from './notifications.model.js';
import type { NotificationListInput } from './notifications.types.js';

interface CursorPayload {
  createdAt: string;
  id: string;
}

function toIsoString(value: Date | undefined): string | null {
  return value ? value.toISOString() : null;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (!parsed.createdAt || !parsed.id) {
      throw new Error('Missing cursor fields');
    }
    return parsed;
  } catch {
    throw new AppError('Invalid notifications cursor.', 422, 'INVALID_CURSOR');
  }
}

function mapNotification(doc: INotificationDocument): NotificationItem {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    severity: doc.severity,
    title: doc.title,
    message: doc.message,
    action_url: doc.actionUrl ?? null,
    metadata: (doc.metadata as Record<string, unknown> | undefined) ?? null,
    read_at: toIsoString(doc.readAt),
    archived_at: toIsoString(doc.archivedAt),
    expires_at: toIsoString(doc.expiresAt),
    created_at: doc.createdAt.toISOString(),
  };
}

function parseNotificationId(notificationId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  }
  return new Types.ObjectId(notificationId);
}

export class NotificationsService {
  async listNotifications(
    userId: Types.ObjectId,
    input: NotificationListInput,
  ): Promise<ListNotificationsResponse> {
    const parsedCursor = input.cursor ? decodeCursor(input.cursor) : null;
    if (parsedCursor && !Types.ObjectId.isValid(parsedCursor.id)) {
      throw new AppError('Invalid notifications cursor.', 422, 'INVALID_CURSOR');
    }
    const cursor = parsedCursor
      ? {
        createdAt: new Date(parsedCursor.createdAt),
        id: new Types.ObjectId(parsedCursor.id),
      }
      : undefined;

    if (cursor && Number.isNaN(cursor.createdAt.getTime())) {
      throw new AppError('Invalid notifications cursor.', 422, 'INVALID_CURSOR');
    }

    const limit = Math.min(100, Math.max(1, input.limit));
    const docs = await notificationsRepository.list({
      userId,
      limit: limit + 1,
      cursor,
      includeRead: input.includeRead,
      includeArchived: input.includeArchived,
      kinds: input.kinds,
      severities: input.severities,
    });

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const unreadCount = await notificationsRepository.countUnread(userId);
    const last = page[page.length - 1];

    return {
      items: page.map((doc) => mapNotification(doc)),
      next_cursor: hasMore && last
        ? encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last._id.toString(),
        })
        : null,
      unread_count: unreadCount,
    };
  }

  async getUnreadCount(userId: Types.ObjectId): Promise<number> {
    return notificationsRepository.countUnread(userId);
  }

  async createNotification(
    userId: Types.ObjectId,
    input: CreateNotificationRequest,
  ): Promise<NotificationItem> {
    const expiresAt = input.expires_at ? new Date(input.expires_at) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new AppError('Invalid expires_at value.', 422, 'VALIDATION_ERROR');
    }

    const created = await notificationsRepository.createWithDedupe({
      userId,
      kind: input.kind,
      severity: input.severity ?? 'info',
      title: input.title.trim(),
      message: input.message.trim(),
      actionUrl: input.action_url?.trim(),
      metadata: input.metadata,
      dedupeKey: input.dedupe_key?.trim(),
      expiresAt,
    });

    return mapNotification(created);
  }

  async markNotificationRead(
    userId: Types.ObjectId,
    notificationId: string,
  ): Promise<NotificationItem> {
    const doc = await notificationsRepository.markRead(
      parseNotificationId(notificationId),
      userId,
    );
    if (!doc) {
      throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }
    return mapNotification(doc);
  }

  async markNotificationUnread(
    userId: Types.ObjectId,
    notificationId: string,
  ): Promise<NotificationItem> {
    const doc = await notificationsRepository.markUnread(
      parseNotificationId(notificationId),
      userId,
    );
    if (!doc) {
      throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }
    return mapNotification(doc);
  }

  async markAllRead(userId: Types.ObjectId): Promise<ReadAllNotificationsResponse> {
    const updated = await notificationsRepository.markAllRead(userId);
    return { updated_count: updated };
  }

  async archiveNotification(
    userId: Types.ObjectId,
    notificationId: string,
  ): Promise<NotificationItem> {
    const doc = await notificationsRepository.archive(
      parseNotificationId(notificationId),
      userId,
    );
    if (!doc) {
      throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }
    return mapNotification(doc);
  }
}

export const notificationsService = new NotificationsService();
