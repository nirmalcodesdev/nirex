import { Types } from 'mongoose';
import type Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import {
  sendBillingCheckoutCompletedEmail,
  sendBillingPaymentFailedEmail,
  sendBillingPaymentSucceededEmail,
  sendBillingSubscriptionStateEmail,
} from '../../utils/mailer.js';
import { usageService } from '../usage/usage.service.js';
import { userRepository } from '../user/user.repository.js';
import {
  getBillingPlan,
  getBillingPlans,
  getPlanPrice,
  resolvePlanFromStripePriceId,
} from './billing.catalog.js';
import { billingRepository } from './billing.repository.js';
import { getStripeClient, getStripeWebhookSecret, isStripeConfigured } from './billing.stripe.js';
import type {
  IBillingCustomerDocument,
  IBillingInvoiceDocument,
  IBillingSubscriptionDocument,
  PaymentMethodSnapshot,
} from './billing.model.js';
import type {
  BillingCycle,
  BillingInvoiceItem,
  BillingOverviewPaymentMethod,
  BillingOverviewResponse,
  BillingOverviewSubscription,
  BillingPlan,
  BillingPlanId,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  CreatePortalSessionInput,
  CreatePortalSessionResult,
} from './billing.types.js';

const ACTIVE_SUBSCRIPTION_STATUSES: Array<IBillingSubscriptionDocument['status']> = [
  'trialing',
  'active',
  'incomplete',
  'past_due',
  'unpaid',
  'paused',
];

function toDateFromUnix(unixTimestamp: number | null | undefined): Date | undefined {
  if (typeof unixTimestamp !== 'number' || Number.isNaN(unixTimestamp)) return undefined;
  return new Date(unixTimestamp * 1000);
}

function toIsoString(date: Date | undefined): string | null {
  return date ? date.toISOString() : null;
}

function statusFromStripeInvoice(
  status: Stripe.Invoice.Status | null,
): 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | 'unknown' {
  if (status === 'draft') return 'draft';
  if (status === 'open') return 'open';
  if (status === 'paid') return 'paid';
  if (status === 'uncollectible') return 'uncollectible';
  if (status === 'void') return 'void';
  return 'unknown';
}

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

function getStripeResourceId(
  resource:
    | string
    | { id?: string | null }
    | null
    | undefined,
): string | null {
  if (!resource) return null;
  if (typeof resource === 'string') return resource;
  return resource.id ?? null;
}

function resolveSubscriptionPeriod(
  subscription: Stripe.Subscription,
): { start?: Date; end?: Date } {
  const starts = subscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === 'number');
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');

  return {
    start:
      starts.length > 0
        ? toDateFromUnix(Math.min(...starts))
        : undefined,
    end:
      ends.length > 0
        ? toDateFromUnix(Math.max(...ends))
        : undefined,
  };
}

function mapCardPaymentMethod(
  paymentMethod: Stripe.PaymentMethod | string | null | undefined,
): PaymentMethodSnapshot | undefined {
  if (!paymentMethod || typeof paymentMethod === 'string') return undefined;
  if (paymentMethod.type !== 'card' || !paymentMethod.card) return undefined;

  return {
    id: paymentMethod.id,
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
    funding: paymentMethod.card.funding ?? null,
  };
}

function resolvePlanNameFromPriceId(
  stripePriceId: string | null | undefined,
): string | null {
  const resolved = resolvePlanFromStripePriceId(stripePriceId);
  if (!resolved) return null;
  const plan = getBillingPlan(resolved.planId);
  return plan?.name ?? null;
}

function getInvoicePrimaryPriceId(invoice: Stripe.Invoice): string | null {
  const firstLine = invoice.lines.data[0] as
    | {
      price?: { id?: string | null } | null;
      pricing?: { price_details?: { price?: string | null } | null } | null;
    }
    | undefined;

  const directPriceId = firstLine?.price?.id;
  if (directPriceId) return directPriceId;

  const priceDetailsId = firstLine?.pricing?.price_details?.price;
  if (priceDetailsId) return priceDetailsId;

  return null;
}

