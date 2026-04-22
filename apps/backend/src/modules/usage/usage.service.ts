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

const COMPUTE_UNIT_PRICE_USD = 0.05;
const STORAGE_UNIT_PRICE_USD = 0.25;
const BANDWIDTH_UNIT_PRICE_USD = 0.01;
const EDGE_REQUESTS_UNIT_PRICE_USD = 0.001 / 1000; // $0.001 per 1K requests
const DEFAULT_COMPUTE_HOURS_LIMIT = 1000;

interface Snapshot {
  total_requests: number;
  total_token_cost_usd: number;
  derived_compute_hours: number;
  event_compute_hours: number;
  storage_gb: number;
  bandwidth_gb: number;
  edge_requests: number;
  avg_response_time_ms: number | null;
  projects: UsageTopProject[];
}

interface ExportPayload {
  content: string;
  contentType: string;
  fileName: string;
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

export class UsageService {
  private readonly overviewCachePrefix = 'usage:overview';
  private readonly overviewCacheTtlSeconds = 120;

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

    inMemoryCache.set(cacheKey, {
      value: data,
      expiresAt: Date.now() + this.overviewCacheTtlSeconds * 1000,
    });
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
        compute_hours: number;
        requests: number;
        cost_usd: number;
      }
    >();

    let totalRequests = 0;
    let totalTokenCost = 0;
    let derivedComputeHours = 0;

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

      const computeHours = (usage.total_tokens || 0) / 1000;
      totalRequests += usage.requests || 0;
      totalTokenCost += cost.cost;
      derivedComputeHours += computeHours;

      const existing = projectMap.get(meta.project_id) || {
        project_name: meta.project_name,
        compute_hours: 0,
        requests: 0,
        cost_usd: 0,
      };

