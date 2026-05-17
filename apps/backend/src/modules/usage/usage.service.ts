import { Types } from 'mongoose';
import type {
  UsageExportFormat,
  UsageOverviewResponse,
  UsageRange,
  UsageTopProject,
} from '@nirex/shared';
import { usageRepository, type DateRange, type SessionUsageAggregate } from './usage.repository.js';
import { billingRepository } from '../billing/billing.repository.js';
import { getBillingPlan } from '../billing/billing.catalog.js';
import type { BillingPlanId } from '../billing/billing.types.js';
import {
  creditPeriodUsageRangeEnd,
  resolveMonthlyCreditPeriod,
  type CreditPeriod,
} from '../billing/domain/credit-period.js';
import type { BillingSubscriptionStatus } from '../billing/billing.model.js';
import {
  getCachedUsageOverview,
  invalidateUsageOverviewCache,
  setCachedUsageOverview,
} from './usage.cache.js';
import { DEFAULT_CREDITS_LIMIT } from '@nirex/shared/domain/usage/schemas';

const ACTIVE_SUBSCRIPTION_STATUSES: Array<Exclude<BillingSubscriptionStatus, 'NONE'>> = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
];

interface Snapshot {
  total_requests: number;
  credits: number;
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
  includedCredits: number;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  billingCycle: 'month' | 'year' | null;
  subscriptionPeriodStart: Date | null;
  subscriptionPeriodEnd: Date | null;
  creditPeriod: CreditPeriod;
}

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

