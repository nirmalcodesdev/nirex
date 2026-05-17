#!/usr/bin/env tsx
import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import type {
  AddMessageResponse,
  ApiKeyScope,
  BillingOverviewResponse,
  BillingCycle,
  BillingPlanId,
  BillingSubscriptionStatus,
  CreateSessionResponse,
  TokenUsage,
  UsageOverviewResponse,
} from '@nirex/shared';
import app from '../app.js';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { apiKeyService } from '../modules/api-keys/api-key.service.js';
import { ApiKeyModel } from '../modules/api-keys/api-key.model.js';
import { billingRepository } from '../modules/billing/billing.repository.js';
import {
  addMonthsClamped,
  resolveMonthlyCreditPeriod,
} from '../modules/billing/domain/credit-period.js';
import {
  BillingCustomerModel,
  BillingSubscriptionModel,
  type IBillingSubscriptionDocument,
} from '../modules/billing/billing.model.js';
import { UserModel } from '../modules/user/user.model.js';
import { ChatSessionModel } from '../modules/chat-session/chat-session.model.js';
import { MessageModel } from '../modules/chat-session/message.model.js';
import { UsageEventModel } from '../modules/usage/usage.model.js';
import { hashApiKey } from '../utils/crypto.js';
import {
  clearUsageOverviewMemoryCache,
  invalidateUsageOverviewCache,
} from '../modules/usage/usage.cache.js';

type Method = 'GET' | 'POST';

interface ApiEnvelope<TData> {
  status?: 'success' | 'fail' | 'error';
  message?: string;
  code?: string;
  data?: TData;
  error?: {
    code?: string;
    message?: string;
  };
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly method: Method,
    readonly path: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface CliOptions {
  apiKey?: string;
  boundaryCredits: number;
  cleanupBefore: boolean;
  currentCredits: number;
  keepData: boolean;
  model: string;
  previousCredits: number;
  resetCredits: number;
  runId: string;
  skipBillingOverview: boolean;
}

interface CreditWindow {
  start: Date;
  endExclusive: Date;
}

interface CheckResult {
  name: string;
  details?: string;
}

const REQUIRED_SCOPES: ApiKeyScope[] = ['sessions:read', 'sessions:write', 'usage:read'];
const ACTIVE_SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'PAUSED'] as const;
type ActiveSubscriptionStatus = typeof ACTIVE_SUBSCRIPTION_STATUSES[number];
const DEFAULT_MODEL = 'gpt-4o';
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const CREDIT_TOLERANCE = 0.05;
const RealDate = Date;

function printHelp(): void {
  console.log(`Run a local in-process E2E test for purchase-anniversary monthly credit resets.

Usage:
  NIREX_API_KEY=<api-key> pnpm --filter @nirex/backend exec tsx src/scripts/e2e-credit-rollover.ts

What it does:
  - Authenticates the API key and validates that the account has an active Pro yearly subscription.
  - Runs the Express app in this process with a virtual clock.
  - Creates a real chat session and messages through the API so usage ledger events are produced normally.
  - Verifies previous-window usage expires, current-window usage counts, boundary usage counts before reset,
    and usage at the exact reset timestamp belongs to the new credit period.
  - Deletes its own seeded session/messages/usage events by default.

Options:
  --api-key <key>              API key. Prefer NIREX_API_KEY to avoid shell history.
  --run-id <id>                Deterministic run id. Default: generated timestamp.
  --model <model>              Chat session model. Default: ${DEFAULT_MODEL}.
  --previous-credits <n>       Credits to seed in the prior credit period. Default: 2.
  --current-credits <n>        Credits to seed in the active credit period. Default: 3.
  --boundary-credits <n>       Credits to seed one millisecond before reset. Default: 5.
  --reset-credits <n>          Credits to seed exactly at reset. Default: 7.
  --keep-data                  Leave seeded records for inspection.
  --no-cleanup-before          Do not delete records from a prior run with the same run id first.
  --skip-billing-overview      Skip the optional /billing/overview API assertion.
  --help, -h                   Show this help.
`);
}