function normalizePlanId(rawPlanId: string | undefined): BillingPlanId {
  if (rawPlanId === 'hobby' || rawPlanId === 'free') return 'free';
  if (rawPlanId === 'pro' || rawPlanId === 'enterprise' || rawPlanId === 'custom') {
    return rawPlanId;
  }
  return 'free';
}

export class BillingService {
  private readonly stripeSubscriptionSyncLimit = 200;
  private readonly stripeInvoiceSyncLimit = 300;

  private billingSyncMinIntervalMs(): number {
    const seconds = Math.max(15, env.BILLING_SYNC_MIN_INTERVAL_SECONDS);
    return seconds * 1000;
  }

  private getAllowedOrigins(): Set<string> {
    const origins = new Set<string>();
    try {
      origins.add(new URL(env.APP_URL).origin);
    } catch {
      // APP_URL is validated at startup.
    }

    for (const origin of env.CORS_ORIGINS) {
      if (origin === '*') continue;
      try {
        origins.add(new URL(origin).origin);
      } catch {
        // Skip malformed optional origins.
      }
    }

    return origins;
  }

  private resolveSafeUrl(input: string | undefined, fallback: string): string {
    const value = input ?? fallback;
    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new AppError('Invalid return URL.', 422, 'INVALID_BILLING_URL');
    }

    const allowedOrigins = this.getAllowedOrigins();
    if (!allowedOrigins.has(parsed.origin)) {
      throw new AppError('Return URL origin is not allowed.', 422, 'INVALID_BILLING_URL');
    }

