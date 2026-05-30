import type { BillingCycle, BillingPlanId, JsonObject } from '@nirex/shared';

export interface GatewayCustomer {
  id: string;
  email?: string;
}

export interface GatewayPaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'wallet' | 'unknown';
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  funding?: string;
}

export interface GatewaySubscription {
  id: string;
  status: string;
  providerPriceId?: string;
  amountMinor: number;
  currency: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface GatewayInvoice {
  id: string;
  providerSubscriptionId?: string;
  invoiceNumber?: string;
  description?: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  amountDueMinor: number;
  amountPaidMinor: number;
  amountRemainingMinor: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  dueAt?: Date;
  paidAt?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  createdAt?: Date;
}

export interface GatewayPaymentIntent {
  id: string;
  status: 'SUCCEEDED' | 'FAILED' | 'REQUIRES_ACTION' | 'PENDING';
  amountMinor: number;
  currency: string;
  failureCode?: string;
  failureMessage?: string;
  requiresActionUrl?: string;
}

export interface GatewayRefund {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  amountMinor: number;
  currency: string;
}

export interface GatewayProduct {
  id: string;
}

export interface GatewayPrice {
  id: string;
  productId: string;
  amountMinor: number;
  currency: string;
  billingCycle: BillingCycle;
}

export interface GatewayEvent {
  id: string;
  type: string;
  createdAt: Date;
  data: unknown;
}

export interface GatewayCheckoutSession {
  id: string;
  url: string;
}

export interface GatewayCheckoutSessionDetail {
  id: string;
  mode: 'subscription' | 'payment' | 'setup';
  status: 'complete' | 'expired' | 'open';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  metadata: JsonObject;
  clientReferenceId: string | null;
  customerId: string | null;
}

export interface GatewayPortalSession {
  url: string;
}

export interface GatewayCreateCustomerParams {
  email?: string;
  name?: string;
  userId: string;
}

export interface GatewaySubscriptionParams {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: JsonObject;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface GatewayCheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  mode?: 'subscription' | 'payment';
  clientReferenceId?: string;
  metadata?: JsonObject;
}

export interface GatewayChargeInvoiceParams {
  providerCustomerId: string;
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethodId?: string;
  idempotencyKey: string;
  metadata?: JsonObject;
}

export interface GatewayRefundPaymentParams {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
  idempotencyKey: string;
}

export interface GatewayProductParams {
  name: string;
  description?: string;
  metadata?: JsonObject;
}

export interface GatewayPriceParams {
  productId: string;
  amountMinor: number;
  currency: string;
  billingCycle: BillingCycle;
  metadata?: JsonObject;
}

export interface GatewayUpcomingInvoiceParams {
  providerCustomerId: string;
  providerSubscriptionId: string;
  newProviderPriceId: string;
}

export interface GatewayUpcomingInvoice {
  amountDueMinor: number;
  currency: string;
  creditAppliedMinor: number;
}

export interface PaymentGatewayPort {
  createCustomer(params: GatewayCreateCustomerParams): Promise<GatewayCustomer>;
  updateCustomer(id: string, params: Partial<GatewayCreateCustomerParams>): Promise<GatewayCustomer>;
  deleteCustomer(id: string): Promise<void>;
  getCustomerDefaultPaymentMethodId(customerId: string): Promise<string | null>;
  listCustomerPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]>;
  listCustomerSubscriptions(customerId: string): Promise<GatewaySubscription[]>;
  listCustomerInvoices(customerId: string, limit?: number): Promise<GatewayInvoice[]>;

  attachPaymentMethod(customerId: string, token: string): Promise<GatewayPaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  createSubscription(params: GatewaySubscriptionParams): Promise<GatewaySubscription>;
  retrieveSubscription(id: string): Promise<GatewaySubscription>;
  updateSubscription(id: string, params: Partial<GatewaySubscriptionParams>): Promise<GatewaySubscription>;
  updateSubscriptionAutoRenewal(id: string, params: { enabled: boolean; idempotencyKey: string }): Promise<GatewaySubscription>;
  cancelSubscription(id: string, params: { atPeriodEnd: boolean; idempotencyKey: string }): Promise<GatewaySubscription>;
  pauseSubscription(id: string, params: { idempotencyKey: string }): Promise<GatewaySubscription>;
  resumeSubscription(id: string, params: { idempotencyKey: string }): Promise<GatewaySubscription>;

  chargeInvoice(invoiceId: string, params: GatewayChargeInvoiceParams): Promise<GatewayPaymentIntent>;
  refundPayment(paymentId: string, params: GatewayRefundPaymentParams): Promise<GatewayRefund>;

  createProduct(params: GatewayProductParams): Promise<GatewayProduct>;
  createPrice(params: GatewayPriceParams): Promise<GatewayPrice>;

  createCheckoutSession(params: GatewayCheckoutSessionParams): Promise<GatewayCheckoutSession>;
  retrieveCheckoutSession(id: string): Promise<GatewayCheckoutSessionDetail>;
  createPortalSession(customerId: string, returnUrl: string, idempotencyKey: string): Promise<GatewayPortalSession>;

  previewUpcomingInvoice(params: GatewayUpcomingInvoiceParams): Promise<GatewayUpcomingInvoice>;
  constructWebhookEvent(payload: Buffer, signature: string, secret: string): GatewayEvent;
}
