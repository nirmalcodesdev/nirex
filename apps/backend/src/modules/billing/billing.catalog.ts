import { env } from '../../config/env.js';
import {
  BILLING_PLAN_CATALOG,
  DEFAULT_BILLING_CURRENCY,
  GO_MONTHLY_DEFAULT_CENTS,
  GO_YEARLY_DEFAULT_CENTS,
  MAX_MONTHLY_DEFAULT_CENTS,
  PLUS_MONTHLY_DEFAULT_CENTS,
  PLUS_YEARLY_DEFAULT_CENTS,
  PRO_MONTHLY_DEFAULT_CENTS,
  PRO_YEARLY_DEFAULT_CENTS,
  TOPUP_PACK_CATALOG,
  getTopUpPack,
} from '@nirex/shared';
import type { BillingCycle, BillingPlan, BillingPlanId, TopUpPack, TopUpPackId } from '@nirex/shared';

export { getTopUpPack, TOPUP_PACK_CATALOG };

interface PriceMapping {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  name: string;
}

function getGoPrices(): BillingPlan['prices'] {
  return {
    month: {
      billingCycle: 'month',
      amountMinor: GO_MONTHLY_DEFAULT_CENTS,
      amountCents: GO_MONTHLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_GO_MONTHLY,
      stripePriceId: env.STRIPE_PRICE_GO_MONTHLY,
    },
    year: {
      billingCycle: 'year',
      amountMinor: GO_YEARLY_DEFAULT_CENTS,
      amountCents: GO_YEARLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_GO_YEARLY,
      stripePriceId: env.STRIPE_PRICE_GO_YEARLY,
    },
  };
}

function getProPrices(): BillingPlan['prices'] {
  return {
    month: {
      billingCycle: 'month',
      amountMinor: PRO_MONTHLY_DEFAULT_CENTS,
      amountCents: PRO_MONTHLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_PRO_MONTHLY,
      stripePriceId: env.STRIPE_PRICE_PRO_MONTHLY,
    },
    year: {
      billingCycle: 'year',
      amountMinor: PRO_YEARLY_DEFAULT_CENTS,
      amountCents: PRO_YEARLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_PRO_YEARLY,
      stripePriceId: env.STRIPE_PRICE_PRO_YEARLY,
    },
  };
}

function getPlusPrices(): BillingPlan['prices'] {
  return {
    month: {
      billingCycle: 'month',
      amountMinor: PLUS_MONTHLY_DEFAULT_CENTS,
      amountCents: PLUS_MONTHLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_PLUS_MONTHLY,
      stripePriceId: env.STRIPE_PRICE_PLUS_MONTHLY,
    },
    year: {
      billingCycle: 'year',
      amountMinor: PLUS_YEARLY_DEFAULT_CENTS,
      amountCents: PLUS_YEARLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_PLUS_YEARLY,
      stripePriceId: env.STRIPE_PRICE_PLUS_YEARLY,
    },
  };
}

function getMaxPrices(): BillingPlan['prices'] {
  return {
    month: {
      billingCycle: 'month',
      amountMinor: MAX_MONTHLY_DEFAULT_CENTS,
      amountCents: MAX_MONTHLY_DEFAULT_CENTS,
      currency: DEFAULT_BILLING_CURRENCY,
      providerPriceId: env.STRIPE_PRICE_MAX_MONTHLY,
      stripePriceId: env.STRIPE_PRICE_MAX_MONTHLY,
    },
  };
}

export function getBillingPlans(): BillingPlan[] {
  const goPrices = getGoPrices();
  const proPrices = getProPrices();
  const plusPrices = getPlusPrices();
  const maxPrices = getMaxPrices();

  return [
    {
      ...BILLING_PLAN_CATALOG.free,
      prices: {
        month: {
          billingCycle: 'month',
          amountMinor: 0,
          amountCents: 0,
          currency: DEFAULT_BILLING_CURRENCY,
        },
      },
      checkoutEnabled: false,
    },
    {
      ...BILLING_PLAN_CATALOG.go,
      prices: goPrices,
      checkoutEnabled: Boolean(
        goPrices.month?.stripePriceId || goPrices.year?.stripePriceId,
      ),
    },
    {
      ...BILLING_PLAN_CATALOG.pro,
      prices: proPrices,
      checkoutEnabled: Boolean(
        proPrices.month?.stripePriceId || proPrices.year?.stripePriceId,
      ),
    },
    {
      ...BILLING_PLAN_CATALOG.plus,
      prices: plusPrices,
      checkoutEnabled: Boolean(
        plusPrices.month?.stripePriceId || plusPrices.year?.stripePriceId,
      ),
    },
    {
      ...BILLING_PLAN_CATALOG.max,
      prices: maxPrices,
      checkoutEnabled: Boolean(maxPrices.month?.stripePriceId),
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
        name: plan.name,
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

// Top-up pack resolution — maps Stripe price IDs back to pack IDs
export function getTopUpPackStripePriceIds(): Map<string, TopUpPackId> {
  const mapping = new Map<string, TopUpPackId>();
  const prices: Array<[TopUpPackId, string | undefined]> = [
    ['small', env.STRIPE_PRICE_TOPUP_SMALL],
    ['medium', env.STRIPE_PRICE_TOPUP_MEDIUM],
    ['large', env.STRIPE_PRICE_TOPUP_LARGE],
    ['xl', env.STRIPE_PRICE_TOPUP_XL],
  ];
  for (const [packId, priceId] of prices) {
    if (priceId) mapping.set(priceId, packId);
  }
  return mapping;
}

export function getTopUpPackByStripePriceId(priceId: string): TopUpPack | null {
  const packId = getTopUpPackStripePriceIds().get(priceId);
  if (!packId) return null;
  return TOPUP_PACK_CATALOG[packId];
}

export function getStripePriceIdForTopUpPack(packId: TopUpPackId): string | null {
  const map: Record<TopUpPackId, string | undefined> = {
    small: env.STRIPE_PRICE_TOPUP_SMALL,
    medium: env.STRIPE_PRICE_TOPUP_MEDIUM,
    large: env.STRIPE_PRICE_TOPUP_LARGE,
    xl: env.STRIPE_PRICE_TOPUP_XL,
  };
  return map[packId] ?? null;
}
