import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type {
  AdminManualChargeRequest,
  AdminRefundRequest,
  ApplyDiscountRequest,
  AttachPaymentMethodRequest,
  BillingInvoicesQuery,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CreateCheckoutSessionRequest,
  CreatePortalSessionRequest,
  CreateTopUpSessionRequest,
  PauseSubscriptionRequest,
  ProrationPreviewQuery,
  ResumeSubscriptionRequest,
  RetryPaymentRequest,
  UpdateAutoRenewalRequest,
} from '@nirex/shared';
import { AppError } from '../../types/index.js';
import { billingService } from './billing.service.js';

function getUserId(req: Request): Types.ObjectId {
  if (!req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHENTICATED');
  }
  return new Types.ObjectId(req.userId);
}

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw new AppError('Billing resource not found.', 404, 'BILLING_RESOURCE_NOT_FOUND');
  }
  return value;
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  const overview = await billingService.getBillingOverview(getUserId(req), {
    force: req.query.force === 'true',
  });
  res.json({ status: 'success', data: overview });
}

export async function listPlans(req: Request, res: Response): Promise<void> {
  const plans = await billingService.listPlans(getUserId(req));
  res.json({ status: 'success', data: plans });
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const query = req.query as BillingInvoicesQuery;
  const invoices = await billingService.listInvoices(getUserId(req), {
    limit: query.limit ?? 20,
    cursor: query.cursor,
  });
  res.json({ status: 'success', data: invoices });
}

export async function downloadInvoicePdf(req: Request, res: Response): Promise<void> {
  const result = await billingService.downloadInvoicePdf(getUserId(req), getParam(req, 'invoiceId'));
  res.json({ status: 'success', data: result });
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  const session = await billingService.createCheckoutSession(
    getUserId(req),
    req.body as CreateCheckoutSessionRequest,
  );
  res.status(201).json({ status: 'success', data: session });
}

export async function createTopUpSession(req: Request, res: Response): Promise<void> {
  const session = await billingService.createTopUpSession(
    getUserId(req),
    req.body as CreateTopUpSessionRequest,
  );
  res.status(201).json({ status: 'success', data: session });
}

export async function createPortalSession(req: Request, res: Response): Promise<void> {
  const session = await billingService.createPortalSession(
    getUserId(req),
    req.body as CreatePortalSessionRequest,
  );
  res.status(201).json({ status: 'success', data: session });
}

export async function attachPaymentMethod(req: Request, res: Response): Promise<void> {
  const method = await billingService.attachPaymentMethod(
    getUserId(req),
    req.body as AttachPaymentMethodRequest,
  );
  res.status(201).json({ status: 'success', data: method });
}

export async function listPaymentMethods(req: Request, res: Response): Promise<void> {
  const methods = await billingService.listPaymentMethods(getUserId(req));
  res.json({ status: 'success', data: methods });
}

export async function removePaymentMethod(req: Request, res: Response): Promise<void> {
  await billingService.removePaymentMethod(getUserId(req), getParam(req, 'paymentMethodId'));
  res.status(204).send();
}

export async function setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
  const method = await billingService.setDefaultPaymentMethod(getUserId(req), getParam(req, 'paymentMethodId'));
  res.json({ status: 'success', data: method });
}

export async function changePlan(req: Request, res: Response): Promise<void> {
  const subscription = await billingService.changePlan(getUserId(req), req.body as ChangePlanRequest);
  res.json({ status: 'success', data: { subscription } });
}

export async function cancelSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await billingService.cancelSubscription(
    getUserId(req),
    req.body as CancelSubscriptionRequest,
  );
  res.json({ status: 'success', data: { subscription } });
}

export async function updateAutoRenewal(req: Request, res: Response): Promise<void> {
  const subscription = await billingService.updateAutoRenewal(
    getUserId(req),
    req.body as UpdateAutoRenewalRequest,
  );
  res.json({ status: 'success', data: { subscription } });
}

export async function pauseSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await billingService.pauseSubscription(
    getUserId(req),
    req.body as PauseSubscriptionRequest,
  );
  res.json({ status: 'success', data: { subscription } });
}

export async function resumeSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await billingService.resumeSubscription(
    getUserId(req),
    req.body as ResumeSubscriptionRequest,
  );
  res.json({ status: 'success', data: { subscription } });
}

export async function retryPayment(req: Request, res: Response): Promise<void> {
  const payment = await billingService.retryPayment(getUserId(req), req.body as RetryPaymentRequest);
  res.json({ status: 'success', data: payment });
}

export async function applyDiscount(req: Request, res: Response): Promise<void> {
  const overview = await billingService.applyDiscount(getUserId(req), req.body as ApplyDiscountRequest);
  res.json({ status: 'success', data: overview });
}

export async function getProrationPreview(req: Request, res: Response): Promise<void> {
  const preview = await billingService.getProrationPreview(
    getUserId(req),
    req.query as unknown as ProrationPreviewQuery,
  );
  res.json({ status: 'success', data: preview });
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
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

export async function getReconciliationReport(_req: Request, res: Response): Promise<void> {
  const report = await billingService.getReconciliationReport();
  res.json({ status: 'success', data: report });
}

export async function runReconciliation(_req: Request, res: Response): Promise<void> {
  const report = await billingService.runReconciliation();
  res.json({ status: 'success', data: report });
}

export async function getAdminCustomerSummary(req: Request, res: Response): Promise<void> {
  const summary = await billingService.getAdminCustomerSummary(getParam(req, 'customerId'));
  res.json({ status: 'success', data: summary });
}

export async function adminRefund(req: Request, res: Response): Promise<void> {
  await billingService.adminRefund(getUserId(req), req.body as AdminRefundRequest);
  res.status(202).json({ status: 'success' });
}

export async function adminManualCharge(req: Request, res: Response): Promise<void> {
  const payment = await billingService.adminManualCharge(
    getUserId(req),
    req.body as AdminManualChargeRequest,
  );
  res.status(201).json({ status: 'success', data: payment });
}

export async function verifyCheckoutSession(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { session_id } = req.body as { session_id: string };
  const result = await billingService.verifyCheckoutSession(userId, session_id);
  res.json({ status: 'success', data: result });
}