function readString(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readPositiveNumber(args: string[], index: number, name: string): number {
  const raw = readString(args, index, name);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) {
    throw new Error(`${name} must be a positive number up to 100000`);
  }
  return parsed;
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    apiKey: process.env.NIREX_API_KEY,
    boundaryCredits: 5,
    cleanupBefore: true,
    currentCredits: 3,
    keepData: false,
    model: process.env.NIREX_E2E_MODEL || DEFAULT_MODEL,
    previousCredits: 2,
    resetCredits: 7,
    runId:
      process.env.NIREX_E2E_RUN_ID ||
      `credit-rollover-e2e-${new RealDate().toISOString().replace(/[:.]/g, '-')}`,
    skipBillingOverview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--api-key':
        options.apiKey = readString(argv, index, arg);
        index += 1;
        break;
      case '--run-id':
        options.runId = readString(argv, index, arg);
        index += 1;
        break;
      case '--model':
        options.model = readString(argv, index, arg);
        index += 1;
        break;
      case '--previous-credits':
        options.previousCredits = readPositiveNumber(argv, index, arg);
        index += 1;
        break;
      case '--current-credits':
        options.currentCredits = readPositiveNumber(argv, index, arg);
        index += 1;
        break;
      case '--boundary-credits':
        options.boundaryCredits = readPositiveNumber(argv, index, arg);
        index += 1;
        break;
      case '--reset-credits':
        options.resetCredits = readPositiveNumber(argv, index, arg);
        index += 1;
        break;
      case '--keep-data':
        options.keepData = true;
        break;
      case '--no-cleanup-before':
        options.cleanupBefore = false;
        break;
      case '--skip-billing-overview':
        options.skipBillingOverview = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function installVirtualClock(instant: Date): () => void {
  const fixedMs = instant.getTime();
  const VirtualDate = function virtualDate(this: unknown, ...args: unknown[]) {
    if (new.target) {
      if (args.length === 0) {
        return new RealDate(fixedMs);
      }
      return new (RealDate as unknown as new (...inner: unknown[]) => Date)(...args);
    }
    return new RealDate(fixedMs).toString();
  } as unknown as DateConstructor;

  VirtualDate.now = () => fixedMs;
  VirtualDate.parse = RealDate.parse;
  VirtualDate.UTC = RealDate.UTC;
  (VirtualDate as unknown as { prototype: Date }).prototype = RealDate.prototype;
  globalThis.Date = VirtualDate;

  return () => {
    globalThis.Date = RealDate;
  };
}

async function withVirtualTime<T>(instant: Date, fn: () => Promise<T>): Promise<T> {
  const restore = installVirtualClock(instant);
  try {
    return await fn();
  } finally {
    restore();
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNear(actual: number, expected: number, label: string): void {
  const delta = Math.abs(actual - expected);
  if (delta > CREDIT_TOLERANCE) {
    throw new Error(`${label}: expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  }
}

function assertIso(actual: string | null | undefined, expected: Date, label: string): void {
  const expectedIso = expected.toISOString();
  if (actual !== expectedIso) {
    throw new Error(`${label}: expected ${expectedIso}, got ${actual ?? 'null'}`);
  }
}

function assertNullish(actual: unknown, label: string): void {
  if (actual !== null && actual !== undefined) {
    throw new Error(`${label}: expected null, got ${String(actual)}`);
  }
}

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function roundCredits(value: number): number {
  return Number(value.toFixed(2));
}

function creditsDelta(after: UsageOverviewResponse, before: UsageOverviewResponse): number {
  return roundCredits(after.summary.credits_used - before.summary.credits_used);
}

function creditsToTokenUsage(credits: number): TokenUsage {
  const totalTokens = Math.max(1, Math.round(credits * 1000));
  const inputTokens = Math.round(totalTokens * 0.5);
  const outputTokens = Math.round(totalTokens * 0.35);
  const cachedTokens = Math.round(totalTokens * 0.05);
  const reasoningTokens = totalTokens - inputTokens - outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: totalTokens,
  };
}

function minDate(left: Date, right: Date): Date {
  return new Date(Math.min(left.getTime(), right.getTime()));
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function insideWindow(window: CreditWindow, offsetMs: number): Date {
  const durationMs = window.endExclusive.getTime() - window.start.getTime();
  const safeOffset = Math.max(0, Math.min(offsetMs, Math.max(0, durationMs - 1)));
  return addMs(window.start, safeOffset);
}

function buildCreditWindows(subscription: IBillingSubscriptionDocument): CreditWindow[] {
  assert(subscription.currentPeriodStart, 'Subscription is missing currentPeriodStart');
  assert(subscription.currentPeriodEnd, 'Subscription is missing currentPeriodEnd');

  const anchorDay = subscription.currentPeriodStart.getUTCDate();
  const windows: CreditWindow[] = [];
  let cursor = new Date(subscription.currentPeriodStart);

  while (cursor.getTime() < subscription.currentPeriodEnd.getTime() && windows.length < 14) {
    const next = minDate(
      addMonthsClamped(cursor, 1, anchorDay),
      subscription.currentPeriodEnd,
    );
    windows.push({ start: cursor, endExclusive: next });
    cursor = next;
  }

  return windows;
}

function findCreditWindowIndexAt(windows: CreditWindow[], instant: Date): number {
  return windows.findIndex((window) =>
    window.start.getTime() <= instant.getTime() &&
    instant.getTime() < window.endExclusive.getTime()
  );
}

function hasScope(scopes: ApiKeyScope[], scope: ApiKeyScope): boolean {
  return scopes.includes(scope);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resetUsageCache(userId: Types.ObjectId): Promise<void> {
  clearUsageOverviewMemoryCache();
  await invalidateUsageOverviewCache(userId);
}

async function apiRequest<TData>(
  method: Method,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<TData> {
  const builder = method === 'GET'
    ? request(app).get(path)
    : request(app).post(path);
  const response = await builder
    .set('Accept', 'application/json')
    .set('x-api-key', apiKey)
    .send(body as string | object | undefined);

  const payload = response.body as ApiEnvelope<TData>;
  if (response.status < 200 || response.status >= 300 || payload.status !== 'success') {
    const code = payload.error?.code || payload.code || 'REQUEST_FAILED';
    const message = payload.error?.message || payload.message || response.text || 'Request failed';
    throw new ApiRequestError(
      `${method} ${path} failed with ${response.status} ${code}: ${message}`,
      response.status,
      code,
      method,
      path,
    );
  }

  assert(payload.data !== undefined, `${method} ${path} returned no data`);
  return payload.data;
}

async function apiRequestFailure(
  method: Method,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<{ status: number; code: string; message: string }> {
  const builder = method === 'GET'
    ? request(app).get(path)
    : request(app).post(path);
  const response = await builder
    .set('Accept', 'application/json')
    .set('x-api-key', apiKey)
    .send(body as string | object | undefined);

  const payload = response.body as ApiEnvelope<unknown>;
  if (response.status >= 200 && response.status < 300 && payload.status === 'success') {
    throw new Error(`${method} ${path} unexpectedly succeeded`);
  }

  return {
    status: response.status,
    code: payload.error?.code || payload.code || 'REQUEST_FAILED',
    message: payload.error?.message || payload.message || response.text || 'Request failed',
  };
}

async function getUsageAt(apiKey: string, userId: Types.ObjectId, now: Date): Promise<UsageOverviewResponse> {
  return withVirtualTime(now, async () => {
    await resetUsageCache(userId);
    return apiRequest<UsageOverviewResponse>(
      'GET',
      '/api/v1/usage/overview?range=month_to_date',
      apiKey,
    );
  });
}

async function createSeedSession(
  apiKey: string,
  options: CliOptions,
  at: Date,
): Promise<string> {
  const created = await withVirtualTime(at, () =>
    apiRequest<CreateSessionResponse>('POST', '/api/v1/sessions', apiKey, {
      name: `Credit rollover E2E ${options.runId}`,
      working_directory: `D:/nirex/e2e/credit-rollover/${options.runId}`,
      model: options.model,
      git_branch: 'e2e/credit-rollover',
      source: 'credit-rollover-e2e',
      metadata: {
        credit_rollover_e2e: true,
        credit_rollover_e2e_run_id: options.runId,
      },
    })
  );

  return created.session.id;
}

async function addUsageMessage(input: {
  apiKey: string;
  at: Date;
  credits: number;
  label: string;
  runId: string;
  sessionId: string;
  userId: Types.ObjectId;
}): Promise<void> {
  await withVirtualTime(input.at, async () => {
    await resetUsageCache(input.userId);
    await apiRequest<AddMessageResponse>(
      'POST',
      `/api/v1/sessions/${input.sessionId}/messages`,
      input.apiKey,
      {
        role: 'user',
        content: `Credit rollover E2E ${input.label}: consume ${input.credits.toFixed(2)} credits at ${input.at.toISOString()}.`,
        token_usage: creditsToTokenUsage(input.credits),
        client_message_id: `credit-rollover-e2e:${input.runId}:${input.label}`,
        metadata: {
          credit_rollover_e2e: true,
          credit_rollover_e2e_run_id: input.runId,
          credit_rollover_e2e_label: input.label,
        },
      },
    );
  });
}

async function cleanupRunData(userId: Types.ObjectId, runId: string): Promise<void> {
  const escapedRunId = escapeRegExp(runId);
  const clientMessageRegex = new RegExp(`^credit-rollover-e2e:${escapedRunId}:`);
  const sessions = await ChatSessionModel.find({
    userId,
    'metadata.credit_rollover_e2e_run_id': runId,
  })
    .select({ _id: 1 })
    .lean()
    .exec();
  const sessionIds = sessions.map((session) => session._id);

  await UsageEventModel.deleteMany({
    user_id: userId,
    'metadata.client_message_id': clientMessageRegex,
  }).exec();
  await MessageModel.deleteMany({
    user_id: userId,
    client_message_id: clientMessageRegex,
  }).exec();

  if (sessionIds.length > 0) {
    await ChatSessionModel.deleteMany({ _id: { $in: sessionIds } }).exec();
  }

  await resetUsageCache(userId);
}

async function cleanupSyntheticRunData(runId: string): Promise<void> {
  const escapedRunId = escapeRegExp(syntheticEmailRunId(runId));
  const emailRegex = new RegExp(`^credit-rollover-e2e\\+${escapedRunId}-`);
  const users = await UserModel.find({ email: emailRegex })
    .select({ _id: 1 })
    .lean()
    .exec();
  const userIds = users.map((user) => user._id);

  if (userIds.length === 0) {
    await BillingSubscriptionModel.deleteMany({
      'metadata.credit_rollover_e2e_run_id': runId,
    }).exec();
    return;
  }

  await Promise.all(userIds.map((syntheticUserId) => resetUsageCache(syntheticUserId)));
  await UsageEventModel.deleteMany({ user_id: { $in: userIds } }).exec();
  await MessageModel.deleteMany({ user_id: { $in: userIds } }).exec();
  await ChatSessionModel.deleteMany({ userId: { $in: userIds } }).exec();
  await ApiKeyModel.deleteMany({ userId: { $in: userIds } }).exec();
  await BillingSubscriptionModel.deleteMany({
    $or: [
      { userId: { $in: userIds } },
      { 'metadata.credit_rollover_e2e_run_id': runId },
    ],
  }).exec();
  await BillingCustomerModel.deleteMany({ userId: { $in: userIds } }).exec();
  await UserModel.deleteMany({ _id: { $in: userIds } }).exec();
}

function apiKeyEnvironmentLabel(): 'live' | 'test' {
  return env.NODE_ENV === 'production' ? 'live' : 'test';
}

function syntheticEmailRunId(runId: string): string {
  return runId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120);
}

function syntheticEmailLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
}

async function createSyntheticApiKey(
  userId: Types.ObjectId,
  label: string,
  scopes: ApiKeyScope[],
): Promise<string> {
  const keyId = crypto.randomBytes(8).toString('hex');
  const keySecret = crypto.randomBytes(24).toString('base64url');
  const keyPrefix = `${env.API_KEY_PREFIX}_${apiKeyEnvironmentLabel()}_${keyId}`;
  const apiKey = `${keyPrefix}_${keySecret}`;

  await ApiKeyModel.create({
    userId,
    name: `Credit rollover E2E ${label}`,
    keyId,
    keyPrefix,
    last4: keySecret.slice(-4),
    keyHash: hashApiKey(apiKey),
    scopes,
    expiresAt: addMs(new RealDate(), 2 * ONE_DAY_MS),
  });

  return apiKey;
}

function planAmountMinor(planCode: BillingPlanId, billingCycle: BillingCycle): number {
  if (planCode === 'pro') {
    return billingCycle === 'year' ? 20_000 : 2_000;
  }
  return 0;
}

function syntheticProviderSubscriptionId(runId: string, label: string): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80);
  const safeRunId = runId.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80);
  return `sub_credit_rollover_e2e_${safeRunId}_${safeLabel}`;
}

async function createSyntheticAccount(input: {
  label: string;
  runId: string;
  scopes: ApiKeyScope[];
  subscription?: {
    planCode: BillingPlanId;
    billingCycle: BillingCycle;
    status: Exclude<BillingSubscriptionStatus, 'NONE'>;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  };
}): Promise<{ apiKey: string; userId: Types.ObjectId; subscription: IBillingSubscriptionDocument | null }> {
  const safeLabel = syntheticEmailLabel(input.label);
  const user = await UserModel.create({
    email: `credit-rollover-e2e+${syntheticEmailRunId(input.runId)}-${safeLabel}@example.invalid`,
    fullName: `Credit Rollover E2E ${input.label}`,
    isEmailVerified: true,
    providers: [],
  });
  const userId = user._id;
  const apiKey = await createSyntheticApiKey(userId, input.label, input.scopes);

  if (!input.subscription) {
    return { apiKey, userId, subscription: null };
  }

  const customer = await BillingCustomerModel.create({
    userId,
    provider: 'stripe',
    lastProviderSyncAt: new RealDate(),
  });
  const subscription = await BillingSubscriptionModel.create({
    customerId: customer._id,
    userId,
    planCode: input.subscription.planCode,
    billingCycle: input.subscription.billingCycle,
    status: input.subscription.status,
    provider: 'stripe',
    providerSubscriptionId: syntheticProviderSubscriptionId(input.runId, input.label),
    currency: 'usd',
    amountMinor: planAmountMinor(input.subscription.planCode, input.subscription.billingCycle),
    cancelAtPeriodEnd: false,
    currentPeriodStart: input.subscription.currentPeriodStart,
    currentPeriodEnd: input.subscription.currentPeriodEnd,
    metadata: {
      credit_rollover_e2e: true,
      credit_rollover_e2e_run_id: input.runId,
      credit_rollover_e2e_label: input.label,
    },
  });

  return { apiKey, userId, subscription };
}

function assertUsageCreditPeriod(
  overview: UsageOverviewResponse,
  expected: {
    planId: string;
    start: Date;
    endExclusive: Date;
    nextBillingDate?: string | null;
  },
  label: string,
): void {
  assertEquals(overview.current_plan.plan_id, expected.planId, `${label} plan_id`);
  assertIso(overview.current_plan.credit_period_start, expected.start, `${label} credit_period_start`);
  assertIso(overview.current_plan.credit_period_end, expected.endExclusive, `${label} credit_period_end`);
  assertIso(overview.current_plan.next_credit_reset_at, expected.endExclusive, `${label} next_credit_reset_at`);
  assertIso(overview.current_plan.credits_expire_at, expected.endExclusive, `${label} credits_expire_at`);
  if ('nextBillingDate' in expected) {
    assertEquals(
      overview.current_plan.next_billing_date,
      expected.nextBillingDate ?? null,
      `${label} next_billing_date`,
    );
  }
}

function calendarMonthWindow(now: Date): CreditWindow {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    endExclusive: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

async function expectApiScopeDenied(input: {
  apiKey: string;
  method: Method;
  path: string;
  body?: unknown;
  label: string;
}): Promise<void> {
  const failure = await apiRequestFailure(input.method, input.path, input.apiKey, input.body);
  assertEquals(failure.status, 403, `${input.label} HTTP status`);
  assertEquals(failure.code, 'API_KEY_SCOPE_DENIED', `${input.label} error code`);
}

function isQuotaExceededError(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    error.status === 402 &&
    error.code === 'QUOTA_EXCEEDED'
  );
}

async function loadActiveProYearlySubscription(userId: Types.ObjectId): Promise<IBillingSubscriptionDocument> {
  const subscription = await billingRepository.findLatestSubscriptionByUserId(
    userId,
    [...ACTIVE_SUBSCRIPTION_STATUSES],
  );

  assert(subscription, 'No active subscription found for the API key user');
  assert(subscription.planCode === 'pro', `Expected Pro subscription, found ${subscription.planCode}`);
  assert(subscription.billingCycle === 'year', `Expected yearly subscription, found ${subscription.billingCycle}`);
  assert(subscription.currentPeriodStart, 'Pro yearly subscription is missing currentPeriodStart');
  assert(subscription.currentPeriodEnd, 'Pro yearly subscription is missing currentPeriodEnd');
  assert(
    subscription.currentPeriodEnd.getTime() > subscription.currentPeriodStart.getTime(),
    'Subscription period end must be after period start',
  );

  return subscription;
}

function printCheck(result: CheckResult): void {
  console.log(`  PASS ${result.name}${result.details ? ` - ${result.details}` : ''}`);
}

async function maybeAssertBillingOverview(input: {
  apiKey: string;
  hasBillingRead: boolean;
  options: CliOptions;
  subscription: IBillingSubscriptionDocument;
  userId: Types.ObjectId;
  window: CreditWindow;
  now: Date;
}): Promise<CheckResult | null> {
  if (input.options.skipBillingOverview || !input.hasBillingRead) {
    return null;
  }

  const overview = await withVirtualTime(input.now, () =>
    apiRequest<BillingOverviewResponse>('GET', '/api/v1/billing/overview', input.apiKey)
  );

  assertIso(overview.usage.creditPeriodStart, input.window.start, 'billing usage.creditPeriodStart');
  assertIso(overview.usage.nextCreditResetAt, input.window.endExclusive, 'billing usage.nextCreditResetAt');
  assertIso(overview.usage.creditsExpireAt, input.window.endExclusive, 'billing usage.creditsExpireAt');
  assertIso(overview.kpis.nextBillingDate, input.subscription.currentPeriodEnd!, 'billing renewal date');

  return {
    name: 'billing overview exposes monthly credit reset separately from annual renewal',
    details: `${overview.usage.nextCreditResetAt} reset, ${overview.kpis.nextBillingDate} renewal`,
  };
}

async function runFastForwardMonthlyReset(input: {
  apiKey: string;
  now: Date;
  options: CliOptions;
  sessionId: string;
  subscription: IBillingSubscriptionDocument;
  userId: Types.ObjectId;
  windows: CreditWindow[];
}): Promise<void> {
  const currentIndex = findCreditWindowIndexAt(input.windows, input.now);
  assert(currentIndex >= 0, `No credit window contains ${input.now.toISOString()}`);
  assert(
    currentIndex + 2 < input.windows.length,
    'Need at least two future credit windows for the fast-forward rollover scenario',
  );

  const realCurrentWindow = input.windows[currentIndex]!;
  const nextWindow = input.windows[currentIndex + 1]!;
  const followingWindow = input.windows[currentIndex + 2]!;
  const resetAt = realCurrentWindow.endExclusive;
  const afterResetAt = addMs(resetAt, ONE_HOUR_MS);
  const beforeFollowingReset = addMs(nextWindow.endExclusive, -1);
  const followingResetAt = nextWindow.endExclusive;
  const afterFollowingReset = addMs(followingResetAt, ONE_HOUR_MS);

  console.log('Fast-forward monthly reset');
  console.log(`  virtualNow: ${input.now.toISOString()}`);
  console.log(`  currentWindow: ${realCurrentWindow.start.toISOString()} -> ${realCurrentWindow.endExclusive.toISOString()}`);
  console.log(`  fastForwardToReset: ${resetAt.toISOString()}`);
  console.log(`  nextWindow: ${nextWindow.start.toISOString()} -> ${nextWindow.endExclusive.toISOString()}`);

  const resetCredits = input.options.resetCredits;
  const leftoverCredits = input.options.boundaryCredits;
  const beforeReset = await getUsageAt(input.apiKey, input.userId, addMs(resetAt, -1));
  assertIso(beforeReset.current_plan.credit_period_start, realCurrentWindow.start, 'fast-forward before reset period start');
  assertIso(beforeReset.current_plan.next_credit_reset_at, resetAt, 'fast-forward before reset next reset');
  if (beforeReset.summary.credits_used >= beforeReset.summary.credits_limit - CREDIT_TOLERANCE) {
    printCheck({
      name: 'virtual clock sees the real current credit window saturated before reset',
      details: `${beforeReset.summary.credits_used.toFixed(2)} / ${beforeReset.summary.credits_limit.toFixed(2)} credits`,
    });
  } else {
    printCheck({
      name: 'virtual clock sees remaining credits before reset and will verify they do not carry over',
      details: `${beforeReset.summary.credits_used.toFixed(2)} / ${beforeReset.summary.credits_limit.toFixed(2)} credits`,
    });
  }

  const baselineAfterReset = await getUsageAt(input.apiKey, input.userId, afterResetAt);
  assertUsageCreditPeriod(
    baselineAfterReset,
    {
      planId: input.subscription.planCode,
      start: nextWindow.start,
      endExclusive: nextWindow.endExclusive,
      nextBillingDate: input.subscription.currentPeriodEnd?.toISOString() ?? null,
    },
    'fast-forward after reset baseline',
  );
  assert(
    baselineAfterReset.summary.credits_used < baselineAfterReset.summary.credits_limit,
    `Expected the fast-forwarded new window to have available credits, got ${baselineAfterReset.summary.credits_used.toFixed(2)} / ${baselineAfterReset.summary.credits_limit.toFixed(2)}`,
  );

  await addUsageMessage({
    apiKey: input.apiKey,
    at: afterResetAt,
    credits: resetCredits,
    label: 'fast-forward-after-reset',
    runId: input.options.runId,
    sessionId: input.sessionId,
    userId: input.userId,
  });
  const afterResetUsage = await getUsageAt(input.apiKey, input.userId, afterResetAt);
  assertNear(
    creditsDelta(afterResetUsage, baselineAfterReset),
    resetCredits,
    'fast-forward post-reset usage delta',
  );
  printCheck({
    name: 'fast-forwarding to the next monthly reset restores spendable credits',
    details: `accepted ${resetCredits.toFixed(2)} credits at ${afterResetAt.toISOString()}`,
  });

  const baselineBeforeFollowingReset = await getUsageAt(input.apiKey, input.userId, beforeFollowingReset);
  const baselineFollowingResetBeforeLeftover = await getUsageAt(input.apiKey, input.userId, afterFollowingReset);
  await addUsageMessage({
    apiKey: input.apiKey,
    at: beforeFollowingReset,
    credits: leftoverCredits,
    label: 'fast-forward-leftover-before-next-reset',
    runId: input.options.runId,
    sessionId: input.sessionId,
    userId: input.userId,
  });
  const beforeFollowingResetUsage = await getUsageAt(input.apiKey, input.userId, beforeFollowingReset);
  assertNear(
    creditsDelta(beforeFollowingResetUsage, baselineBeforeFollowingReset),
    leftoverCredits,
    'fast-forward leftover before following reset delta',
  );

  const afterFollowingResetWithoutCarryover = await getUsageAt(input.apiKey, input.userId, afterFollowingReset);
  assertUsageCreditPeriod(
    afterFollowingResetWithoutCarryover,
    {
      planId: input.subscription.planCode,
      start: followingWindow.start,
      endExclusive: followingWindow.endExclusive,
      nextBillingDate: input.subscription.currentPeriodEnd?.toISOString() ?? null,
    },
    'fast-forward following reset baseline',
  );
  assertNear(
    creditsDelta(afterFollowingResetWithoutCarryover, baselineFollowingResetBeforeLeftover),
    0,
    'fast-forward leftover carryover delta',
  );

  await addUsageMessage({
    apiKey: input.apiKey,
    at: afterFollowingReset,
    credits: input.options.currentCredits,
    label: 'fast-forward-after-following-reset',
    runId: input.options.runId,
    sessionId: input.sessionId,
    userId: input.userId,
  });
  const afterFollowingResetUsage = await getUsageAt(input.apiKey, input.userId, afterFollowingReset);
  assertNear(
    creditsDelta(afterFollowingResetUsage, afterFollowingResetWithoutCarryover),
    input.options.currentCredits,
    'fast-forward following reset usage delta',
  );
  printCheck({
    name: 'fast-forwarding another month overrides leftover credits from the prior window',
    details: `${leftoverCredits.toFixed(2)} credits before reset did not carry into ${followingWindow.start.toISOString()}`,
  });
}

async function runSyntheticEdgeCaseChecks(options: CliOptions): Promise<void> {
  console.log('Synthetic rollover edge cases');

  const fullScopes: ApiKeyScope[] = [
    'sessions:read',
    'sessions:write',
    'usage:read',
    'billing:read',
  ];
  const activeStatusScopes: ApiKeyScope[] = ['usage:read'];

  const monthlyStart = new Date('2026-01-31T10:00:00.000Z');
  const monthlyEnd = new Date('2026-02-28T10:00:00.000Z');
  const monthlyNow = new Date('2026-02-14T12:00:00.000Z');
  const monthly = await createSyntheticAccount({
    label: 'monthly-pro',
    runId: options.runId,
    scopes: fullScopes,
    subscription: {
      planCode: 'pro',
      billingCycle: 'month',
      status: 'ACTIVE',
      currentPeriodStart: monthlyStart,
      currentPeriodEnd: monthlyEnd,
    },
  });

  const monthlyUsage = await getUsageAt(monthly.apiKey, monthly.userId, monthlyNow);
  assertUsageCreditPeriod(
    monthlyUsage,
    {
      planId: 'pro',
      start: monthlyStart,
      endExclusive: monthlyEnd,
      nextBillingDate: monthlyEnd.toISOString(),
    },
    'monthly subscription',
  );
  const monthlyBilling = await withVirtualTime(monthlyNow, () =>
    apiRequest<BillingOverviewResponse>('GET', '/api/v1/billing/overview', monthly.apiKey)
  );
  assertIso(monthlyBilling.usage.creditPeriodStart, monthlyStart, 'monthly billing creditPeriodStart');
  assertIso(monthlyBilling.usage.nextCreditResetAt, monthlyEnd, 'monthly billing nextCreditResetAt');
  assertIso(monthlyBilling.kpis.nextBillingDate, monthlyEnd, 'monthly billing nextBillingDate');
  printCheck({
    name: 'monthly subscriptions use the subscription period as the credit period',
    details: `${monthlyStart.toISOString()} -> ${monthlyEnd.toISOString()}`,
  });

  const expiredNow = new Date('2026-04-15T12:00:00.000Z');
  const expiredCalendar = calendarMonthWindow(expiredNow);
  const expired = await createSyntheticAccount({
    label: 'expired-pro',
    runId: options.runId,
    scopes: fullScopes,
    subscription: {
      planCode: 'pro',
      billingCycle: 'year',
      status: 'ACTIVE',
      currentPeriodStart: new Date('2025-01-17T10:00:00.000Z'),
      currentPeriodEnd: new Date('2026-01-17T10:00:00.000Z'),
    },
  });
  const expiredUsage = await getUsageAt(expired.apiKey, expired.userId, expiredNow);
  assertUsageCreditPeriod(
    expiredUsage,
    {
      planId: 'free',
      start: expiredCalendar.start,
      endExclusive: expiredCalendar.endExclusive,
      nextBillingDate: null,
    },
    'expired subscription',
  );
  const expiredBilling = await withVirtualTime(expiredNow, () =>
    apiRequest<BillingOverviewResponse>('GET', '/api/v1/billing/overview', expired.apiKey)
  );
  assertEquals(expiredBilling.currentPlan.id, 'pro', 'expired billing currentPlan id remains latest local subscription');
  assertNullish(expiredBilling.usage.creditPeriodStart, 'expired billing usage.creditPeriodStart');
  assertNullish(expiredBilling.usage.nextCreditResetAt, 'expired billing usage.nextCreditResetAt');
  printCheck({
    name: 'expired subscription usage falls back to free calendar-month credits',
    details: `${expiredUsage.current_plan.credit_period_start} -> ${expiredUsage.current_plan.credit_period_end}`,
  });

  const canceledNow = new Date('2026-04-15T12:00:00.000Z');
  const canceledCalendar = calendarMonthWindow(canceledNow);
  const canceled = await createSyntheticAccount({
    label: 'canceled-pro',
    runId: options.runId,
    scopes: fullScopes,
    subscription: {
      planCode: 'pro',
      billingCycle: 'year',
      status: 'CANCELED',
      currentPeriodStart: new Date('2026-01-17T10:00:00.000Z'),
      currentPeriodEnd: new Date('2027-01-17T10:00:00.000Z'),
    },
  });
  const canceledUsage = await getUsageAt(canceled.apiKey, canceled.userId, canceledNow);
  assertUsageCreditPeriod(
    canceledUsage,
    {
      planId: 'free',
      start: canceledCalendar.start,
      endExclusive: canceledCalendar.endExclusive,
      nextBillingDate: null,
    },
    'canceled subscription',
  );
  printCheck({
    name: 'canceled subscriptions do not grant active monthly credit windows',
    details: `${canceledUsage.current_plan.plan_id} ${canceledUsage.current_plan.credit_period_start}`,
  });

  const activeLikeStart = new Date('2026-01-31T10:00:00.000Z');
  const activeLikeEnd = new Date('2027-01-31T10:00:00.000Z');
  const activeLikeNow = new Date('2026-03-15T12:00:00.000Z');
  const activeLikeExpected = resolveMonthlyCreditPeriod({
    now: activeLikeNow,
    billingCycle: 'year',
    subscriptionPeriodStart: activeLikeStart,
    subscriptionPeriodEnd: activeLikeEnd,
  });

  for (const status of ACTIVE_SUBSCRIPTION_STATUSES) {
    const synthetic = await createSyntheticAccount({
      label: `status-${status.toLowerCase()}`,
      runId: options.runId,
      scopes: activeStatusScopes,
      subscription: {
        planCode: 'pro',
        billingCycle: 'year',
        status,
        currentPeriodStart: activeLikeStart,
        currentPeriodEnd: activeLikeEnd,
      },
    });
    const overview = await getUsageAt(synthetic.apiKey, synthetic.userId, activeLikeNow);
    assertUsageCreditPeriod(
      overview,
      {
        planId: 'pro',
        start: activeLikeExpected.periodStart,
        endExclusive: activeLikeExpected.periodEndExclusive,
        nextBillingDate: activeLikeEnd.toISOString(),
      },
      `status ${status}`,
    );
  }
  printCheck({
    name: 'all active-like subscription statuses keep paid monthly credit windows',
    details: ACTIVE_SUBSCRIPTION_STATUSES.join(', '),
  });

  const enterpriseStart = new Date('2026-03-10T09:30:00.000Z');
  const enterpriseEnd = new Date('2027-03-10T09:30:00.000Z');
  const enterpriseNow = new Date('2026-05-02T11:00:00.000Z');
  const enterpriseExpected = resolveMonthlyCreditPeriod({
    now: enterpriseNow,
    billingCycle: 'year',
    subscriptionPeriodStart: enterpriseStart,
    subscriptionPeriodEnd: enterpriseEnd,
  });
  const enterprise = await createSyntheticAccount({
    label: 'enterprise-yearly',
    runId: options.runId,
    scopes: activeStatusScopes,
    subscription: {
      planCode: 'enterprise',
      billingCycle: 'year',
      status: 'ACTIVE',
      currentPeriodStart: enterpriseStart,
      currentPeriodEnd: enterpriseEnd,
    },
  });
  const enterpriseUsage = await getUsageAt(enterprise.apiKey, enterprise.userId, enterpriseNow);
  assertUsageCreditPeriod(
    enterpriseUsage,
    {
      planId: 'enterprise',
      start: enterpriseExpected.periodStart,
      endExclusive: enterpriseExpected.periodEndExclusive,
      nextBillingDate: enterpriseEnd.toISOString(),
    },
    'enterprise yearly subscription',
  );
  printCheck({
    name: 'non-Pro active plans use the same rollover logic without downgrading plan id',
    details: `enterprise ${enterpriseUsage.current_plan.credit_period_start}`,
  });

  const noBillingScope = await createSyntheticAccount({
    label: 'scope-no-billing-read',
    runId: options.runId,
    scopes: ['usage:read'],
    subscription: {
      planCode: 'pro',
      billingCycle: 'year',
      status: 'ACTIVE',
      currentPeriodStart: activeLikeStart,
      currentPeriodEnd: activeLikeEnd,
    },
  });
  await expectApiScopeDenied({
    apiKey: noBillingScope.apiKey,
    method: 'GET',
    path: '/api/v1/billing/overview',
    label: 'missing billing:read',
  });
  const noUsageScope = await createSyntheticAccount({
    label: 'scope-no-usage-read',
    runId: options.runId,
    scopes: ['sessions:read', 'sessions:write'],
    subscription: {
      planCode: 'pro',
      billingCycle: 'year',
      status: 'ACTIVE',
      currentPeriodStart: activeLikeStart,
      currentPeriodEnd: activeLikeEnd,
    },
  });
  await expectApiScopeDenied({
    apiKey: noUsageScope.apiKey,
    method: 'GET',
    path: '/api/v1/usage/overview?range=month_to_date',
    label: 'missing usage:read',
  });
  const noSessionWriteScope = await createSyntheticAccount({
    label: 'scope-no-session-write',
    runId: options.runId,
    scopes: ['sessions:read', 'usage:read'],
    subscription: {
      planCode: 'pro',
      billingCycle: 'year',
      status: 'ACTIVE',
      currentPeriodStart: activeLikeStart,
      currentPeriodEnd: activeLikeEnd,
    },
  });
  await expectApiScopeDenied({
    apiKey: noSessionWriteScope.apiKey,
    method: 'POST',
    path: '/api/v1/sessions',
    body: {
      name: 'Missing write scope probe',
      working_directory: `D:/nirex/e2e/credit-rollover/${options.runId}/scope`,
      model: options.model,
      source: 'credit-rollover-e2e',
    },
    label: 'missing sessions:write',
  });
  printCheck({
    name: 'API key scope failures are enforced for usage, billing, and session writes',
    details: '403 API_KEY_SCOPE_DENIED',
  });

  const monthEndCases = [
    {
      label: 'jan-31-to-feb-28',
      start: new Date('2026-01-31T10:00:00.000Z'),
      end: new Date('2027-01-31T10:00:00.000Z'),
      now: new Date('2026-02-28T10:00:00.000Z'),
      expectedStart: new Date('2026-02-28T10:00:00.000Z'),
      expectedEnd: new Date('2026-03-31T10:00:00.000Z'),
    },
    {
      label: 'leap-year-feb-29-anchor',
      start: new Date('2024-02-29T08:45:00.000Z'),
      end: new Date('2025-02-28T08:45:00.000Z'),
      now: new Date('2024-03-30T08:45:00.000Z'),
      expectedStart: new Date('2024-03-29T08:45:00.000Z'),
      expectedEnd: new Date('2024-04-29T08:45:00.000Z'),
    },
    {
      label: 'final-window-clamped-to-renewal',
      start: new Date('2026-05-17T01:58:30.000Z'),
      end: new Date('2027-05-17T01:58:30.000Z'),
      now: new Date('2027-05-01T00:00:00.000Z'),
      expectedStart: new Date('2027-04-17T01:58:30.000Z'),
      expectedEnd: new Date('2027-05-17T01:58:30.000Z'),
    },
  ];

  for (const testCase of monthEndCases) {
    const period = resolveMonthlyCreditPeriod({
      now: testCase.now,
      billingCycle: 'year',
      subscriptionPeriodStart: testCase.start,
      subscriptionPeriodEnd: testCase.end,
    });
    assertIso(period.periodStart.toISOString(), testCase.expectedStart, `${testCase.label} periodStart`);
    assertIso(period.periodEndExclusive.toISOString(), testCase.expectedEnd, `${testCase.label} periodEndExclusive`);
    assertIso(period.nextCreditResetAt.toISOString(), testCase.expectedEnd, `${testCase.label} nextCreditResetAt`);
  }
  printCheck({
    name: 'month-end, leap-year, and final-renewal rollover math is clamped correctly',
    details: monthEndCases.map((testCase) => testCase.label).join(', '),
  });
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assert(options.apiKey, 'Missing API key. Set NIREX_API_KEY or pass --api-key.');

  await connectDatabase();

  let userId: Types.ObjectId | null = null;
  let cleaned = false;
  let syntheticCleaned = false;
  try {
    if (options.cleanupBefore) {
      await cleanupSyntheticRunData(options.runId);
    }

    const identity = await apiKeyService.authenticateApiKey(options.apiKey, REQUIRED_SCOPES);
    userId = new Types.ObjectId(identity.userId);
    const subscription = await loadActiveProYearlySubscription(userId);
    const windows = buildCreditWindows(subscription);
    assert(windows.length >= 3, 'Need at least three monthly windows inside the yearly subscription period');

    const previousWindow = windows[0]!;
    const currentWindow = windows[1]!;
    const resetWindow = windows[2]!;
    const previousEventAt = insideWindow(previousWindow, ONE_DAY_MS);
    const currentEventAt = insideWindow(currentWindow, ONE_DAY_MS);
    const midCurrentNow = insideWindow(currentWindow, ONE_DAY_MS + ONE_HOUR_MS);
    const beforeResetNow = addMs(currentWindow.endExclusive, -1);
    const resetAt = currentWindow.endExclusive;

    console.log('Credit rollover E2E');
    console.log(`  userId: ${userId.toString()}`);
    console.log(`  runId: ${options.runId}`);
    console.log(`  subscriptionPeriod: ${subscription.currentPeriodStart!.toISOString()} -> ${subscription.currentPeriodEnd!.toISOString()}`);
    console.log(`  currentCreditWindow: ${currentWindow.start.toISOString()} -> ${currentWindow.endExclusive.toISOString()}`);
    console.log(`  cleanup: ${options.keepData ? 'disabled' : 'enabled'}`);

    if (options.cleanupBefore) {
      await cleanupRunData(userId, options.runId);
    }

    const baselineMid = await getUsageAt(options.apiKey, userId, midCurrentNow);
    const baselineBeforeReset = await getUsageAt(options.apiKey, userId, beforeResetNow);
    const baselineAtReset = await getUsageAt(options.apiKey, userId, resetAt);

    assert(baselineMid.current_plan.plan_id === 'pro', `Expected usage plan_id pro, got ${baselineMid.current_plan.plan_id}`);
    assertIso(baselineMid.current_plan.credit_period_start, currentWindow.start, 'usage current_plan.credit_period_start');
    assertIso(baselineMid.current_plan.next_credit_reset_at, currentWindow.endExclusive, 'usage current_plan.next_credit_reset_at');

    printCheck({
      name: 'usage overview resolves current monthly credit window from yearly purchase date',
      details: `${baselineMid.current_plan.credit_period_start} -> ${baselineMid.current_plan.credit_period_end}`,
    });

    const sessionId = await createSeedSession(options.apiKey, options, previousEventAt);
    let previousUsageSeeded = true;
    try {
      await addUsageMessage({
        apiKey: options.apiKey,
        at: previousEventAt,
        credits: options.previousCredits,
        label: 'previous-window',
        runId: options.runId,
        sessionId,
        userId,
      });
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        throw error;
      }

      previousUsageSeeded = false;
      const previousUsage = await getUsageAt(options.apiKey, userId, previousEventAt);
      const wouldExceedLimit =
        previousUsage.summary.credits_used + options.previousCredits >
        previousUsage.summary.credits_limit;
      assert(
        wouldExceedLimit,
        `previous-window usage was quota-blocked but the window was not over limit: ${previousUsage.summary.credits_used.toFixed(2)} / ${previousUsage.summary.credits_limit.toFixed(2)}`,
      );
      printCheck({
        name: 'already exhausted prior credit window rejects additional usage before reset',
        details: `${previousUsage.summary.credits_used.toFixed(2)} / ${previousUsage.summary.credits_limit.toFixed(2)} credits`,
      });
    }
    await addUsageMessage({
      apiKey: options.apiKey,
      at: currentEventAt,
      credits: options.currentCredits,
      label: 'current-window',
      runId: options.runId,
      sessionId,
      userId,
    });
    await addUsageMessage({
      apiKey: options.apiKey,
      at: beforeResetNow,
      credits: options.boundaryCredits,
      label: 'before-reset-boundary',
      runId: options.runId,
      sessionId,
      userId,
    });
    await addUsageMessage({
      apiKey: options.apiKey,
      at: resetAt,
      credits: options.resetCredits,
      label: 'exact-reset',
      runId: options.runId,
      sessionId,
      userId,
    });

    const afterMid = await getUsageAt(options.apiKey, userId, midCurrentNow);
    const midDelta = creditsDelta(afterMid, baselineMid);
    assertNear(midDelta, options.currentCredits, 'current-window credit delta');
    printCheck({
      name: 'prior monthly credits expire and do not count in the active window',
      details: previousUsageSeeded
        ? `delta ${midDelta.toFixed(2)} excludes ${options.previousCredits.toFixed(2)} prior credits`
        : `delta ${midDelta.toFixed(2)} excludes the quota-saturated prior window`,
    });

    const afterBeforeReset = await getUsageAt(options.apiKey, userId, beforeResetNow);
    const beforeResetDelta = creditsDelta(afterBeforeReset, baselineBeforeReset);
    assertNear(
      beforeResetDelta,
      options.currentCredits + options.boundaryCredits,
      'before-reset credit delta',
    );
    assertIso(afterBeforeReset.current_plan.credit_period_start, currentWindow.start, 'before-reset period start');
    assertIso(afterBeforeReset.current_plan.next_credit_reset_at, currentWindow.endExclusive, 'before-reset next reset');
    printCheck({
      name: 'usage one millisecond before reset still belongs to the expiring credit period',
      details: `delta ${beforeResetDelta.toFixed(2)}`,
    });

    const afterReset = await getUsageAt(options.apiKey, userId, resetAt);
    const resetDelta = creditsDelta(afterReset, baselineAtReset);
    assertNear(resetDelta, options.resetCredits, 'exact-reset credit delta');
    assertIso(afterReset.current_plan.credit_period_start, resetWindow.start, 'reset period start');
    assertIso(afterReset.current_plan.next_credit_reset_at, resetWindow.endExclusive, 'reset next reset');
    printCheck({
      name: 'credits override exactly at reset and new usage starts the next monthly period',
      details: `delta ${resetDelta.toFixed(2)} starts at ${afterReset.current_plan.credit_period_start}`,
    });

    console.log('  TRACE checking billing overview reset metadata');
    const billingCheck = await maybeAssertBillingOverview({
      apiKey: options.apiKey,
      hasBillingRead: hasScope(identity.scopes, 'billing:read'),
      options,
      subscription,
      userId,
      window: currentWindow,
      now: midCurrentNow,
    });
    if (billingCheck) {
      printCheck(billingCheck);
    } else {
      console.log('  SKIP billing overview API assertion - API key lacks billing:read or check was disabled');
    }

    console.log('  TRACE starting fast-forward monthly reset checks');
    await runFastForwardMonthlyReset({
      apiKey: options.apiKey,
      now: new RealDate(),
      options,
      sessionId,
      subscription,
      userId,
      windows,
    });
    console.log('  TRACE completed fast-forward monthly reset checks');

    console.log('  TRACE starting synthetic edge-case checks');
    await runSyntheticEdgeCaseChecks(options);

    if (!options.keepData) {
      await cleanupRunData(userId, options.runId);
      await cleanupSyntheticRunData(options.runId);
      cleaned = true;
      syntheticCleaned = true;
      printCheck({ name: 'seeded E2E data cleaned up', details: options.runId });
    } else {
      console.log(`  KEEP seeded records for runId ${options.runId}`);
    }

    console.log('Done. Credit rollover E2E passed.');
  } finally {
    globalThis.Date = RealDate;
    if (userId && !options.keepData && !cleaned) {
      try {
        await cleanupRunData(userId, options.runId);
      } catch (cleanupError) {
        const cleanupMessage = cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError);
        console.error(`Cleanup after failed E2E run also failed: ${cleanupMessage}`);
      }
    }
    if (!options.keepData && !syntheticCleaned && mongoose.connection.readyState !== 0) {
      try {
        await cleanupSyntheticRunData(options.runId);
      } catch (cleanupError) {
        const cleanupMessage = cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError);
        console.error(`Synthetic cleanup after failed E2E run also failed: ${cleanupMessage}`);
      }
    }
    if (userId && !options.keepData) {
      await resetUsageCache(userId);
    }
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase();
    }
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Credit rollover E2E failed: ${message}`);
  process.exitCode = 1;
});
