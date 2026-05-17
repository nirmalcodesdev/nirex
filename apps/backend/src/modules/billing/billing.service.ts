import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  DEFAULT_BILLING_CURRENCY,
  type BillingAdminCustomerSummary,
  type BillingAdminReconciliationReport,
  type BillingAuditLogItem,
  type BillingCycle,
  type BillingInvoiceItem,
  type BillingInvoicesResponse,
  type BillingOverviewEntitlement,
  type BillingOverviewPaymentMethod,
  type BillingOverviewResponse,
  type BillingOverviewSubscription,
  type BillingPayment,
  type BillingPaymentMethod,
  type BillingPlan,
  type BillingPlanId,
  type BillingReconciliationAlertItem,
  type BillingSubscription,
  type BillingSubscriptionStatus,
  type CreateNotificationRequest,
  type JsonObject,
  type MoneyAmount,
} from '@nirex/shared';
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
import { userRepository } from '../user/user.repository.js';
import { getBillingPlan, getBillingPlans, getPlanPrice, resolvePlanFromStripePriceId } from './billing.catalog.js';
import {
  BillingAuthorizationError,
  BillingError,
  GatewayUnavailableError,
  IdempotencyConflictError,
} from './billing.errors.js';
import { billingMetrics } from './billing.metrics.js';
import type {
  BillingSession,
  IdempotencyStartResult,
} from './billing.repository.js';
import { billingRepository } from './billing.repository.js';
import {
  type IBillingAuditLogDocument,
  type IBillingCustomerDocument,
  type IBillingInvoiceDocument,
  type IBillingPaymentDocument,
  type IBillingPaymentMethodDocument,
  type IBillingReconciliationAlertDocument,
  type IBillingSubscriptionDocument,
  type IBillingWebhookEventDocument,
} from './billing.model.js';
import {
  assertSubscriptionTransition,
  canTransitionSubscription,
} from './domain/subscription-state-machine.js';
import { Money } from './domain/money.js';
import { resolveMonthlyCreditPeriod } from './domain/credit-period.js';
import { getPaymentGateway, getStripeWebhookSecret, isStripeConfigured } from './billing.stripe.js';
import type {
  GatewayEvent,
  GatewayInvoice,
  GatewayPaymentIntent,
  GatewayPaymentMethod,
  GatewaySubscription,
  PaymentGatewayPort,
} from './payment-gateway.port.js';
import type {
  AdminManualChargeRequest,
  AdminRefundRequest,
  ApplyDiscountRequest,
  CancelSubscriptionInput,
  ChangePlanRequest,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  CreatePortalSessionInput,
  CreatePortalSessionResult,
  DownloadInvoicePdfResponse,
  PauseSubscriptionRequest,
  ProrationPreviewQuery,
  ProrationPreviewResponse,
  ResumeSubscriptionRequest,
  ResumeSubscriptionResponse,
  RetryPaymentRequest,
  StripeWebhookResponse,
} from './billing.types.js';

type ActiveSubscriptionStatus = Exclude<BillingSubscriptionStatus, 'NONE'>;
type ActorContext = {
  actorType: 'USER' | 'ADMIN' | 'SYSTEM' | 'WEBHOOK' | 'JOB' | 'API_KEY';
  actorId?: string;
  ip?: string;
  userAgent?: string;
};
type OperationOutcome<T> = { value: T; response: JsonObject };

const ACTIVE_SUBSCRIPTION_STATUSES: ActiveSubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
];

const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES: ActiveSubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
];

const OVERVIEW_SUBSCRIPTION_STATUSES: ActiveSubscriptionStatus[] = [
  ...ACTIVE_SUBSCRIPTION_STATUSES,
  'CANCELED',
];

const EXPLICIT_WEBHOOK_HANDLERS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_method.attached',
]);

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown> | null, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readNestedRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  return readRecord(record?.[key]);
}

function toJsonObject(value: Record<string, unknown> | null | undefined): JsonObject | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function objectIdFromString(value: string, code: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError('Billing resource not found.', 404, code);
  }
  return new Types.ObjectId(value);
}

function hashPayload(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function deterministicKey(parts: Array<string | number | boolean | null | undefined>): string {
  return crypto
    .createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join(':'))
    .digest('hex');
}

function normalizeCurrency(currency: string | undefined): string {
  return (currency ?? DEFAULT_BILLING_CURRENCY).toLowerCase();
}

function mapProviderSubscriptionStatus(status: string): ActiveSubscriptionStatus {
  if (status === 'trialing') return 'TRIALING';
  if (status === 'active') return 'ACTIVE';
  if (status === 'past_due') return 'PAST_DUE';
  if (status === 'unpaid') return 'UNPAID';
  if (status === 'paused') return 'PAUSED';
  if (status === 'canceled' || status === 'incomplete_expired') return 'CANCELED';
  if (status === 'incomplete') return 'PAST_DUE';
  return 'ACTIVE';
}

function mapPlan(plan: BillingPlan): BillingPlan {
  return plan;
}

function mapPaymentMethod(doc: IBillingPaymentMethodDocument): BillingPaymentMethod {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    provider: doc.provider,
    providerPaymentMethodId: doc.providerPaymentMethodId,
    type: doc.type,
    brand: doc.brand ?? null,
    last4: doc.last4 ?? null,
    expMonth: doc.expMonth ?? null,
    expYear: doc.expYear ?? null,
    funding: doc.funding ?? null,
    isDefault: doc.isDefault,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

function mapOverviewPaymentMethod(doc: IBillingPaymentMethodDocument): BillingOverviewPaymentMethod {
  return {
    id: doc._id.toString(),
    brand: doc.brand ?? null,
    last4: doc.last4 ?? null,
    expMonth: doc.expMonth ?? null,
    expYear: doc.expYear ?? null,
    funding: doc.funding ?? null,
  };
}

function mapOverviewSubscription(doc: IBillingSubscriptionDocument | null): BillingOverviewSubscription {
  if (!doc) {
    return {
      subscriptionId: null,
      status: 'NONE',
      planId: 'free',
      billingCycle: null,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEnd: null,
    };
  }

  return {
    subscriptionId: doc._id.toString(),
    status: doc.status,
    planId: doc.planCode,
    billingCycle: doc.billingCycle,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
    currentPeriodStart: iso(doc.currentPeriodStart),
    currentPeriodEnd: iso(doc.currentPeriodEnd),
    trialEnd: iso(doc.trialEnd),
  };
}

function mapSubscription(doc: IBillingSubscriptionDocument): BillingSubscription {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    planId: doc.planCode,
    status: doc.status,
    billingCycle: doc.billingCycle,
    currentPeriodStart: iso(doc.currentPeriodStart),
    currentPeriodEnd: iso(doc.currentPeriodEnd),
    trialStart: iso(doc.trialStart),
    trialEnd: iso(doc.trialEnd),
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
    canceledAt: iso(doc.canceledAt),
    pausedAt: iso(doc.pausedAt),
    providerSubscriptionId: doc.providerSubscriptionId ?? null,
  };
}

