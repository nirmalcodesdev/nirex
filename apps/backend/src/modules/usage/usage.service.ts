import { Types } from 'mongoose';
import type {
  UsageExportFormat,
  UsageOverviewResponse,
  UsageRange,
  UsageTopProject,
} from '@nirex/shared';
import { tokenPricingService } from '../chat-session/token-pricing.service.js';
import { usageRepository, type DateRange, type SessionUsageAggregate } from './usage.repository.js';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { billingRepository } from '../billing/billing.repository.js';
import { getBillingPlan, getPlanPrice } from '../billing/billing.catalog.js';
import type { BillingPlanId } from '../billing/billing.types.js';
import type { BillingSubscriptionStatus } from '../billing/billing.model.js';

const CREDIT_UNIT_PRICE_USD = 0.05;
const DEFAULT_CREDITS_LIMIT = 10000;
const ACTIVE_SUBSCRIPTION_STATUSES: BillingSubscriptionStatus[] = [
  'trialing',
  'active',
  'incomplete',
  'past_due',
  'unpaid',
  'paused',
];

interface Snapshot {
  total_requests: number;
  total_token_cost_usd: number;
  derived_credits: number;
  event_credits: number;
  avg_response_time_ms: number | null;
  projects: UsageTopProject[];
}

interface ExportPayload {
  content: string;
  contentType: string;
  fileName: string;
}

interface ResolvedCurrentPlan {
  planId: string;
  planName: string;
  priceUsdMonthly: number;
  includedCredits: number;
  nextBillingDate: string;
  billingCycle: 'month' | 'year' | null;
  subscriptionPeriodStart: Date | null;
  subscriptionPeriodEnd: Date | null;
}

const inMemoryCache = new Map<
  string,
  { expiresAt: number; value: UsageOverviewResponse }
>();

