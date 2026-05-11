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
import { notificationsService } from '../notifications/notifications.service.js';
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
  IBillingEntitlementDocument,
  IBillingInvoiceDocument,
  IBillingSubscriptionDocument,
  PaymentMethodSnapshot,
} from './billing.model.js';
import type {
  BillingCycle,
  BillingOverviewEntitlement,
  BillingInvoiceItem,
  BillingOverviewPaymentMethod,
  BillingOverviewResponse,
  BillingOverviewSubscription,
  BillingPlan,
  BillingPlanId,
  CancelSubscriptionInput,
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

const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES: Array<IBillingSubscriptionDocument['status']> = [
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

  private async resolveBillingUserIdByStripeCustomerId(
    stripeCustomerId: string | null,
  ): Promise<Types.ObjectId | null> {
    if (!stripeCustomerId) return null;
    const customer = await billingRepository.findCustomerByStripeCustomerId(stripeCustomerId);
    return customer?.userId ?? null;
  }

  private async createInAppBillingNotification(input: {
    userId: Types.ObjectId | null;
    eventId: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!input.userId) return;
    await notificationsService.createNotification(input.userId, {
      kind: 'billing',
      severity: input.severity,
      title: input.title,
      message: input.message,
      action_url: this.billingPortalUrl(),
      dedupe_key: `billing-event:${input.eventId}`,
      metadata: input.metadata,
    });
  }

  private subscriptionEntitlementState(subscription: IBillingSubscriptionDocument): {
    status: BillingOverviewEntitlement['status'];
    canAccessPaidFeatures: boolean;
    issueCode: string | null;
    issueMessage: string | null;
  } {
    if (subscription.status === 'trialing') {
      return {
        status: 'trialing',
        canAccessPaidFeatures: true,
        issueCode: null,
        issueMessage: null,
      };
    }

    if (subscription.status === 'active') {
      return {
        status: 'active',
        canAccessPaidFeatures: true,
        issueCode: null,
        issueMessage: null,
      };
    }

    if (subscription.status === 'past_due') {
      return {
        status: 'past_due_grace',
        canAccessPaidFeatures: true,
        issueCode: 'PAYMENT_PAST_DUE',
        issueMessage: 'Payment is past due. Update the payment method to avoid losing access.',
      };
    }

    if (subscription.status === 'incomplete') {
      return {
        status: 'payment_action_required',
        canAccessPaidFeatures: false,
        issueCode: 'PAYMENT_ACTION_REQUIRED',
        issueMessage: 'Payment requires confirmation before this subscription becomes active.',
      };
    }

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return {
        status: 'canceled',
        canAccessPaidFeatures: false,
        issueCode: null,
        issueMessage: null,
      };
    }

    return {
      status: 'suspended',
      canAccessPaidFeatures: false,
      issueCode: `SUBSCRIPTION_${subscription.status.toUpperCase()}`,
      issueMessage: 'Subscription access is suspended until the billing issue is resolved.',
    };
  }

  private async upsertFreeEntitlement(userId: Types.ObjectId): Promise<IBillingEntitlementDocument> {
    const freePlan = getBillingPlan('free') as BillingPlan;
    return billingRepository.upsertEntitlement({
      userId,
      planId: freePlan.id,
      status: 'none',
      canAccessPaidFeatures: false,
      creditsIncluded: freePlan.includedCredits,
      features: freePlan.features,
      issueCode: null,
      issueMessage: null,
      lastSyncedAt: new Date(),
    });
  }

  private entitlementAccessEndsAt(entitlement: IBillingEntitlementDocument): Date | null {
    return entitlement.accessEndsAt ?? entitlement.currentPeriodEnd ?? null;
  }

  private isEntitlementExpired(
    entitlement: IBillingEntitlementDocument,
    now: Date,
  ): boolean {
    const accessEndsAt = this.entitlementAccessEndsAt(entitlement);
    if (!entitlement.canAccessPaidFeatures || !accessEndsAt) return false;
    return accessEndsAt.getTime() <= now.getTime();
  }

  private isSubscriptionWindowActive(
    subscription: IBillingSubscriptionDocument | null,
    now: Date,
  ): boolean {
    if (!subscription) return false;
    if (!CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      return false;
    }
    if (!subscription.currentPeriodEnd) return true;
    return subscription.currentPeriodEnd.getTime() > now.getTime();
  }

  private async reconcileExpiredEntitlement(
    userId: Types.ObjectId,
    entitlement: IBillingEntitlementDocument,
    activeSubscription: IBillingSubscriptionDocument | null,
    now: Date,
  ): Promise<IBillingEntitlementDocument> {
    if (!this.isEntitlementExpired(entitlement, now)) {
      return entitlement;
    }

    if (activeSubscription && this.isSubscriptionWindowActive(activeSubscription, now)) {
      return this.syncEntitlementFromSubscription(
        activeSubscription,
        'entitlement_resynced_before_expiry',
      );
    }

    const previousPlanId = normalizePlanId(entitlement.planId);
    const expiredAt = this.entitlementAccessEndsAt(entitlement);
    const freeEntitlement = await this.upsertFreeEntitlement(userId);

    await billingRepository.recordBillingEvent({
      userId,
      action: 'entitlement_expired_to_free',
      status: 'success',
      metadata: {
        previousPlanId,
        previousStatus: entitlement.status,
        expiredAt: expiredAt?.toISOString() ?? null,
      },
    });

    await this.createInAppBillingNotification({
      userId,
      eventId: `entitlement-expired:${userId.toHexString()}:${expiredAt?.getTime() ?? now.getTime()}`,
      severity: 'info',
      title: 'Plan expired',
      message: 'Your paid plan expired. Your account has moved to the Free plan.',
      metadata: {
        previousPlanId,
        expiredAt: expiredAt?.toISOString() ?? null,
      },
    });

    return freeEntitlement;
  }

  private async syncEntitlementFromSubscription(
    subscription: IBillingSubscriptionDocument,
    action: string,
  ): Promise<IBillingEntitlementDocument> {
    const planId = normalizePlanId(subscription.planId);
    const plan = getBillingPlan(planId) ?? (getBillingPlan('free') as BillingPlan);
    const state = this.subscriptionEntitlementState(subscription);

    const entitlement = await billingRepository.upsertEntitlement({
      userId: subscription.userId,
      planId,
      status: state.status,
      canAccessPaidFeatures: state.canAccessPaidFeatures,
      creditsIncluded: plan.includedCredits,
      features: plan.features,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      accessEndsAt: subscription.currentPeriodEnd,
      issueCode: state.issueCode,
      issueMessage: state.issueMessage,
      lastSyncedAt: new Date(),
    });

    await billingRepository.recordBillingEvent({
      userId: subscription.userId,
      objectId: subscription.stripeSubscriptionId,
      action,
      status: 'success',
      metadata: {
        planId,
        subscriptionStatus: subscription.status,
        entitlementStatus: state.status,
        canAccessPaidFeatures: state.canAccessPaidFeatures,
      },
    });

    return entitlement;
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

    const userIdString = userId.toHexString();
    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: userIdString,
        },
      },
      {
        idempotencyKey: `billing:customer:create:${userIdString}`,
      },
    );

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

    const synced = await billingRepository.upsertSubscription({
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

    await this.syncEntitlementFromSubscription(synced, 'subscription_synced');
    return synced;
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

  private mapEntitlementOverview(
    entitlement: IBillingEntitlementDocument | null,
  ): BillingOverviewEntitlement {
    if (!entitlement) {
      return {
        status: 'none',
        planId: 'free',
        canAccessPaidFeatures: false,
        isBillingIssue: false,
        issueCode: null,
        issueMessage: null,
        accessEndsAt: null,
        lastSyncedAt: null,
      };
    }

    return {
      status: entitlement.status,
      planId: normalizePlanId(entitlement.planId),
      canAccessPaidFeatures: entitlement.canAccessPaidFeatures,
      isBillingIssue: Boolean(entitlement.issueCode),
      issueCode: entitlement.issueCode ?? null,
      issueMessage: entitlement.issueMessage ?? null,
      accessEndsAt: toIsoString(entitlement.accessEndsAt),
      lastSyncedAt: entitlement.lastSyncedAt.toISOString(),
    };
  }

  private calculateYearlySavings(
    plan: BillingPlan,
    subscription: IBillingSubscriptionDocument | null,
  ): number {
    if (!subscription || subscription.billingCycle !== 'year') return 0;
    const monthly = plan.prices.month?.amountCents;
    if (!monthly || monthly <= 0) return 0;

    const yearly = plan.prices.year?.amountCents;
    if (!yearly || yearly <= 0) return 0;

    const planMonthlyCurrency = plan.prices.month?.currency?.toLowerCase();
    const planYearlyCurrency = plan.prices.year?.currency?.toLowerCase();
    const subscriptionCurrency = subscription.currency.toLowerCase();
    if (planMonthlyCurrency && planMonthlyCurrency !== subscriptionCurrency) return 0;
    if (planYearlyCurrency && planYearlyCurrency !== subscriptionCurrency) return 0;

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

  async getBillingOverview(
    userId: Types.ObjectId,
    options?: { force?: boolean },
  ): Promise<BillingOverviewResponse> {
    const plans = getBillingPlans();
    const now = new Date();

    if (!isStripeConfigured()) {
      const freePlan = getBillingPlan('free') as BillingPlan;
      return {
        billingEnabled: false,
        customerId: null,
        currentPlan: freePlan,
        subscription: this.mapSubscriptionOverview(null),
        entitlement: {
          status: 'none',
          planId: 'free',
          canAccessPaidFeatures: false,
          isBillingIssue: false,
          issueCode: null,
          issueMessage: null,
          accessEndsAt: null,
          lastSyncedAt: null,
        },
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
          periodEndDate: null,
          nextBillingDate: null,
          yearlySavingsCents: 0,
        },
        invoices: [],
        plans,
      };
    }

    try {
      await this.refreshBillingState(userId, options);
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

    let entitlement = await billingRepository.findEntitlementByUserId(userId);
    if (!entitlement) {
      entitlement = activeSubscription
        ? await this.syncEntitlementFromSubscription(activeSubscription, 'entitlement_backfilled')
        : await this.upsertFreeEntitlement(userId);
    }

    entitlement = await this.reconcileExpiredEntitlement(
      userId,
      entitlement,
      activeSubscription,
      now,
    );

    const currentPlanId = entitlement.canAccessPaidFeatures
      ? normalizePlanId(entitlement.planId)
      : normalizePlanId(activeSubscription?.planId);
    const currentPlan = getBillingPlan(currentPlanId) ?? (getBillingPlan('free') as BillingPlan);
    const usage = await this.resolveUsageData(userId, currentPlan);
    const [invoices, totalPaidYtdCents] = await Promise.all([
      billingRepository.listInvoicesByUserId(userId, 20),
      billingRepository.getPaidInvoicesYtdTotalCents(userId, now.getUTCFullYear()),
    ]);

    let inferredEntitlementCycle: BillingCycle | null = null;
    if (
      entitlement.canAccessPaidFeatures &&
      entitlement.currentPeriodStart &&
      entitlement.currentPeriodEnd
    ) {
      inferredEntitlementCycle =
        entitlement.currentPeriodEnd.getTime() -
          entitlement.currentPeriodStart.getTime() >
          32 * 24 * 60 * 60 * 1000
          ? 'year'
          : 'month';
    }

    const resolvedBillingCycle = activeSubscription?.billingCycle ?? inferredEntitlementCycle;

    const currentPlanAmountCents =
      activeSubscription?.amountCents ??
      (resolvedBillingCycle === 'year' ? currentPlan.prices.year?.amountCents : currentPlan.prices.month?.amountCents) ??
      0;

    const periodEndDate = toIsoString(
      activeSubscription?.currentPeriodEnd ??
      (entitlement.canAccessPaidFeatures
        ? entitlement.accessEndsAt ?? entitlement.currentPeriodEnd
        : undefined),
    );

    return {
      billingEnabled: true,
      customerId: customer?.stripeCustomerId ?? null,
      currentPlan,
      subscription: this.mapSubscriptionOverview(activeSubscription),
      entitlement: this.mapEntitlementOverview(entitlement),
      paymentMethod: this.mapPaymentMethod(customer?.defaultPaymentMethod),
      usage,
      kpis: {
        currentPlanAmountCents,
        currency: activeSubscription?.currency ?? currentPlan.prices.month?.currency ?? 'usd',
        totalPaidYtdCents,
        periodEndDate,
        nextBillingDate: activeSubscription ? toIsoString(activeSubscription.currentPeriodEnd) : null,
        yearlySavingsCents: this.calculateYearlySavings(currentPlan, activeSubscription),
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

    try {
      await this.refreshBillingState(userId, { force: true });
    } catch (error) {
      logger.warn('Failed to force-refresh billing state before checkout.', {
        userId: userId.toHexString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const now = new Date();
    const [existingEntitlementDoc, activeSubscription] = await Promise.all([
      billingRepository.findEntitlementByUserId(userId),
      billingRepository.findLatestSubscriptionByUserId(
        userId,
        CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES,
      ),
    ]);
    let existingEntitlement = existingEntitlementDoc;

    if (existingEntitlement) {
      existingEntitlement = await this.reconcileExpiredEntitlement(
        userId,
        existingEntitlement,
        activeSubscription,
        now,
      );
    }

    const entitlementAccessEndsAt =
      existingEntitlement?.accessEndsAt ?? existingEntitlement?.currentPeriodEnd;
    const hasActiveEntitlement =
      existingEntitlement?.canAccessPaidFeatures === true &&
      (!entitlementAccessEndsAt || entitlementAccessEndsAt > now);

    const hasBlockingSubscription = this.isSubscriptionWindowActive(
      activeSubscription,
      now,
    );

    if (hasActiveEntitlement || hasBlockingSubscription) {
      throw new AppError(
        'You already have an active plan. Wait for it to expire before purchasing again.',
        409,
        'ACTIVE_PLAN_EXISTS',
      );
    }

    const customer = await this.getOrCreateCustomer(userId);
    const stripe = getStripeClient();
    const successUrl = this.resolveSafeUrl(input.successUrl, this.defaultSuccessUrl());
    const cancelUrl = this.resolveSafeUrl(input.cancelUrl, this.defaultCancelUrl());
    const userIdString = userId.toHexString();

    const priceObject = await stripe.prices.retrieve(price.stripePriceId);
    const isRecurring = !!priceObject.recurring;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isRecurring ? 'subscription' : 'payment',
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
    };

    if (isRecurring) {
      sessionParams.subscription_data = {
        metadata: {
          userId: userIdString,
          planId: input.planId,
          billingCycle: input.billingCycle,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: [
        'billing',
        'checkout',
        'v3', // Incremented version to avoid collision with previous failed params
        userIdString,
        input.planId,
        input.billingCycle,
        Buffer.from(successUrl).toString('base64url').slice(0, 48),
      ].join(':'),
    });

    if (!session.url) {
      throw new AppError('Stripe checkout session did not include a redirect URL.', 500, 'BILLING_CHECKOUT_SESSION_INVALID');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
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

      // If this was a subscription-mode checkout, immediately set it to cancel at period end
      // to ensure it remains a one-time purchase.
      if (session.mode === 'subscription' && session.subscription) {
        const stripe = getStripeClient();
        const subscriptionId = getStripeResourceId(session.subscription);
        if (subscriptionId) {
          try {
            await stripe.subscriptions.update(subscriptionId, {
              cancel_at_period_end: true,
            });
          } catch (error) {
            logger.error('Failed to set subscription to cancel at period end after checkout.', {
              subscriptionId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const planId = session.metadata?.['planId'] as BillingPlanId | undefined;
      const billingCycle = session.metadata?.['billingCycle'] as BillingCycle | undefined;

      if (planId && billingCycle) {
        const plan = getBillingPlan(planId);
        if (plan) {
          const now = new Date();
          const endDate = new Date(now);
          if (billingCycle === 'year') {
            endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
          } else {
            endDate.setUTCMonth(endDate.getUTCMonth() + 1);
          }

          await billingRepository.upsertEntitlement({
            userId,
            planId,
            status: 'active',
            canAccessPaidFeatures: true,
            creditsIncluded: plan.includedCredits,
            features: plan.features,
            currentPeriodStart: now,
            currentPeriodEnd: endDate,
            accessEndsAt: endDate,
            lastSyncedAt: now,
          });

          await billingRepository.recordBillingEvent({
            userId,
            objectId: session.id,
            action: 'checkout_fulfilled',
            status: 'success',
            metadata: {
              planId,
              billingCycle,
              mode: session.mode,
            },
          });
        }
      }
    }
  }

  private async handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
    await this.syncInvoiceFromStripe(invoice, { strictCustomerMapping: true });
  }

  private async sendBillingNotificationForEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const stripeCustomerId = getStripeCustomerId(session.customer);
        const [recipient, userId] = await Promise.all([
          this.resolveBillingRecipientByStripeCustomerId(stripeCustomerId),
          this.resolveBillingUserIdByStripeCustomerId(stripeCustomerId),
        ]);
        const planId = session.metadata?.['planId'] as BillingPlanId | undefined;
        const planName = planId ? getBillingPlan(planId)?.name ?? null : null;
        await this.createInAppBillingNotification({
          userId,
          eventId: event.id,
          severity: 'success',
          title: 'Purchase completed',
          message: planName
            ? `Your ${planName} plan purchase is complete.`
            : 'Your purchase is complete.',
          metadata: {
            stripeEventType: event.type,
            planId: planId ?? null,
            planName,
          },
        });
        if (this.shouldSendBillingEmails() && recipient) {
          await sendBillingCheckoutCompletedEmail({
            to: recipient.email,
            customerName: recipient.name,
            planName,
            billingPortalUrl: this.billingPortalUrl(),
          });
        }
        return;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = getStripeCustomerId(invoice.customer);
        const [recipient, userId] = await Promise.all([
          this.resolveBillingRecipientByStripeCustomerId(stripeCustomerId),
          this.resolveBillingUserIdByStripeCustomerId(stripeCustomerId),
        ]);

        const firstPriceId = getInvoicePrimaryPriceId(invoice);
        const planName = resolvePlanNameFromPriceId(firstPriceId);
        await this.createInAppBillingNotification({
          userId,
          eventId: event.id,
          severity: 'success',
          title: 'Invoice paid',
          message: planName
            ? `${planName} invoice ${invoice.number ?? ''} has been paid.`.trim()
            : `Invoice ${invoice.number ?? ''} has been paid.`.trim(),
          metadata: {
            stripeEventType: event.type,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number ?? null,
            amountCents: invoice.amount_paid ?? invoice.total ?? 0,
            currency: invoice.currency ?? 'usd',
          },
        });
        if (this.shouldSendBillingEmails() && recipient) {
          await sendBillingPaymentSucceededEmail({
            to: recipient.email,
            customerName: recipient.name,
            planName,
            amountCents: invoice.amount_paid ?? invoice.total ?? 0,
            currency: invoice.currency ?? 'usd',
            invoiceNumber: invoice.number ?? null,
            invoicePdfUrl: invoice.invoice_pdf ?? null,
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            paidAt: toDateFromUnix(invoice.status_transitions.paid_at),
            billingPortalUrl: this.billingPortalUrl(),
          });
        }
        return;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = getStripeCustomerId(invoice.customer);
        const [recipient, userId] = await Promise.all([
          this.resolveBillingRecipientByStripeCustomerId(stripeCustomerId),
          this.resolveBillingUserIdByStripeCustomerId(stripeCustomerId),
        ]);

        const firstPriceId = getInvoicePrimaryPriceId(invoice);
        const planName = resolvePlanNameFromPriceId(firstPriceId);
        await this.createInAppBillingNotification({
          userId,
          eventId: event.id,
          severity: 'warning',
          title: 'Payment failed',
          message: planName
            ? `Payment failed for your ${planName} plan invoice.`
            : 'Payment failed for your plan invoice.',
          metadata: {
            stripeEventType: event.type,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number ?? null,
            amountCents: invoice.amount_due ?? invoice.total ?? 0,
            currency: invoice.currency ?? 'usd',
            dueDate: toDateFromUnix(invoice.due_date)?.toISOString() ?? null,
          },
        });
        if (this.shouldSendBillingEmails() && recipient) {
          await sendBillingPaymentFailedEmail({
            to: recipient.email,
            customerName: recipient.name,
            planName,
            amountCents: invoice.amount_due ?? invoice.total ?? 0,
            currency: invoice.currency ?? 'usd',
            invoiceNumber: invoice.number ?? null,
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            dueDate: toDateFromUnix(invoice.due_date),
            billingPortalUrl: this.billingPortalUrl(),
          });
        }
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
      case 'invoice.finalized':
      case 'invoice.created':
      case 'invoice.finalization_failed':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required':
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
