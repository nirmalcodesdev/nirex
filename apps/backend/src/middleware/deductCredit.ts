import mongoose, { Types } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { getPlanRequestQuota } from '@nirex/shared';
import { UserModel } from '../modules/user/user.model.js';
import { CreditTransactionModel } from '../modules/billing/billing.model.js';
import { AppError } from '../types/index.js';
import { rollingWindowService } from '../modules/usage/rolling-window.service.js';
import { logger } from '../utils/logger.js';

export async function deductCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    throw new AppError('Unauthenticated.', 401, 'UNAUTHENTICATED');
  }

  const userId = new Types.ObjectId(req.userId);

  const userForPlan = await UserModel.findById(userId)
    .select('planId includedCredits topupBalance')
    .lean()
    .exec();
  if (!userForPlan) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const planId = userForPlan.planId ?? 'free';
  const includedCredits = userForPlan.includedCredits ?? 0;
  const topupBalance = userForPlan.topupBalance ?? 0;

  let forceTopup = false;

  if (includedCredits > 0) {
    const result = await rollingWindowService.checkAndRecord(userId, planId);

    if (!result.allowed) {
      if (topupBalance > 0) {
        forceTopup = true;
        logger.info('Rolling window exceeded, forcing topup deduction.', {
          userId: userId.toString(),
          exceededWindow: result.exceeded,
        });
      } else {
        const window = result.exceeded === '5h' ? '5-hour' : '7-day';
        const retryAfter = result.retryAfterMs;
        if (retryAfter != null) {
          const retryDate = new Date(Date.now() + retryAfter);
          throw new AppError(
            `Request limit reached for the ${window} window. Next slot available at ${retryDate.toISOString()}. Top up to lift this limit.`,
            429,
            'ROLLING_WINDOW_EXCEEDED',
          );
        }
        throw new AppError(
          `Request limit reached for the ${window} window. Top up to lift this limit.`,
          429,
          'ROLLING_WINDOW_EXCEEDED',
        );
      }
    }
  }

  const session = await mongoose.startSession();

  let deductionSource: 'included' | 'topup' = 'included';

  try {
    await session.withTransaction(async () => {
      const user = await UserModel.findById(userId).session(session).exec();
      if (!user) {
        throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
      }

      const currentPlanId = user.planId ?? 'free';
      const requestQuota = getPlanRequestQuota(currentPlanId);

      if (currentPlanId !== 'max' && user.topupBalance === 0) {
        if (user.monthlyRequestCount >= requestQuota) {
          throw new AppError(
            'Monthly request limit reached. Top up to continue.',
            429,
            'QUOTA_EXCEEDED',
          );
        }
      }

      let source: 'included' | 'topup';
      if (forceTopup && user.topupBalance > 0) {
        source = 'topup';
      } else if (user.includedCredits > 0) {
        source = 'included';
      } else if (user.topupBalance > 0) {
        source = 'topup';
      } else {
        throw new AppError(
          'Insufficient credits. Top up or wait for renewal.',
          402,
          'INSUFFICIENT_CREDITS',
        );
      }

      deductionSource = source;

      const includedCreditsBefore = user.includedCredits;
      const topupBalanceBefore = user.topupBalance;

      const updateFields =
        source === 'included'
          ? { $inc: { includedCredits: -1, monthlyRequestCount: 1 } }
          : { $inc: { topupBalance: -1, monthlyRequestCount: 1 } };

      await UserModel.updateOne({ _id: userId }, updateFields, { session }).exec();

      await CreditTransactionModel.create(
        [
          {
            userId,
            amount: -1,
            type: 'usage',
            source,
            includedCreditsBefore,
            topupBalanceBefore,
          },
        ],
        { session },
      );
    });

    next();
  } finally {
    await session.endSession();
  }
}
