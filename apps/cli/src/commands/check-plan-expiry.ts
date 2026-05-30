import chalk from 'chalk';
import type { BillingCycle, CreateCheckoutSessionRequest } from '@nirex/shared';
import { callApi, parseDate, formatDate, normalizeBaseUrl, resolveErrorCode, type ApiResponsePayload } from '../utils/api.js';

interface BillingOverviewData {
  currentPlan?: {
    id?: string;
    name?: string;
  };
  entitlement?: {
    planId?: string;
    status?: string;
    canAccessPaidFeatures?: boolean;
    issueCode?: string | null;
    issueMessage?: string | null;
    accessEndsAt?: string | null;
  };
  subscription?: {
    status?: string;
    currentPeriodEnd?: string | null;
  };
}

interface Check {
  ok: boolean;
  title: string;
  detail: string;
}

const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'incomplete',
  'past_due',
  'unpaid',
  'paused',
]);

function isCheckoutBlockingSubscriptionActive(
  status: unknown,
  currentPeriodEnd: Date | null,
  now: Date,
): boolean {
  if (typeof status !== 'string') return false;
  if (!CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES.has(status)) return false;
  if (!currentPeriodEnd) return true;
  return currentPeriodEnd.getTime() > now.getTime();
}

function printCheck(check: Check): void {
  const marker = check.ok ? chalk.green('PASS') : chalk.red('FAIL');
  console.log(`${marker} ${check.title}`);
  console.log(chalk.gray(`     ${check.detail}`));
}

export async function checkPlanExpiryCommand(opts: {
  baseUrl: string;
  apiKey?: string;
  planId: string;
  billingCycle: string;
  timeoutMs: number;
  skipCheckoutProbe: boolean;
}): Promise<void> {
  const apiKey = opts.apiKey?.trim();
  if (!apiKey) {
    throw new Error(
      'Missing API key. Provide --api-key or set NIREX_API_KEY environment variable.',
    );
  }

  if (opts.planId !== 'free' && opts.planId !== 'pro' && opts.planId !== 'enterprise') {
    throw new Error('--plan-id must be one of: free, pro, enterprise');
  }

  if (opts.billingCycle !== 'month' && opts.billingCycle !== 'year') {
    throw new Error('--billing-cycle must be either month or year');
  }

  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const now = new Date();
  const checks: Check[] = [];

  console.log(chalk.cyan(`Checking billing expiry against: ${baseUrl}`));
  console.log(chalk.gray(`Run time: ${now.toISOString()}`));

  const overview = await callApi<BillingOverviewData>({
    url: `${baseUrl}/billing/overview?force=true`,
    apiKey,
    timeoutMs: opts.timeoutMs,
  });

  if (overview.httpStatus !== 200 || !overview.payload.data) {
    checks.push({
      ok: false,
      title: 'Overview endpoint',
      detail: `Expected HTTP 200 with data, got HTTP ${overview.httpStatus} (${overview.payload.message ?? 'no message'})`,
    });
    checks.forEach(printCheck);
    process.exitCode = 1;
    return;
  }

  const data = overview.payload.data;
  const currentPlanId = data.currentPlan?.id ?? 'unknown';
  const currentPlanName = data.currentPlan?.name ?? 'unknown';
  const entitlement = data.entitlement ?? {};
  const subscription = data.subscription ?? {};

  const canAccessPaidFeatures = entitlement.canAccessPaidFeatures === true;
  const entitlementAccessEndsAt = parseDate(entitlement.accessEndsAt ?? null);
  const entitlementExpiredByDate = entitlementAccessEndsAt
    ? entitlementAccessEndsAt.getTime() <= now.getTime()
    : false;

  const subscriptionPeriodEnd = parseDate(subscription.currentPeriodEnd ?? null);
  const subscriptionWindowActive = isCheckoutBlockingSubscriptionActive(
    subscription.status,
    subscriptionPeriodEnd,
    now,
  );

  checks.push({
    ok: true,
    title: 'Overview fetched',
    detail: `plan=${currentPlanId} (${currentPlanName}), entitlementStatus=${entitlement.status ?? 'unknown'}, subscriptionStatus=${subscription.status ?? 'unknown'}`,
  });

  checks.push({
    ok: !(canAccessPaidFeatures && entitlementExpiredByDate),
    title: 'No paid access after expiry',
    detail: `canAccessPaidFeatures=${String(canAccessPaidFeatures)}, accessEndsAt=${formatDate(entitlementAccessEndsAt)}, expiredByDate=${String(entitlementExpiredByDate)}`,
  });

  if (!opts.skipCheckoutProbe) {
    const expectedCheckoutToBeBlocked = canAccessPaidFeatures || subscriptionWindowActive;

    const checkoutBody: CreateCheckoutSessionRequest = {
      planId: opts.planId as CreateCheckoutSessionRequest['planId'],
      billingCycle: opts.billingCycle as BillingCycle,
    };

    const checkout = await callApi({
      url: `${baseUrl}/billing/checkout-session`,
      apiKey,
      method: 'POST',
      body: checkoutBody as unknown as Record<string, unknown>,
      timeoutMs: opts.timeoutMs,
    });

    const errorCode = resolveErrorCode(checkout.payload);

    if (expectedCheckoutToBeBlocked) {
      checks.push({
        ok: checkout.httpStatus === 409 && errorCode === 'ACTIVE_PLAN_EXISTS',
        title: 'Checkout blocked for active plan',
        detail: `expected=HTTP 409 ACTIVE_PLAN_EXISTS, actual=HTTP ${checkout.httpStatus} ${errorCode ?? ''}`.trim(),
      });
    } else {
      const checkoutUrl =
        typeof checkout.payload.data === 'object' &&
          checkout.payload.data !== null &&
          'checkoutUrl' in checkout.payload.data &&
          typeof checkout.payload.data.checkoutUrl === 'string'
          ? checkout.payload.data.checkoutUrl
          : null;
      checks.push({
        ok: checkout.httpStatus === 201 && checkoutUrl !== null,
        title: 'Checkout allowed after expiry',
        detail: `expected=HTTP 201 with checkoutUrl, actual=HTTP ${checkout.httpStatus} ${checkoutUrl ? '(checkoutUrl returned)' : '(no checkoutUrl)'}`,
      });
    }
  } else {
    checks.push({
      ok: true,
      title: 'Checkout probe',
      detail: 'Skipped (--skip-checkout-probe)',
    });
  }

  for (const check of checks) {
    printCheck(check);
  }

  const failed = checks.filter((check) => !check.ok).length;
  if (failed > 0) {
    console.log(chalk.red(`\nResult: ${failed} check(s) failed.`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.green('\nResult: all expiry checks passed.'));
}
