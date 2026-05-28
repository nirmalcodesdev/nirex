/**
 * Billing domain contracts shared by backend and frontend.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export type BillingCycle = 'month' | 'year';
export type BillingPlanId = 'free' | 'go' | 'pro' | 'plus' | 'max' | 'enterprise' | 'custom';
export type BillingProvider = 'stripe';

export type TopUpPackId = 'small' | 'medium' | 'large' | 'xl';

export interface TopUpPack {
  id: TopUpPackId;
  name: string;
  credits: number;
  amountMinor: number;
  currency: string;
}

export interface CreateTopUpSessionRequest {
  packId: TopUpPackId;
  customAmount?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateTopUpSessionResponse {
  sessionId: string;
  checkoutUrl: string;
}

export interface RollingWindowUsage {
  window5h: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
  };
  window7d: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
  };
}

export interface CreditBalanceResponse {
  planId: BillingPlanId;
  includedCredits: number;
  topupBalance: number;
  totalCredits: number;
  balanceUsd: number;
  monthlyRequestCount: number;
  requestQuota: number | null;
  quotaLifted: boolean;
  rollingWindow: RollingWindowUsage;
}

export type BillingSubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'PAUSED'
  | 'CANCELED'
  | 'NONE';

export type BillingInvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID'
  | 'VOID'
  | 'UNCOLLECTIBLE';

export type BillingPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REQUIRES_ACTION'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type BillingRefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export type BillingWebhookStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DEAD'
  | 'IGNORED';

export type BillingAuditOutcome = 'SUCCESS' | 'FAILURE' | 'IGNORED';
export type BillingActorType = 'USER' | 'ADMIN' | 'SYSTEM' | 'WEBHOOK' | 'JOB' | 'API_KEY';
export type BillingDiscountType = 'PERCENTAGE' | 'FIXED';
export type BillingTaxInclusiveMode = 'INCLUSIVE' | 'EXCLUSIVE';
export type BillingInterval = BillingCycle;

export interface MoneyAmount {
  amountMinor: number;
  currency: string;
}

export interface BillingPlanPrice extends MoneyAmount {
  billingCycle: BillingCycle;
  amountCents?: number;
  providerPriceId?: string;
  stripePriceId?: string;
}

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  description: string;
  features: string[];
  includedCredits: number | null;
  trialDays: number;
  prices: Partial<Record<BillingCycle, BillingPlanPrice>>;
  checkoutEnabled: boolean;
  active: boolean;
}

export interface BillingCustomer {
  id: string;
  userId: string;
  provider: BillingProvider;
  providerCustomerId: string | null;
  defaultPaymentMethodId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPaymentMethod {
  id: string;
  customerId: string;
  provider: BillingProvider;
  providerPaymentMethodId: string;
  type: 'card' | 'bank_account' | 'wallet' | 'unknown';
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  funding: string | null;
  isDefault: boolean;
  status: 'ACTIVE' | 'DETACHED';
  createdAt: string;
}

export interface BillingSubscription {
  id: string;
  customerId: string;
  planId: BillingPlanId;
  status: BillingSubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  autoRenewalEnabled: boolean;
  canceledAt: string | null;
  pausedAt: string | null;
  providerSubscriptionId: string | null;
}

export interface BillingInvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmount: MoneyAmount;
  amount: MoneyAmount;
  planId: BillingPlanId | null;
  usageRecordId: string | null;
}

export interface BillingInvoiceItem {
  invoiceId: string;
  invoiceNumber: string | null;
  number: string | null;
  description: string | null;
  status: BillingInvoiceStatus;
  currency: string;
  subtotalMinor: number;
  subtotalCents: number;
  taxMinor: number;
  taxCents: number;
  discountMinor: number;
  totalMinor: number;
  totalCents: number;
  amountDueMinor: number;
  amountDueCents: number;
  amountPaidMinor: number;
  amountPaidCents: number;
  amountRemainingMinor: number;
  amountRemainingCents: number;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  dueDate: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lineItems: BillingInvoiceLineItem[];
  createdAt: string;
}

export interface BillingPayment {
  id: string;
  invoiceId: string;
  paymentMethodId: string | null;
  status: BillingPaymentStatus;
  amount: MoneyAmount;
  failureCode: string | null;
  failureMessage: string | null;
  attemptedAt: string;
}

export interface BillingRefund {
  id: string;
  paymentId: string;
  status: BillingRefundStatus;
  amount: MoneyAmount;
  reason: string | null;
  createdAt: string;
}

export interface ScheduledPlanChange {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  scheduledAt: string;
}

export interface BillingOverviewSubscription {
  subscriptionId: string | null;
  status: BillingSubscriptionStatus;
  planId: BillingPlanId;
  billingCycle: BillingCycle | null;
  cancelAtPeriodEnd: boolean;
  autoRenewalEnabled: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  scheduledPlanChange: ScheduledPlanChange | null;
}

export interface BillingOverviewPaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  funding: string | null;
}

export interface BillingOverviewUsage {
  creditsUsed: number | null;
  creditsIncluded: number | null;
  creditsUsagePct: number | null;
  creditPeriodStart: string | null;
  creditPeriodEnd: string | null;
  nextCreditResetAt: string | null;
  creditsExpireAt: string | null;
  includedCredits: number;
  topupBalance: number;
  totalCredits: number;
  balanceUsd: number;
  monthlyRequestCount: number;
  requestQuota: number | null;
  quotaLifted: boolean;
  rollingWindow: RollingWindowUsage;
}

export interface BillingOverviewKpis {
  currentPlanAmountMinor: number;
  currentPlanAmountCents: number;
  currency: string;
  totalPaidYtdMinor: number;
  totalPaidYtdCents: number;
  periodEndDate: string | null;
  nextBillingDate: string | null;
  nextRenewalAmountMinor: number;
  yearlySavingsMinor: number;
  yearlySavingsCents: number;
  lastFetchedAt: string;
}

export interface BillingOverviewEntitlement {
  status:
    | 'active'
    | 'trialing'
    | 'past_due_grace'
    | 'payment_action_required'
    | 'suspended'
    | 'canceled'
    | 'none';
  planId: BillingPlanId;
  canAccessPaidFeatures: boolean;
  isBillingIssue: boolean;
  issueCode: string | null;
  issueMessage: string | null;
  accessEndsAt: string | null;
  lastSyncedAt: string | null;
}

export interface BillingOverviewResponse {
  billingEnabled: boolean;
  adminAccess: boolean;
  customerId: string | null;
  providerCustomerId: string | null;
  currentPlan: BillingPlan;
  subscription: BillingOverviewSubscription;
  entitlement: BillingOverviewEntitlement;
  paymentMethod: BillingOverviewPaymentMethod | null;
  paymentMethods: BillingPaymentMethod[];
  usage: BillingOverviewUsage;
  kpis: BillingOverviewKpis;
  invoices: BillingInvoiceItem[];
  plans: BillingPlan[];
}

export interface BillingInvoicesQuery {
  limit?: number;
  cursor?: string;
  status?: BillingInvoiceStatus;
}

export interface BillingInvoicesResponse {
  items: BillingInvoiceItem[];
  nextCursor: string | null;
}

export interface CreateCheckoutSessionRequest {
  planId: Exclude<BillingPlanId, 'custom'>;
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
  couponCode?: string;
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

export interface AttachPaymentMethodRequest {
  providerToken: string;
  setDefault?: boolean;
}

export interface ChangePlanRequest {
  planId: Exclude<BillingPlanId, 'custom'>;
  billingCycle: BillingCycle;
  couponCode?: string;
  downgradeAtPeriodEnd?: boolean;
}

export interface CancelSubscriptionRequest {
  atPeriodEnd?: boolean;
  reason?: string;
}

export interface CancelSubscriptionResponse {
  subscription: BillingOverviewSubscription;
}

export interface UpdateAutoRenewalRequest {
  enabled: boolean;
  reason?: string;
}

export interface UpdateAutoRenewalResponse {
  subscription: BillingOverviewSubscription;
}

export interface PauseSubscriptionRequest {
  reason?: string;
}

export interface ResumeSubscriptionRequest {
  reason?: string;
}

export interface ResumeSubscriptionResponse {
  subscription: BillingOverviewSubscription;
}

export interface RetryPaymentRequest {
  invoiceId?: string;
  paymentMethodId?: string;
}

export interface ApplyDiscountRequest {
  code: string;
}

export interface ProrationPreviewQuery {
  planId: Exclude<BillingPlanId, 'custom'>;
  billingCycle: BillingCycle;
  couponCode?: string;
}

export interface ProrationPreviewResponse {
  amountDueToday: MoneyAmount;
  newRecurringAmount: MoneyAmount;
  creditApplied: MoneyAmount;
  description: string;
}

export interface DownloadInvoicePdfResponse {
  downloadUrl: string;
}

export interface StripeWebhookResponse {
  received: true;
  duplicate: boolean;
}

export interface BillingAuditLogItem {
  id: string;
  action: string;
  actorType: BillingActorType;
  actorId: string | null;
  outcome: BillingAuditOutcome;
  errorCode: string | null;
  occurredAt: string;
  metadata: JsonObject | null;
}

export interface BillingReconciliationAlertItem {
  id: string;
  customerId: string | null;
  subscriptionId: string | null;
  paymentId: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  diff: JsonObject;
  createdAt: string;
}

export interface BillingAdminCustomerSummary {
  customer: BillingCustomer;
  subscription: BillingSubscription | null;
  paymentMethods: BillingPaymentMethod[];
  invoices: BillingInvoiceItem[];
  payments: BillingPayment[];
  auditLogs: BillingAuditLogItem[];
}

export interface BillingAdminReconciliationReport {
  generatedAt: string;
  openAlerts: BillingReconciliationAlertItem[];
}

export interface AdminRefundRequest {
  paymentId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface AdminManualChargeRequest {
  customerId: string;
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethodId?: string;
}
