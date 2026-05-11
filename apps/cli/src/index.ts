#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import {
  APP_NAME,
  type BillingCycle,
  type CreateCheckoutSessionRequest,
} from '@nirex/shared';

const program = new Command();

const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'incomplete',
  'past_due',
  'unpaid',
  'paused',
]);

interface ApiResponsePayload<TData = unknown> {
  status?: string;
  message?: string;
  code?: string;
  data?: TData;
}

interface ApiCallResult<TData = unknown> {
  httpStatus: number;
  payload: ApiResponsePayload<TData>;
}

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

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString() : 'n/a';
}

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

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, '');
}

async function callApi<TData = unknown>(input: {
  url: string;
  apiKey: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  timeoutMs: number;
}): Promise<ApiCallResult<TData>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: input.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': input.apiKey,
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: ApiResponsePayload<TData> = {};
    if (raw.trim().length > 0) {
      try {
        payload = JSON.parse(raw) as ApiResponsePayload<TData>;
      } catch {
        payload = {
          status: 'error',
          message: `Non-JSON response body: ${raw.slice(0, 240)}`,
        };
      }
    }

    return {
      httpStatus: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveErrorCode(payload: ApiResponsePayload): string | null {
  if (typeof payload.code === 'string') return payload.code;
  return null;
}

function printCheck(check: Check): void {
  const marker = check.ok ? chalk.green('PASS') : chalk.red('FAIL');
  console.log(`${marker} ${check.title}`);
  console.log(chalk.gray(`     ${check.detail}`));
}

program
  .name(APP_NAME.toLowerCase())
  .description(`${APP_NAME} Project CLI`)
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello to the user')
  .argument('[name]', 'The name of the user', 'World')
  .action((name: string) => {
    console.log(chalk.green(`Hello, ${name}!`));
    console.log(chalk.blue(`Welcome to the ${APP_NAME} monorepo!`));
  });

program
  .command('check-plan-expiry')
  .description('Verify billing plan expiry behavior through live billing APIs')
  .option(
    '--base-url <url>',
    'Backend API base URL',
    process.env.NIREX_API_BASE_URL ?? 'http://localhost:3001/api/v1',
  )
  .option(
    '--api-key <key>',
    'API key with billing:read and billing:write scopes',
    process.env.NIREX_API_KEY,
  )
  .option('--plan-id <planId>', 'Plan to use for checkout probe', 'pro')
  .option('--billing-cycle <cycle>', 'Billing cycle for checkout probe', 'month')
  .option(
    '--timeout-ms <ms>',
    'HTTP timeout in milliseconds',
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1000) {
        throw new Error('timeout-ms must be an integer >= 1000');
      }
      return parsed;
    },
    15000,
  )
  .option('--skip-checkout-probe', 'Skip checkout-session behavior check', false)
  .action(
    async (opts: {
      baseUrl: string;
      apiKey?: string;
      planId: string;
      billingCycle: string;
      timeoutMs: number;
      skipCheckoutProbe: boolean;
    }) => {
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
          body: checkoutBody,
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
            detail: `expected=HTTP 201 with checkoutUrl, actual=HTTP ${checkout.httpStatus} ${checkoutUrl ? '(checkoutUrl returned)' : '(no checkoutUrl)'
              }`,
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
    },
  );

void program.parseAsync(process.argv);
