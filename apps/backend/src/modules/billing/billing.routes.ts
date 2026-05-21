import express, { Router } from 'express';
import {
  adminManualChargeSchema,
  adminRefundSchema,
  applyDiscountSchema,
  attachPaymentMethodSchema,
  billingAdminCustomerParamSchema,
  billingInvoicesQuerySchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  invoiceIdParamSchema,
  pauseSubscriptionSchema,
  paymentMethodIdParamSchema,
  prorationPreviewQuerySchema,
  resumeSubscriptionSchema,
  retryPaymentSchema,
  updateAutoRenewalSchema,
} from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser, requireApiKeyScopes } from '../../middleware/authenticateUser.js';
import {
  apiLimiter,
  billingAdminLimiter,
  billingMutationLimiter,
  billingWebhookLimiter,
} from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as billingController from './billing.controller.js';
import {
  billingOwnerGuard,
  rejectRawCardData,
  requireBillingAdmin,
} from './billing.guard.js';

const protectedRouter: Router = Router();
protectedRouter.use(asyncWrapper(authenticateUser(['billing:read'])));

protectedRouter.get('/overview', apiLimiter, asyncWrapper(billingController.getOverview));
protectedRouter.get('/plans', apiLimiter, asyncWrapper(billingController.listPlans));
protectedRouter.get(
  '/invoices',
  apiLimiter,
  validate(billingInvoicesQuerySchema, 'query'),
  asyncWrapper(billingController.listInvoices),
);
protectedRouter.get(
  '/invoices/:invoiceId/pdf',
  apiLimiter,
  validate(invoiceIdParamSchema, 'params'),
  asyncWrapper(billingOwnerGuard('invoiceId')),
  asyncWrapper(billingController.downloadInvoicePdf),
);
protectedRouter.get(
  '/proration-preview',
  apiLimiter,
  validate(prorationPreviewQuerySchema, 'query'),
  asyncWrapper(billingController.getProrationPreview),
);

protectedRouter.post(
  '/checkout-sessions',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  rejectRawCardData,
  validate(createCheckoutSessionSchema),
  asyncWrapper(billingController.createCheckoutSession),
);
protectedRouter.post(
  '/checkout-session',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  rejectRawCardData,
  validate(createCheckoutSessionSchema),
  asyncWrapper(billingController.createCheckoutSession),
);
protectedRouter.post(
  '/portal-sessions',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(createPortalSessionSchema),
  asyncWrapper(billingController.createPortalSession),
);
protectedRouter.post(
  '/payment-methods',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  rejectRawCardData,
  validate(attachPaymentMethodSchema),
  asyncWrapper(billingController.attachPaymentMethod),
);
protectedRouter.get(
  '/payment-methods',
  apiLimiter,
  asyncWrapper(billingController.listPaymentMethods),
);
protectedRouter.delete(
  '/payment-methods/:paymentMethodId',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(paymentMethodIdParamSchema, 'params'),
  asyncWrapper(billingOwnerGuard('paymentMethodId')),
  asyncWrapper(billingController.removePaymentMethod),
);
protectedRouter.patch(
  '/payment-methods/:paymentMethodId/default',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(paymentMethodIdParamSchema, 'params'),
  asyncWrapper(billingOwnerGuard('paymentMethodId')),
  asyncWrapper(billingController.setDefaultPaymentMethod),
);
protectedRouter.post(
  '/subscription/change-plan',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(changePlanSchema),
  asyncWrapper(billingController.changePlan),
);
protectedRouter.post(
  '/subscription/cancel',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(cancelSubscriptionSchema),
  asyncWrapper(billingController.cancelSubscription),
);
protectedRouter.patch(
  '/subscription/auto-renewal',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(updateAutoRenewalSchema),
  asyncWrapper(billingController.updateAutoRenewal),
);
protectedRouter.post(
  '/subscription/auto-renewal',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(updateAutoRenewalSchema),
  asyncWrapper(billingController.updateAutoRenewal),
);
protectedRouter.post(
  '/subscription/pause',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(pauseSubscriptionSchema),
  asyncWrapper(billingController.pauseSubscription),
);
protectedRouter.post(
  '/subscription/resume',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(resumeSubscriptionSchema),
  asyncWrapper(billingController.resumeSubscription),
);
protectedRouter.post(
  '/subscription/retry-payment',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(retryPaymentSchema),
  asyncWrapper(billingController.retryPayment),
);
protectedRouter.post(
  '/discounts/apply',
  billingMutationLimiter,
  requireApiKeyScopes(['billing:write']),
  validate(applyDiscountSchema),
  asyncWrapper(billingController.applyDiscount),
);

protectedRouter.use('/admin', billingAdminLimiter, requireBillingAdmin);
protectedRouter.get(
  '/admin/reconciliation/report',
  asyncWrapper(billingController.getReconciliationReport),
);
protectedRouter.post(
  '/admin/reconciliation/run',
  asyncWrapper(billingController.runReconciliation),
);
protectedRouter.get(
  '/admin/customers/:customerId',
  validate(billingAdminCustomerParamSchema, 'params'),
  asyncWrapper(billingController.getAdminCustomerSummary),
);
protectedRouter.post(
  '/admin/customers/:customerId/refunds',
  validate(billingAdminCustomerParamSchema, 'params'),
  validate(adminRefundSchema),
  asyncWrapper(billingController.adminRefund),
);
protectedRouter.post(
  '/admin/customers/:customerId/manual-charge',
  validate(billingAdminCustomerParamSchema, 'params'),
  rejectRawCardData,
  validate(adminManualChargeSchema),
  asyncWrapper(billingController.adminManualCharge),
);

export const billingWebhookRouter: Router = Router();
billingWebhookRouter.post(
  '/stripe',
  billingWebhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  asyncWrapper(billingController.handleStripeWebhook),
);

export default protectedRouter;