function mapInvoice(
  doc: IBillingInvoiceDocument,
  lines: Array<{
    _id: Types.ObjectId;
    invoiceId: Types.ObjectId;
    description: string;
    quantity: number;
    unitAmountMinor: number;
    amountMinor: number;
    currency: string;
    planCode?: BillingPlanId;
    usageRecordId?: Types.ObjectId;
  }> = [],
): BillingInvoiceItem {
  return {
    invoiceId: doc._id.toString(),
    invoiceNumber: doc.invoiceNumber ?? null,
    number: doc.invoiceNumber ?? null,
    description: doc.description ?? null,
    status: doc.status,
    currency: doc.currency,
    subtotalMinor: doc.subtotalMinor,
    subtotalCents: doc.subtotalMinor,
    taxMinor: doc.taxMinor,
    taxCents: doc.taxMinor,
    discountMinor: doc.discountMinor,
    totalMinor: doc.totalMinor,
    totalCents: doc.totalMinor,
    amountDueMinor: doc.amountDueMinor,
    amountDueCents: doc.amountDueMinor,
    amountPaidMinor: doc.amountPaidMinor,
    amountPaidCents: doc.amountPaidMinor,
    amountRemainingMinor: doc.amountRemainingMinor,
    amountRemainingCents: doc.amountRemainingMinor,
    hostedInvoiceUrl: doc.hostedInvoiceUrl ?? null,
    invoicePdfUrl: doc.invoicePdfUrl ?? null,
    dueDate: iso(doc.dueAt),
    paidAt: iso(doc.paidAt),
    periodStart: iso(doc.periodStart),
    periodEnd: iso(doc.periodEnd),
    lineItems: lines.map((line) => ({
      id: line._id.toString(),
      invoiceId: line.invoiceId.toString(),
      description: line.description,
      quantity: line.quantity,
      unitAmount: { amountMinor: line.unitAmountMinor, currency: line.currency },
      amount: { amountMinor: line.amountMinor, currency: line.currency },
      planId: line.planCode ?? null,
      usageRecordId: line.usageRecordId?.toString() ?? null,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

function mapPayment(doc: IBillingPaymentDocument): BillingPayment {
  return {
    id: doc._id.toString(),
    invoiceId: doc.invoiceId?.toString() ?? '',
    paymentMethodId: doc.paymentMethodId?.toString() ?? null,
    status: doc.status,
    amount: { amountMinor: doc.amountMinor, currency: doc.currency },
    failureCode: doc.failureCode ?? null,
    failureMessage: doc.failureMessage ?? null,
    attemptedAt: doc.attemptedAt.toISOString(),
  };
}

function mapAuditLog(doc: IBillingAuditLogDocument): BillingAuditLogItem {
  return {
    id: doc._id.toString(),
    action: doc.action,
    actorType: doc.actorType,
    actorId: doc.actorId ?? null,
    outcome: doc.outcome,
    errorCode: doc.errorCode ?? null,
    occurredAt: doc.occurredAt.toISOString(),
    metadata: toJsonObject(doc.metadata),
  };
}

function mapReconciliationAlert(doc: IBillingReconciliationAlertDocument): BillingReconciliationAlertItem {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId?.toString() ?? null,
    subscriptionId: doc.subscriptionId?.toString() ?? null,
    paymentId: doc.paymentId?.toString() ?? null,
    severity: doc.severity,
    status: doc.status,
    diff: toJsonObject(doc.diff) ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}

function deriveEntitlement(subscription: IBillingSubscriptionDocument | null, planId: BillingPlanId): BillingOverviewEntitlement {
  const status = subscription?.status ?? 'NONE';
  const canAccessPaidFeatures =
    planId !== 'free' && (status === 'TRIALING' || status === 'ACTIVE' || status === 'PAST_DUE');

  return {
    status:
      status === 'TRIALING'
        ? 'trialing'
        : status === 'ACTIVE'
          ? 'active'
          : status === 'PAST_DUE'
            ? 'past_due_grace'
            : status === 'CANCELED'
              ? 'canceled'
              : status === 'UNPAID'
                ? 'suspended'
                : 'none',
    planId,
    canAccessPaidFeatures,
    isBillingIssue: status === 'PAST_DUE' || status === 'UNPAID',
    issueCode: status === 'PAST_DUE' || status === 'UNPAID' ? status : null,
    issueMessage:
      status === 'PAST_DUE'
        ? 'Payment is past due. Update your payment method to keep paid features active.'
        : status === 'UNPAID'
          ? 'Payment retries were exhausted. Paid features are suspended.'
          : null,
    accessEndsAt: iso(subscription?.currentPeriodEnd),
    lastSyncedAt: iso(subscription?.updatedAt),
  };
}

function createBillingLogBase(operation: string, startedAt: number, error?: unknown): JsonObject {
  return {
    service: 'billing',
    operation,
    durationMs: Date.now() - startedAt,
    outcome: error ? 'failure' : 'success',
    errorCode: error instanceof AppError ? error.code : error instanceof Error ? error.name : null,
    timestamp: new Date().toISOString(),
  };
}

async function createBillingNotificationSafely(
  userId: Types.ObjectId,
  input: CreateNotificationRequest,
  context: JsonObject = {},
): Promise<void> {
  try {
    await notificationsService.createNotification(userId, input);
  } catch (error) {
    logger.warn('Failed to create billing notification.', {
      service: 'billing',
      operation: 'billing.notification',
      userId: userId.toString(),
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendBillingEmailSafely(
  notificationType: string,
  userId: Types.ObjectId,
  sendEmail: () => Promise<void>,
  context: JsonObject = {},
): Promise<void> {
  if (!env.BILLING_EMAIL_NOTIFICATIONS_ENABLED) {
    return;
  }
  try {
    await sendEmail();
  } catch (error) {
    logger.error('Billing email notification failed', {
      service: 'billing',
      operation: 'billing.email_notification',
      notificationType,
      userId: userId.toString(),
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function notifyBillingSubscriptionStarted(input: {
  userId: Types.ObjectId;
  user: { email?: string | null; fullName?: string | null } | null;
  planName: string;
  status: ActiveSubscriptionStatus;
  providerSubscriptionId?: string;
  source: string;
  providerEventId?: string;
}): Promise<void> {
  if (input.status !== 'ACTIVE' && input.status !== 'TRIALING') {
    return;
  }

  const isTrialing = input.status === 'TRIALING';
  const metadata: Record<string, unknown> = {
    source: input.source,
    providerSubscriptionId: input.providerSubscriptionId ?? null,
    providerEventId: input.providerEventId ?? null,
    status: input.status,
  };
  const dedupeKey = input.providerSubscriptionId
    ? `billing:subscription-started:${input.providerSubscriptionId}`
    : undefined;

  await createBillingNotificationSafely(
    input.userId,
    {
      kind: 'billing',
      severity: 'info',
      title: isTrialing ? 'Trial started' : 'Subscription activated',
      message: isTrialing
        ? `Your ${input.planName} trial has started! You won't be charged until the trial ends.`
        : `Your ${input.planName} subscription is now active!`,
      dedupe_key: dedupeKey,
      metadata,
    },
    metadata as JsonObject,
  );

  if (input.user?.email) {
    await sendBillingEmailSafely(
      isTrialing ? 'trial_started' : 'checkout_completed',
      input.userId,
      () => sendBillingCheckoutCompletedEmail({
        to: input.user?.email ?? '',
        customerName: input.user?.fullName,
        planName: input.planName,
        billingPortalUrl: `${env.APP_URL}/billing`,
      }),
      metadata as JsonObject,
    );
  }
}

export class BillingAuditService {
  async record(
    input: {
      userId?: Types.ObjectId;
      customerId?: Types.ObjectId;
      subscriptionId?: Types.ObjectId;
      invoiceId?: Types.ObjectId;
      paymentId?: Types.ObjectId;
      action: string;
      outcome: 'SUCCESS' | 'FAILURE' | 'IGNORED';
      before?: JsonObject;
      after?: JsonObject;
      metadata?: JsonObject;
      errorCode?: string;
    },
    actor: ActorContext,
    session?: BillingSession,
  ): Promise<void> {
    await billingRepository.recordAuditLog(
      {
        ...input,
        actorType: actor.actorType,
        actorId: actor.actorId,
        ip: actor.ip,
        userAgent: actor.userAgent,
        occurredAt: new Date(),
      },
      session,
    );
  }
}

export class SubscriptionService {
  constructor(private readonly auditService = new BillingAuditService()) { }

  async transition(
    subscription: IBillingSubscriptionDocument,
    to: ActiveSubscriptionStatus,
    actor: ActorContext,
    fields: Partial<Pick<IBillingSubscriptionDocument, 'cancelAtPeriodEnd' | 'canceledAt' | 'pausedAt' | 'endedAt' | 'currentPeriodStart' | 'currentPeriodEnd'>> = {},
    session?: BillingSession,
  ): Promise<IBillingSubscriptionDocument> {
    assertSubscriptionTransition(subscription.status, to);
    const before: JsonObject = {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };

    const updated = await billingRepository.updateSubscriptionState(
      subscription._id,
      to,
      fields,
      session,
    );
    if (!updated) {
      throw new AppError('Subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    await this.auditService.record(
      {
        userId: subscription.userId,
        customerId: subscription.customerId,
        subscriptionId: subscription._id,
        action: 'subscription.state_transition',
        outcome: 'SUCCESS',
        before,
        after: {
          status: updated.status,
          cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        },
      },
      actor,
      session,
    );

    billingMetrics.increment('billing.subscription.state_change', 1, {
      from_state: subscription.status,
      to_state: to,
    });

    return updated;
  }
}

export class InvoiceService {
  async listForUser(userId: Types.ObjectId, limit: number, cursor?: string): Promise<BillingInvoicesResponse> {
    const result = await billingRepository.listInvoicesByUserId({ userId, limit, cursor });
    const lineItems = await billingRepository.listInvoiceLineItems(result.items.map((invoice) => invoice._id));
    const linesByInvoice = new Map<string, typeof lineItems>();
    for (const line of lineItems) {
      const key = line.invoiceId.toString();
      linesByInvoice.set(key, [...(linesByInvoice.get(key) ?? []), line]);
    }
    return {
      items: result.items.map((invoice) => mapInvoice(invoice, linesByInvoice.get(invoice._id.toString()) ?? [])),
      nextCursor: result.nextCursor,
    };
  }

  async downloadPdf(userId: Types.ObjectId, invoiceId: string): Promise<DownloadInvoicePdfResponse> {
    const invoice = await billingRepository.findInvoiceById(objectIdFromString(invoiceId, 'INVOICE_NOT_FOUND'));
    if (!invoice || invoice.userId.toString() !== userId.toString()) {
      throw new BillingAuthorizationError('Invoice access denied.', {
        userId: userId.toString(),
        invoiceId,
      });
    }
    if (!invoice.invoicePdfUrl) {
      throw new AppError('Invoice PDF is not available yet.', 409, 'INVOICE_PDF_PENDING');
    }
    return { downloadUrl: invoice.invoicePdfUrl };
  }
}

export class WebhookService {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly auditService = new BillingAuditService(),
    private readonly subscriptionService = new SubscriptionService(auditService),
  ) { }

  async ingestStripeWebhook(payload: Buffer, signatureHeader: string | string[] | undefined): Promise<StripeWebhookResponse> {
    if (!isStripeConfigured()) {
      throw new AppError('Billing is not configured on the server.', 503, 'BILLING_NOT_CONFIGURED');
    }
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      throw new AppError('Missing Stripe signature.', 401, 'INVALID_STRIPE_SIGNATURE');
    }

    const event = this.gateway.constructWebhookEvent(payload, signature, getStripeWebhookSecret());
    billingMetrics.increment('billing.webhook.received', 1, {
      event_type: event.type,
      outcome: 'accepted',
    });

    const persisted = await billingRepository.createWebhookEvent({
      providerEventId: event.id,
      eventType: event.type,
      rawPayload: payload.toString('utf8'),
      signature,
      status: 'PENDING',
    });

    if (persisted.duplicate) {
      const existing = await billingRepository.findWebhookEventByProviderId(event.id);
      if (
        existing &&
        (existing.status === 'PENDING' || existing.status === 'FAILED' || existing.status === 'DEAD')
      ) {
        await this.processWebhookEvent(existing._id);
      }
      return { received: true, duplicate: true };
    }

    const webhookId = persisted.doc?._id;
    if (webhookId) {
      await this.processWebhookEvent(webhookId);
    }

    return { received: true, duplicate: false };
  }

  async processWebhookEvent(webhookEventId: Types.ObjectId): Promise<void> {
    const workerId = `webhook:${process.pid}:${Date.now()}`;
    const staleBefore = new Date(
      Date.now() - Math.max(60, env.BILLING_WEBHOOK_STALE_RETRY_SECONDS || 900) * 1000,
    );
    const eventDoc = await billingRepository.claimWebhookEvent(webhookEventId, workerId, staleBefore);
    if (!eventDoc) return;

    try {
      const event = this.gateway.constructWebhookEvent(
        Buffer.from(eventDoc.rawPayload, 'utf8'),
        eventDoc.signature ?? '',
        getStripeWebhookSecret(),
      );

      await billingRepository.withTransaction(async (session) => {
        if (!EXPLICIT_WEBHOOK_HANDLERS.has(event.type)) {
          await this.auditService.record(
            {
              action: `webhook.${event.type}`,
              outcome: 'IGNORED',
              metadata: { providerEventId: event.id },
            },
            { actorType: 'WEBHOOK', actorId: event.id },
            session,
          );
          await billingRepository.markWebhookEventStatus(eventDoc._id, 'IGNORED', undefined, session);
          return { ignored: true };
        }

        await this.routeEvent(event, session);
        await billingRepository.markWebhookEventStatus(eventDoc._id, 'PROCESSED', undefined, session);
        return { processed: true };
      });

      billingMetrics.increment('billing.webhook.received', 1, {
        event_type: eventDoc.eventType,
        outcome: 'processed',
      });
    } catch (error) {
      const maxAttempts = Math.max(3, env.BILLING_GATEWAY_MAX_RETRIES || 3);
      const status = eventDoc.attempts >= maxAttempts ? 'DEAD' : 'FAILED';
      await billingRepository.markWebhookEventStatus(
        eventDoc._id,
        status,
        error instanceof Error ? error.message : String(error),
      );
      billingMetrics.increment('billing.webhook.received', 1, {
        event_type: eventDoc.eventType,
        outcome: 'failed',
      });
      throw error;
    }
  }

  private async routeEvent(event: GatewayEvent, session: BillingSession): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event, session);
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpsert(event, false, session);
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionUpsert(event, true, session);
        return;
      case 'invoice.paid':
        await this.handleInvoiceEvent(event, 'PAID', session);
        return;
      case 'invoice.payment_failed':
        await this.handleInvoiceEvent(event, 'OPEN', session);
        return;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntent(event, 'SUCCEEDED', session);
        return;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntent(event, 'FAILED', session);
        return;
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event, session);
        return;
      default:
        await this.auditService.record(
          {
            action: `webhook.${event.type}`,
            outcome: 'IGNORED',
            metadata: { providerEventId: event.id },
          },
          { actorType: 'WEBHOOK', actorId: event.id },
          session,
        );
    }
  }

  private async handleCheckoutCompleted(event: GatewayEvent, session: BillingSession): Promise<void> {
    await this.auditService.record(
      {
        action: 'webhook.checkout.completed',
        outcome: 'SUCCESS',
        metadata: { providerEventId: event.id },
      },
      { actorType: 'WEBHOOK', actorId: event.id },
      session,
    );
  }

  private async handleSubscriptionUpsert(
    event: GatewayEvent,
    deleted: boolean,
    session: BillingSession,
  ): Promise<void> {
    const data = readRecord(event.data);
    const providerSubscriptionId = readString(data, 'id');
    const providerCustomerId = readString(data, 'customer');
    if (!providerSubscriptionId || !providerCustomerId) return;

    const customer = await billingRepository.findCustomerByProviderCustomerId(providerCustomerId, session);
    if (!customer) return;

    const items = readNestedRecord(data, 'items');
    const itemData = Array.isArray(items?.data) ? items.data : [];
    const firstItem = readRecord(itemData[0]);
    const price = readNestedRecord(firstItem, 'price');
    const providerPriceId = readString(price, 'id');
    const mappedPlan = resolvePlanFromStripePriceId(providerPriceId);
    const status = deleted ? 'CANCELED' : mapProviderSubscriptionStatus(readString(data, 'status') ?? 'active');
    const existing = await billingRepository.findSubscriptionByProviderId(providerSubscriptionId, session);

    const subscription = await billingRepository.upsertSubscription(
      {
        customerId: customer._id,
        userId: customer.userId,
        planCode: mappedPlan?.planId ?? existing?.planCode ?? 'custom',
        billingCycle: mappedPlan?.billingCycle ?? existing?.billingCycle ?? 'month',
        status,
        providerSubscriptionId,
        providerPriceId,
        currency: normalizeCurrency(readString(price, 'currency') ?? existing?.currency),
        amountMinor: readNumber(price, 'unit_amount') ?? existing?.amountMinor ?? 0,
        cancelAtPeriodEnd: readBoolean(data, 'cancel_at_period_end') ?? false,
        currentPeriodStart: toDate(readNumber(firstItem, 'current_period_start')),
        currentPeriodEnd: toDate(readNumber(firstItem, 'current_period_end')),
        trialStart: toDate(readNumber(data, 'trial_start')),
        trialEnd: toDate(readNumber(data, 'trial_end')),
        metadata: { providerEventId: event.id },
      },
      session,
    );

    const user = await userRepository.findById(customer.userId);
    const planName = mappedPlan?.name ?? (existing ? getBillingPlan(existing.planCode)?.name : undefined) ?? 'Nirex Subscription';

    if (!existing && (status === 'ACTIVE' || status === 'TRIALING')) {
      await notifyBillingSubscriptionStarted({
        userId: customer.userId,
        user,
        planName,
        status,
        providerSubscriptionId,
        source: 'webhook.subscription',
        providerEventId: event.id,
      });
    }

    if (existing && existing.status !== status && canTransitionSubscription(existing.status, status)) {
      await this.auditService.record(
        {
          userId: customer.userId,
          customerId: customer._id,
          subscriptionId: subscription._id,
          action: 'webhook.subscription.state_changed',
          outcome: 'SUCCESS',
          before: { status: existing.status },
          after: { status },
          metadata: { providerEventId: event.id },
        },
        { actorType: 'WEBHOOK', actorId: event.id },
        session,
      );

      // Notify of status changes
      if (status === 'CANCELED') {
        if (user?.email) {
          await sendBillingEmailSafely(
            'subscription_state_changed',
            customer.userId,
            () => sendBillingSubscriptionStateEmail({
              to: user.email,
              customerName: user.fullName,
              planName,
              statusLabel: 'Canceled',
              detail: 'Your subscription has been canceled and your access will end at the end of the current billing period.',
              billingPortalUrl: `${env.APP_URL}/billing`,
            }),
            { providerEventId: event.id, providerSubscriptionId },
          );
        }
        await notificationsService.createNotification(customer.userId, {
          kind: 'billing',
          severity: 'warning',
          title: 'Subscription canceled',
          message: `Your ${planName} subscription has been canceled.`,
        });
      } else if (status === 'ACTIVE' && existing.status === 'PAST_DUE') {
        await notificationsService.createNotification(customer.userId, {
          kind: 'billing',
          severity: 'info',
          title: 'Subscription restored',
          message: `Your ${planName} subscription is active again. Thank you!`,
        });
      }
    }
  }

  private async handleInvoiceEvent(
    event: GatewayEvent,
    status: 'PAID' | 'OPEN',
    session: BillingSession,
  ): Promise<void> {
    const data = readRecord(event.data);
    const providerCustomerId = readString(data, 'customer');
    if (!providerCustomerId) return;
    const customer = await billingRepository.findCustomerByProviderCustomerId(providerCustomerId, session);
    if (!customer) return;

    const providerSubscriptionId = readString(data, 'subscription');
    const subscription = providerSubscriptionId
      ? await billingRepository.findSubscriptionByProviderId(providerSubscriptionId, session)
      : null;
    const totalMinor = readNumber(data, 'total') ?? 0;
    const paid = status === 'PAID';
    const invoice = await billingRepository.upsertInvoice(
      {
        customerId: customer._id,
        userId: customer.userId,
        subscriptionId: subscription?._id,
        providerInvoiceId: readString(data, 'id'),
        invoiceNumber: readString(data, 'number'),
        description: readString(data, 'description'),
        status,
        currency: normalizeCurrency(readString(data, 'currency')),
        subtotalMinor: readNumber(data, 'subtotal') ?? totalMinor,
        taxMinor: readNumber(data, 'tax') ?? 0,
        discountMinor: 0,
        totalMinor,
        amountDueMinor: readNumber(data, 'amount_due') ?? totalMinor,
        amountPaidMinor: paid ? readNumber(data, 'amount_paid') ?? totalMinor : 0,
        amountRemainingMinor: paid ? 0 : readNumber(data, 'amount_remaining') ?? totalMinor,
        hostedInvoiceUrl: readString(data, 'hosted_invoice_url'),
        invoicePdfUrl: readString(data, 'invoice_pdf'),
        paidAt: paid ? new Date() : undefined,
        providerCreatedAt: toDate(readNumber(data, 'created')),
      },
      session,
    );

    if (subscription && !paid && canTransitionSubscription(subscription.status, 'PAST_DUE')) {
      await this.subscriptionService.transition(
        subscription,
        'PAST_DUE',
        { actorType: 'WEBHOOK', actorId: event.id },
        {},
        session,
      );
    }

    await this.auditService.record(
      {
        userId: customer.userId,
        customerId: customer._id,
        subscriptionId: subscription?._id,
        invoiceId: invoice._id,
        action: paid ? 'webhook.invoice.paid' : 'webhook.invoice.payment_failed',
        outcome: 'SUCCESS',
        metadata: { providerEventId: event.id },
      },
      { actorType: 'WEBHOOK', actorId: event.id },
      session,
    );

    const user = await userRepository.findById(customer.userId);
    const planName = subscription ? getBillingPlan(subscription.planCode)?.name : 'Nirex Subscription';

    if (paid) {
      if (user?.email) {
        await sendBillingEmailSafely(
          'payment_succeeded',
          customer.userId,
          () => sendBillingPaymentSucceededEmail({
            to: user.email,
            customerName: user.fullName,
            planName,
            amountCents: totalMinor,
            currency: normalizeCurrency(readString(data, 'currency')),
            invoiceNumber: readString(data, 'number'),
            invoicePdfUrl: readString(data, 'invoice_pdf'),
            hostedInvoiceUrl: readString(data, 'hosted_invoice_url'),
            paidAt: new Date(),
            billingPortalUrl: `${env.APP_URL}/billing`,
          }),
          { providerEventId: event.id, providerSubscriptionId: providerSubscriptionId ?? null },
        );
      }
      await notificationsService.createNotification(customer.userId, {
        kind: 'billing',
        severity: 'info',
        title: 'Payment received',
        message: `We received your payment for ${planName}. Thank you!`,
      });
    } else {
      if (user?.email) {
        await sendBillingEmailSafely(
          'payment_failed',
          customer.userId,
          () => sendBillingPaymentFailedEmail({
            to: user.email,
            customerName: user.fullName,
            planName,
            amountCents: totalMinor,
            currency: normalizeCurrency(readString(data, 'currency')),
            invoiceNumber: readString(data, 'number'),
            dueDate: toDate(readNumber(data, 'due_date')),
            hostedInvoiceUrl: readString(data, 'hosted_invoice_url'),
            billingPortalUrl: `${env.APP_URL}/billing`,
          }),
          { providerEventId: event.id, providerSubscriptionId: providerSubscriptionId ?? null },
        );
      }
      await notificationsService.createNotification(customer.userId, {
        kind: 'billing',
        severity: 'error',
        title: 'Payment failed',
        message: `We couldn't process your payment for ${planName}. Please update your payment method.`,
      });
    }
  }

  private async handlePaymentIntent(
    event: GatewayEvent,
    status: 'SUCCEEDED' | 'FAILED',
    session: BillingSession,
  ): Promise<void> {
    const data = readRecord(event.data);
    const providerCustomerId = readString(data, 'customer');
    if (!providerCustomerId) return;
    const customer = await billingRepository.findCustomerByProviderCustomerId(providerCustomerId, session);
    if (!customer) return;

    const amountMinor = readNumber(data, 'amount') ?? 0;
    await billingRepository.createPayment(
      {
        customerId: customer._id,
        userId: customer.userId,
        providerPaymentId: readString(data, 'id'),
        idempotencyKey: `webhook:${event.id}`,
        status,
        amountMinor,
        currency: normalizeCurrency(readString(data, 'currency')),
        failureCode: readNestedRecord(data, 'last_payment_error') ? readString(readNestedRecord(data, 'last_payment_error'), 'code') : undefined,
        failureMessage: readNestedRecord(data, 'last_payment_error') ? readString(readNestedRecord(data, 'last_payment_error'), 'message') : undefined,
      },
      session,
    );
  }

  private async handlePaymentMethodAttached(event: GatewayEvent, session: BillingSession): Promise<void> {
    const data = readRecord(event.data);
    const providerCustomerId = readString(data, 'customer');
    const paymentMethodId = readString(data, 'id');
    if (!providerCustomerId || !paymentMethodId) return;
    const customer = await billingRepository.findCustomerByProviderCustomerId(providerCustomerId, session);
    if (!customer) return;

    const card = readNestedRecord(data, 'card');
    await billingRepository.upsertPaymentMethod(
      {
        customerId: customer._id,
        userId: customer.userId,
        providerPaymentMethodId: paymentMethodId,
        type: readString(data, 'type') === 'card' ? 'card' : 'unknown',
        brand: readString(card, 'brand'),
        last4: readString(card, 'last4'),
        expMonth: readNumber(card, 'exp_month'),
        expYear: readNumber(card, 'exp_year'),
        funding: readString(card, 'funding'),
      },
      session,
    );
  }

}

function toDate(unixTimestamp: number | undefined): Date | undefined {
  if (typeof unixTimestamp !== 'number' || Number.isNaN(unixTimestamp)) return undefined;
  return new Date(unixTimestamp * 1000);
}

export class DunningService {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly auditService = new BillingAuditService(),
    private readonly subscriptionService = new SubscriptionService(auditService),
  ) { }

  scheduleDays(): number[] {
    return Array.isArray(env.BILLING_DUNNING_SCHEDULE_DAYS) && env.BILLING_DUNNING_SCHEDULE_DAYS.length > 0
      ? env.BILLING_DUNNING_SCHEDULE_DAYS
      : [0, 3, 7, 14, 21];
  }

  async schedule(subscription: IBillingSubscriptionDocument, invoiceId?: Types.ObjectId, session?: BillingSession): Promise<void> {
    const startedAt = subscription.currentPeriodEnd ?? new Date();
    for (const day of this.scheduleDays()) {
      const scheduledAt = new Date(startedAt.getTime() + day * 24 * 60 * 60 * 1000);
      await billingRepository.createDunningAttempt(
        {
          subscriptionId: subscription._id,
          invoiceId,
          customerId: subscription.customerId,
          userId: subscription.userId,
          day,
          scheduledAt,
        },
        session,
      );
    }
  }

  async runDue(now: Date = new Date()): Promise<number> {
    const attempts = await billingRepository.listDueDunningAttempts(now);
    let processed = 0;
    for (const attempt of attempts) {
      const subscription = await billingRepository.findSubscriptionById(attempt.subscriptionId);
      if (!subscription || subscription.status !== 'PAST_DUE') {
        await billingRepository.updateDunningAttempt(attempt._id, 'CANCELED');
        continue;
      }

      try {
        await notificationsService.createNotification(subscription.userId, {
          kind: 'billing',
          severity: attempt.day >= 14 ? 'error' : 'warning',
          title: attempt.day >= 21 ? 'Subscription canceled' : 'Payment retry required',
          message:
            attempt.day >= 21
              ? 'Your subscription was canceled after repeated failed payment attempts.'
              : 'We could not collect payment. Please update your billing details.',
          dedupe_key: `billing:dunning:${attempt._id.toString()}`,
        });

        if (attempt.day === 14 && canTransitionSubscription(subscription.status, 'UNPAID')) {
          await billingRepository.withTransaction(async (session) => {
            await this.subscriptionService.transition(
              subscription,
              'UNPAID',
              { actorType: 'JOB', actorId: 'DunningJob' },
              {},
              session,
            );
            await billingRepository.updateDunningAttempt(attempt._id, 'SUCCEEDED', undefined, session);
            return { status: 'UNPAID' };
          });
        } else if (attempt.day >= 21 && canTransitionSubscription(subscription.status, 'CANCELED')) {
          await this.gateway.cancelSubscription(subscription.providerSubscriptionId ?? '', {
            atPeriodEnd: false,
            idempotencyKey: `billing:dunning:cancel:${subscription._id.toString()}:${attempt.day}`,
          });
          await billingRepository.withTransaction(async (session) => {
            await this.subscriptionService.transition(
              subscription,
              'CANCELED',
              { actorType: 'JOB', actorId: 'DunningJob' },
              { canceledAt: new Date(), endedAt: new Date() },
              session,
            );
            await billingRepository.updateDunningAttempt(attempt._id, 'SUCCEEDED', undefined, session);
            return { status: 'CANCELED' };
          });
        } else {
          await billingRepository.updateDunningAttempt(attempt._id, 'SUCCEEDED');
        }

        billingMetrics.increment('billing.dunning.attempt', 1, {
          day: String(attempt.day),
          outcome: 'success',
        });
        processed += 1;
      } catch (error) {
        await billingRepository.updateDunningAttempt(
          attempt._id,
          'FAILED',
          error instanceof AppError ? error.code : 'DUNNING_ERROR',
        );
        billingMetrics.increment('billing.dunning.attempt', 1, {
          day: String(attempt.day),
          outcome: 'failure',
        });
      }
    }
    return processed;
  }
}

export class ReconciliationService {
  constructor(private readonly gateway: PaymentGatewayPort) { }

  async run(): Promise<BillingAdminReconciliationReport> {
    const [subscriptions, payments] = await Promise.all([
      billingRepository.listActiveSubscriptions(),
      billingRepository.listRecentPayments(),
    ]);

    for (const subscription of subscriptions) {
      if (!subscription.providerSubscriptionId) continue;
      try {
        const remote = await this.gateway.retrieveSubscription(subscription.providerSubscriptionId);
        const diff: JsonObject = {};
        const remoteStatus = mapProviderSubscriptionStatus(remote.status);
        if (remoteStatus !== subscription.status) {
          diff.status = { local: subscription.status, remote: remoteStatus };
        }
        if (remote.amountMinor !== subscription.amountMinor) {
          diff.amountMinor = { local: subscription.amountMinor, remote: remote.amountMinor };
        }
        if (normalizeCurrency(remote.currency) !== subscription.currency) {
          diff.currency = { local: subscription.currency, remote: normalizeCurrency(remote.currency) };
        }
        if (Object.keys(diff).length > 0) {
          await billingRepository.createReconciliationAlert({
            customerId: subscription.customerId,
            subscriptionId: subscription._id,
            severity: 'WARNING',
            diff,
          });
          billingMetrics.increment('billing.reconciliation.discrepancy', 1, { type: 'subscription' });
          logger.warn('Billing reconciliation discrepancy', {
            service: 'billing',
            operation: 'reconciliation.subscription',
            customerId: subscription.customerId.toString(),
            subscriptionId: subscription._id.toString(),
            outcome: 'failure',
            diff,
          });
        }
      } catch (error) {
        await billingRepository.createReconciliationAlert({
          customerId: subscription.customerId,
          subscriptionId: subscription._id,
          severity: 'CRITICAL',
          diff: {
            error: error instanceof Error ? error.message : 'Remote subscription lookup failed',
          },
        });
      }
    }

    for (const payment of payments) {
      if (!payment.providerPaymentId || payment.amountMinor < 0) continue;
      if (payment.status === 'FAILED' && payment.providerPaymentId) {
        await billingRepository.createReconciliationAlert({
          customerId: payment.customerId,
          paymentId: payment._id,
          severity: 'INFO',
          diff: { paymentStatus: { local: payment.status, review: 'provider failure retained' } },
        });
      }
    }

    const openAlerts = await billingRepository.listOpenReconciliationAlerts(500);
    return {
      generatedAt: new Date().toISOString(),
      openAlerts: openAlerts.map(mapReconciliationAlert),
    };
  }

  async report(): Promise<BillingAdminReconciliationReport> {
    const openAlerts = await billingRepository.listOpenReconciliationAlerts(500);
    return {
      generatedAt: new Date().toISOString(),
      openAlerts: openAlerts.map(mapReconciliationAlert),
    };
  }
}

export class BillingService {
  private readonly auditService = new BillingAuditService();
  private readonly subscriptionService = new SubscriptionService(this.auditService);
  private readonly invoiceService = new InvoiceService();
  private readonly webhookService: WebhookService;
  private readonly dunningService: DunningService;
  private readonly reconciliationService: ReconciliationService;

  constructor(private readonly gateway: PaymentGatewayPort = getPaymentGateway()) {
    this.webhookService = new WebhookService(gateway, this.auditService, this.subscriptionService);
    this.dunningService = new DunningService(gateway, this.auditService, this.subscriptionService);
    this.reconciliationService = new ReconciliationService(gateway);
  }

  private billingEnabled(): boolean {
    return isStripeConfigured();
  }

  private getAllowedOrigins(): Set<string> {
    const origins = new Set<string>();
    try {
      origins.add(new URL(env.APP_URL).origin);
    } catch {
      return origins;
    }

    for (const origin of env.CORS_ORIGINS ?? []) {
      if (origin === '*') continue;
      try {
        origins.add(new URL(origin).origin);
      } catch {
        logger.warn('Invalid optional CORS origin skipped for billing URL allow-list', {
          service: 'billing',
          operation: 'resolveSafeUrl',
          origin,
        });
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

    if (!this.getAllowedOrigins().has(parsed.origin)) {
      throw new AppError('Return URL origin is not allowed.', 422, 'INVALID_BILLING_URL');
    }

    return parsed.toString();
  }

  private async withOperation<T>(
    operation: string,
    customerId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      logger.info('Billing operation completed', {
        ...createBillingLogBase(operation, startedAt),
        customerId,
      });
      return result;
    } catch (error) {
      logger.warn('Billing operation failed', {
        ...createBillingLogBase(operation, startedAt, error),
        customerId,
      });
      throw error;
    }
  }

  private async runIdempotent<T>(
    key: string,
    operation: string,
    requestPayload: JsonObject,
    executor: () => Promise<OperationOutcome<T>>,
    responseMapper: (response: JsonObject) => T,
  ): Promise<T> {
    const record: IdempotencyStartResult = await billingRepository.startIdempotency(
      key,
      operation,
      hashPayload(requestPayload),
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    if (record.existing) {
      if (record.record.status === 'SUCCEEDED' && record.record.response) {
        return responseMapper(toJsonObject(record.record.response) ?? {});
      }
      if (record.record.status === 'FAILED') {
        throw new AppError('Previous idempotent billing operation failed.', 409, record.record.errorCode ?? 'IDEMPOTENT_OPERATION_FAILED');
      }
      throw new IdempotencyConflictError('Billing operation is already in progress.', { key });
    }

    try {
      const result = await executor();
      await billingRepository.completeIdempotency(key, 'SUCCEEDED', result.response);
      return result.value;
    } catch (error) {
      await billingRepository.completeIdempotency(
        key,
        'FAILED',
        undefined,
        error instanceof AppError ? error.code : 'BILLING_OPERATION_FAILED',
      );
      throw error;
    }
  }

  private async getOrCreateCustomer(userId: Types.ObjectId): Promise<IBillingCustomerDocument> {
    const existing = await billingRepository.findCustomerByUserId(userId);
    if (existing?.providerCustomerId) return existing;
    if (!this.billingEnabled()) {
      throw new AppError('Billing is not configured on the server.', 503, 'BILLING_NOT_CONFIGURED');
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const gatewayCustomer = await this.gateway.createCustomer({
      userId: userId.toString(),
      email: user.email,
      name: user.fullName,
    });

    return billingRepository.withTransaction(async (session) => {
      const customer = await billingRepository.upsertCustomer(
        {
          userId,
          providerCustomerId: gatewayCustomer.id,
        },
        session,
      );
      await this.auditService.record(
        {
          userId,
          customerId: customer._id,
          action: 'customer.created',
          outcome: 'SUCCESS',
          after: { providerCustomerId: gatewayCustomer.id },
        },
        { actorType: 'SYSTEM', actorId: 'BillingService' },
        session,
      );
      return customer;
    });
  }

  private async resolveEligibleTrialDays(userId: Types.ObjectId, plan: BillingPlan): Promise<number> {
    if (plan.trialDays <= 0 || plan.id === 'free' || plan.id === 'custom') {
      return 0;
    }

    const hasUsedTrial = await billingRepository.hasUsedTrialForPlan(userId, plan.id);
    return hasUsedTrial ? 0 : plan.trialDays;
  }

  private async getPlansForUser(userId: Types.ObjectId): Promise<BillingPlan[]> {
    const plans = getBillingPlans();
    const resolved = await Promise.all(
      plans.map(async (plan) => ({
        ...plan,
        trialDays: await this.resolveEligibleTrialDays(userId, plan),
      })),
    );
    return resolved;
  }

  private shouldSyncCustomerFromProvider(
    customer: IBillingCustomerDocument,
    options: { force?: boolean },
  ): boolean {
    if (!customer.providerCustomerId || !this.billingEnabled()) {
      return false;
    }
    if (options.force) {
      return true;
    }
    const minIntervalMs = Math.max(0, env.BILLING_SYNC_MIN_INTERVAL_SECONDS) * 1000;
    const lastSyncMs = customer.lastProviderSyncAt?.getTime() ?? 0;
    return Date.now() - lastSyncMs >= minIntervalMs;
  }

  private async syncCustomerFromProvider(
    userId: Types.ObjectId,
    customer: IBillingCustomerDocument,
  ): Promise<void> {
    if (!customer.providerCustomerId) {
      return;
    }

    const [
      defaultPaymentMethodResult,
      paymentMethodsResult,
      subscriptionsResult,
      invoicesResult,
    ] = await Promise.allSettled([
      this.gateway.getCustomerDefaultPaymentMethodId(customer.providerCustomerId),
      this.gateway.listCustomerPaymentMethods(customer.providerCustomerId),
      this.gateway.listCustomerSubscriptions(customer.providerCustomerId),
      this.gateway.listCustomerInvoices(customer.providerCustomerId, 100),
    ]);

    const syncFailures: string[] = [];
    const readSyncResult = <T>(
      result: PromiseSettledResult<T>,
      operation: string,
      fallback: T,
    ): T => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      syncFailures.push(operation);
      logger.warn('Billing provider sync segment failed; continuing with available data.', {
        service: 'billing',
        operation: `syncCustomerFromProvider.${operation}`,
        userId: userId.toString(),
        customerId: customer._id.toString(),
        providerCustomerId: customer.providerCustomerId,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return fallback;
    };

    const defaultPaymentMethodId = readSyncResult<string | null>(
      defaultPaymentMethodResult,
      'getCustomerDefaultPaymentMethodId',
      null,
    );
    const gatewayPaymentMethods = readSyncResult<GatewayPaymentMethod[]>(
      paymentMethodsResult,
      'listCustomerPaymentMethods',
      [],
    );
    const gatewaySubscriptions = readSyncResult<GatewaySubscription[]>(
      subscriptionsResult,
      'listCustomerSubscriptions',
      [],
    );
    const gatewayInvoices = readSyncResult<GatewayInvoice[]>(
      invoicesResult,
      'listCustomerInvoices',
      [],
    );

    if (syncFailures.length === 4) {
      throw new GatewayUnavailableError('Billing provider sync failed.');
    }

    const startedSubscriptionNotifications: Array<{
      planName: string;
      status: ActiveSubscriptionStatus;
      providerSubscriptionId?: string;
    }> = [];
    const sortedSubscriptions = [...gatewaySubscriptions].sort(
      (a, b) => (b.currentPeriodEnd?.getTime() ?? 0) - (a.currentPeriodEnd?.getTime() ?? 0),
    );
    const targetSubscription =
      sortedSubscriptions.find((subscription) =>
        ACTIVE_SUBSCRIPTION_STATUSES.includes(mapProviderSubscriptionStatus(subscription.status)),
      ) ?? sortedSubscriptions[0] ?? null;

    await billingRepository.withTransaction(async (session) => {
      let firstMethodId: Types.ObjectId | null = null;
      let resolvedDefaultMethodId: Types.ObjectId | null = null;

      for (const method of gatewayPaymentMethods) {
        const savedMethod = await billingRepository.upsertPaymentMethod(
          {
            customerId: customer._id,
            userId,
            providerPaymentMethodId: method.id,
            type: method.type,
            brand: method.brand,
            last4: method.last4,
            expMonth: method.expMonth,
            expYear: method.expYear,
            funding: method.funding,
            isDefault: method.id === defaultPaymentMethodId,
          },
          session,
        );

        if (!firstMethodId) {
          firstMethodId = savedMethod._id;
        }
        if (method.id === defaultPaymentMethodId) {
          resolvedDefaultMethodId = savedMethod._id;
        }
      }

      if (!resolvedDefaultMethodId && firstMethodId) {
        resolvedDefaultMethodId = firstMethodId;
      }
      if (resolvedDefaultMethodId) {
        await billingRepository.setDefaultPaymentMethod(customer._id, resolvedDefaultMethodId, session);
      }

      let syncedSubscription: IBillingSubscriptionDocument | null = null;
      if (targetSubscription) {
        const existing = await billingRepository.findSubscriptionByProviderId(targetSubscription.id, session);
        const mappedPlan = resolvePlanFromStripePriceId(targetSubscription.providerPriceId);
        const planCode = mappedPlan?.planId ?? existing?.planCode ?? 'custom';
        const billingCycle = mappedPlan?.billingCycle ?? existing?.billingCycle ?? 'month';
        const planPrice = mappedPlan ? getPlanPrice(mappedPlan.planId, mappedPlan.billingCycle) : null;
        const status = mapProviderSubscriptionStatus(targetSubscription.status);

        syncedSubscription = await billingRepository.upsertSubscription(
          {
            customerId: customer._id,
            userId,
            planCode,
            billingCycle,
            status,
            providerSubscriptionId: targetSubscription.id,
            providerPriceId: targetSubscription.providerPriceId,
            currency: planPrice?.currency ?? targetSubscription.currency ?? existing?.currency ?? DEFAULT_BILLING_CURRENCY,
            amountMinor: planPrice?.amountMinor ?? targetSubscription.amountMinor ?? existing?.amountMinor ?? 0,
            cancelAtPeriodEnd: targetSubscription.cancelAtPeriodEnd,
            currentPeriodStart: targetSubscription.currentPeriodStart,
            currentPeriodEnd: targetSubscription.currentPeriodEnd,
            trialStart: targetSubscription.trialStart,
            trialEnd: targetSubscription.trialEnd,
            metadata: { source: 'provider.sync' },
          },
          session,
        );

        if (!existing && (status === 'ACTIVE' || status === 'TRIALING')) {
          startedSubscriptionNotifications.push({
            planName: mappedPlan?.name ?? getBillingPlan(planCode)?.name ?? 'Nirex Subscription',
            status,
            providerSubscriptionId: targetSubscription.id,
          });
        }
      }

      for (const invoice of gatewayInvoices) {
        let invoiceSubscriptionId: Types.ObjectId | undefined;
        if (invoice.providerSubscriptionId) {
          if (syncedSubscription?.providerSubscriptionId === invoice.providerSubscriptionId) {
            invoiceSubscriptionId = syncedSubscription._id;
          } else {
            const matching = await billingRepository.findSubscriptionByProviderId(invoice.providerSubscriptionId, session);
            invoiceSubscriptionId = matching?._id;
          }
        }

        await billingRepository.upsertInvoice(
          {
            customerId: customer._id,
            userId,
            subscriptionId: invoiceSubscriptionId,
            providerInvoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            description: invoice.description,
            status: invoice.status,
            currency: invoice.currency,
            subtotalMinor: invoice.subtotalMinor,
            taxMinor: invoice.taxMinor,
            discountMinor: invoice.discountMinor,
            totalMinor: invoice.totalMinor,
            amountDueMinor: invoice.amountDueMinor,
            amountPaidMinor: invoice.amountPaidMinor,
            amountRemainingMinor: invoice.amountRemainingMinor,
            hostedInvoiceUrl: invoice.hostedInvoiceUrl,
            invoicePdfUrl: invoice.invoicePdfUrl,
            dueAt: invoice.dueAt,
            paidAt: invoice.paidAt,
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodEnd,
            providerCreatedAt: invoice.createdAt,
          },
          session,
        );
      }

      if (syncFailures.length === 0) {
        await billingRepository.markCustomerSynced(customer._id, new Date(), session);
      }
      return { ok: true };
    });

    const startedSubscriptionNotification = startedSubscriptionNotifications[0];
    if (startedSubscriptionNotification) {
      const user = await userRepository.findById(userId);
      await notifyBillingSubscriptionStarted({
        userId,
        user,
        planName: startedSubscriptionNotification.planName,
        status: startedSubscriptionNotification.status,
        providerSubscriptionId: startedSubscriptionNotification.providerSubscriptionId,
        source: 'provider.sync',
      });
    }
  }

  async getBillingOverview(
    userId: Types.ObjectId,
    options: { force?: boolean } = {},
  ): Promise<BillingOverviewResponse> {
    return this.withOperation('getBillingOverview', undefined, async () => {
      const customer = await billingRepository.findCustomerByUserId(userId);

      if (customer && this.shouldSyncCustomerFromProvider(customer, options)) {
        try {
          await this.syncCustomerFromProvider(userId, customer);
        } catch (error) {
          logger.warn('Billing provider sync failed; using local state.', {
            service: 'billing',
            operation: 'getBillingOverview.syncCustomerFromProvider',
            userId: userId.toString(),
            customerId: customer._id.toString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const now = new Date();
      const [subscription, paymentMethods, invoices, totalPaidYtdMinor] = await Promise.all([
        billingRepository.findLatestSubscriptionByUserId(userId, OVERVIEW_SUBSCRIPTION_STATUSES),
        billingRepository.listPaymentMethods(userId),
        this.invoiceService.listForUser(userId, 10),
        billingRepository.getPaidInvoicesYtdTotalMinor(userId, now.getUTCFullYear()),
      ]);
      const plans = await this.getPlansForUser(userId);

      const planId = subscription?.planCode ?? 'free';
      const currentPlan = plans.find((plan) => plan.id === planId) ?? plans.find((plan) => plan.id === 'free') ?? plans[0];
      if (!currentPlan) {
        throw new AppError('Billing plan catalog is empty.', 500, 'BILLING_CATALOG_EMPTY');
      }

      const price =
        getPlanPrice(planId, subscription?.billingCycle ?? 'month') ??
        getPlanPrice(planId, 'month') ??
        currentPlan.prices.month;
      const defaultPaymentMethod = paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0] ?? null;
      const periodEnd = subscription?.currentPeriodEnd ?? null;
      const hasActiveCreditWindow =
        subscription !== null &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        Boolean(subscription.currentPeriodStart) &&
        Boolean(subscription.currentPeriodEnd) &&
        (subscription.currentPeriodEnd?.getTime() ?? 0) > now.getTime();
      const creditPeriod = hasActiveCreditWindow && subscription
        ? resolveMonthlyCreditPeriod({
          now,
          billingCycle: subscription.billingCycle,
          subscriptionPeriodStart: subscription.currentPeriodStart ?? null,
          subscriptionPeriodEnd: subscription.currentPeriodEnd ?? null,
        })
        : null;

      return {
        billingEnabled: this.billingEnabled(),
        adminAccess: env.BILLING_ADMIN_USER_IDS?.includes(userId.toString()) ?? false,
        customerId: customer?._id.toString() ?? null,
        providerCustomerId: customer?.providerCustomerId ?? null,
        currentPlan: mapPlan(currentPlan),
        subscription: mapOverviewSubscription(subscription),
        entitlement: deriveEntitlement(subscription, planId),
        paymentMethod: defaultPaymentMethod ? mapOverviewPaymentMethod(defaultPaymentMethod) : null,
        paymentMethods: paymentMethods.map(mapPaymentMethod),
        usage: {
          creditsUsed: null,
          creditsIncluded: currentPlan.includedCredits,
          creditsUsagePct: null,
          creditPeriodStart: creditPeriod?.periodStart.toISOString() ?? null,
          creditPeriodEnd: creditPeriod?.periodEndExclusive.toISOString() ?? null,
          nextCreditResetAt: creditPeriod?.nextCreditResetAt.toISOString() ?? null,
          creditsExpireAt: creditPeriod?.creditsExpireAt.toISOString() ?? null,
        },
        kpis: {
          currentPlanAmountMinor: price?.amountMinor ?? 0,
          currentPlanAmountCents: price?.amountMinor ?? 0,
          currency: price?.currency ?? DEFAULT_BILLING_CURRENCY,
          totalPaidYtdMinor,
          totalPaidYtdCents: totalPaidYtdMinor,
          periodEndDate: iso(periodEnd),
          nextBillingDate: iso(periodEnd),
          nextRenewalAmountMinor: subscription?.amountMinor ?? price?.amountMinor ?? 0,
          yearlySavingsMinor:
            Math.max(
              0,
              (getPlanPrice(planId, 'month')?.amountMinor ?? 0) * 12 -
              (getPlanPrice(planId, 'year')?.amountMinor ?? 0),
            ),
          yearlySavingsCents:
            Math.max(
              0,
              (getPlanPrice(planId, 'month')?.amountMinor ?? 0) * 12 -
              (getPlanPrice(planId, 'year')?.amountMinor ?? 0),
            ),
          lastFetchedAt: now.toISOString(),
        },
        invoices: invoices.items,
        plans,
      };
    });
  }

  async listPlans(userId: Types.ObjectId): Promise<BillingPlan[]> {
    return this.withOperation('listPlans', undefined, async () => this.getPlansForUser(userId));
  }

  async listInvoices(
    userId: Types.ObjectId,
    limitOrInput: number | { limit?: number; cursor?: string } = 20,
  ): Promise<BillingInvoicesResponse> {
    const input = typeof limitOrInput === 'number' ? { limit: limitOrInput } : limitOrInput;
    const customer = await billingRepository.findCustomerByUserId(userId);
    if (customer && this.shouldSyncCustomerFromProvider(customer, { force: false })) {
      try {
        await this.syncCustomerFromProvider(userId, customer);
      } catch (error) {
        logger.warn('Billing provider sync failed during invoice listing; using local state.', {
          service: 'billing',
          operation: 'listInvoices.syncCustomerFromProvider',
          userId: userId.toString(),
          customerId: customer._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.invoiceService.listForUser(userId, input.limit ?? 20, input.cursor);
  }

  async listPaymentMethods(userId: Types.ObjectId): Promise<BillingPaymentMethod[]> {
    const customer = await billingRepository.findCustomerByUserId(userId);
    if (customer && this.shouldSyncCustomerFromProvider(customer, { force: false })) {
      try {
        await this.syncCustomerFromProvider(userId, customer);
      } catch (error) {
        logger.warn('Billing provider sync failed during payment method listing; using local state.', {
          service: 'billing',
          operation: 'listPaymentMethods.syncCustomerFromProvider',
          userId: userId.toString(),
          customerId: customer._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const methods = await billingRepository.listPaymentMethods(userId);
    return methods.map(mapPaymentMethod);
  }

  async createCheckoutSession(
    userId: Types.ObjectId,
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    return this.withOperation('createCheckoutSession', undefined, async () => {
      const plan = getBillingPlan(input.planId);
      const price = getPlanPrice(input.planId, input.billingCycle);
      if (!plan || !price?.providerPriceId) {
        throw new AppError('Plan is not available for checkout.', 422, 'PLAN_NOT_CHECKOUT_ENABLED');
      }

      const existing = await billingRepository.findLatestSubscriptionByUserId(
        userId,
        CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES,
      );
      if (existing && existing.planCode === input.planId && existing.status !== 'CANCELED') {
        throw new AppError('An active subscription already exists.', 409, 'SUBSCRIPTION_ALREADY_ACTIVE');
      }

      const customer = await this.getOrCreateCustomer(userId);
      const successUrl = this.resolveSafeUrl(
        input.successUrl,
        env.BILLING_DEFAULT_SUCCESS_URL ?? `${env.APP_URL}/billing?checkout=success`,
      );
      const cancelUrl = this.resolveSafeUrl(
        input.cancelUrl,
        env.BILLING_DEFAULT_CANCEL_URL ?? `${env.APP_URL}/billing?checkout=cancelled`,
      );
      const trialDays = await this.resolveEligibleTrialDays(userId, plan);

      const session = await this.gateway.createCheckoutSession({
        customerId: customer.providerCustomerId ?? '',
        priceId: price.providerPriceId,
        successUrl,
        cancelUrl,
        trialDays,
        metadata: {
          userId: userId.toString(),
          planId: input.planId,
          billingCycle: input.billingCycle,
          couponCode: input.couponCode ?? null,
        },
      });

      await billingRepository.withTransaction(async (dbSession) => {
        await this.auditService.record(
          {
            userId,
            customerId: customer._id,
            action: 'checkout_session.created',
            outcome: 'SUCCESS',
            metadata: {
              planId: input.planId,
              billingCycle: input.billingCycle,
              providerCheckoutSessionId: session.id,
            },
          },
          { actorType: 'USER', actorId: userId.toString() },
          dbSession,
        );
        return { ok: true };
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    });
  }

  async createPortalSession(
    userId: Types.ObjectId,
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResult> {
    const customer = await billingRepository.findCustomerByUserId(userId);
    if (!customer?.providerCustomerId) {
      throw new AppError('No billing customer found.', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    const returnUrl = this.resolveSafeUrl(input.returnUrl, `${env.APP_URL}/billing`);
    const key = `billing:portal:${deterministicKey([customer._id.toString(), returnUrl])}`;
    const session = await this.gateway.createPortalSession(customer.providerCustomerId, returnUrl, key);
    return { portalUrl: session.url };
  }

  async attachPaymentMethod(userId: Types.ObjectId, input: { providerToken: string; setDefault?: boolean }): Promise<BillingPaymentMethod> {
    const customer = await this.getOrCreateCustomer(userId);
    const gatewayPaymentMethod = await this.gateway.attachPaymentMethod(customer.providerCustomerId ?? '', input.providerToken);
    const existingMethods = await billingRepository.listPaymentMethods(userId);
    const shouldSetDefault = input.setDefault === true || existingMethods.length === 0;
    if (shouldSetDefault) {
      await this.gateway.setDefaultPaymentMethod(customer.providerCustomerId ?? '', gatewayPaymentMethod.id);
    }

    const created = await billingRepository.withTransaction(async (session) => {
      const method = await billingRepository.upsertPaymentMethod(
        {
          customerId: customer._id,
          userId,
          providerPaymentMethodId: gatewayPaymentMethod.id,
          type: gatewayPaymentMethod.type,
          brand: gatewayPaymentMethod.brand,
          last4: gatewayPaymentMethod.last4,
          expMonth: gatewayPaymentMethod.expMonth,
          expYear: gatewayPaymentMethod.expYear,
          funding: gatewayPaymentMethod.funding,
          isDefault: shouldSetDefault,
        },
        session,
      );
      if (shouldSetDefault) {
        await billingRepository.setDefaultPaymentMethod(customer._id, method._id, session);
      }
      await this.auditService.record(
        {
          userId,
          customerId: customer._id,
          action: 'payment_method.attached',
          outcome: 'SUCCESS',
          metadata: { paymentMethodId: method._id.toString() },
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      return method;
    });

    return mapPaymentMethod(created);
  }

  async removePaymentMethod(userId: Types.ObjectId, paymentMethodId: string): Promise<void> {
    const method = await this.getOwnedPaymentMethod(userId, paymentMethodId);
    const active = await billingRepository.findLatestSubscriptionByUserId(userId, ['TRIALING', 'ACTIVE', 'PAST_DUE']);
    if (active && method.isDefault) {
      throw new AppError('Default payment method cannot be removed while subscription is active.', 409, 'DEFAULT_PAYMENT_METHOD_IN_USE');
    }
    await this.gateway.detachPaymentMethod(method.providerPaymentMethodId);
    await billingRepository.withTransaction(async (session) => {
      await billingRepository.detachPaymentMethod(method._id, session);
      await this.auditService.record(
        {
          userId,
          customerId: method.customerId,
          action: 'payment_method.detached',
          outcome: 'SUCCESS',
          metadata: { paymentMethodId },
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      return { ok: true };
    });
  }

  async setDefaultPaymentMethod(userId: Types.ObjectId, paymentMethodId: string): Promise<BillingPaymentMethod> {
    const method = await this.getOwnedPaymentMethod(userId, paymentMethodId);
    const customer = await billingRepository.findCustomerById(method.customerId);
    if (!customer?.providerCustomerId) {
      throw new AppError('Billing customer not found.', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    await this.gateway.setDefaultPaymentMethod(customer.providerCustomerId, method.providerPaymentMethodId);
    await billingRepository.withTransaction(async (session) => {
      await billingRepository.setDefaultPaymentMethod(customer._id, method._id, session);
      await this.auditService.record(
        {
          userId,
          customerId: customer._id,
          action: 'payment_method.default_set',
          outcome: 'SUCCESS',
          metadata: { paymentMethodId },
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      return { ok: true };
    });
    const updated = await this.getOwnedPaymentMethod(userId, paymentMethodId);
    return mapPaymentMethod(updated);
  }

  async changePlan(userId: Types.ObjectId, input: ChangePlanRequest): Promise<BillingOverviewSubscription> {
    const plan = getBillingPlan(input.planId);
    const price = getPlanPrice(input.planId, input.billingCycle);
    if (!plan || !price?.providerPriceId) {
      throw new AppError('Plan is not available.', 422, 'PLAN_NOT_AVAILABLE');
    }
    const providerPriceId = price.providerPriceId;
    const customer = await this.getOrCreateCustomer(userId);
    const existing = await billingRepository.findLatestSubscriptionByUserId(userId, ACTIVE_SUBSCRIPTION_STATUSES);
    const key = `billing:change-plan:${deterministicKey([userId.toString(), existing?._id.toString(), input.planId, input.billingCycle])}`;

    return this.runIdempotent(
      key,
      'changePlan',
      { userId: userId.toString(), planId: input.planId, billingCycle: input.billingCycle },
      async () => {
        const trialDays = await this.resolveEligibleTrialDays(userId, plan);
        const gatewaySubscription: GatewaySubscription = existing?.providerSubscriptionId
          ? await this.gateway.updateSubscription(existing.providerSubscriptionId, {
            priceId: providerPriceId,
            metadata: { userId: userId.toString(), planId: input.planId, billingCycle: input.billingCycle },
          })
          : await this.gateway.createSubscription({
            customerId: customer.providerCustomerId ?? '',
            priceId: providerPriceId,
            trialDays,
            metadata: { userId: userId.toString(), planId: input.planId, billingCycle: input.billingCycle },
          });
        const subscriptionStatus = mapProviderSubscriptionStatus(gatewaySubscription.status);

        const saved = await billingRepository.withTransaction(async (session) => {
          const subscription = await billingRepository.upsertSubscription(
            {
              customerId: customer._id,
              userId,
              planCode: input.planId,
              billingCycle: input.billingCycle,
              status: subscriptionStatus,
              providerSubscriptionId: gatewaySubscription.id,
              providerPriceId,
              currency: price.currency,
              amountMinor: price.amountMinor,
              cancelAtPeriodEnd: gatewaySubscription.cancelAtPeriodEnd,
              currentPeriodStart: gatewaySubscription.currentPeriodStart,
              currentPeriodEnd: gatewaySubscription.currentPeriodEnd,
              trialStart: gatewaySubscription.trialStart,
              trialEnd: gatewaySubscription.trialEnd,
              metadata: { source: 'changePlan' },
            },
            session,
          );
          await this.auditService.record(
            {
              userId,
              customerId: customer._id,
              subscriptionId: subscription._id,
              action: 'subscription.plan_changed',
              outcome: 'SUCCESS',
              before: existing
                ? { planId: existing.planCode, billingCycle: existing.billingCycle }
                : undefined,
              after: { planId: input.planId, billingCycle: input.billingCycle },
            },
            { actorType: 'USER', actorId: userId.toString() },
            session,
          );
          return subscription;
        });
        if (!existing && (subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING')) {
          const user = await userRepository.findById(userId);
          await notifyBillingSubscriptionStarted({
            userId,
            user,
            planName: plan.name,
            status: subscriptionStatus,
            providerSubscriptionId: gatewaySubscription.id,
            source: 'changePlan',
          });
        }
        const response = mapOverviewSubscription(saved);
        return {
          value: response,
          response: { subscriptionId: response.subscriptionId, status: response.status },
        };
      },
      (response) => ({
        subscriptionId: readString(response, 'subscriptionId') ?? null,
        status: (readString(response, 'status') as BillingSubscriptionStatus | undefined) ?? 'ACTIVE',
        planId: input.planId,
        billingCycle: input.billingCycle,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEnd: null,
      }),
    );
  }

  async cancelSubscription(userId: Types.ObjectId, input: CancelSubscriptionInput): Promise<BillingOverviewSubscription> {
    const subscription = await this.requireOwnedSubscription(userId);
    if (!subscription.providerSubscriptionId) {
      throw new AppError('Subscription is missing provider identity.', 409, 'SUBSCRIPTION_PROVIDER_MISSING');
    }
    const atPeriodEnd = input.atPeriodEnd !== false;
    const key = `billing:cancel:${deterministicKey([subscription._id.toString(), atPeriodEnd])}`;

    return this.runIdempotent(
      key,
      'cancelSubscription',
      { subscriptionId: subscription._id.toString(), atPeriodEnd },
      async () => {
        await this.gateway.cancelSubscription(subscription.providerSubscriptionId ?? '', {
          atPeriodEnd,
          idempotencyKey: key,
        });
        const updated = await billingRepository.withTransaction(async (session) => {
          if (atPeriodEnd) {
            const doc = await billingRepository.updateSubscriptionState(
              subscription._id,
              subscription.status,
              { cancelAtPeriodEnd: true },
              session,
            );
            if (!doc) throw new AppError('Subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
            await this.auditService.record(
              {
                userId,
                customerId: subscription.customerId,
                subscriptionId: subscription._id,
                action: 'subscription.cancel_scheduled',
                outcome: 'SUCCESS',
                before: { cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
                after: { cancelAtPeriodEnd: true },
                metadata: { reason: input.reason ?? null },
              },
              { actorType: 'USER', actorId: userId.toString() },
              session,
            );
            await notificationsService.createNotification(userId, {
              kind: 'billing',
              severity: 'warning',
              title: 'Cancellation scheduled',
              message: `Your subscription will remain active until ${subscription.currentPeriodEnd?.toLocaleDateString() ?? 'the end of the period'}, then it will be canceled.`,
            });
            return doc;
          }
          const updated = await this.subscriptionService.transition(
            subscription,
            'CANCELED',
            { actorType: 'USER', actorId: userId.toString() },
            { cancelAtPeriodEnd: false, canceledAt: new Date(), endedAt: new Date() },
            session,
          );
          await notificationsService.createNotification(userId, {
            kind: 'billing',
            severity: 'warning',
            title: 'Subscription canceled',
            message: 'Your subscription has been canceled immediately.',
          });
          return updated;
        });
        const response = mapOverviewSubscription(updated);
        return {
          value: response,
          response: { subscriptionId: response.subscriptionId, status: response.status },
        };
      },
      (response) => ({
        subscriptionId: readString(response, 'subscriptionId') ?? subscription._id.toString(),
        status: (readString(response, 'status') as BillingSubscriptionStatus | undefined) ?? subscription.status,
        planId: subscription.planCode,
        billingCycle: subscription.billingCycle,
        cancelAtPeriodEnd: true,
        currentPeriodStart: iso(subscription.currentPeriodStart),
        currentPeriodEnd: iso(subscription.currentPeriodEnd),
        trialEnd: iso(subscription.trialEnd),
      }),
    );
  }

  async pauseSubscription(userId: Types.ObjectId, _input: PauseSubscriptionRequest = {}): Promise<BillingOverviewSubscription> {
    if (!env.BILLING_FEATURE_PAUSE_ENABLED) {
      throw new AppError('Subscription pause is not enabled.', 403, 'BILLING_PAUSE_DISABLED');
    }
    const subscription = await this.requireOwnedSubscription(userId);
    if (!subscription.providerSubscriptionId) {
      throw new AppError('Subscription is missing provider identity.', 409, 'SUBSCRIPTION_PROVIDER_MISSING');
    }
    const key = `billing:pause:${deterministicKey([subscription._id.toString()])}`;
    await this.gateway.pauseSubscription(subscription.providerSubscriptionId, { idempotencyKey: key });
    const updated = await billingRepository.withTransaction(async (session) => {
      const doc = await this.subscriptionService.transition(
        subscription,
        'PAUSED',
        { actorType: 'USER', actorId: userId.toString() },
        { pausedAt: new Date() },
        session,
      );
      await notificationsService.createNotification(userId, {
        kind: 'billing',
        severity: 'info',
        title: 'Subscription paused',
        message: 'Your subscription has been paused. You will not be charged while it is paused.',
      });
      return doc;
    });
    return mapOverviewSubscription(updated);
  }

  async resumeSubscription(userId: Types.ObjectId, _input: ResumeSubscriptionRequest = {}): Promise<ResumeSubscriptionResponse['subscription']> {
    const subscription = await this.requireOwnedSubscription(userId, ['PAUSED', 'ACTIVE']);
    if (subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd) {
      throw new AppError('Subscription is not scheduled for cancellation.', 409, 'SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCEL');
    }
    if (!subscription.providerSubscriptionId) {
      throw new AppError('Subscription is missing provider identity.', 409, 'SUBSCRIPTION_PROVIDER_MISSING');
    }
    const key = `billing:resume:${deterministicKey([subscription._id.toString()])}`;
    await this.gateway.resumeSubscription(subscription.providerSubscriptionId, { idempotencyKey: key });
    const updated = await billingRepository.withTransaction(async (session) => {
      if (subscription.status === 'PAUSED') {
        const doc = await this.subscriptionService.transition(
          subscription,
          'ACTIVE',
          { actorType: 'USER', actorId: userId.toString() },
          { pausedAt: undefined, cancelAtPeriodEnd: false },
          session,
        );
        await notificationsService.createNotification(userId, {
          kind: 'billing',
          severity: 'info',
          title: 'Subscription resumed',
          message: 'Welcome back! Your subscription is active again.',
        });
        return doc;
      }
      const doc = await billingRepository.updateSubscriptionState(
        subscription._id,
        subscription.status,
        { cancelAtPeriodEnd: false },
        session,
      );
      if (!doc) throw new AppError('Subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
      await this.auditService.record(
        {
          userId,
          customerId: subscription.customerId,
          subscriptionId: subscription._id,
          action: 'subscription.cancel_resumed',
          outcome: 'SUCCESS',
          before: { cancelAtPeriodEnd: true },
          after: { cancelAtPeriodEnd: false },
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      await notificationsService.createNotification(userId, {
        kind: 'billing',
        severity: 'info',
        title: 'Cancellation reversed',
        message: 'Your subscription will continue to renew automatically.',
      });
      return doc;
    });
    return mapOverviewSubscription(updated);
  }

  async retryPayment(userId: Types.ObjectId, input: RetryPaymentRequest): Promise<BillingPayment> {
    const customer = await billingRepository.findCustomerByUserId(userId);
    if (!customer?.providerCustomerId) {
      throw new AppError('Billing customer not found.', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    const subscription = await this.requireOwnedSubscription(userId, ['PAST_DUE', 'UNPAID', 'ACTIVE']);
    const invoiceId = input.invoiceId
      ? objectIdFromString(input.invoiceId, 'INVOICE_NOT_FOUND')
      : subscription.latestInvoiceId;
    if (!invoiceId) {
      throw new AppError('No invoice is available for retry.', 404, 'INVOICE_NOT_FOUND');
    }
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice || invoice.userId.toString() !== userId.toString()) {
      throw new BillingAuthorizationError('Invoice access denied.', { userId: userId.toString() });
    }
    const paymentMethod = input.paymentMethodId
      ? await this.getOwnedPaymentMethod(userId, input.paymentMethodId)
      : null;
    const key = `billing:retry-payment:${deterministicKey([invoice._id.toString(), paymentMethod?._id.toString()])}`;
    const gatewayPayment = await this.gateway.chargeInvoice(invoice._id.toString(), {
      providerCustomerId: customer.providerCustomerId,
      amountMinor: invoice.amountRemainingMinor,
      currency: invoice.currency,
      description: invoice.description ?? `Invoice ${invoice.invoiceNumber ?? invoice._id.toString()}`,
      paymentMethodId: paymentMethod?.providerPaymentMethodId,
      idempotencyKey: key,
      metadata: { userId: userId.toString(), invoiceId: invoice._id.toString() },
    });
    return this.persistGatewayPayment(userId, customer, invoice, paymentMethod, gatewayPayment, key);
  }

  async applyDiscount(userId: Types.ObjectId, input: ApplyDiscountRequest): Promise<BillingOverviewResponse> {
    const customer = await billingRepository.findCustomerByUserId(userId);
    const subscription = await this.requireOwnedSubscription(userId, ACTIVE_SUBSCRIPTION_STATUSES);
    const coupon = await billingRepository.findCouponByCode(input.code);
    if (!customer || !coupon || !coupon.active) {
      throw new AppError('Discount code is invalid.', 422, 'DISCOUNT_INVALID');
    }
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new AppError('Discount code has expired.', 422, 'DISCOUNT_EXPIRED');
    }
    if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
      throw new AppError('Discount code has reached its usage limit.', 422, 'DISCOUNT_REDEEMED');
    }
    const price = Money.of(subscription.amountMinor, subscription.currency);
    const discountMinor = coupon.type === 'PERCENTAGE'
      ? price.prorate(coupon.percentOff ?? 0, 100).amountMinor
      : Math.min(coupon.amountOffMinor ?? 0, subscription.amountMinor);

    await billingRepository.withTransaction(async (session) => {
      await billingRepository.createDiscount(
        {
          couponId: coupon._id,
          customerId: customer._id,
          subscriptionId: subscription._id,
          amountMinor: discountMinor,
          currency: subscription.currency,
        },
        session,
      );
      await this.auditService.record(
        {
          userId,
          customerId: customer._id,
          subscriptionId: subscription._id,
          action: 'discount.applied',
          outcome: 'SUCCESS',
          metadata: { code: coupon.code, amountMinor: discountMinor },
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      return { ok: true };
    });

    return this.getBillingOverview(userId, { force: true });
  }

  async getProrationPreview(userId: Types.ObjectId, input: ProrationPreviewQuery): Promise<ProrationPreviewResponse> {
    const subscription = await billingRepository.findLatestSubscriptionByUserId(userId, ACTIVE_SUBSCRIPTION_STATUSES);
    const targetPrice = getPlanPrice(input.planId, input.billingCycle);
    if (!targetPrice) {
      throw new AppError('Plan is not available.', 422, 'PLAN_NOT_AVAILABLE');
    }
    const now = new Date();
    const currentRemainingMinor = subscription?.currentPeriodEnd && subscription.currentPeriodStart
      ? Money.of(subscription.amountMinor, subscription.currency).prorate(
        Math.max(0, subscription.currentPeriodEnd.getTime() - now.getTime()),
        Math.max(1, subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()),
      ).amountMinor
      : 0;
    const amountDueToday = Math.max(0, targetPrice.amountMinor - currentRemainingMinor);
    return {
      amountDueToday: { amountMinor: amountDueToday, currency: targetPrice.currency },
      newRecurringAmount: { amountMinor: targetPrice.amountMinor, currency: targetPrice.currency },
      creditApplied: { amountMinor: currentRemainingMinor, currency: targetPrice.currency },
      description: 'Proration preview based on the remaining value of the current billing period.',
    };
  }

  async downloadInvoicePdf(userId: Types.ObjectId, invoiceId: string): Promise<DownloadInvoicePdfResponse> {
    return this.invoiceService.downloadPdf(userId, invoiceId);
  }

  async processStripeWebhook(payload: Buffer, signatureHeader: string | string[] | undefined): Promise<StripeWebhookResponse> {
    return this.webhookService.ingestStripeWebhook(payload, signatureHeader);
  }

  async runDunningJob(now: Date = new Date()): Promise<number> {
    return this.dunningService.runDue(now);
  }

  async runReconciliation(): Promise<BillingAdminReconciliationReport> {
    return this.reconciliationService.run();
  }

  async getReconciliationReport(): Promise<BillingAdminReconciliationReport> {
    return this.reconciliationService.report();
  }

  async getAdminCustomerSummary(customerId: string): Promise<BillingAdminCustomerSummary> {
    const customer = await billingRepository.findCustomerById(objectIdFromString(customerId, 'BILLING_CUSTOMER_NOT_FOUND'));
    if (!customer) {
      throw new AppError('Billing customer not found.', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    const [subscription, paymentMethods, invoices, auditLogs] = await Promise.all([
      billingRepository.findLatestSubscriptionByUserId(customer.userId, ACTIVE_SUBSCRIPTION_STATUSES),
      billingRepository.listPaymentMethods(customer.userId),
      this.invoiceService.listForUser(customer.userId, 100),
      billingRepository.listAuditLogsByCustomer(customer._id, 100),
    ]);

    return {
      customer: {
        id: customer._id.toString(),
        userId: customer.userId.toString(),
        provider: customer.provider,
        providerCustomerId: customer.providerCustomerId ?? null,
        defaultPaymentMethodId: customer.defaultPaymentMethodId?.toString() ?? null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      subscription: subscription ? mapSubscription(subscription) : null,
      paymentMethods: paymentMethods.map(mapPaymentMethod),
      invoices: invoices.items,
      payments: [],
      auditLogs: auditLogs.map(mapAuditLog),
    };
  }

  async adminRefund(actorUserId: Types.ObjectId, input: AdminRefundRequest): Promise<void> {
    const payment = await billingRepository.findPaymentById(objectIdFromString(input.paymentId, 'PAYMENT_NOT_FOUND'));
    if (!payment?.providerPaymentId) {
      throw new AppError('Payment not found.', 404, 'PAYMENT_NOT_FOUND');
    }
    const requested = Money.of(input.amountMinor, input.currency);
    const paid = Money.of(payment.amountMinor, payment.currency);
    if (requested.amountMinor > paid.amountMinor) {
      throw new AppError('Refund amount exceeds payment amount.', 422, 'REFUND_AMOUNT_INVALID');
    }
    const key = `billing:refund:${deterministicKey([payment._id.toString(), input.amountMinor, input.currency])}`;
    const refund = await this.gateway.refundPayment(payment._id.toString(), {
      providerPaymentId: payment.providerPaymentId,
      amountMinor: requested.amountMinor,
      currency: requested.currency,
      reason: input.reason,
      idempotencyKey: key,
    });
    await billingRepository.withTransaction(async (session) => {
      await billingRepository.createRefund(
        {
          paymentId: payment._id,
          customerId: payment.customerId,
          userId: payment.userId,
          providerRefundId: refund.id,
          idempotencyKey: key,
          status: refund.status,
          amountMinor: refund.amountMinor,
          currency: refund.currency,
          reason: input.reason,
          requestedByActorType: 'ADMIN',
          requestedByActorId: actorUserId.toString(),
        },
        session,
      );
      await this.auditService.record(
        {
          userId: payment.userId,
          customerId: payment.customerId,
          paymentId: payment._id,
          action: 'payment.refunded',
          outcome: 'SUCCESS',
          metadata: { amountMinor: refund.amountMinor, currency: refund.currency },
        },
        { actorType: 'ADMIN', actorId: actorUserId.toString() },
        session,
      );
      return { ok: true };
    });
  }

  async adminManualCharge(actorUserId: Types.ObjectId, input: AdminManualChargeRequest): Promise<BillingPayment> {
    const customer = await billingRepository.findCustomerById(objectIdFromString(input.customerId, 'BILLING_CUSTOMER_NOT_FOUND'));
    if (!customer?.providerCustomerId) {
      throw new AppError('Billing customer not found.', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    const paymentMethod = input.paymentMethodId
      ? await billingRepository.findPaymentMethodById(objectIdFromString(input.paymentMethodId, 'PAYMENT_METHOD_NOT_FOUND'))
      : null;
    const key = `billing:manual-charge:${deterministicKey([customer._id.toString(), input.amountMinor, input.currency, input.description])}`;
    const invoice = await billingRepository.withTransaction(async (session) => {
      const created = await billingRepository.createInvoice(
        {
          customerId: customer._id,
          userId: customer.userId,
          description: input.description,
          status: 'OPEN',
          currency: input.currency,
          subtotalMinor: input.amountMinor,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: input.amountMinor,
          amountDueMinor: input.amountMinor,
          amountPaidMinor: 0,
          amountRemainingMinor: input.amountMinor,
        },
        session,
      );
      await this.auditService.record(
        {
          userId: customer.userId,
          customerId: customer._id,
          invoiceId: created._id,
          action: 'invoice.manual_created',
          outcome: 'SUCCESS',
          metadata: { amountMinor: input.amountMinor, currency: input.currency },
        },
        { actorType: 'ADMIN', actorId: actorUserId.toString() },
        session,
      );
      return created;
    });
    const intent = await this.gateway.chargeInvoice(invoice._id.toString(), {
      providerCustomerId: customer.providerCustomerId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.description,
      paymentMethodId: paymentMethod?.providerPaymentMethodId,
      idempotencyKey: key,
      metadata: { adminUserId: actorUserId.toString() },
    });
    return this.persistGatewayPayment(customer.userId, customer, invoice, paymentMethod, intent, key);
  }

  private async persistGatewayPayment(
    userId: Types.ObjectId,
    customer: IBillingCustomerDocument,
    invoice: IBillingInvoiceDocument,
    paymentMethod: IBillingPaymentMethodDocument | null,
    gatewayPayment: GatewayPaymentIntent,
    idempotencyKey: string,
  ): Promise<BillingPayment> {
    const created = await billingRepository.withTransaction(async (session) => {
      const payment = await billingRepository.createPayment(
        {
          invoiceId: invoice._id,
          customerId: customer._id,
          userId,
          paymentMethodId: paymentMethod?._id,
          providerPaymentId: gatewayPayment.id,
          idempotencyKey,
          status: gatewayPayment.status,
          amountMinor: gatewayPayment.amountMinor,
          currency: gatewayPayment.currency,
          failureCode: gatewayPayment.failureCode,
          failureMessage: gatewayPayment.failureMessage,
          requiresActionUrl: gatewayPayment.requiresActionUrl,
        },
        session,
      );
      await this.auditService.record(
        {
          userId,
          customerId: customer._id,
          invoiceId: invoice._id,
          paymentId: payment._id,
          action: 'payment.attempted',
          outcome: gatewayPayment.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
          metadata: { status: gatewayPayment.status },
          errorCode: gatewayPayment.failureCode,
        },
        { actorType: 'USER', actorId: userId.toString() },
        session,
      );
      return payment;
    });

    billingMetrics.increment('billing.payment.attempt', 1, {
      outcome: gatewayPayment.status === 'SUCCEEDED' ? 'success' : 'failure',
      error_type: gatewayPayment.failureCode ?? 'none',
    });

    return mapPayment(created);
  }

  private async getOwnedPaymentMethod(
    userId: Types.ObjectId,
    paymentMethodId: string,
  ): Promise<IBillingPaymentMethodDocument> {
    const method = await billingRepository.findPaymentMethodById(
      objectIdFromString(paymentMethodId, 'PAYMENT_METHOD_NOT_FOUND'),
    );
    if (!method || method.userId.toString() !== userId.toString()) {
      throw new BillingAuthorizationError('Payment method access denied.', {
        userId: userId.toString(),
        paymentMethodId,
      });
    }
    return method;
  }

  private async requireOwnedSubscription(
    userId: Types.ObjectId,
    statuses: ActiveSubscriptionStatus[] = ACTIVE_SUBSCRIPTION_STATUSES,
  ): Promise<IBillingSubscriptionDocument> {
    const subscription = await billingRepository.findLatestSubscriptionByUserId(userId, statuses);
    if (!subscription) {
      throw new AppError('No active subscription found.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }
    if (subscription.userId.toString() !== userId.toString()) {
      throw new BillingAuthorizationError('Subscription access denied.', {
        userId: userId.toString(),
        subscriptionId: subscription._id.toString(),
      });
    }
    return subscription;
  }
}

export const billingService = new BillingService();

export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}
