import type { BillingPlan, BillingPlanId } from './types.js';

export const DEFAULT_BILLING_CURRENCY = 'usd';
export const PRO_MONTHLY_DEFAULT_CENTS = 4900;
export const PRO_YEARLY_DEFAULT_CENTS = 47040;

export type BillingCatalogPlanId = Exclude<BillingPlanId, 'custom'>;

export type BillingPlanCatalogEntry = Pick<
  BillingPlan,
  'id' | 'name' | 'description' | 'features' | 'includedComputeSeconds'
>;

export const BILLING_PLAN_CATALOG: Record<
  BillingCatalogPlanId,
  BillingPlanCatalogEntry
> = {
  hobby: {
    id: 'hobby',
    name: 'Hobby',
    description: 'Perfect for side projects and learning.',
    features: [
      'Up to 3 projects',
      '10,000s cloud compute',
      'Community support',
      'Basic analytics',
    ],
    includedComputeSeconds: 10_000,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional developers and growing teams.',
    features: [
      'Unlimited local executions',
      '50,000s cloud compute',
      'Advanced analytics',
      'Priority support',
    ],
    includedComputeSeconds: 50_000,
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
    includedComputeSeconds: null,
  },
};

