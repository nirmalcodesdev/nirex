import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import {
  GatewayRateLimitError,
  GatewayTimeoutError,
  GatewayUnavailableError,
  InvalidPaymentMethodError,
  PaymentDeclinedError,
  PaymentRequiresActionError,
  WebhookSignatureError,
} from './billing.errors.js';
import type {
  GatewayChargeInvoiceParams,
  GatewayCheckoutSession,
  GatewayCheckoutSessionParams,
  GatewayCreateCustomerParams,
  GatewayCustomer,
  GatewayEvent,
  GatewayInvoice,
  GatewayPaymentIntent,
  GatewayPaymentMethod,
  GatewayPortalSession,
  GatewayPrice,
  GatewayPriceParams,
  GatewayProduct,
  GatewayProductParams,
  GatewayRefund,
  GatewayRefundPaymentParams,
  GatewaySubscription,
  GatewaySubscriptionParams,
  GatewayUpcomingInvoice,
  GatewayUpcomingInvoiceParams,
  PaymentGatewayPort,
} from './payment-gateway.port.js';

let stripeClient: Stripe | null = null;
let gatewayAdapter: StripePaymentGatewayAdapter | null = null;

type StripeRequestOptions = Stripe.RequestOptions & {
  timeout?: number;
};
type StripeInvoiceWithId = Stripe.Invoice & { id: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDateFromUnix(unixTimestamp: number | null | undefined): Date | undefined {
  if (typeof unixTimestamp !== 'number' || Number.isNaN(unixTimestamp)) return undefined;
  return new Date(unixTimestamp * 1000);
}

function hasStripeInvoiceId(invoice: Stripe.Invoice): invoice is StripeInvoiceWithId {
  return typeof invoice.id === 'string' && invoice.id.length > 0;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  const raw = value[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const raw = value[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function readStripeObjectId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  const record = readRecord(value);
  return record ? readString(record, 'id') : undefined;
}

function normalizeStripeSubscription(subscription: Stripe.Subscription): GatewaySubscription {
  const firstItem = subscription.items.data[0];
  const price = firstItem?.price;
  const subscriptionRecord = readRecord(subscription as unknown);
  const itemRecord = readRecord(firstItem);
  const currentPeriodStart =
    readNumber(itemRecord ?? {}, 'current_period_start') ??
    readNumber(subscriptionRecord ?? {}, 'current_period_start');
  const currentPeriodEnd =
    readNumber(itemRecord ?? {}, 'current_period_end') ??
    readNumber(subscriptionRecord ?? {}, 'current_period_end');

  const isPaused = Boolean(subscription.pause_collection && typeof subscription.pause_collection === 'object');
  const status = isPaused ? 'paused' : subscription.status;

  return {
    id: subscription.id,
    status,
    providerPriceId: price?.id,
    amountMinor: price?.unit_amount ?? 0,
    currency: price?.currency ?? 'usd',
    currentPeriodStart: toDateFromUnix(currentPeriodStart),
    currentPeriodEnd: toDateFromUnix(currentPeriodEnd),
    trialStart: toDateFromUnix(subscription.trial_start),
    trialEnd: toDateFromUnix(subscription.trial_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

function normalizeStripePaymentMethod(paymentMethod: Stripe.PaymentMethod): GatewayPaymentMethod {
  if (paymentMethod.type === 'card' && paymentMethod.card) {
    return {
      id: paymentMethod.id,
      type: 'card',
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
      funding: paymentMethod.card.funding,
    };
  }

  return {
    id: paymentMethod.id,
    type: paymentMethod.type === 'us_bank_account' ? 'bank_account' : 'unknown',
  };
}

function normalizePaymentIntent(intent: Stripe.PaymentIntent): GatewayPaymentIntent {
  const status: GatewayPaymentIntent['status'] =
    intent.status === 'succeeded'
      ? 'SUCCEEDED'
      : intent.status === 'requires_action' || intent.status === 'requires_confirmation'
        ? 'REQUIRES_ACTION'
        : intent.status === 'canceled'
          ? 'FAILED'
          : 'PENDING';

  return {
    id: intent.id,
    status,
    amountMinor: intent.amount,
    currency: intent.currency,
    failureCode: intent.last_payment_error?.code ?? undefined,
    failureMessage: intent.last_payment_error?.message ?? undefined,
    requiresActionUrl: intent.next_action?.redirect_to_url?.url ?? undefined,
  };
}

function toStripeMetadata(metadata: Record<string, unknown> | undefined): Stripe.MetadataParam | undefined {
  if (!metadata) return undefined;
  const normalized: Stripe.MetadataParam = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      normalized[key] = value;
    } else {
      normalized[key] = JSON.stringify(value);
    }
  }
  return normalized;
}

function normalizeRefund(refund: Stripe.Refund): GatewayRefund {
  const status: GatewayRefund['status'] =
    refund.status === 'succeeded'
      ? 'SUCCEEDED'
      : refund.status === 'failed'
        ? 'FAILED'
        : refund.status === 'canceled'
          ? 'CANCELED'
          : 'PENDING';

  return {
    id: refund.id,
    status,
    amountMinor: refund.amount,
    currency: refund.currency,
  };
}

function normalizeStripeInvoice(invoice: StripeInvoiceWithId): GatewayInvoice {
  const invoiceRecord = readRecord(invoice as unknown);
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  const legacySubscription = readStripeObjectId(invoiceRecord?.subscription);
  const subscription = readStripeObjectId(parentSubscription) ?? legacySubscription;
  const taxMinor = Array.isArray(invoice.total_taxes)
    ? invoice.total_taxes.reduce((sum, item) => sum + item.amount, 0)
    : 0;

  const statusMap: Record<string, GatewayInvoice['status']> = {
    draft: 'DRAFT',
    open: 'OPEN',
    paid: 'PAID',
    void: 'VOID',
    uncollectible: 'UNCOLLECTIBLE',
  };

  const discountMinor = Array.isArray(invoice.total_discount_amounts)
    ? invoice.total_discount_amounts.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    : 0;
  const status = statusMap[invoice.status ?? 'open'] ?? 'OPEN';
  const createdAt = toDateFromUnix(invoice.created ?? undefined);
  const paidAt =
    toDateFromUnix(invoice.status_transitions?.paid_at ?? undefined) ??
    (status === 'PAID' ? createdAt : undefined);

  return {
    id: invoice.id,
    providerSubscriptionId: subscription ?? undefined,
    invoiceNumber: invoice.number ?? undefined,
    description: invoice.description ?? undefined,
    status,
    currency: invoice.currency ?? 'usd',
    subtotalMinor: invoice.subtotal ?? 0,
    taxMinor,
    discountMinor,
    totalMinor: invoice.total ?? 0,
    amountDueMinor: invoice.amount_due ?? 0,
    amountPaidMinor: invoice.amount_paid ?? 0,
    amountRemainingMinor: invoice.amount_remaining ?? 0,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    invoicePdfUrl: invoice.invoice_pdf ?? undefined,
    dueAt: toDateFromUnix(invoice.due_date ?? undefined),
    paidAt,
    periodStart: toDateFromUnix(readNumber(invoiceRecord ?? {}, 'period_start')),
    periodEnd: toDateFromUnix(readNumber(invoiceRecord ?? {}, 'period_end')),
    createdAt,
  };
}

function extractStripeError(error: unknown): {
  code?: string;
  statusCode?: number;
  message: string;
  type?: string;
} {
  const record = readRecord(error);
  return {
    code: typeof record?.code === 'string' ? record.code : undefined,
    statusCode: typeof record?.statusCode === 'number' ? record.statusCode : undefined,
    message: error instanceof Error ? error.message : 'Payment gateway request failed.',
    type: typeof record?.type === 'string' ? record.type : undefined,
  };
}

function normalizeGatewayError(error: unknown): Error {
  const stripeError = extractStripeError(error);

  if (stripeError.type === 'StripeSignatureVerificationError') {
    return new WebhookSignatureError('Stripe webhook signature verification failed.');
  }
  if (stripeError.type === 'StripeCardError') {
    if (stripeError.code === 'authentication_required') {
      return new PaymentRequiresActionError(stripeError.message);
    }
    if (stripeError.code === 'resource_missing' || stripeError.code === 'payment_method_invalid') {
      return new InvalidPaymentMethodError(stripeError.message);
    }
    return new PaymentDeclinedError(
      stripeError.message,
      stripeError.code ? { stripeCode: stripeError.code } : {},
    );
  }
  if (stripeError.statusCode === 429) {
    return new GatewayRateLimitError(stripeError.message);
  }
  if (stripeError.type === 'StripeConnectionError' || stripeError.type === 'StripeAPIError') {
    return new GatewayUnavailableError(stripeError.message);
  }
  if (stripeError.type === 'StripeAPIConnectionError') {
    return new GatewayTimeoutError(stripeError.message);
  }
  return error instanceof Error ? error : new GatewayUnavailableError(stripeError.message);
}

function isRetriableGatewayError(error: unknown): boolean {
  const stripeError = extractStripeError(error);
  return (
    stripeError.statusCode === 429 ||
    (typeof stripeError.statusCode === 'number' && stripeError.statusCode >= 500) ||
    stripeError.type === 'StripeConnectionError' ||
    stripeError.type === 'StripeAPIConnectionError' ||
    stripeError.type === 'StripeAPIError'
  );
}

function requestOptions(idempotencyKey?: string): StripeRequestOptions {
  return {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    timeout: env.BILLING_GATEWAY_TIMEOUT_MS,
  };
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(
      'Billing is not configured on the server.',
      503,
      'BILLING_NOT_CONFIGURED',
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
      appInfo: {
        name: 'Nirex Backend',
        version: '1.0.0',
      },
      maxNetworkRetries: env.BILLING_GATEWAY_MAX_RETRIES,
      timeout: env.BILLING_GATEWAY_TIMEOUT_MS,
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(
      'Stripe webhook secret is not configured.',
      503,
      'BILLING_NOT_CONFIGURED',
    );
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

export class StripePaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly stripe: Stripe = getStripeClient()) { }

  async getCustomerDefaultPaymentMethodId(customerId: string): Promise<string | null> {
    const customer = await this.call('retrieveCustomer', customerId, () =>
      this.stripe.customers.retrieve(customerId),
    );

    if ('deleted' in customer && customer.deleted) {
      return null;
    }

    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
    if (typeof defaultPaymentMethod === 'string' && defaultPaymentMethod.length > 0) {
      return defaultPaymentMethod;
    }
    if (
      defaultPaymentMethod &&
      typeof defaultPaymentMethod === 'object' &&
      'id' in defaultPaymentMethod &&
      typeof defaultPaymentMethod.id === 'string' &&
      defaultPaymentMethod.id.length > 0
    ) {
      return defaultPaymentMethod.id;
    }
    return null;
  }

  async listCustomerPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]> {
    const methods = await this.call('listCustomerPaymentMethods', customerId, () =>
      this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 100,
      }),
    );
    return methods.data.map((method) => normalizeStripePaymentMethod(method));
  }

  async listCustomerSubscriptions(customerId: string): Promise<GatewaySubscription[]> {
    const subscriptions = await this.call('listCustomerSubscriptions', customerId, () =>
      this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      }),
    );
    return subscriptions.data.map((subscription) => normalizeStripeSubscription(subscription));
  }

  async listCustomerInvoices(customerId: string, limit: number = 50): Promise<GatewayInvoice[]> {
    const invoices = await this.call('listCustomerInvoices', customerId, () =>
      this.stripe.invoices.list({
        customer: customerId,
        limit: Math.max(1, Math.min(limit, 100)),
      }),
    );
    return invoices.data.filter(hasStripeInvoiceId).map((invoice) => normalizeStripeInvoice(invoice));
  }

  private async getPreferredCheckoutPaymentMethodId(customerId: string): Promise<string | undefined> {
    const existingDefault = await this.getCustomerDefaultPaymentMethodId(customerId);
    if (existingDefault) {
      return existingDefault;
    }

    const methods = await this.listCustomerPaymentMethods(customerId);
    const firstCard = methods[0];
    if (!firstCard?.id) {
      return undefined;
    }

    await this.call('setDefaultPaymentMethod', customerId, () =>
      this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: firstCard.id },
      }),
    );
    return firstCard.id;
  }

  private async call<T>(
    operation: string,
    customerId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const maxAttempts = Math.max(1, env.BILLING_GATEWAY_MAX_RETRIES);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await fn();
        logger.info('Billing gateway call completed', {
          service: 'billing',
          operation,
          customerId,
          durationMs: Date.now() - startedAt,
          outcome: 'success',
          attempt,
        });
        return result;
      } catch (error) {
        lastError = error;
        if (!isRetriableGatewayError(error) || attempt >= maxAttempts) {
          const normalized = normalizeGatewayError(error);
          logger.warn('Billing gateway call failed', {
            service: 'billing',
            operation,
            customerId,
            durationMs: Date.now() - startedAt,
            outcome: 'failure',
            errorCode: normalized instanceof AppError ? normalized.code : 'GATEWAY_ERROR',
            attempt,
          });
          throw normalized;
        }

        const backoffMs = Math.min(2000, 150 * 2 ** (attempt - 1)) + Math.trunc(Math.random() * 100);
        await sleep(backoffMs);
      }
    }

    throw normalizeGatewayError(lastError);
  }

  async createCustomer(params: GatewayCreateCustomerParams): Promise<GatewayCustomer> {
    const customer = await this.call('createCustomer', params.userId, () =>
      this.stripe.customers.create({
        email: params.email,
        name: params.name,
        metadata: { userId: params.userId },
      }),
    );
    return { id: customer.id, email: typeof customer.email === 'string' ? customer.email : undefined };
  }

  async updateCustomer(id: string, params: Partial<GatewayCreateCustomerParams>): Promise<GatewayCustomer> {
    const customer = await this.call('updateCustomer', id, () =>
      this.stripe.customers.update(id, {
        email: params.email,
        name: params.name,
      }),
    );
    return { id: customer.id, email: typeof customer.email === 'string' ? customer.email : undefined };
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.call('deleteCustomer', id, () => this.stripe.customers.del(id));
  }

  async attachPaymentMethod(customerId: string, token: string): Promise<GatewayPaymentMethod> {
    const paymentMethod = await this.call('attachPaymentMethod', customerId, () =>
      this.stripe.paymentMethods.attach(token, { customer: customerId }),
    );
    return normalizeStripePaymentMethod(paymentMethod);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.call('detachPaymentMethod', undefined, () =>
      this.stripe.paymentMethods.detach(paymentMethodId),
    );
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.call('setDefaultPaymentMethod', customerId, () =>
      this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      }),
    );
  }

  async createSubscription(params: GatewaySubscriptionParams): Promise<GatewaySubscription> {
    const subscription = await this.call('createSubscription', params.customerId, () =>
      this.stripe.subscriptions.create({
        customer: params.customerId,
        items: [{ price: params.priceId }],
        trial_period_days: params.trialDays && params.trialDays > 0 ? params.trialDays : undefined,
        payment_behavior: 'default_incomplete',
        metadata: toStripeMetadata(params.metadata),
      }),
    );
    return normalizeStripeSubscription(subscription);
  }

  async retrieveSubscription(id: string): Promise<GatewaySubscription> {
    const subscription = await this.call('retrieveSubscription', undefined, () =>
      this.stripe.subscriptions.retrieve(id),
    );
    return normalizeStripeSubscription(subscription);
  }

  async updateSubscription(id: string, params: Partial<GatewaySubscriptionParams>): Promise<GatewaySubscription> {
    const current = params.priceId
      ? await this.stripe.subscriptions.retrieve(id)
      : null;
    const itemId = current?.items.data[0]?.id;
    const subscription = await this.call('updateSubscription', undefined, () =>
      this.stripe.subscriptions.update(id, {
        items: params.priceId && itemId ? [{ id: itemId, price: params.priceId }] : undefined,
        proration_behavior: params.priceId ? (params.prorationBehavior ?? 'create_prorations') : undefined,
        metadata: toStripeMetadata(params.metadata),
      }),
    );
    return normalizeStripeSubscription(subscription);
  }

  async cancelSubscription(id: string, params: { atPeriodEnd: boolean; idempotencyKey: string }): Promise<GatewaySubscription> {
    const subscription = params.atPeriodEnd
      ? await this.call('cancelSubscriptionAtPeriodEnd', undefined, () =>
        this.stripe.subscriptions.update(
          id,
          { cancel_at_period_end: true },
          requestOptions(params.idempotencyKey),
        ),
      )
      : await this.call('cancelSubscriptionNow', undefined, () =>
        this.stripe.subscriptions.cancel(id, undefined, requestOptions(params.idempotencyKey)),
      );
    return normalizeStripeSubscription(subscription);
  }

  async updateSubscriptionAutoRenewal(id: string, params: { enabled: boolean; idempotencyKey: string }): Promise<GatewaySubscription> {
    const subscription = await this.call('updateSubscriptionAutoRenewal', undefined, () =>
      this.stripe.subscriptions.update(
        id,
        { cancel_at_period_end: !params.enabled },
        requestOptions(params.idempotencyKey),
      ),
    );
    return normalizeStripeSubscription(subscription);
  }

  async pauseSubscription(id: string, params: { idempotencyKey: string }): Promise<GatewaySubscription> {
    const subscription = await this.call('pauseSubscription', undefined, () =>
      this.stripe.subscriptions.update(
        id,
        { pause_collection: { behavior: 'void' } },
        requestOptions(params.idempotencyKey),
      ),
    );
    return normalizeStripeSubscription(subscription);
  }

  async resumeSubscription(id: string, params: { idempotencyKey: string }): Promise<GatewaySubscription> {
    const subscription = await this.call('resumeSubscription', undefined, () =>
      this.stripe.subscriptions.update(
        id,
        { cancel_at_period_end: false, pause_collection: '' },
        requestOptions(params.idempotencyKey),
      ),
    );
    return normalizeStripeSubscription(subscription);
  }

  async chargeInvoice(invoiceId: string, params: GatewayChargeInvoiceParams): Promise<GatewayPaymentIntent> {
    const intent = await this.call('chargeInvoice', params.providerCustomerId, () =>
      this.stripe.paymentIntents.create(
        {
          amount: params.amountMinor,
          currency: params.currency,
          customer: params.providerCustomerId,
          payment_method: params.paymentMethodId,
          confirm: Boolean(params.paymentMethodId),
          description: params.description,
          metadata: toStripeMetadata({
            ...(params.metadata ?? {}),
            internalInvoiceId: invoiceId,
          }),
        },
        requestOptions(params.idempotencyKey),
      ),
    );
    return normalizePaymentIntent(intent);
  }

  async refundPayment(paymentId: string, params: GatewayRefundPaymentParams): Promise<GatewayRefund> {
    const refund = await this.call('refundPayment', undefined, () =>
      this.stripe.refunds.create(
        {
          payment_intent: params.providerPaymentId,
          amount: params.amountMinor,
          reason: params.reason === 'fraudulent' || params.reason === 'duplicate' || params.reason === 'requested_by_customer'
            ? params.reason
            : undefined,
          metadata: { internalPaymentId: paymentId },
        },
        requestOptions(params.idempotencyKey),
      ),
    );
    return normalizeRefund(refund);
  }

  async createProduct(params: GatewayProductParams): Promise<GatewayProduct> {
    const product = await this.call('createProduct', undefined, () =>
      this.stripe.products.create({
        name: params.name,
        description: params.description,
        metadata: toStripeMetadata(params.metadata),
      }),
    );
    return { id: product.id };
  }

  async createPrice(params: GatewayPriceParams): Promise<GatewayPrice> {
    const price = await this.call('createPrice', undefined, () =>
      this.stripe.prices.create({
        product: params.productId,
        unit_amount: params.amountMinor,
        currency: params.currency,
        recurring: { interval: params.billingCycle },
        metadata: toStripeMetadata(params.metadata),
      }),
    );
    return {
      id: price.id,
      productId: typeof price.product === 'string' ? price.product : price.product.id,
      amountMinor: price.unit_amount ?? params.amountMinor,
      currency: price.currency,
      billingCycle: params.billingCycle,
    };
  }

  async createCheckoutSession(params: GatewayCheckoutSessionParams): Promise<GatewayCheckoutSession> {
    await this.getPreferredCheckoutPaymentMethodId(params.customerId);

    const mode = params.mode ?? 'subscription';
    const isPayment = mode === 'payment';

    const session = await this.call('createCheckoutSession', params.customerId, () =>
      this.stripe.checkout.sessions.create({
        mode,
        customer: params.customerId,
        client_reference_id: params.clientReferenceId,
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        payment_method_collection: isPayment ? undefined : 'always',
        saved_payment_method_options: {
          allow_redisplay_filters: ['always', 'limited', 'unspecified'],
        },
        subscription_data: isPayment ? undefined : {
          trial_period_days: params.trialDays && params.trialDays > 0 ? params.trialDays : undefined,
          metadata: toStripeMetadata(params.metadata),
        },
        metadata: toStripeMetadata(params.metadata),
        automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX_ENABLED },
      }),
    );
    if (!session.url) {
      throw new GatewayUnavailableError('Stripe checkout session did not include a URL.');
    }
    return { id: session.id, url: session.url };
  }

  async createPortalSession(customerId: string, returnUrl: string, idempotencyKey: string): Promise<GatewayPortalSession> {
    const session = await this.call('createPortalSession', customerId, () =>
      this.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          return_url: returnUrl,
          configuration: env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID,
        },
        requestOptions(idempotencyKey),
      ),
    );
    return { url: session.url };
  }

  async previewUpcomingInvoice(params: GatewayUpcomingInvoiceParams): Promise<GatewayUpcomingInvoice> {
    const subscription = await this.call('previewUpcomingInvoice.retrieveSubscription', params.providerCustomerId, () =>
      this.stripe.subscriptions.retrieve(params.providerSubscriptionId, { expand: ['items'] }),
    );
    const firstItemId = subscription.items.data[0]?.id;

    const invoice = await this.call('previewUpcomingInvoice', params.providerCustomerId, () =>
      this.stripe.invoices.createPreview({
        customer: params.providerCustomerId,
        subscription: params.providerSubscriptionId,
        subscription_details: {
          items: firstItemId
            ? [{ id: firstItemId, price: params.newProviderPriceId }]
            : [{ price: params.newProviderPriceId }],
          proration_behavior: 'always_invoice',
        },
      }),
    );

    // Credit lines are proration adjustments with a negative amount
    const creditAppliedMinor = invoice.lines.data
      .filter((line) => {
        const p = line.parent;
        return (p?.invoice_item_details?.proration || p?.subscription_item_details?.proration) && line.amount < 0;
      })
      .reduce((sum, line) => sum + Math.abs(line.amount), 0);

    return {
      amountDueMinor: Math.max(0, invoice.amount_due),
      currency: invoice.currency ?? 'usd',
      creditAppliedMinor,
    };
  }

  constructWebhookEvent(payload: Buffer, signature: string, secret: string): GatewayEvent {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        secret,
        env.STRIPE_WEBHOOK_TOLERANCE_SECONDS,
      );
      return {
        id: event.id,
        type: event.type,
        createdAt: toDateFromUnix(event.created) ?? new Date(),
        data: event.data.object,
      };
    } catch (error) {
      throw normalizeGatewayError(error);
    }
  }
}

export function getPaymentGateway(): PaymentGatewayPort {
  if (!gatewayAdapter) {
    gatewayAdapter = new StripePaymentGatewayAdapter();
  }
  return gatewayAdapter;
}
