import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { dashboardService } from '../src/modules/dashboard/dashboard.service.js';
import { usageService } from '../src/modules/usage/usage.service.js';
import { billingService } from '../src/modules/billing/billing.service.js';
import { notificationsService } from '../src/modules/notifications/notifications.service.js';

describe('dashboard service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns healthy overview when all dependencies succeed', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageService, 'getOverview').mockResolvedValue({
      summary: {
        total_usage_cost_usd: 5.1,
        total_usage_cost_trend_pct: 10,
        credits_used: 1200,
        credits_limit: 50000,
        credits_used_pct: 2.4,
        total_requests: 89,
        total_requests_trend_pct: 5,
        avg_response_time_ms: 220,
        avg_response_time_trend_pct: -3,
      },
      chart: [],
      cost_breakdown: { items: [], total_cost_usd: 5.1 },
      top_projects: [],
      current_plan: {
        plan_id: 'pro',
        plan_name: 'Pro',
        price_usd_monthly: 49,
        included_credits: 50000,
        next_billing_date: '2026-05-01T00:00:00.000Z',
      },
    } as never);

    vi.spyOn(billingService, 'getBillingOverview').mockResolvedValue({
      billingEnabled: true,
      customerId: 'cus_123',
      currentPlan: {
        id: 'pro',
        name: 'Pro',
        description: '',
        features: [],
        includedCredits: 50000,
        prices: {},
        checkoutEnabled: true,
      },
      subscription: {
        subscriptionId: 'sub_123',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: '2026-05-01T00:00:00.000Z',
      },
      paymentMethod: null,
      usage: {
        creditsUsed: 1000,
        creditsIncluded: 50000,
        creditsUsagePct: 2,
      },
      kpis: {
        currentPlanAmountCents: 4900,
        currency: 'usd',
        totalPaidYtdCents: 9800,
        nextBillingDate: '2026-05-01T00:00:00.000Z',
        yearlySavingsCents: 0,
      },
      invoices: [],
      plans: [],
    } as never);

    vi.spyOn(notificationsService, 'getUnreadCount').mockResolvedValue(4);
    vi.spyOn(notificationsService, 'listNotifications').mockResolvedValue({
      items: [
        {
          id: '1',
          kind: 'billing',
          severity: 'warning',
          title: 'Payment failed',
          message: 'Invoice payment failed.',
          action_url: null,
          metadata: null,
          read_at: null,
          archived_at: null,
          expires_at: null,
          created_at: '2026-04-24T00:00:00.000Z',
        },
      ],
      next_cursor: null,
      unread_count: 4,
    });

    const result = await dashboardService.getOverview(userId, {
      usageRange: '30d',
      includeRecentNotifications: true,
      notificationsLimit: 5,
    });

    expect(result.health_status).toBe('healthy');
    expect(result.errors).toEqual([]);
    expect(result.notifications.unread_count).toBe(4);
    expect(result.kpis.active_alerts).toBe(1);
  });

  it('returns degraded overview when usage dependency fails', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageService, 'getOverview').mockRejectedValue(new Error('usage down'));
    vi.spyOn(billingService, 'getBillingOverview').mockResolvedValue({
      billingEnabled: false,
      currentPlan: { id: 'free', name: 'Free' },
      subscription: { status: 'none' },
      kpis: { totalPaidYtdCents: 0, nextBillingDate: null, currency: 'usd' },
    } as never);
    vi.spyOn(notificationsService, 'getUnreadCount').mockResolvedValue(0);
    vi.spyOn(notificationsService, 'listNotifications').mockResolvedValue({
      items: [],
      next_cursor: null,
      unread_count: 0,
    });

    const result = await dashboardService.getOverview(userId, {
      usageRange: '30d',
      includeRecentNotifications: true,
      notificationsLimit: 5,
    });

    expect(result.health_status).toBe('degraded');
    expect(result.usage.available).toBe(false);
    expect(result.errors).toContain('USAGE_OVERVIEW_UNAVAILABLE');
  });
});
