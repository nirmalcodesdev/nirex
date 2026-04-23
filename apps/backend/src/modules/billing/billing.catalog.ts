import { env } from '../../config/env.js';
import {
  BILLING_PLAN_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
} from '@nirex/shared';
import type { BillingCycle, BillingPlan, BillingPlanId } from './billing.types.js';

interface PriceMapping {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
}

function getProPrices(): BillingPlan['prices'] {
  return {
    month: {
      billingCycle: 'month',
      amountCents: PRO_MONTHLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      stripePriceId: env.STRIPE_PRICE_PRO_MONTHLY,
    },
    year: {
      billingCycle: 'year',
      amountCents: PRO_YEARLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      stripePriceId: env.STRIPE_PRICE_PRO_YEARLY,
    },
  };
}

export function getBillingPlans(): BillingPlan[] {
  const proPrices = getProPrices();

  return [
    {
      ...BILLING_PLAN_CATALOG.hobby,
      prices: {
        month: {
          billingCycle: 'month',
          amountCents: 0,
          currency: DEFAULT_BILLING_CURRENCY,
        },
      },
      checkoutEnabled: false,
    },
    {
      ...BILLING_PLAN_CATALOG.pro,
      prices: proPrices,
      checkoutEnabled: Boolean(
        proPrices.month?.stripePriceId || proPrices.year?.stripePriceId,
      ),
    },
    {
      ...BILLING_PLAN_CATALOG.enterprise,
      prices: {},
      checkoutEnabled: false,
    },
  ];
}

export function getBillingPlan(planId: BillingPlanId): BillingPlan | null {
  return getBillingPlans().find((plan) => plan.id === planId) ?? null;
}

export function getPlanPrice(
  planId: BillingPlanId,
  billingCycle: BillingCycle,
): BillingPlan['prices'][BillingCycle] | null {
  const plan = getBillingPlan(planId);
  if (!plan) return null;
  return plan.prices[billingCycle] ?? null;
}

export function getPriceMappingByStripePriceId(): Map<string, PriceMapping> {
  const mapping = new Map<string, PriceMapping>();
  for (const plan of getBillingPlans()) {
    for (const cycle of ['month', 'year'] as const) {
      const price = plan.prices[cycle];
      if (!price?.stripePriceId) continue;
      mapping.set(price.stripePriceId, {
        planId: plan.id,
        billingCycle: cycle,
      });
    }
  }
  return mapping;
}

export function resolvePlanFromStripePriceId(
  stripePriceId: string | null | undefined,
): PriceMapping | null {
  if (!stripePriceId) return null;
  return getPriceMappingByStripePriceId().get(stripePriceId) ?? null;
}
