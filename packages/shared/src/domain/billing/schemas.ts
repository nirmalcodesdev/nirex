import { z } from 'zod';

export const billingCycleSchema = z.enum(['month', 'year']);
export const billingPlanIdSchema = z.enum(['hobby', 'pro', 'enterprise', 'custom']);
export const checkoutPlanIdSchema = z.enum(['hobby', 'pro', 'enterprise']);

export const billingInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCheckoutSessionSchema = z.object({
  planId: checkoutPlanIdSchema,
  billingCycle: billingCycleSchema.default('month'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().optional().default(true),
});

export type BillingInvoicesQuerySchema = z.infer<typeof billingInvoicesQuerySchema>;
export type CreateCheckoutSessionSchema = z.infer<typeof createCheckoutSessionSchema>;
export type CreatePortalSessionSchema = z.infer<typeof createPortalSessionSchema>;
export type CancelSubscriptionSchema = z.infer<typeof cancelSubscriptionSchema>;
