import type { BillingPlan, BillingPlanId } from './types.js';

export const DEFAULT_BILLING_CURRENCY = 'usd';
export const PRO_MONTHLY_DEFAULT_CENTS = 4900;
export const PRO_YEARLY_DEFAULT_CENTS = 47040;

export type BillingCatalogPlanId = Exclude<BillingPlanId, 'custom'>;

export type BillingPlanCatalogEntry = Pick<
  BillingPlan,
  'id' | 'name' | 'description' | 'features' | 'includedCredits'
>;

export const BILLING_PLAN_CATALOG: Record<
  BillingCatalogPlanId,
  BillingPlanCatalogEntry
> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for side projects and learning.',
    features: [
      'Limited Chat Sessions',
      'Access to free ai models',
      'Limited to Agentic Team AI',
    ],
    includedCredits: 10_000,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional developers and growing teams.',
    features: [
      'Unlimited Chat Sessions',
      'Access to pro + free ai models',
      'Access to Agentic Team AI',
    ],
    includedCredits: 50_000,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom billing, support, and compliance options.',
    features: [
      'Unlimited everything',
      'Dedicated support',
      'SSO and advanced security controls',
      'Custom SLAs and onboarding',
    ],
    includedCredits: null,
  },
};

