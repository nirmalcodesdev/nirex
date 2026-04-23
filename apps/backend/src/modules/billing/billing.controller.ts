import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type {
  BillingInvoicesQuery,
  CreateCheckoutSessionRequest,
  CreatePortalSessionRequest,
  CancelSubscriptionRequest,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { billingService } from './billing.service.js';
import type {
  CancelSubscriptionInput,
  CreateCheckoutSessionInput,
  CreatePortalSessionInput,
} from './billing.types.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const overview = await billingService.getBillingOverview(userId);

  res.json({
    status: 'success',
    data: overview,
  });
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { limit = 20 } = req.query as BillingInvoicesQuery;
  const invoices = await billingService.listInvoices(userId, limit);

  res.json({
    status: 'success',
    data: invoices,
  });
}

export async function createCheckoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const body = req.body as CreateCheckoutSessionRequest;

  const input: CreateCheckoutSessionInput = {
    planId: body.planId,
    billingCycle: body.billingCycle,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  };

  const session = await billingService.createCheckoutSession(userId, input);

  res.status(201).json({
    status: 'success',
    data: session,
  });
}

export async function createPortalSession(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const body = req.body as CreatePortalSessionRequest;
  const input: CreatePortalSessionInput = {
    returnUrl: body.returnUrl,
  };

  const session = await billingService.createPortalSession(userId, input);
  res.status(201).json({
    status: 'success',
    data: session,
  });
}

export async function cancelSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const body = req.body as CancelSubscriptionRequest;
  const input: CancelSubscriptionInput = {
    atPeriodEnd: body.atPeriodEnd ?? true,
  };

  const subscription = await billingService.cancelSubscription(userId, input);

  res.json({
    status: 'success',
    data: subscription,
  });
}

export async function resumeSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const subscription = await billingService.resumeSubscription(userId);

  res.json({
    status: 'success',
    data: subscription,
  });
}

export async function handleStripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(
      'Stripe webhook must be sent as raw application/json.',
      400,
      'INVALID_STRIPE_WEBHOOK_BODY',
    );
  }

  const result = await billingService.processStripeWebhook(
    req.body,
    req.headers['stripe-signature'],
  );

  res.json(result);
}
