import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../../types/index.js';
import { quotaService, type QuotaStatus } from './quota.service.js';

export async function getQuotaStatus(userId: Types.ObjectId): Promise<QuotaStatus> {
  return quotaService.getStatus(userId);
}

export async function assertWithinQuota(userId: Types.ObjectId): Promise<QuotaStatus> {
  return quotaService.assertWithinQuota(userId);
}

export function quotaGuard(): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
      }

      await assertWithinQuota(new Types.ObjectId(req.userId));
      next();
    } catch (error) {
      next(error);
    }
  };
}
