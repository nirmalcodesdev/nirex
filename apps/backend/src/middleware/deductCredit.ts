import mongoose, { Types } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { getPlanRequestQuota } from '@nirex/shared';
import { UserModel } from '../modules/user/user.model.js';
import { CreditTransactionModel } from '../modules/billing/billing.model.js';
import { AppError } from '../types/index.js';

/**
 * Atomically deducts 1 credit from the user on every API request.
 *
 * Deduction logic (per spec):
 *   1. Quota check: if plan != 'max' AND topupBalance == 0, enforce monthly request quota.
 *   2. Deduct from includedCredits first, then topupBalance.
 *   3. If both are 0, reject the request.
 *   4. Increment monthlyRequestCount.
 *   5. Log a CreditTransaction record.
 *
 * All steps run inside a MongoDB session transaction so that concurrent
 * requests cannot double-deduct or bypass the quota check.
 */
export async function deductCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    throw new AppError('Unauthenticated.', 401, 'UNAUTHENTICATED');
  }

  const userId = new Types.ObjectId(req.userId);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Lock the user document for this transaction
      const user = await UserModel.findById(userId).session(session).exec();
      if (!user) {
        throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
      }

      const planId = user.planId ?? 'free';
      const requestQuota = getPlanRequestQuota(planId);

      // Step 1: Quota check — only enforced when topupBalance is 0 and plan is not 'max'
      if (planId !== 'max' && user.topupBalance === 0) {
        if (user.monthlyRequestCount >= requestQuota) {
          throw new AppError(
            'Monthly request limit reached. Top up to continue.',
            429,
            'QUOTA_EXCEEDED',
          );
        }
      }

      // Step 2: Determine which credit bucket to deduct from
      let source: 'included' | 'topup';
      if (user.includedCredits > 0) {
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

      const includedCreditsBefore = user.includedCredits;
      const topupBalanceBefore = user.topupBalance;

      // Step 3: Atomic deduct + increment request counter
      const updateFields =
        source === 'included'
          ? { $inc: { includedCredits: -1, monthlyRequestCount: 1 } }
          : { $inc: { topupBalance: -1, monthlyRequestCount: 1 } };

      await UserModel.updateOne({ _id: userId }, updateFields, { session }).exec();

      // Step 4: Log the credit transaction
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
