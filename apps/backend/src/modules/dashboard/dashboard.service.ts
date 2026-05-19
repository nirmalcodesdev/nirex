import { Types } from 'mongoose';
import type {
  DashboardOverviewResponse,
  NotificationItem,
} from '@nirex/shared';
import { billingService } from '../billing/billing.service.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { usageService } from '../usage/usage.service.js';
import type { DashboardOverviewInput } from './dashboard.types.js';
import {
  dashboardOverviewCacheKey,
  getCachedDashboardOverview,
  invalidateDashboardOverviewCache,
  setCachedDashboardOverview,
} from './dashboard.cache.js';

export class DashboardService {
  async invalidateOverviewCache(userId: Types.ObjectId | string): Promise<void> {
    await invalidateDashboardOverviewCache(userId);
  }

  async getOverview(
    userId: Types.ObjectId,
    input: DashboardOverviewInput,
  ): Promise<DashboardOverviewResponse> {
    const cacheKey = dashboardOverviewCacheKey(userId, input);
    const cached = await getCachedDashboardOverview(cacheKey);
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
        cancel_at_period_end: billing?.subscription?.cancelAtPeriodEnd ?? null,
        next_billing_date: billing?.kpis?.nextBillingDate ?? null,
        current_period_end: billing?.subscription?.currentPeriodEnd ?? null,
        trial_end: billing?.subscription?.trialEnd ?? null,
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

    await setCachedDashboardOverview(cacheKey, result);
    return result;
  }
}

export const dashboardService = new DashboardService();
