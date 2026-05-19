import type { BillingPlan, BillingPlanId } from './types.js';

export const DEFAULT_BILLING_CURRENCY = 'usd';
export const PRO_MONTHLY_DEFAULT_CENTS = 2000;
export const PRO_YEARLY_DEFAULT_CENTS = 20000;

export type BillingCatalogPlanId = Exclude<BillingPlanId, 'custom'>;

export type BillingPlanCatalogEntry = Pick<
  BillingPlan,
  'id' | 'name' | 'description' | 'features' | 'includedCredits' | 'trialDays' | 'active'
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
      '10,000 monthly credits',
      'Limited Chat Sessions',
      'Access to free ai models',
      'Limited to Agentic Team AI',
    ],
    includedCredits: 10_000,
    trialDays: 0,
    active: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional developers and growing teams.',
    features: [
      '50,000 monthly credits',
      'Unlimited Chat Sessions',
      'Access to pro + free ai models',
      'Access to Agentic Team AI',
    ],
    includedCredits: 50_000,
    trialDays: 0,
    active: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom billing, support, and compliance options.',
    features: [
      'Custom monthly credits',
      'Unlimited everything',
      'Dedicated support',
      'SSO and advanced security controls',
      'Custom SLAs and onboarding',
    ],
    includedCredits: null,
    trialDays: 0,
    active: true,
  },
};

