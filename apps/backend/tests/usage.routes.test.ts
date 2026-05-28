import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import type { UsageOverviewResponse } from '@nirex/shared';
import app from '../src/app.js';
import {
  assertWithinQuota,
  getQuotaStatus,
} from '../src/modules/usage/quota.guard.js';
import { quotaService, type QuotaStatus } from '../src/modules/usage/quota.service.js';
import { usageService } from '../src/modules/usage/usage.service.js';
import { usageRepository } from '../src/modules/usage/usage.repository.js';
import { billingRepository } from '../src/modules/billing/billing.repository.js';
import {
  clearUsageOverviewMemoryCache,
  getCachedUsageOverview,
  invalidateUsageOverviewCache,
  setCachedUsageOverview,
} from '../src/modules/usage/usage.cache.js';
import { rollingWindowService } from '../src/modules/usage/rolling-window.service.js';
import { UserModel } from '../src/modules/user/user.model.js';

vi.mock('../src/modules/usage/rolling-window.service.js', () => ({
  rollingWindowService: {
    getUsageSnapshot: vi.fn().mockResolvedValue({
      window5h: { used: 0, limit: 100, remaining: 100, resetsAt: new Date().toISOString() },
      window7d: { used: 0, limit: 500, remaining: 500, resetsAt: new Date().toISOString() },
    }),
    checkWindow: vi.fn().mockResolvedValue({
      window5h: { used: 0, limit: 100, remaining: 100, resetsAt: new Date(), exceeded: false },
      window7d: { used: 0, limit: 500, remaining: 500, resetsAt: new Date(), exceeded: false },
      exceeded: false,
      exceededWindow: null,
    }),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

function overviewFixture(
  creditsUsed: number = 60_000,
  includedCredits: number = 50_000,
): UsageOverviewResponse {
  return {
    summary: {
      credits_used: creditsUsed,
      credits_used_trend_pct: 0,
      credits_limit: includedCredits,
      credits_remaining: Math.max(0, includedCredits - creditsUsed),
      credits_used_pct: (creditsUsed / includedCredits) * 100,
      total_requests: 0,
      total_requests_trend_pct: 0,
      avg_response_time_ms: null,
      avg_response_time_trend_pct: null,
    },
    chart: [],
    top_projects: [],
    current_plan: {
      plan_id: 'pro',
      plan_name: 'Pro',
      included_credits: includedCredits,
      subscription_status: 'ACTIVE',
      cancel_at_period_end: false,
      next_billing_date: null,
      trial_end: null,
      credit_period_start: null,
      credit_period_end: null,
      next_credit_reset_at: null,
      credits_expire_at: null,
      rolling_window: {
        window5h: { used: 0, limit: 500, remaining: 500, resetsAt: null },
        window7d: { used: 0, limit: 3000, remaining: 3000, resetsAt: null },
      },
    },
  };
}

function quotaStatusFixture(
  creditsUsed: number = 60_000,
  includedCredits: number = 50_000,
): QuotaStatus {
  return {
    planId: 'pro',
    creditsUsed,
    includedCredits,
    remainingCredits: Math.max(0, includedCredits - creditsUsed),
    overQuota: creditsUsed >= includedCredits,
    periodStart: new Date('2026-05-01T00:00:00.000Z'),
    periodEnd: new Date('2026-06-01T00:00:00.000Z'),
  };
}

describe('usage routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearUsageOverviewMemoryCache();

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            planId: 'free',
            includedCredits: 0,
            topupBalance: 0,
            monthlyRequestCount: 0,
          }),
        }),
      }),
    } as any);
  });

  it('requires authentication for overview endpoint', async () => {
    const response = await request(app).get('/api/v1/usage/overview');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('allows users below their included credit quota', async () => {
    const userId = new Types.ObjectId();
    const assertSpy = vi
      .spyOn(quotaService, 'assertWithinQuota')
      .mockResolvedValue(quotaStatusFixture(49_999));

    const status = await assertWithinQuota(userId);

    expect(status).toMatchObject({
      creditsUsed: 49_999,
      includedCredits: 50_000,
      remainingCredits: 1,
      overQuota: false,
    });
    expect(assertSpy).toHaveBeenCalledWith(userId);
  });

  it('blocks users at or above their included credit quota', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(quotaService, 'assertWithinQuota').mockRejectedValue(
      Object.assign(new Error('Credit quota exceeded.'), {
        statusCode: 402,
        code: 'QUOTA_EXCEEDED',
      })
    );

    await expect(assertWithinQuota(userId)).rejects.toMatchObject({
      statusCode: 402,
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('reports over-quota status without throwing', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(quotaService, 'getStatus').mockResolvedValue(quotaStatusFixture(65_000));

    await expect(getQuotaStatus(userId)).resolves.toMatchObject({
      creditsUsed: 65_000,
      includedCredits: 50_000,
      remainingCredits: 0,
      overQuota: true,
    });
  });

  it('does not use cached usage overview data for quota enforcement', async () => {
    const userId = new Types.ObjectId();
    await setCachedUsageOverview(userId, 'month_to_date', overviewFixture(0));
    const overviewSpy = vi.spyOn(usageService, 'getOverview');
    vi.spyOn(quotaService, 'getStatus').mockResolvedValue(quotaStatusFixture(50_000));

    await expect(getQuotaStatus(userId)).resolves.toMatchObject({
      creditsUsed: 50_000,
      overQuota: true,
    });
    expect(overviewSpy).not.toHaveBeenCalled();
  });

  it('invalidates only the requested user overview ranges', async () => {
    const userId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    const userOverview = overviewFixture(10);
    const otherOverview = overviewFixture(20);

    await setCachedUsageOverview(userId, '30d', userOverview);
    await setCachedUsageOverview(userId, 'month_to_date', userOverview);
    await setCachedUsageOverview(otherUserId, '30d', otherOverview);

    await invalidateUsageOverviewCache(userId);

    await expect(getCachedUsageOverview(userId, '30d')).resolves.toBeNull();
    await expect(getCachedUsageOverview(userId, 'month_to_date')).resolves.toBeNull();
    await expect(getCachedUsageOverview(otherUserId, '30d')).resolves.toBe(otherOverview);
  });

  it('keeps overview credits from usage events after sessions have been deleted', async () => {
    const userId = new Types.ObjectId();
    const today = new Date().toISOString().slice(0, 10);

    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 8.75,
      requests: 3,
    });
    vi.spyOn(usageRepository, 'getProjectEventTotals').mockResolvedValue([
      {
        project_id: 'project-hash',
        project_name: 'nirex',
        credits: 8.75,
        requests: 3,
      },
    ]);
    vi.spyOn(usageRepository, 'getSessionEventTotals').mockResolvedValue(new Map());
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([
      {
        date: today,
        event_type: 'credits',
        total: 8.75,
      },
    ]);

    const overview = await usageService.getOverview(userId, '30d');

    // credits_used comes from analytics (UsageEvent collection) for historical tracking
    expect(overview.summary.credits_used).toBe(8.75);
    expect(overview.summary.total_requests).toBe(3);
    expect(overview.top_projects).toEqual([
      expect.objectContaining({
        project_id: 'project-hash',
        project_name: 'nirex',
        credits: 8.75,
        requests: 3,
      }),
    ]);
  });
});
