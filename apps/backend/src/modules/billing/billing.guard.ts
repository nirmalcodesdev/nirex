import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../types/index.js';
import { BillingAuthorizationError } from './billing.errors.js';
import { billingRepository } from './billing.repository.js';

type BillingOwnedParam = 'invoiceId' | 'paymentMethodId' | 'subscriptionId';

const cardCandidatePattern = /\b(?:\d[ -]*?){13,19}\b/;

function requireRequestUserId(req: Request): Types.ObjectId {
  if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

function containsRawCardCandidate(value: unknown): boolean {
  if (typeof value === 'string') {
    return cardCandidatePattern.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsRawCardCandidate(item));
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      containsRawCardCandidate(item),
    );
  }
  return false;
}

export function rejectRawCardData(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (containsRawCardCandidate(req.body)) {
    next(
      new AppError(
        'Raw card data is not accepted by this API. Use the hosted payment element.',
        400,
        'RAW_CARD_DATA_REJECTED',
      ),
    );
    return;
  }
  next();
}

export function requireBillingAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const userId = requireRequestUserId(req).toString();
    if (!env.BILLING_ADMIN_USER_IDS.includes(userId)) {
      throw new BillingAuthorizationError('Billing admin access denied.', {
        userId,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function billingOwnerGuard(paramName: BillingOwnedParam) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireRequestUserId(req);
      const rawId = req.params[paramName];
      if (!rawId || !Types.ObjectId.isValid(rawId)) {
        throw new AppError('Billing resource not found.', 404, 'BILLING_RESOURCE_NOT_FOUND');
      }

      const id = new Types.ObjectId(rawId);
      if (paramName === 'invoiceId') {
        const invoice = await billingRepository.findInvoiceById(id);
        if (!invoice || invoice.userId.toString() !== userId.toString()) {
          throw new BillingAuthorizationError('Billing resource access denied.', {
            userId: userId.toString(),
            invoiceId: rawId,
          });
        }
      }

      if (paramName === 'paymentMethodId') {
        const paymentMethod = await billingRepository.findPaymentMethodById(id);
        if (!paymentMethod || paymentMethod.userId.toString() !== userId.toString()) {
          throw new BillingAuthorizationError('Billing resource access denied.', {
            userId: userId.toString(),
            paymentMethodId: rawId,
          });
        }
      }

      if (paramName === 'subscriptionId') {
        const subscription = await billingRepository.findSubscriptionById(id);
        if (!subscription || subscription.userId.toString() !== userId.toString()) {
          throw new BillingAuthorizationError('Billing resource access denied.', {
            userId: userId.toString(),
            subscriptionId: rawId,
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
