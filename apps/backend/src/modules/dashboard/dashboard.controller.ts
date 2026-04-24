import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { DashboardOverviewQuery } from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { dashboardService } from './dashboard.service.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const query = req.query as DashboardOverviewQuery;
  const data = await dashboardService.getOverview(userId, {
    usageRange: query.usage_range ?? '30d',
    includeRecentNotifications: query.include_recent_notifications ?? true,
    notificationsLimit: query.notifications_limit ?? 5,
  });

  res.json({
    status: 'success',
    data,
  });
}
