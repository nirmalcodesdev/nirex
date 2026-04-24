export type BillingCycle = 'month' | 'year';

export type BillingPlanId = 'free' | 'pro' | 'enterprise' | 'custom';

export interface BillingPlanPrice {
  billingCycle: BillingCycle;
  amountCents: number;
  currency: string;
  stripePriceId?: string;
}

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  description: string;
  features: string[];
  includedCredits: number | null;
  prices: Partial<Record<BillingCycle, BillingPlanPrice>>;
  checkoutEnabled: boolean;
}

export interface BillingOverviewSubscription {
  subscriptionId: string | null;
  status:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | 'none';
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingOverviewPaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: string | null;
}

export interface BillingInvoiceItem {
  invoiceId: string;
  number: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | 'unknown';
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  paidAt: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface BillingOverviewKpis {
  currentPlanAmountCents: number;
  currency: string;
  totalPaidYtdCents: number;
  nextBillingDate: string | null;
  yearlySavingsCents: number;
}

export interface BillingOverviewResponse {
  billingEnabled: boolean;
  customerId: string | null;
  currentPlan: BillingPlan;
  subscription: BillingOverviewSubscription;
  paymentMethod: BillingOverviewPaymentMethod | null;
  usage: {
    creditsUsed: number | null;
    creditsIncluded: number | null;
    creditsUsagePct: number | null;
  };
  kpis: BillingOverviewKpis;
  invoices: BillingInvoiceItem[];
  plans: BillingPlan[];
}

export interface CreateCheckoutSessionInput {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface CreatePortalSessionInput {
  returnUrl?: string;
}

export interface CreatePortalSessionResult {
  portalUrl: string;
}
