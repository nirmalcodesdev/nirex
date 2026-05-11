import express, { Router } from 'express';
import {
  billingInvoicesQuerySchema,
  createCheckoutSessionSchema,
} from '@nirex/shared';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import { authenticateUser, requireApiKeyScopes } from '../../middleware/authenticateUser.js';
import { apiLimiter, billingWebhookLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import * as billingController from './billing.controller.js';

const protectedRouter: Router = Router();
protectedRouter.use(asyncWrapper(authenticateUser(['billing:read'])));

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
  requireApiKeyScopes(['billing:write']),
  validate(createCheckoutSessionSchema),
  asyncWrapper(billingController.createCheckoutSession),
);

export const billingWebhookRouter: Router = Router();
billingWebhookRouter.post(
  '/stripe',
  billingWebhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  asyncWrapper(billingController.handleStripeWebhook),
);

export default protectedRouter;