      existing.compute_hours += computeHours;
      existing.requests += usage.requests || 0;
      existing.cost_usd += cost.cost;
      projectMap.set(meta.project_id, existing);
    }

    // Allocate edge request cost proportionally by request volume.
    const edgeRequests = eventTotals.edge_requests > 0 ? eventTotals.edge_requests : totalRequests;
    const totalEdgeCost = edgeRequests * EDGE_REQUESTS_UNIT_PRICE_USD;
    if (totalRequests > 0 && totalEdgeCost > 0) {
      for (const project of projectMap.values()) {
        project.cost_usd += totalEdgeCost * (project.requests / totalRequests);
      }
    }

    const projects: UsageTopProject[] = [...projectMap.entries()].map(([projectId, project]) => ({
      project_id: projectId,
      project_name: project.project_name,
      compute_hours: round(project.compute_hours, 2),
      requests: Math.round(project.requests),
      cost_usd: round(project.cost_usd, 4),
      trend_pct: 0,
    }));

    return {
      total_requests: totalRequests,
      total_token_cost_usd: round(totalTokenCost, 6),
      derived_compute_hours: round(derivedComputeHours, 4),
      event_compute_hours: round(eventTotals.compute_hours, 4),
      storage_gb: round(eventTotals.storage_gb, 4),
      bandwidth_gb: round(eventTotals.bandwidth_gb, 4),
      edge_requests: round(edgeRequests, 0),
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

    const [
      currentSnapshot,
      previousSnapshot,
      dailyTokens,
      dailyEvents,
    ] = await Promise.all([
      this.buildSnapshot(userId, current),
      this.buildSnapshot(userId, previous),
      usageRepository.getDailyTokenTotals(userId, current),
      usageRepository.getDailyEventTotals(userId, current, [
        'compute_hours',
        'storage_gb',
        'bandwidth_gb',
      ]),
    ]);

    const computeHoursUsed = currentSnapshot.event_compute_hours > 0
      ? currentSnapshot.event_compute_hours
      : currentSnapshot.derived_compute_hours;
    const previousComputeHoursUsed = previousSnapshot.event_compute_hours > 0
      ? previousSnapshot.event_compute_hours
      : previousSnapshot.derived_compute_hours;

    const computeCost = currentSnapshot.event_compute_hours > 0
      ? currentSnapshot.event_compute_hours * COMPUTE_UNIT_PRICE_USD
      : currentSnapshot.total_token_cost_usd;
    const previousComputeCost = previousSnapshot.event_compute_hours > 0
      ? previousSnapshot.event_compute_hours * COMPUTE_UNIT_PRICE_USD
      : previousSnapshot.total_token_cost_usd;

    const storageCost = currentSnapshot.storage_gb * STORAGE_UNIT_PRICE_USD;
    const prevStorageCost = previousSnapshot.storage_gb * STORAGE_UNIT_PRICE_USD;

    const bandwidthCost = currentSnapshot.bandwidth_gb * BANDWIDTH_UNIT_PRICE_USD;
    const prevBandwidthCost = previousSnapshot.bandwidth_gb * BANDWIDTH_UNIT_PRICE_USD;

    const edgeCost = currentSnapshot.edge_requests * EDGE_REQUESTS_UNIT_PRICE_USD;
    const prevEdgeCost = previousSnapshot.edge_requests * EDGE_REQUESTS_UNIT_PRICE_USD;

    const totalCost = computeCost + storageCost + bandwidthCost + edgeCost;
    const previousTotalCost = previousComputeCost + prevStorageCost + prevBandwidthCost + prevEdgeCost;

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
    const eventMap = new Map<string, { compute: number; storage: number; network: number }>();
    for (const event of dailyEvents) {
      const existing = eventMap.get(event.date) || { compute: 0, storage: 0, network: 0 };
      if (event.event_type === 'compute_hours') existing.compute += event.total;
      if (event.event_type === 'storage_gb') existing.storage += event.total;
      if (event.event_type === 'bandwidth_gb') existing.network += event.total;
      eventMap.set(event.date, existing);
    }

    const chart = dayRange(current).map((date) => {
      const fromEvents = eventMap.get(date) || { compute: 0, storage: 0, network: 0 };
      const fallbackCompute = tokenByDate.get(date) || 0;
      return {
        date,
        compute: round(fromEvents.compute > 0 ? fromEvents.compute : fallbackCompute, 4),
        storage: round(fromEvents.storage, 4),
        network: round(fromEvents.network, 4),
      };
    });

    const result: UsageOverviewResponse = {
      summary: {
        total_usage_cost_usd: round(totalCost, 4),
        total_usage_cost_trend_pct: percentageChange(totalCost, previousTotalCost),
        compute_hours_used: round(computeHoursUsed, 2),
        compute_hours_limit: DEFAULT_COMPUTE_HOURS_LIMIT,
        compute_hours_used_pct: round(
          (computeHoursUsed / DEFAULT_COMPUTE_HOURS_LIMIT) * 100,
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
            key: 'compute_hours',
            units: round(computeHoursUsed, 4),
            unit_price_usd: round(
              computeHoursUsed > 0 ? computeCost / computeHoursUsed : COMPUTE_UNIT_PRICE_USD,
              6
            ),
            cost_usd: round(computeCost, 4),
            description: 'Compute hours and model execution costs',
          },
          {
            key: 'database_storage',
            units: round(currentSnapshot.storage_gb, 4),
            unit_price_usd: STORAGE_UNIT_PRICE_USD,
            cost_usd: round(storageCost, 4),
            description: 'Database storage consumption',
          },
          {
            key: 'bandwidth',
            units: round(currentSnapshot.bandwidth_gb, 4),
            unit_price_usd: BANDWIDTH_UNIT_PRICE_USD,
            cost_usd: round(bandwidthCost, 4),
            description: 'Network bandwidth transfer',
          },
          {
            key: 'edge_requests',
            units: Math.round(currentSnapshot.edge_requests),
            unit_price_usd: EDGE_REQUESTS_UNIT_PRICE_USD,
            cost_usd: round(edgeCost, 4),
            description: 'Edge/API request volume',
          },
        ],
        total_cost_usd: round(totalCost, 4),
      },
      top_projects: topProjects,
      current_plan: {
        plan_id: 'pro',
        plan_name: 'Pro Plan',
        price_usd_monthly: 49,
        included_compute_hours: DEFAULT_COMPUTE_HOURS_LIMIT,
        included_storage_gb: 50,
        included_bandwidth_gb: 1024,
        next_billing_date: nextBillingDate(new Date()),
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
      ['summary', 'totals', '', overview.summary.total_usage_cost_usd, overview.summary.total_requests, overview.summary.compute_hours_used, overview.summary.avg_response_time_ms ?? '']
        .map(escapeCsv)
        .join(',')
    );

    for (const point of overview.chart) {
      rows.push(
        ['chart', 'daily_usage', point.date, point.compute, point.storage, point.network, '']
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
        ['top_projects', project.project_id, project.project_name, project.compute_hours, project.requests, project.cost_usd, project.trend_pct]
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
