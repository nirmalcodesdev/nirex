import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type {
  CreateNotificationRequest,
  ListNotificationsQuery,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { notificationsService } from './notifications.service.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const query = req.query as ListNotificationsQuery;
  const result = await notificationsService.listNotifications(userId, {
    limit: query.limit ?? 20,
    cursor: query.cursor,
    includeRead: query.include_read ?? true,
    includeArchived: query.include_archived ?? false,
    kinds: query.kinds ?? [],
    severities: query.severities ?? [],
  });

  res.json({
    status: 'success',
    data: result,
  });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const unreadCount = await notificationsService.getUnreadCount(userId);
  res.json({
    status: 'success',
    data: {
      unread_count: unreadCount,
    },
  });
}

export async function createNotification(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const body = req.body as CreateNotificationRequest;
  const created = await notificationsService.createNotification(userId, body);
  res.status(201).json({
    status: 'success',
    data: created,
  });
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { notificationId } = req.params as { notificationId: string };
  const notification = await notificationsService.markNotificationRead(userId, notificationId);
  res.json({
    status: 'success',
    data: notification,
  });
}

export async function markNotificationUnread(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { notificationId } = req.params as { notificationId: string };
  const notification = await notificationsService.markNotificationUnread(userId, notificationId);
  res.json({
    status: 'success',
    data: notification,
  });
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const result = await notificationsService.markAllRead(userId);
  res.json({
    status: 'success',
    data: result,
  });
}

export async function archiveNotification(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { notificationId } = req.params as { notificationId: string };
  const notification = await notificationsService.archiveNotification(userId, notificationId);
  res.json({
    status: 'success',
    data: notification,
  });
}
