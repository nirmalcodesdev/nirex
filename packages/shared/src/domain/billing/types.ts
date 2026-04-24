/**
 * Billing Domain Types
 */

export type BillingCycle = 'month' | 'year';

export type BillingPlanId = 'hobby' | 'pro' | 'enterprise' | 'custom';

export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'none';

export type BillingInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'
  | 'unknown';

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
  status: BillingSubscriptionStatus;
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
  status: BillingInvoiceStatus;
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

export interface BillingOverviewUsage {
  creditsUsed: number | null;
  creditsIncluded: number | null;
  creditsUsagePct: number | null;
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
  usage: BillingOverviewUsage;
  kpis: BillingOverviewKpis;
  invoices: BillingInvoiceItem[];
  plans: BillingPlan[];
}

export interface BillingInvoicesQuery {
  limit?: number;
}

export interface CreateCheckoutSessionRequest {
  planId: Exclude<BillingPlanId, 'custom'>;
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
}

export interface CreatePortalSessionRequest {
  returnUrl?: string;
}

export interface CreatePortalSessionResponse {
  portalUrl: string;
}

export interface CancelSubscriptionRequest {
  atPeriodEnd?: boolean;
}

export type CancelSubscriptionResponse = BillingOverviewSubscription;
export type ResumeSubscriptionResponse = BillingOverviewSubscription;

export interface StripeWebhookResponse {
  received: true;
  duplicate: boolean;
}
