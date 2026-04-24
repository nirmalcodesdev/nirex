import { Types } from 'mongoose';
import type {
  DashboardOverviewResponse,
  NotificationItem,
} from '@nirex/shared';
import { getRedisClient, isRedisAvailable } from '../../config/redis.js';
import { billingService } from '../billing/billing.service.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { usageService } from '../usage/usage.service.js';
import type { DashboardOverviewInput } from './dashboard.types.js';

const inMemoryCache = new Map<
  string,
  { expiresAt: number; value: DashboardOverviewResponse }
>();

export class DashboardService {
  private readonly cachePrefix = 'dashboard:overview';
  private readonly cacheTtlSeconds = 60;
  private readonly inMemoryMaxEntries = 3000;

  private pruneInMemoryCache(nowMs: number = Date.now()): void {
    for (const [key, item] of inMemoryCache) {
      if (item.expiresAt < nowMs) inMemoryCache.delete(key);
    }
    while (inMemoryCache.size >= this.inMemoryMaxEntries) {
      const oldestKey = inMemoryCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      inMemoryCache.delete(oldestKey);
    }
  }

  private cacheKey(userId: Types.ObjectId, input: DashboardOverviewInput): string {
    return [
      this.cachePrefix,
      userId.toString(),
      input.usageRange,
      input.includeRecentNotifications ? '1' : '0',
      input.notificationsLimit,
    ].join(':');
  }

  private async getCached(cacheKey: string): Promise<DashboardOverviewResponse | null> {
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const raw = await redis.get(cacheKey);
        if (raw) return JSON.parse(raw) as DashboardOverviewResponse;
      } catch {
        // Continue with in-memory cache.
      }
    }

    const cached = inMemoryCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      inMemoryCache.delete(cacheKey);
      return null;
    }
    return cached.value;
  }

  private async setCached(cacheKey: string, value: DashboardOverviewResponse): Promise<void> {
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, this.cacheTtlSeconds, JSON.stringify(value));
      } catch {
        // Fall through to in-memory.
      }
    }

    this.pruneInMemoryCache();
    inMemoryCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlSeconds * 1000,
    });
  }

  async getOverview(
    userId: Types.ObjectId,
    input: DashboardOverviewInput,
  ): Promise<DashboardOverviewResponse> {
    const cacheKey = this.cacheKey(userId, input);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const errors: string[] = [];
    const [usageResult, billingResult, unreadCountResult, notificationsResult] = await Promise.allSettled([
      usageService.getOverview(userId, input.usageRange),
      billingService.getBillingOverview(userId),
      notificationsService.getUnreadCount(userId),
      input.includeRecentNotifications
        ? notificationsService.listNotifications(userId, {
          limit: input.notificationsLimit,
          includeRead: true,
          includeArchived: false,
          kinds: [],
          severities: [],
        })
        : Promise.resolve({
          items: [] as NotificationItem[],
          next_cursor: null,
          unread_count: 0,
        }),
    ]);

    const usageAvailable = usageResult.status === 'fulfilled';
    const billingAvailable = billingResult.status === 'fulfilled';
    const notificationsAvailable =
      unreadCountResult.status === 'fulfilled' && notificationsResult.status === 'fulfilled';

    if (usageResult.status === 'rejected') errors.push('USAGE_OVERVIEW_UNAVAILABLE');
    if (billingResult.status === 'rejected') errors.push('BILLING_OVERVIEW_UNAVAILABLE');
    if (unreadCountResult.status === 'rejected') errors.push('NOTIFICATIONS_COUNT_UNAVAILABLE');
    if (notificationsResult.status === 'rejected') errors.push('NOTIFICATIONS_LIST_UNAVAILABLE');

    const usage = usageResult.status === 'fulfilled' ? usageResult.value : null;
    const billing = billingResult.status === 'fulfilled' ? billingResult.value : null;
    const unreadCount = unreadCountResult.status === 'fulfilled' ? unreadCountResult.value : null;
    const recentNotifications = notificationsResult.status === 'fulfilled'
      ? notificationsResult.value.items
      : [];

    const activeAlerts = (() => {
      if (!notificationsAvailable) return null;
      return recentNotifications.filter((item) =>
        item.severity === 'warning' || item.severity === 'error').length;
    })();

    const failedSections = [usageAvailable, billingAvailable, notificationsAvailable].filter(
      (ok) => !ok,
    ).length;
    const healthStatus: DashboardOverviewResponse['health_status'] =
      failedSections === 0 ? 'healthy' : failedSections === 1 ? 'degraded' : 'critical';

    const result: DashboardOverviewResponse = {
      generated_at: new Date().toISOString(),
      health_status: healthStatus,
      errors,
      usage: {
        available: usageAvailable,
        range: input.usageRange,
        summary: usage?.summary ?? null,
      },
      billing: {
        available: billingAvailable,
        billing_enabled: billing?.billingEnabled ?? null,
        current_plan_id: billing?.currentPlan?.id ?? null,
        current_plan_name: billing?.currentPlan?.name ?? null,
        subscription_status: billing?.subscription?.status ?? null,
        next_billing_date: billing?.kpis?.nextBillingDate ?? null,
        total_paid_ytd_cents: billing?.kpis?.totalPaidYtdCents ?? null,
        currency: billing?.kpis?.currency ?? null,
      },
      notifications: {
        available: notificationsAvailable,
        unread_count: unreadCount,
        recent: recentNotifications,
      },
      kpis: {
        active_alerts: activeAlerts,
      },
    };

    await this.setCached(cacheKey, result);
    return result;
  }
}

export const dashboardService = new DashboardService();
