import { z } from 'zod';

export const billingCycleSchema = z.enum(['month', 'year']);
export const billingPlanIdSchema = z.enum(['free', 'pro', 'enterprise', 'custom']);
export const checkoutPlanIdSchema = z.enum(['free', 'pro', 'enterprise']);

export const billingInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCheckoutSessionSchema = z.object({
  planId: checkoutPlanIdSchema,
  billingCycle: billingCycleSchema.default('month'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type BillingInvoicesQuerySchema = z.infer<typeof billingInvoicesQuerySchema>;
export type CreateCheckoutSessionSchema = z.infer<typeof createCheckoutSessionSchema>;
