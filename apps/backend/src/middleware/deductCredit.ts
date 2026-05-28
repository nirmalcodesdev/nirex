import mongoose, { Types } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { getPlanRequestQuota } from '@nirex/shared';
import { UserModel } from '../modules/user/user.model.js';
import { CreditTransactionModel } from '../modules/billing/billing.model.js';
import { AppError } from '../types/index.js';
import { rollingWindowService } from '../modules/usage/rolling-window.service.js';
import { logger } from '../utils/logger.js';

/**
 * Atomically deducts 1 credit from the user on every API request.
 *
 * Deduction logic:
 *   1. Rolling window check: enforce 5h and 7d rolling window limits when using included credits.
 *   2. Quota check: if plan != 'max' AND topupBalance == 0, enforce monthly request quota.
 *   3. Deduct from includedCredits first, then topupBalance.
 *   4. If both are 0, reject the request.
 *   5. Increment monthlyRequestCount.
 *   6. Log a CreditTransaction record.
 *   7. Record usage in rolling window counters (only when deducted from includedCredits).
 *
 * Rolling window checks use Redis sorted sets for O(log N) performance.
 * Credit deduction runs inside a MongoDB transaction for atomicity.
 */
export async function deductCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    throw new AppError('Unauthenticated.', 401, 'UNAUTHENTICATED');
  }

  const userId = new Types.ObjectId(req.userId);

  const userForPlan = await UserModel.findById(userId).select('planId includedCredits topupBalance').lean().exec();
  if (!userForPlan) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const planId = userForPlan.planId ?? 'free';
  const includedCredits = userForPlan.includedCredits ?? 0;
  const topupBalance = userForPlan.topupBalance ?? 0;

  let forceTopup = false;

  if (includedCredits > 0) {
    try {
      const windowStatus = await rollingWindowService.checkWindow(userId, planId);
      if (windowStatus.exceeded) {
        if (topupBalance > 0) {
          forceTopup = true;
          logger.info('Rolling window exceeded, forcing topup deduction.', {
            userId: userId.toString(),
            exceededWindow: windowStatus.exceededWindow,
          });
        } else {
          const window = windowStatus.exceededWindow === '5h' ? '5-hour' : '7-day';
          const limit = windowStatus.exceededWindow === '5h'
            ? windowStatus.window5h.limit
            : windowStatus.window7d.limit;
          const firstSlotFreesAt = windowStatus.exceededWindow === '5h'
            ? windowStatus.window5h.firstSlotFreesAt
            : windowStatus.window7d.firstSlotFreesAt;

          throw new AppError(
            `Request limit reached for the ${window} window (${limit} requests). First slot frees at ${firstSlotFreesAt.toISOString()}. Top up to lift this limit.`,
            429,
            'ROLLING_WINDOW_EXCEEDED',
          );
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.warn('Rolling window check failed, proceeding with request.', {
        userId: userId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
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

    if (deductionSource === 'included') {
      const idempotencyKey = `req:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
      await rollingWindowService.recordUsage(userId, idempotencyKey).catch((error) => {
        logger.warn('Failed to record rolling window usage after credit deduction.', {
          userId: userId.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }


    next();
  } finally {
    await session.endSession();
  }
}
