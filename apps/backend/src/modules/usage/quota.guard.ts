import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../../types/index.js';
import { usageService } from './usage.service.js';

export interface QuotaStatus {
  creditsUsed: number;
  includedCredits: number;
  remainingCredits: number;
  overQuota: boolean;
}

export async function getQuotaStatus(userId: Types.ObjectId): Promise<QuotaStatus> {
  const overview = await usageService.getOverview(userId, 'month_to_date');
  const creditsUsed = overview.summary.credits_used;
  const includedCredits = overview.current_plan.included_credits;

  return {
    creditsUsed,
    includedCredits,
    remainingCredits: Math.max(0, includedCredits - creditsUsed),
    overQuota: creditsUsed >= includedCredits,
  };
}

export async function assertWithinQuota(userId: Types.ObjectId): Promise<QuotaStatus> {
  const status = await getQuotaStatus(userId);

  if (status.overQuota) {
    throw new AppError(
      'Credit quota exceeded. Upgrade your plan or wait for the next billing period.',
      402,
      'QUOTA_EXCEEDED',
    );
  }

  return status;
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
