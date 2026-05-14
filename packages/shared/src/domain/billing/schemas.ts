import { z } from 'zod';

export const billingCycleSchema = z.enum(['month', 'year']);
export const billingPlanIdSchema = z.enum(['free', 'pro', 'enterprise', 'custom']);
export const checkoutPlanIdSchema = z.enum(['free', 'pro', 'enterprise']);
export const billingInvoiceStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'PAID',
  'VOID',
  'UNCOLLECTIBLE',
]);

export const billingObjectIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const billingInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  status: billingInvoiceStatusSchema.optional(),
});

export const createCheckoutSessionSchema = z.object({
  planId: checkoutPlanIdSchema,
  billingCycle: billingCycleSchema.default('month'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  couponCode: z.string().trim().min(1).max(80).optional(),
});

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const attachPaymentMethodSchema = z.object({
  providerToken: z.string().trim().min(3).max(500),
  setDefault: z.boolean().optional(),
});

export const paymentMethodIdParamSchema = z.object({
  paymentMethodId: billingObjectIdSchema,
});

export const invoiceIdParamSchema = z.object({
  invoiceId: billingObjectIdSchema,
});

export const changePlanSchema = z.object({
  planId: checkoutPlanIdSchema,
  billingCycle: billingCycleSchema,
  couponCode: z.string().trim().min(1).max(80).optional(),
});

export const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().optional(),
  reason: z.string().trim().min(1).max(300).optional(),
});

export const pauseSubscriptionSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

export const resumeSubscriptionSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

export const retryPaymentSchema = z.object({
  invoiceId: billingObjectIdSchema.optional(),
  paymentMethodId: billingObjectIdSchema.optional(),
});

export const applyDiscountSchema = z.object({
  code: z.string().trim().min(1).max(80),
});

export const prorationPreviewQuerySchema = z.object({
  planId: checkoutPlanIdSchema,
  billingCycle: billingCycleSchema,
  couponCode: z.string().trim().min(1).max(80).optional(),
});

export const billingAdminCustomerParamSchema = z.object({
  customerId: billingObjectIdSchema,
});

export const billingAdminSubscriptionParamSchema = z.object({
  subscriptionId: billingObjectIdSchema,
});

export const adminRefundSchema = z.object({
  paymentId: billingObjectIdSchema,
  amountMinor: z.number().int().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toLowerCase()),
  reason: z.string().trim().min(1).max(300).optional(),
});

export const adminManualChargeSchema = z.object({
  customerId: billingObjectIdSchema,
  amountMinor: z.number().int().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toLowerCase()),
  description: z.string().trim().min(1).max(300),
  paymentMethodId: billingObjectIdSchema.optional(),
});

export type BillingInvoicesQuerySchema = z.infer<typeof billingInvoicesQuerySchema>;
export type CreateCheckoutSessionSchema = z.infer<typeof createCheckoutSessionSchema>;
export type AttachPaymentMethodSchema = z.infer<typeof attachPaymentMethodSchema>;
export type ChangePlanSchema = z.infer<typeof changePlanSchema>;
export type CancelSubscriptionSchema = z.infer<typeof cancelSubscriptionSchema>;