    return parsed.toString();
  }

  private defaultSuccessUrl(): string {
    return env.BILLING_DEFAULT_SUCCESS_URL ?? `${env.APP_URL}/main/billing?checkout=success`;
  }

  private defaultCancelUrl(): string {
    return env.BILLING_DEFAULT_CANCEL_URL ?? `${env.APP_URL}/main/billing?checkout=cancelled`;
  }

  private defaultPortalReturnUrl(): string {
    return `${env.APP_URL}/main/billing`;
  }

  private assertStripeEnabled(): void {
    if (!isStripeConfigured()) {
      throw new AppError(
        'Billing is not enabled on this environment.',
        503,
        'BILLING_NOT_CONFIGURED',
      );
    }
  }

  private billingPortalUrl(): string {
    return `${env.APP_URL.replace(/\/$/, '')}/main/billing`;
  }

  private shouldSendBillingEmails(): boolean {
    return env.BILLING_EMAIL_NOTIFICATIONS_ENABLED;
  }

  private async resolveBillingRecipientByStripeCustomerId(
    stripeCustomerId: string | null,
  ): Promise<{ email: string; name?: string | null } | null> {
    if (!stripeCustomerId) return null;
    const customer = await billingRepository.findCustomerByStripeCustomerId(stripeCustomerId);
    if (!customer) return null;

    const user = await userRepository.findById(customer.userId);
    const canonicalEmail = user?.email?.toLowerCase().trim();
    if (canonicalEmail) {
      return {
        email: canonicalEmail,
        name: user?.fullName ?? customer.name ?? null,
      };
    }

    if (customer.email) {
      return {
        email: customer.email.toLowerCase().trim(),
        name: customer.name ?? null,
      };
    }

    return null;
  }

  private async getOrCreateCustomer(
    userId: Types.ObjectId,
  ): Promise<IBillingCustomerDocument> {
    const existing = await billingRepository.findCustomerByUserId(userId);
    if (existing) return existing;

    this.assertStripeEnabled();
    const stripe = getStripeClient();
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: userId.toHexString(),
      },
    });

    return billingRepository.upsertCustomer({
      userId,
      stripeCustomerId: customer.id,
      email: user.email,
      name: user.fullName,
    });
  }

  private async syncCustomerFromStripe(
    userId: Types.ObjectId,
    stripeCustomerId: string,
    fallbackEmail?: string,
    fallbackName?: string,
  ): Promise<IBillingCustomerDocument | null> {
    this.assertStripeEnabled();
    const stripe = getStripeClient();

    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    if ('deleted' in customer && customer.deleted) {
      return null;
    }

    const paymentMethod = mapCardPaymentMethod(
      customer.invoice_settings.default_payment_method,
    );

    const email =
      customer.email ??
      fallbackEmail ??
      `${stripeCustomerId}@nirex.local.invalid`;

    const name = customer.name ?? fallbackName;

    return billingRepository.upsertCustomer({
      userId,
      stripeCustomerId: customer.id,
      email,
      name,
      defaultPaymentMethod: paymentMethod,
    });
  }

  private async syncSubscriptionFromStripe(
    subscription: Stripe.Subscription,
  ): Promise<IBillingSubscriptionDocument | null> {
    const stripeCustomerId = getStripeCustomerId(subscription.customer);
    if (!stripeCustomerId) return null;

    let customerDoc = await billingRepository.findCustomerByStripeCustomerId(
      stripeCustomerId,
    );

    if (!customerDoc) {
      const metadataUserId = subscription.metadata?.['userId'];
      if (!metadataUserId || !Types.ObjectId.isValid(metadataUserId)) {
        logger.warn('Skipping subscription sync without customer mapping.', {
          subscriptionId: subscription.id,
          stripeCustomerId,
        });
        return null;
      }

      const userId = new Types.ObjectId(metadataUserId);
      const user = await userRepository.findById(userId);
      customerDoc = await this.syncCustomerFromStripe(
        userId,
        stripeCustomerId,
        user?.email,
        user?.fullName,
      );
      if (!customerDoc) return null;
    }

    const primaryPrice = subscription.items.data[0]?.price;
    const stripePriceId = primaryPrice?.id;
    const resolvedPlan = resolvePlanFromStripePriceId(stripePriceId);

    const recurringInterval = primaryPrice?.recurring?.interval;
    const inferredCycle: BillingCycle =
      recurringInterval === 'year' ? 'year' : 'month';

    const billingCycle = resolvedPlan?.billingCycle ?? inferredCycle;
    const planId = resolvedPlan?.planId ?? 'custom';
    const amountCents = primaryPrice?.unit_amount ?? 0;
    const currency = (primaryPrice?.currency ?? subscription.currency ?? 'usd').toLowerCase();
    const latestInvoiceId = getStripeResourceId(subscription.latest_invoice);
    const period = resolveSubscriptionPeriod(subscription);

    return billingRepository.upsertSubscription({
      userId: customerDoc.userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: stripePriceId ?? undefined,
      planId,
      billingCycle,
      status: subscription.status,
      currency,
      amountCents,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      canceledAt: toDateFromUnix(subscription.canceled_at),
      endedAt: toDateFromUnix(subscription.ended_at),
      trialStart: toDateFromUnix(subscription.trial_start),
      trialEnd: toDateFromUnix(subscription.trial_end),
      latestInvoiceId: latestInvoiceId ?? undefined,
    });
  }

  private async syncInvoiceFromStripe(
    invoice: Stripe.Invoice,
    options?: { strictCustomerMapping?: boolean },
  ): Promise<IBillingInvoiceDocument | null> {
    if (!invoice.id) {
      logger.warn('Skipping invoice sync because Stripe invoice id is missing.');
      return null;
    }

    const stripeCustomerId = getStripeCustomerId(invoice.customer);
    if (!stripeCustomerId) return null;

    const customerDoc = await billingRepository.findCustomerByStripeCustomerId(
      stripeCustomerId,
    );

    let resolvedCustomer = customerDoc;
    if (!resolvedCustomer && isStripeConfigured()) {
      const stripe = getStripeClient();
      let mappedUserId: Types.ObjectId | null = null;

      try {
        const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
        const metadataUserId =
          !('deleted' in stripeCustomer && stripeCustomer.deleted)
            ? stripeCustomer.metadata?.['userId']
            : undefined;
        if (
          metadataUserId &&
          Types.ObjectId.isValid(metadataUserId)
        ) {
          mappedUserId = new Types.ObjectId(metadataUserId);
        }
      } catch (error) {
        logger.warn('Failed to retrieve Stripe customer while syncing invoice.', {
          invoiceId: invoice.id,
          stripeCustomerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (!mappedUserId) {
        const stripeSubscriptionId = getStripeResourceId(
          invoice.parent?.subscription_details?.subscription,
        );
        if (stripeSubscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const metadataUserId = subscription.metadata?.['userId'];
            if (metadataUserId && Types.ObjectId.isValid(metadataUserId)) {
              mappedUserId = new Types.ObjectId(metadataUserId);
            }
          } catch (error) {
            logger.warn('Failed to retrieve Stripe subscription while syncing invoice.', {
              invoiceId: invoice.id,
              stripeCustomerId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (mappedUserId) {
        const user = await userRepository.findById(mappedUserId);
        resolvedCustomer = await this.syncCustomerFromStripe(
          mappedUserId,
          stripeCustomerId,
          user?.email,
          user?.fullName,
        );
      }
    }

    if (!resolvedCustomer) {
      logger.warn('Skipping invoice sync without customer mapping.', {
        invoiceId: invoice.id,
        stripeCustomerId,
      });
      if (options?.strictCustomerMapping) {
        throw new AppError(
          'Unable to map invoice to a billing customer.',
          409,
          'BILLING_CUSTOMER_MAPPING_NOT_FOUND',
        );
      }
      return null;
    }

    const firstLine = invoice.lines.data[0];
    const periodStart = toDateFromUnix(firstLine?.period?.start);
    const periodEnd = toDateFromUnix(firstLine?.period?.end);
    const paidAt = toDateFromUnix(invoice.status_transitions.paid_at);
    const dueDate = toDateFromUnix(invoice.due_date);
    const stripeSubscriptionId = getStripeResourceId(
      invoice.parent?.subscription_details?.subscription,
    );
    const taxCents =
      invoice.total_taxes?.reduce(
        (sum, taxItem) => sum + (taxItem.amount ?? 0),
        0,
      ) ?? 0;

    return billingRepository.upsertInvoice({
      userId: resolvedCustomer.userId,
      stripeCustomerId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      number: invoice.number ?? undefined,
      status: statusFromStripeInvoice(invoice.status),
      currency: (invoice.currency ?? 'usd').toLowerCase(),
      subtotalCents: invoice.subtotal ?? 0,
      taxCents,
      totalCents: invoice.total ?? 0,
      amountDueCents: invoice.amount_due ?? 0,
      amountPaidCents: invoice.amount_paid ?? 0,
      amountRemainingCents: invoice.amount_remaining ?? 0,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdfUrl: invoice.invoice_pdf ?? undefined,
      dueDate,
      paidAt,
      periodStart,
      periodEnd,
      stripeCreatedAt: toDateFromUnix(invoice.created) ?? new Date(),
    });
  }

  private async listSubscriptionsForCustomer(
    stripe: Stripe,
    stripeCustomerId: string,
    maxItems: number,
  ): Promise<Stripe.Subscription[]> {
    const data: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;

    while (data.length < maxItems) {
      const page = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all',
        limit: Math.min(100, maxItems - data.length),
        starting_after: startingAfter,
      });
      data.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }

    if (data.length >= maxItems) {
      logger.warn('Subscription sync truncated at configured maximum.', {
        stripeCustomerId,
        maxItems,
      });
    }

    return data;
  }

  private async listInvoicesForCustomer(
    stripe: Stripe,
    stripeCustomerId: string,
    maxItems: number,
  ): Promise<Stripe.Invoice[]> {
    const data: Stripe.Invoice[] = [];
    let startingAfter: string | undefined;

    while (data.length < maxItems) {
      const page = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: Math.min(100, maxItems - data.length),
        starting_after: startingAfter,
      });
      data.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }

    if (data.length >= maxItems) {
      logger.warn('Invoice sync truncated at configured maximum.', {
        stripeCustomerId,
        maxItems,
      });
    }

    return data;
  }

  private async refreshBillingState(
    userId: Types.ObjectId,
    options?: { force?: boolean },
  ): Promise<void> {
    if (!isStripeConfigured()) return;
    const customer = await billingRepository.findCustomerByUserId(userId);
    if (!customer) return;
    if (!options?.force && customer.lastStripeSyncAt) {
      const elapsed = Date.now() - customer.lastStripeSyncAt.getTime();
      if (elapsed < this.billingSyncMinIntervalMs()) {
        return;
      }
    }

    const stripe = getStripeClient();
    await this.syncCustomerFromStripe(
      userId,
      customer.stripeCustomerId,
      customer.email,
      customer.name,
    );

    const [subscriptions, invoices] = await Promise.all([
      this.listSubscriptionsForCustomer(
        stripe,
        customer.stripeCustomerId,
        this.stripeSubscriptionSyncLimit,
      ),
      this.listInvoicesForCustomer(
        stripe,
        customer.stripeCustomerId,
        this.stripeInvoiceSyncLimit,
      ),
    ]);

    await Promise.all(
      subscriptions.map((subscription) =>
        this.syncSubscriptionFromStripe(subscription),
      ),
    );

    await Promise.all(
      invoices.map((invoice) => this.syncInvoiceFromStripe(invoice)),
    );

    await billingRepository.markCustomerStripeSynced(userId);
  }

  private mapPaymentMethod(
    paymentMethod: PaymentMethodSnapshot | undefined,
  ): BillingOverviewPaymentMethod | null {
    if (!paymentMethod) return null;
    return {
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expMonth: paymentMethod.expMonth,
      expYear: paymentMethod.expYear,
      funding: paymentMethod.funding ?? null,
    };
  }

  private mapInvoice(doc: IBillingInvoiceDocument): BillingInvoiceItem {
    return {
      invoiceId: doc.stripeInvoiceId,
      number: doc.number ?? null,
      status: doc.status,
      currency: doc.currency,
      subtotalCents: doc.subtotalCents,
      taxCents: doc.taxCents,
      totalCents: doc.totalCents,
      amountDueCents: doc.amountDueCents,
      amountPaidCents: doc.amountPaidCents,
      amountRemainingCents: doc.amountRemainingCents,
      paidAt: toIsoString(doc.paidAt),
      dueDate: toIsoString(doc.dueDate),
      periodStart: toIsoString(doc.periodStart),
      periodEnd: toIsoString(doc.periodEnd),
      hostedInvoiceUrl: doc.hostedInvoiceUrl ?? null,
      invoicePdfUrl: doc.invoicePdfUrl ?? null,
      createdAt: doc.stripeCreatedAt.toISOString(),
    };
  }

  private mapSubscriptionOverview(
    subscription: IBillingSubscriptionDocument | null,
  ): BillingOverviewSubscription {
    if (!subscription) {
      return {
        subscriptionId: null,
        status: 'none',
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }

    return {
      subscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: toIsoString(subscription.currentPeriodStart),
      currentPeriodEnd: toIsoString(subscription.currentPeriodEnd),
    };
  }

  private calculateYearlySavings(
    plan: BillingPlan,
    billingCycle: BillingCycle | null,
  ): number {
    if (billingCycle !== 'year') return 0;
    const monthly = plan.prices.month?.amountCents;
    const yearly = plan.prices.year?.amountCents;
    if (!monthly || !yearly) return 0;
    const savings = monthly * 12 - yearly;
    return savings > 0 ? savings : 0;
  }

  private async resolveUsageData(
    userId: Types.ObjectId,
    currentPlan: BillingPlan,
  ): Promise<{
    creditsUsed: number | null;
    creditsIncluded: number | null;
    creditsUsagePct: number | null;
  }> {
    try {
      const usageOverview = await usageService.getOverview(userId, 'month_to_date');
      const creditsUsed = Math.round(usageOverview.summary.credits_used);
      const includedCredits = currentPlan.includedCredits;

      return {
        creditsUsed,
        creditsIncluded: includedCredits,
        creditsUsagePct:
          includedCredits && includedCredits > 0
            ? Number(((creditsUsed / includedCredits) * 100).toFixed(2))
            : null,
      };
    } catch {
      return {
        creditsUsed: null,
        creditsIncluded: currentPlan.includedCredits,
        creditsUsagePct: null,
      };
    }
  }

  async getBillingOverview(userId: Types.ObjectId): Promise<BillingOverviewResponse> {
    const plans = getBillingPlans();
    const now = new Date();

    if (!isStripeConfigured()) {
      const freePlan = getBillingPlan('free') as BillingPlan;
      return {
        billingEnabled: false,
        customerId: null,
        currentPlan: freePlan,
        subscription: this.mapSubscriptionOverview(null),
        paymentMethod: null,
        usage: {
          creditsUsed: null,
          creditsIncluded: freePlan.includedCredits,
          creditsUsagePct: null,
        },
        kpis: {
          currentPlanAmountCents: 0,
          currency: 'usd',
          totalPaidYtdCents: 0,
          nextBillingDate: null,
          yearlySavingsCents: 0,
        },
        invoices: [],
        plans,
      };
    }

    try {
      await this.refreshBillingState(userId);
    } catch (error) {
      logger.warn('Failed to refresh billing state. Using cached DB snapshot.', {
        userId: userId.toHexString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const [customer, activeSubscription] = await Promise.all([
      billingRepository.findCustomerByUserId(userId),
      billingRepository.findLatestSubscriptionByUserId(
        userId,
        ACTIVE_SUBSCRIPTION_STATUSES,
      ),
    ]);

    const currentPlanId = normalizePlanId(activeSubscription?.planId);
    const currentPlan = getBillingPlan(currentPlanId) ?? (getBillingPlan('free') as BillingPlan);
    const usage = await this.resolveUsageData(userId, currentPlan);
    const [invoices, totalPaidYtdCents] = await Promise.all([
      billingRepository.listInvoicesByUserId(userId, 20),
      billingRepository.getPaidInvoicesYtdTotalCents(userId, now.getUTCFullYear()),
    ]);

    const subscriptionCycle: BillingCycle | null = activeSubscription
      ? activeSubscription.billingCycle
      : null;

    const currentPlanAmountCents =
      activeSubscription?.amountCents ??
      currentPlan.prices.month?.amountCents ??
      0;

    return {
      billingEnabled: true,
      customerId: customer?.stripeCustomerId ?? null,
      currentPlan,
      subscription: this.mapSubscriptionOverview(activeSubscription),
      paymentMethod: this.mapPaymentMethod(customer?.defaultPaymentMethod),
      usage,
      kpis: {
        currentPlanAmountCents,
        currency: activeSubscription?.currency ?? currentPlan.prices.month?.currency ?? 'usd',
        totalPaidYtdCents,
        nextBillingDate: toIsoString(activeSubscription?.currentPeriodEnd),
        yearlySavingsCents: this.calculateYearlySavings(currentPlan, subscriptionCycle),
      },
      invoices: invoices.map((invoice) => this.mapInvoice(invoice)),
      plans,
    };
  }

  async listInvoices(userId: Types.ObjectId, limit: number): Promise<BillingInvoiceItem[]> {
    if (isStripeConfigured()) {
      try {
        await this.refreshBillingState(userId);
      } catch {
        // Continue with persisted records.
      }
    }
    const invoices = await billingRepository.listInvoicesByUserId(userId, limit);
    return invoices.map((invoice) => this.mapInvoice(invoice));
  }

  async createCheckoutSession(
    userId: Types.ObjectId,
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    this.assertStripeEnabled();

    const plan = getBillingPlan(input.planId);
    if (!plan) {
      throw new AppError('Selected plan does not exist.', 422, 'INVALID_PLAN');
    }
    if (!plan.checkoutEnabled) {
      throw new AppError(
        'Selected plan is not available for direct checkout.',
        422,
        'PLAN_NOT_CHECKOUT_ENABLED',
      );
    }

    const price = getPlanPrice(input.planId, input.billingCycle);
    if (!price?.stripePriceId) {
      throw new AppError(
        'Stripe price is not configured for this billing cycle.',
        503,
        'BILLING_PRICE_NOT_CONFIGURED',
      );
    }

    const existingSubscription = await billingRepository.findLatestSubscriptionByUserId(
      userId,
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
    if (existingSubscription) {
      throw new AppError(
        'An active subscription already exists. Use the billing portal to change plans.',
        409,
        'ACTIVE_SUBSCRIPTION_EXISTS',
      );
    }

    const customer = await this.getOrCreateCustomer(userId);
    const stripe = getStripeClient();
    const successUrl = this.resolveSafeUrl(input.successUrl, this.defaultSuccessUrl());
    const cancelUrl = this.resolveSafeUrl(input.cancelUrl, this.defaultCancelUrl());
    const userIdString = userId.toHexString();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.stripeCustomerId,
      line_items: [{ price: price.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      automatic_tax: {
        enabled: env.STRIPE_AUTOMATIC_TAX_ENABLED,
      },
      client_reference_id: userIdString,
      metadata: {
        userId: userIdString,
        planId: input.planId,
        billingCycle: input.billingCycle,
      },
      subscription_data: {
        metadata: {
          userId: userIdString,
          planId: input.planId,
          billingCycle: input.billingCycle,
        },
      },
    });

    if (!session.url) {
      throw new AppError('Stripe checkout session did not include a redirect URL.', 500, 'BILLING_CHECKOUT_SESSION_INVALID');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async createPortalSession(
    userId: Types.ObjectId,
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResult> {
    this.assertStripeEnabled();
    const customer = await this.getOrCreateCustomer(userId);
    const stripe = getStripeClient();
    const returnUrl = this.resolveSafeUrl(
      input.returnUrl,
      this.defaultPortalReturnUrl(),
    );

    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: customer.stripeCustomerId,
      return_url: returnUrl,
    };
    if (env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID) {
      params.configuration = env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
    }

    const session = await stripe.billingPortal.sessions.create(params);

    return { portalUrl: session.url };
  }

  async deleteSubscription(userId: Types.ObjectId): Promise<BillingOverviewSubscription> {
    this.assertStripeEnabled();
    const stripe = getStripeClient();
    const current = await billingRepository.findLatestSubscriptionByUserId(
      userId,
      ACTIVE_SUBSCRIPTION_STATUSES,
    );

    if (!current) {
      throw new AppError('No active subscription found.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const updated = await stripe.subscriptions.cancel(current.stripeSubscriptionId);
    const synced = await this.syncSubscriptionFromStripe(updated);
    return this.mapSubscriptionOverview(synced);
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.mode !== 'subscription') return;

    const subscriptionId = getStripeResourceId(session.subscription);
    if (!subscriptionId) return;

    const stripe = getStripeClient();
    const stripeCustomerId = getStripeCustomerId(session.customer);
    const metadataUserId = session.client_reference_id ?? session.metadata?.['userId'];

    if (
      stripeCustomerId &&
      metadataUserId &&
      Types.ObjectId.isValid(metadataUserId)
    ) {
      const userId = new Types.ObjectId(metadataUserId);
      const user = await userRepository.findById(userId);
      await this.syncCustomerFromStripe(userId, stripeCustomerId, user?.email, user?.fullName);
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await this.syncSubscriptionFromStripe(subscription);
  }

  private async handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
    await this.syncSubscriptionFromStripe(subscription);
  }

  private async handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
    await this.syncInvoiceFromStripe(invoice, { strictCustomerMapping: true });
  }

  private async sendBillingNotificationForEvent(event: Stripe.Event): Promise<void> {
    if (!this.shouldSendBillingEmails()) return;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') return;
        const recipient = await this.resolveBillingRecipientByStripeCustomerId(
          getStripeCustomerId(session.customer),
        );
        if (!recipient) return;


        const planId = session.metadata?.['planId'] as BillingPlanId | undefined;
        const planName = planId ? getBillingPlan(planId)?.name ?? null : null;
        await sendBillingCheckoutCompletedEmail({
          to: recipient.email,
          customerName: recipient.name,
          planName,
          billingPortalUrl: this.billingPortalUrl(),
        });
        return;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const recipient = await this.resolveBillingRecipientByStripeCustomerId(
          getStripeCustomerId(invoice.customer),
        );
        if (!recipient) return;

        const firstPriceId = getInvoicePrimaryPriceId(invoice);
        await sendBillingPaymentSucceededEmail({
          to: recipient.email,
          customerName: recipient.name,
          planName: resolvePlanNameFromPriceId(firstPriceId),
          amountCents: invoice.amount_paid ?? invoice.total ?? 0,
          currency: invoice.currency ?? 'usd',
          invoiceNumber: invoice.number ?? null,
          invoicePdfUrl: invoice.invoice_pdf ?? null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          paidAt: toDateFromUnix(invoice.status_transitions.paid_at),
          billingPortalUrl: this.billingPortalUrl(),
        });
        return;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const recipient = await this.resolveBillingRecipientByStripeCustomerId(
          getStripeCustomerId(invoice.customer),
        );
        if (!recipient) return;

        const firstPriceId = getInvoicePrimaryPriceId(invoice);
        await sendBillingPaymentFailedEmail({
          to: recipient.email,
          customerName: recipient.name,
          planName: resolvePlanNameFromPriceId(firstPriceId),
          amountCents: invoice.amount_due ?? invoice.total ?? 0,
          currency: invoice.currency ?? 'usd',
          invoiceNumber: invoice.number ?? null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          dueDate: toDateFromUnix(invoice.due_date),
          billingPortalUrl: this.billingPortalUrl(),
        });
        return;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        const recipient = await this.resolveBillingRecipientByStripeCustomerId(
          getStripeCustomerId(subscription.customer),
        );
        if (!recipient) return;

        const planName = resolvePlanNameFromPriceId(subscription.items.data[0]?.price?.id);
        const detailsByEvent: Record<string, { label: string; detail: string }> = {
          'customer.subscription.deleted': {
            label: 'Canceled',
            detail: 'Your subscription has been canceled.',
          },
          'customer.subscription.paused': {
            label: 'Paused',
            detail: 'Your subscription is paused. Access may be limited until it is resumed.',
          },
          'customer.subscription.resumed': {
            label: 'Resumed',
            detail: 'Your subscription is active again.',
          },
        };

        const details = detailsByEvent[event.type];
        if (!details) return;
        await sendBillingSubscriptionStateEmail({
          to: recipient.email,
          customerName: recipient.name,
          planName,
          statusLabel: details.label,
          detail: details.detail,
          billingPortalUrl: this.billingPortalUrl(),
        });
        return;
      }

      default:
        return;
    }
  }

  private async processStripeEvent(event: Stripe.Event): Promise<boolean> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        return true;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await this.handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        return true;
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.updated':
        await this.handleInvoiceEvent(event.data.object as Stripe.Invoice);
        return true;
      default:
        return false;
    }
  }

  async processStripeWebhook(
    rawBody: Buffer,
    signatureHeader: string | string[] | undefined,
  ): Promise<{ received: true; duplicate: boolean }> {
    this.assertStripeEnabled();
    const stripe = getStripeClient();
    const endpointSecret = getStripeWebhookSecret();

    if (!signatureHeader || Array.isArray(signatureHeader)) {
      throw new AppError(
        'Missing Stripe-Signature header.',
        400,
        'INVALID_STRIPE_SIGNATURE',
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        endpointSecret,
        env.STRIPE_WEBHOOK_TOLERANCE_SECONDS,
      );
    } catch (error) {
      logger.warn('Stripe webhook signature verification failed.', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(
        `Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'
        }`,
        400,
        'INVALID_STRIPE_SIGNATURE',
      );
    }

    const claim = await billingRepository.claimWebhookEventForProcessing(
      event.id,
      event.type,
      env.BILLING_WEBHOOK_STALE_RETRY_SECONDS,
    );

    if (!claim.shouldProcess) {
      logger.info('Stripe webhook duplicate delivery ignored.', {
        eventId: event.id,
        eventType: event.type,
      });
      return { received: true, duplicate: true };
    }

    try {
      const handled = await this.processStripeEvent(event);
      if (handled) {
        await billingRepository.markWebhookEventProcessed(event.id);
      } else {
        await billingRepository.markWebhookEventIgnored(event.id);
      }

      if (handled) {
        try {
          await this.sendBillingNotificationForEvent(event);
        } catch (notifyError) {
          logger.error('Billing email notification failed.', {
            eventId: event.id,
            eventType: event.type,
            error: notifyError instanceof Error ? notifyError.message : String(notifyError),
          });
        }
      }

      logger.info('Stripe webhook processed.', {
        eventId: event.id,
        eventType: event.type,
        handled,
      });
      return { received: true, duplicate: false };
    } catch (error) {
      await billingRepository.markWebhookEventFailed(
        event.id,
        error instanceof Error ? error.message : String(error),
      );
      logger.error('Stripe webhook processing failed.', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const billingService = new BillingService();
