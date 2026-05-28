import type { BillingPlan, BillingPlanId, TopUpPack, TopUpPackId } from './types.js';

export const DEFAULT_BILLING_CURRENCY = 'usd';

// Plan prices in cents
export const GO_MONTHLY_DEFAULT_CENTS = 500;    // $5
export const GO_YEARLY_DEFAULT_CENTS = 5000;    // $50
export const PRO_MONTHLY_DEFAULT_CENTS = 2000;   // $20
export const PRO_YEARLY_DEFAULT_CENTS = 20000;    // $200
export const PLUS_MONTHLY_DEFAULT_CENTS = 5000;   // $50
export const PLUS_YEARLY_DEFAULT_CENTS = 50000;   // $500
export const MAX_MONTHLY_DEFAULT_CENTS = 20000;   // $200

// Plan credit allotments (per billing period)
export const FREE_SIGNUP_BONUS_CREDITS = 500;
export const FREE_INCLUDED_CREDITS = 0;
export const GO_INCLUDED_CREDITS = 1000;
export const PRO_INCLUDED_CREDITS = 3000;
export const PLUS_INCLUDED_CREDITS = 7500;
export const MAX_INCLUDED_CREDITS = 30000;

// Request quotas (soft limit, ignored when topupBalance > 0)
export const FREE_REQUEST_QUOTA = 5000;
export const GO_REQUEST_QUOTA = 10000;
export const PRO_REQUEST_QUOTA = 30000;
export const PLUS_REQUEST_QUOTA = 100000;
export const MAX_REQUEST_QUOTA = Infinity; // No cap

// 1 credit = $0.01
export const CREDITS_PER_DOLLAR = 100;

export type BillingCatalogPlanId = Exclude<BillingPlanId, 'custom'>;

export type BillingPlanCatalogEntry = Pick<
  BillingPlan,
  'id' | 'name' | 'description' | 'features' | 'includedCredits' | 'trialDays' | 'active'
> & {
  requestQuota: number;
};

export const BILLING_PLAN_CATALOG: Record<
  BillingCatalogPlanId,
  BillingPlanCatalogEntry
> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with Nirex at no cost.',
    features: [
      '$5 one-time included balance',
      '5,000 monthly requests',
      'Top-ups available to unlock unlimited requests',
      'Access to free AI models',
    ],
    includedCredits: FREE_INCLUDED_CREDITS,
    requestQuota: FREE_REQUEST_QUOTA,
    trialDays: 0,
    active: true,
  },
  go: {
    id: 'go',
    name: 'Go',
    description: 'For individuals getting started.',
    features: [
      '$10 included balance/mo',
      '10,000 monthly requests',
      'Top-ups available to unlock unlimited requests',
      'Access to go + free AI models',
      'Save $10/yr with annual billing ($50/yr)',
    ],
    includedCredits: GO_INCLUDED_CREDITS,
    requestQuota: GO_REQUEST_QUOTA,
    trialDays: 0,
    active: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professional developers and growing teams.',
    features: [
      '$30 included balance/mo',
      '30,000 monthly requests',
      'Top-ups available to unlock unlimited requests',
      'Access to pro + free AI models',
      'Save $40/yr with annual billing',
    ],
    includedCredits: PRO_INCLUDED_CREDITS,
    requestQuota: PRO_REQUEST_QUOTA,
    trialDays: 0,
    active: true,
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    description: 'For power users who need more.',
    features: [
      '$75 included balance/mo',
      '100,000 monthly requests',
      'Top-ups available to unlock unlimited requests',
      'Access to plus + pro + free AI models',
      'Save $100/yr with annual billing',
    ],
    includedCredits: PLUS_INCLUDED_CREDITS,
    requestQuota: PLUS_REQUEST_QUOTA,
    trialDays: 0,
    active: true,
  },
  max: {
    id: 'max',
    name: 'Max',
    description: 'Unlimited power for high-volume usage.',
    features: [
      '$300 included balance/mo',
      'Unlimited requests — no cap, ever',
      'Top-ups for extra balance',
      'Access to all AI models',
      'Priority support',
    ],
    includedCredits: MAX_INCLUDED_CREDITS,
    requestQuota: MAX_REQUEST_QUOTA,
    trialDays: 0,
    active: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom billing, support, and compliance options.',
    features: [
      'Custom monthly balance',
      'Unlimited everything',
      'Dedicated support',
      'SSO and advanced security controls',
      'Custom SLAs and onboarding',
    ],
    includedCredits: null,
    requestQuota: MAX_REQUEST_QUOTA,
    trialDays: 0,
    active: false,
  },
};

// Top-up pack catalog
export const TOPUP_PACK_CATALOG: Record<TopUpPackId, TopUpPack> = {
  small: {
    id: 'small',
    name: 'Small Pack',
    credits: 1000,
    amountMinor: 1000, // $10
    currency: DEFAULT_BILLING_CURRENCY,
  },
  medium: {
    id: 'medium',
    name: 'Medium Pack',
    credits: 2500,
    amountMinor: 2500, // $25
    currency: DEFAULT_BILLING_CURRENCY,
  },
  large: {
    id: 'large',
    name: 'Large Pack',
    credits: 5000,
    amountMinor: 5000, // $50
    currency: DEFAULT_BILLING_CURRENCY,
  },
  xl: {
    id: 'xl',
    name: 'XL Pack',
    credits: 10000,
    amountMinor: 10000, // $100
    currency: DEFAULT_BILLING_CURRENCY,
  },
};

export function getTopUpPack(id: TopUpPackId): TopUpPack {
  return TOPUP_PACK_CATALOG[id];
}

export function getPlanConfig(planId: BillingPlanId): BillingPlanCatalogEntry {
  const entry = BILLING_PLAN_CATALOG[planId as BillingCatalogPlanId];
  if (!entry) return BILLING_PLAN_CATALOG.free;
  return entry;
}

export function getPlanIncludedCredits(planId: BillingPlanId): number {
  return getPlanConfig(planId).includedCredits ?? FREE_INCLUDED_CREDITS;
}

export function getPlanRequestQuota(planId: BillingPlanId): number {
  return getPlanConfig(planId).requestQuota;
}
