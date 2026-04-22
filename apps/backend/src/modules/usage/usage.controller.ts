import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { UsageExportFormat, UsageRange } from '@nirex/shared';
import { usageService } from './usage.service.js';
import { AppError } from '../../types/index.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { range } = req.query as { range: UsageRange };
  const overview = await usageService.getOverview(userId, range);

  res.json({
    status: 'success',
    data: overview,
  });
}

export async function exportOverview(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { range, format } = req.query as {
    range: UsageRange;
    format: UsageExportFormat;
  };

  const report = await usageService.exportOverview(userId, range, format);
  res.setHeader('Content-Type', report.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
  res.send(report.content);
}