function resolveRange(
  range: UsageRange,
  now: Date,
  creditRange?: DateRange,
): { current: DateRange; previous: DateRange } {
  const nowEnd = endOfDay(now);
  let start: Date;
  let end = nowEnd;

  if (range === 'month_to_date' && creditRange) {
    start = creditRange.start;
    end = creditRange.end;
  } else if (range === 'month_to_date') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else {
    const days = range === '90d' ? 90 : 30;
    start = startOfDay(addDays(now, -(days - 1)));
  }

  const current: DateRange = { start, end };
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

function previousRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime() + 1;
  return {
    start: new Date(range.start.getTime() - durationMs),
    end: new Date(range.start.getTime() - 1),
  };
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
  async invalidateOverviewCache(userId: Types.ObjectId | string): Promise<void> {
    await invalidateUsageOverviewCache(userId);
  }

  private async resolveCurrentPlan(userId: Types.ObjectId): Promise<ResolvedCurrentPlan> {
    const freePlan = getBillingPlan('free');
    const defaultPlanName = freePlan?.name ?? 'Free';

    try {
      const subscription = await billingRepository.findLatestSubscriptionByUserId(
        userId,
        ACTIVE_SUBSCRIPTION_STATUSES,
      );

      const now = new Date();
      const subscriptionWindowActive =
        subscription !== null &&
        ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > now);

      const subscriptionPeriodStart = subscriptionWindowActive
        ? subscription?.currentPeriodStart ?? null
        : null;
      const subscriptionPeriodEnd = subscriptionWindowActive
        ? subscription?.currentPeriodEnd ?? null
        : null;
      const effectivePeriodStart = subscriptionPeriodStart;
      const effectivePeriodEnd = subscriptionPeriodEnd;
      const effectiveBillingCycle =
        subscriptionWindowActive && subscription
          ? subscription.billingCycle
          : null;
      const creditPeriod = resolveMonthlyCreditPeriod({
        now,
        billingCycle: effectiveBillingCycle,
        subscriptionPeriodStart: effectivePeriodStart,
        subscriptionPeriodEnd: effectivePeriodEnd,
      });

      const rawPlanId = subscriptionWindowActive
        ? subscription?.planCode
        : 'free';
      const planId = normalizePlanId(rawPlanId);

      if (planId === 'custom') {
        return {
          planId: 'custom',
          planName: 'Custom',
          includedCredits: DEFAULT_CREDITS_LIMIT,
          subscriptionStatus: subscription?.status ?? null,
          nextBillingDate: effectivePeriodEnd?.toISOString() ?? null,
          billingCycle: effectiveBillingCycle,
          subscriptionPeriodStart: effectivePeriodStart,
          subscriptionPeriodEnd: effectivePeriodEnd,
          creditPeriod,
        };
      }

      const plan = getBillingPlan(planId) ?? freePlan;

      return {
        planId: plan?.id ?? 'free',
        planName: plan?.name ?? defaultPlanName,
        includedCredits:
          plan?.includedCredits ??
          DEFAULT_CREDITS_LIMIT,
        subscriptionStatus: subscription?.status ?? null,
        nextBillingDate: effectivePeriodEnd?.toISOString() ?? null,
        billingCycle: effectiveBillingCycle,
        subscriptionPeriodStart: effectivePeriodStart,
        subscriptionPeriodEnd: effectivePeriodEnd,
        creditPeriod,
      };
    } catch {
      const now = new Date();
      const creditPeriod = resolveMonthlyCreditPeriod({
        now,
        billingCycle: null,
        subscriptionPeriodStart: null,
        subscriptionPeriodEnd: null,
      });

      return {
        planId: 'free',
        planName: defaultPlanName,
        includedCredits: freePlan?.includedCredits ?? DEFAULT_CREDITS_LIMIT,
        subscriptionStatus: null,
        nextBillingDate: null,
        billingCycle: null,
        subscriptionPeriodStart: null,
        subscriptionPeriodEnd: null,
        creditPeriod,
      };
    }
  }

  private resolveCreditUsageRange(
    now: Date,
    plan: ResolvedCurrentPlan,
  ): DateRange {
    const nowEnd = endOfDay(now);
    const end = creditPeriodUsageRangeEnd(plan.creditPeriod, nowEnd);
    return {
      start: plan.creditPeriod.periodStart,
      end: end.getTime() < plan.creditPeriod.periodStart.getTime()
        ? plan.creditPeriod.periodStart
        : end,
    };
  }

  private async buildSnapshot(userId: Types.ObjectId, range: DateRange): Promise<Snapshot> {
    const [
      sessionMeta,
      sessionUsage,
      eventTotals,
      eventProjects,
      responseAvg,
    ] = await Promise.all([
      usageRepository.listSessionProjectMeta(userId),
      usageRepository.getSessionUsageFromMessages(userId, range),
      usageRepository.getEventTotals(userId, range),
      usageRepository.getProjectEventTotals(userId, range),
      usageRepository.getAverageResponseTimeMs(userId, range),
    ]);

    const usageBySession = mapSessionUsageById(sessionUsage);
    const liveSessionIds = sessionUsage
      .map((usage) => usage.session_id)
      .filter((sessionId) => Types.ObjectId.isValid(sessionId))
      .map((sessionId) => new Types.ObjectId(sessionId));
    const eventTotalsBySession = await usageRepository.getSessionEventTotals(
      userId,
      range,
      liveSessionIds
    );
    const projectMap = new Map<
      string,
      {
        project_name: string;
        credits: number;
        requests: number;
      }
    >();

    for (const project of eventProjects) {
      projectMap.set(project.project_id, {
        project_name: project.project_name,
        credits: project.credits || 0,
        requests: project.requests || 0,
      });
    }

    let totalRequests = eventTotals.requests || 0;
    let credits = eventTotals.credits || 0;

    for (const meta of sessionMeta) {
      const usage = usageBySession.get(meta.session_id);
      if (!usage) {
        continue;
      }

      const existingSessionEvents = eventTotalsBySession.get(meta.session_id) || {
        credits: 0,
        requests: 0,
      };
      const derivedCredits = (usage.total_tokens || 0) / 1000;
      const creditDelta = Math.max(0, derivedCredits - existingSessionEvents.credits);
      const requestDelta = Math.max(0, (usage.requests || 0) - existingSessionEvents.requests);

      totalRequests += requestDelta;
      credits += creditDelta;

      const existing = projectMap.get(meta.project_id) || {
        project_name: meta.project_name,
        credits: 0,
        requests: 0,
      };

      existing.credits += creditDelta;
      existing.requests += requestDelta;
      projectMap.set(meta.project_id, existing);
    }

    const projects: UsageTopProject[] = [...projectMap.entries()].map(([projectId, project]) => ({
      project_id: projectId,
      project_name: project.project_name,
      credits: round(project.credits, 2),
      requests: Math.round(project.requests),
      trend_pct: 0,
    }));

    return {
      total_requests: totalRequests,
      credits: round(credits, 4),
      avg_response_time_ms: responseAvg === null ? null : round(responseAvg, 2),
      projects,
    };
  }

  async getOverview(
    userId: Types.ObjectId,
    range: UsageRange = '30d'
  ): Promise<UsageOverviewResponse> {
    const cached = await getCachedUsageOverview(userId, range);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const currentPlan = await this.resolveCurrentPlan(userId);
    const creditRange = this.resolveCreditUsageRange(now, currentPlan);
    const { current, previous } = resolveRange(
      range,
      now,
      range === 'month_to_date' ? creditRange : undefined,
    );
    const previousCreditRange = previousRange(creditRange);

    const [
      currentSnapshot,
      previousSnapshot,
      dailyTokens,
      dailyEvents,
      creditSnapshot,
      previousCreditSnapshot,
      lifetimeSnapshot,
    ] = await Promise.all([
      this.buildSnapshot(userId, current),
      this.buildSnapshot(userId, previous),
      usageRepository.getDailyTokenTotals(userId, current),
      usageRepository.getDailyEventTotals(userId, current, ['credits']),
      this.buildSnapshot(userId, creditRange),
      this.buildSnapshot(userId, previousCreditRange),
      this.buildSnapshot(userId, { start: new Date(0), end: new Date() }),
    ]);

    const creditsUsed = creditSnapshot.credits;
    const previousCreditsUsed = previousCreditSnapshot.credits;
    const lifetimeCreditsUsed = lifetimeSnapshot.credits;

    const previousProjects = new Map(
      previousSnapshot.projects.map((project) => [project.project_id, project.credits])
    );

    const topProjects = currentSnapshot.projects
      .map((project) => {
        const previousCredits = previousProjects.get(project.project_id) || 0;
        return {
          ...project,
          trend_pct: percentageChange(project.credits, previousCredits),
        };
      })
      .sort((a, b) => b.credits - a.credits)
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
        credits: round(
          fromEvents.credits > 0 ? Math.max(fromEvents.credits, fallbackCredits) : fallbackCredits,
          4
        ),
      };
    });

    const creditsLimit = Math.max(1, currentPlan.includedCredits);

    const result: UsageOverviewResponse = {
      summary: {
        credits_used: round(creditsUsed, 2),
        credits_used_trend_pct: percentageChange(creditsUsed, previousCreditsUsed),
        credits_total_used: round(lifetimeCreditsUsed, 2),
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
      credits_total_used: round(lifetimeCreditsUsed, 2),
      chart,
      top_projects: topProjects,
      current_plan: {
        plan_id: currentPlan.planId,
        plan_name: currentPlan.planName,
        included_credits: creditsLimit,
        subscription_status: currentPlan.subscriptionStatus,
        next_billing_date: currentPlan.nextBillingDate,
        credit_period_start: currentPlan.creditPeriod.periodStart.toISOString(),
        credit_period_end: currentPlan.creditPeriod.periodEndExclusive.toISOString(),
        next_credit_reset_at: currentPlan.creditPeriod.nextCreditResetAt.toISOString(),
        credits_expire_at: currentPlan.creditPeriod.creditsExpireAt.toISOString(),
      },
    };

    await setCachedUsageOverview(userId, range, result);
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
      [
        'summary',
        'totals',
        '',
        overview.summary.total_requests,
        overview.summary.credits_used,
        overview.summary.credits_limit,
        overview.summary.avg_response_time_ms ?? '',
      ]
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

    for (const project of overview.top_projects) {
      rows.push(
        ['top_projects', project.project_id, project.project_name, project.credits, project.requests, project.trend_pct, '']
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
