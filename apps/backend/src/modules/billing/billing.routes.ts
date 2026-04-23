import express, { Router } from 'express';
import {
  billingInvoicesQuerySchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  cancelSubscriptionSchema,
} from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticate } from '../../middleware/authenticate.js';
import { apiLimiter, billingWebhookLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as billingController from './billing.controller.js';

const protectedRouter: Router = Router();
protectedRouter.use(asyncWrapper(authenticate));

protectedRouter.get('/overview', apiLimiter, asyncWrapper(billingController.getOverview));
protectedRouter.get(
  '/invoices',
  apiLimiter,
  validate(billingInvoicesQuerySchema, 'query'),
  asyncWrapper(billingController.listInvoices),
);
protectedRouter.post(
  '/checkout-session',
  apiLimiter,
  validate(createCheckoutSessionSchema),
  asyncWrapper(billingController.createCheckoutSession),
);
protectedRouter.post(
  '/portal-session',
  apiLimiter,
  validate(createPortalSessionSchema),
  asyncWrapper(billingController.createPortalSession),
);
protectedRouter.post(
  '/subscription/cancel',
  apiLimiter,
  validate(cancelSubscriptionSchema),
  asyncWrapper(billingController.cancelSubscription),
);
protectedRouter.post(
  '/subscription/resume',
  apiLimiter,
  asyncWrapper(billingController.resumeSubscription),
);

export const billingWebhookRouter: Router = Router();
billingWebhookRouter.post(
  '/stripe',
  billingWebhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  asyncWrapper(billingController.handleStripeWebhook),
);

export default protectedRouter;