function round(value: number, precision: number = 4): number {
  return Number(value.toFixed(precision));
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return round(((current - previous) / previous) * 100, 2);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const next = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(anchorDay, daysInTargetMonth));
  return next;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayRange(range: DateRange): string[] {
  const dates: string[] = [];
  let cursor = startOfDay(range.start);
  const end = startOfDay(range.end);
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function resolveRange(range: UsageRange, now: Date): { current: DateRange; previous: DateRange } {
  const nowEnd = endOfDay(now);
  let start: Date;

  if (range === 'month_to_date') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else {
    const days = range === '90d' ? 90 : 30;
    start = startOfDay(addDays(now, -(days - 1)));
  }

  const current: DateRange = { start, end: nowEnd };
  const durationMs = current.end.getTime() - current.start.getTime() + 1;
  const previous: DateRange = {
    start: new Date(current.start.getTime() - durationMs),
    end: new Date(current.start.getTime() - 1),
  };

  return { current, previous };
}

function mapSessionUsageById(usages: SessionUsageAggregate[]): Map<string, SessionUsageAggregate> {
  return new Map(usages.map((usage) => [usage.session_id, usage]));
}

function nextBillingDate(now: Date): string {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  const next = month === 11
    ? new Date(Date.UTC(year + 1, 0, 1))
    : new Date(Date.UTC(year, month + 1, 1));
  return next.toISOString();
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function isBillingPlanId(value: string | undefined): value is BillingPlanId {
  return value === 'free' || value === 'pro' || value === 'enterprise' || value === 'custom';
}

function normalizePlanId(value: string | undefined): BillingPlanId {
  if (value === 'hobby' || value === 'free') return 'free';
  if (isBillingPlanId(value)) return value;
  return 'free';
}

export class UsageService {
  private readonly overviewCachePrefix = 'usage:overview';
  private readonly overviewCacheTtlSeconds = 120;
  private readonly overviewInMemoryCacheMaxEntries = 5000;

  private pruneInMemoryCache(nowMs: number = Date.now()): void {
    for (const [key, item] of inMemoryCache) {
      if (item.expiresAt < nowMs) {
        inMemoryCache.delete(key);
      }
    }

    while (inMemoryCache.size >= this.overviewInMemoryCacheMaxEntries) {
      const oldestKey = inMemoryCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      inMemoryCache.delete(oldestKey);
    }
  }

  private async getCachedOverview(cacheKey: string): Promise<UsageOverviewResponse | null> {
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const raw = await redis.get(cacheKey);
        if (raw) {
          return JSON.parse(raw) as UsageOverviewResponse;
        }
      } catch {
        // Continue with in-memory cache fallback
      }
    }

    const item = inMemoryCache.get(cacheKey);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      inMemoryCache.delete(cacheKey);
      return null;
    }
    return item.value;
  }

  private async setCachedOverview(cacheKey: string, data: UsageOverviewResponse): Promise<void> {
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, this.overviewCacheTtlSeconds, JSON.stringify(data));
      } catch {
        // Fall back to in-memory cache
      }
    }

    this.pruneInMemoryCache();
    inMemoryCache.set(cacheKey, {
      value: data,
      expiresAt: Date.now() + this.overviewCacheTtlSeconds * 1000,
    });
  }

  private async resolveCurrentPlan(userId: Types.ObjectId): Promise<ResolvedCurrentPlan> {
    const freePlan = getBillingPlan('free');
    const defaultPlanName = freePlan?.name ?? 'Free';
    const defaultMonthlyPrice = (getPlanPrice('free', 'month')?.amountCents ?? 0) / 100;

    try {
      const subscription = await billingRepository.findLatestSubscriptionByUserId(
        userId,
        ACTIVE_SUBSCRIPTION_STATUSES,
      );
      const rawPlanId = subscription?.planId;
      const planId = normalizePlanId(rawPlanId);

      if (planId === 'custom') {
        const monthlyPrice = subscription
          ? subscription.billingCycle === 'year'
            ? subscription.amountCents / 1200
            : subscription.amountCents / 100
          : 0;

        return {
          planId: 'custom',
          planName: 'Custom',
          priceUsdMonthly: round(monthlyPrice, 2),
          includedCredits: DEFAULT_CREDITS_LIMIT,
          nextBillingDate: subscription?.currentPeriodEnd?.toISOString() ?? nextBillingDate(new Date()),
          billingCycle: subscription?.billingCycle ?? null,
          subscriptionPeriodStart: subscription?.currentPeriodStart ?? null,
          subscriptionPeriodEnd: subscription?.currentPeriodEnd ?? null,
        };
      }

      const plan = getBillingPlan(planId) ?? freePlan;
      const monthlyPriceCents =
        getPlanPrice(planId, 'month')?.amountCents ??
        (subscription
          ? subscription.billingCycle === 'year'
            ? Math.round(subscription.amountCents / 12)
            : subscription.amountCents
          : 0);

      return {
        planId: plan?.id ?? 'free',
        planName: plan?.name ?? defaultPlanName,
        priceUsdMonthly: round(monthlyPriceCents / 100, 2),
        includedCredits: plan?.includedCredits ?? DEFAULT_CREDITS_LIMIT,
        nextBillingDate: subscription?.currentPeriodEnd?.toISOString() ?? nextBillingDate(new Date()),
        billingCycle: subscription?.billingCycle ?? null,
        subscriptionPeriodStart: subscription?.currentPeriodStart ?? null,
        subscriptionPeriodEnd: subscription?.currentPeriodEnd ?? null,
      };
    } catch {
      return {
        planId: 'free',
        planName: defaultPlanName,
        priceUsdMonthly: round(defaultMonthlyPrice, 2),
        includedCredits: freePlan?.includedCredits ?? DEFAULT_CREDITS_LIMIT,
        nextBillingDate: nextBillingDate(new Date()),
        billingCycle: null,
        subscriptionPeriodStart: null,
        subscriptionPeriodEnd: null,
      };
    }
  }

  private resolveCreditUsageRange(
    now: Date,
    plan: ResolvedCurrentPlan,
  ): DateRange {
    const nowEnd = endOfDay(now);

    if (
      plan.billingCycle === 'month' &&
      plan.subscriptionPeriodStart &&
      plan.subscriptionPeriodEnd
    ) {
      return {
        start: plan.subscriptionPeriodStart,
        end: nowEnd < plan.subscriptionPeriodEnd ? nowEnd : plan.subscriptionPeriodEnd,
      };
    }

    if (
      plan.billingCycle === 'year' &&
      plan.subscriptionPeriodStart &&
      plan.subscriptionPeriodEnd
    ) {
      const anchorDay = plan.subscriptionPeriodStart.getUTCDate();
      let windowStart = new Date(plan.subscriptionPeriodStart);
      let nextWindowStart = addMonthsClamped(windowStart, 1, anchorDay);

      while (nextWindowStart <= now && nextWindowStart < plan.subscriptionPeriodEnd) {
        windowStart = nextWindowStart;
        nextWindowStart = addMonthsClamped(windowStart, 1, anchorDay);
      }

      const maxEnd = nextWindowStart.getTime() - 1;
      const entitlementEnd = new Date(
        Math.min(maxEnd, plan.subscriptionPeriodEnd.getTime(), nowEnd.getTime()),
      );

      return {
        start: windowStart,
        end: entitlementEnd,
      };
    }

    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: nowEnd,
    };
  }

  private async buildSnapshot(userId: Types.ObjectId, range: DateRange): Promise<Snapshot> {
    const [
      sessionMeta,
      sessionUsage,
      eventTotals,
      responseAvg,
    ] = await Promise.all([
      usageRepository.listSessionProjectMeta(userId),
      usageRepository.getSessionUsageFromMessages(userId, range),
      usageRepository.getEventTotals(userId, range),
      usageRepository.getAverageResponseTimeMs(userId, range),
    ]);

    const usageBySession = mapSessionUsageById(sessionUsage);
    const projectMap = new Map<
      string,
      {
        project_name: string;
        credits: number;
        requests: number;
        cost_usd: number;
      }
    >();

    let totalRequests = 0;
    let totalTokenCost = 0;
    let derivedCredits = 0;

    for (const meta of sessionMeta) {
      const usage = usageBySession.get(meta.session_id);
      if (!usage) {
        continue;
      }

      const cost = await tokenPricingService.calculateCost(
        meta.model,
        usage.input_tokens || 0,
        usage.output_tokens || 0,
        usage.cached_tokens || 0
      );

      const credits = (usage.total_tokens || 0) / 1000;
      totalRequests += usage.requests || 0;
      totalTokenCost += cost.cost;
      derivedCredits += credits;

      const existing = projectMap.get(meta.project_id) || {
        project_name: meta.project_name,
        credits: 0,
        requests: 0,
        cost_usd: 0,
      };

      existing.credits += credits;
      existing.requests += usage.requests || 0;
      existing.cost_usd += cost.cost;
      projectMap.set(meta.project_id, existing);
    }

    const projects: UsageTopProject[] = [...projectMap.entries()].map(([projectId, project]) => ({
      project_id: projectId,
      project_name: project.project_name,
      credits: round(project.credits, 2),
      requests: Math.round(project.requests),
      cost_usd: round(project.cost_usd, 4),
      trend_pct: 0,
    }));

    return {
      total_requests: totalRequests,
      total_token_cost_usd: round(totalTokenCost, 6),
      derived_credits: round(derivedCredits, 4),
      event_credits: round(eventTotals.credits, 4),
      avg_response_time_ms: responseAvg === null ? null : round(responseAvg, 2),
      projects,
    };
  }

  async getOverview(
    userId: Types.ObjectId,
    range: UsageRange = '30d'
  ): Promise<UsageOverviewResponse> {
    const cacheKey = `${this.overviewCachePrefix}:${userId.toString()}:${range}`;
    const cached = await this.getCachedOverview(cacheKey);
    if (cached) {
      return cached;
    }

    const { current, previous } = resolveRange(range, new Date());

    const currentPlan = await this.resolveCurrentPlan(userId);
    const creditRange = this.resolveCreditUsageRange(new Date(), currentPlan);

    const [
      currentSnapshot,
      previousSnapshot,
      dailyTokens,
      dailyEvents,
      creditSnapshot,
    ] = await Promise.all([
      this.buildSnapshot(userId, current),
      this.buildSnapshot(userId, previous),
      usageRepository.getDailyTokenTotals(userId, current),
      usageRepository.getDailyEventTotals(userId, current, ['credits']),
      this.buildSnapshot(userId, creditRange),
    ]);

    const creditsUsed = creditSnapshot.event_credits > 0
      ? creditSnapshot.event_credits
      : creditSnapshot.derived_credits;
    const creditsCost = currentSnapshot.event_credits > 0
      ? currentSnapshot.event_credits * CREDIT_UNIT_PRICE_USD
      : currentSnapshot.total_token_cost_usd;
    const previousCreditsCost = previousSnapshot.event_credits > 0
      ? previousSnapshot.event_credits * CREDIT_UNIT_PRICE_USD
      : previousSnapshot.total_token_cost_usd;
    const totalCost = creditsCost;
    const previousTotalCost = previousCreditsCost;

    const previousProjects = new Map(
      previousSnapshot.projects.map((project) => [project.project_id, project.cost_usd])
    );

    const topProjects = currentSnapshot.projects
      .map((project) => {
        const prevCost = previousProjects.get(project.project_id) || 0;
        return {
          ...project,
          trend_pct: percentageChange(project.cost_usd, prevCost),
        };
      })
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 10);

    const tokenByDate = new Map(dailyTokens.map((d) => [d.date, d.total_tokens / 1000]));
    const eventMap = new Map<string, { credits: number }>();
    for (const event of dailyEvents) {
      const existing = eventMap.get(event.date) || { credits: 0 };
      if (event.event_type === 'credits') existing.credits += event.total;
      eventMap.set(event.date, existing);
    }

    const chart = dayRange(current).map((date) => {
      const fromEvents = eventMap.get(date) || { credits: 0 };
      const fallbackCredits = tokenByDate.get(date) || 0;
      return {
        date,
        credits: round(fromEvents.credits > 0 ? fromEvents.credits : fallbackCredits, 4),
      };
    });

    const creditsLimit = Math.max(1, currentPlan.includedCredits);

    const result: UsageOverviewResponse = {
      summary: {
        total_usage_cost_usd: round(totalCost, 4),
        total_usage_cost_trend_pct: percentageChange(totalCost, previousTotalCost),
        credits_used: round(creditsUsed, 2),
        credits_limit: creditsLimit,
        credits_used_pct: round(
          (creditsUsed / creditsLimit) * 100,
          2
        ),
        total_requests: Math.round(currentSnapshot.total_requests),
        total_requests_trend_pct: percentageChange(
          currentSnapshot.total_requests,
          previousSnapshot.total_requests
        ),
        avg_response_time_ms: currentSnapshot.avg_response_time_ms,
        avg_response_time_trend_pct:
          currentSnapshot.avg_response_time_ms === null ||
          previousSnapshot.avg_response_time_ms === null
            ? null
            : percentageChange(
                currentSnapshot.avg_response_time_ms,
                previousSnapshot.avg_response_time_ms
              ),
      },
      chart,
      cost_breakdown: {
        items: [
          {
            key: 'credits',
            units: round(creditsUsed, 4),
            unit_price_usd: round(
              creditsUsed > 0 ? creditsCost / creditsUsed : CREDIT_UNIT_PRICE_USD,
              6
            ),
            cost_usd: round(creditsCost, 4),
            description: 'Credits consumed by model execution',
          },
        ],
        total_cost_usd: round(totalCost, 4),
      },
      top_projects: topProjects,
      current_plan: {
        plan_id: currentPlan.planId,
        plan_name: currentPlan.planName,
        price_usd_monthly: currentPlan.priceUsdMonthly,
        included_credits: creditsLimit,
        next_billing_date: currentPlan.nextBillingDate,
      },
    };

    await this.setCachedOverview(cacheKey, result);
    return result;
  }

  async exportOverview(
    userId: Types.ObjectId,
    range: UsageRange = '30d',
    format: UsageExportFormat = 'json'
  ): Promise<ExportPayload> {
    const overview = await this.getOverview(userId, range);
    const dateStamp = toISODate(new Date());

    if (format === 'json') {
      return {
        content: JSON.stringify(overview, null, 2),
        contentType: 'application/json',
        fileName: `usage-report-${range}-${dateStamp}.json`,
      };
    }

    const rows: string[] = [];
    rows.push(
      ['section', 'key', 'date_or_label', 'metric_1', 'metric_2', 'metric_3', 'metric_4']
        .map(escapeCsv)
        .join(',')
    );

    rows.push(
      ['summary', 'totals', '', overview.summary.total_usage_cost_usd, overview.summary.total_requests, overview.summary.credits_used, overview.summary.avg_response_time_ms ?? '']
        .map(escapeCsv)
        .join(',')
    );

    for (const point of overview.chart) {
      rows.push(
        ['chart', 'daily_usage', point.date, point.credits, '', '', '']
          .map(escapeCsv)
          .join(',')
      );
    }

    for (const item of overview.cost_breakdown.items) {
      rows.push(
        ['cost_breakdown', item.key, item.description, item.units, item.unit_price_usd, item.cost_usd, '']
          .map(escapeCsv)
          .join(',')
      );
    }

    for (const project of overview.top_projects) {
      rows.push(
        ['top_projects', project.project_id, project.project_name, project.credits, project.requests, project.cost_usd, project.trend_pct]
          .map(escapeCsv)
          .join(',')
      );
    }

    return {
      content: rows.join('\n'),
      contentType: 'text/csv; charset=utf-8',
      fileName: `usage-report-${range}-${dateStamp}.csv`,
    };
  }
}

export const usageService = new UsageService();
