import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import type { UsageOverviewResponse } from '@nirex/shared';
import app from '../src/app.js';
import {
  assertWithinQuota,
  getQuotaStatus,
} from '../src/modules/usage/quota.guard.js';
import { usageService } from '../src/modules/usage/usage.service.js';
import {
  clearUsageOverviewMemoryCache,
  getCachedUsageOverview,
  invalidateUsageOverviewCache,
  setCachedUsageOverview,
} from '../src/modules/usage/usage.cache.js';

function overviewFixture(
  creditsUsed: number = 60_000,
  includedCredits: number = 50_000,
): UsageOverviewResponse {
  return {
    summary: {
      total_usage_cost_usd: creditsUsed * 0.9,
      total_usage_cost_trend_pct: 0,
      credits_used: creditsUsed,
      credits_limit: includedCredits,
      credits_used_pct: (creditsUsed / includedCredits) * 100,
      total_requests: 0,
      total_requests_trend_pct: 0,
      avg_response_time_ms: null,
      avg_response_time_trend_pct: null,
    },
    chart: [],
    cost_breakdown: {
      items: [],
      total_cost_usd: creditsUsed * 0.05,
    },
    top_projects: [],
    current_plan: {
      plan_id: 'pro',
      plan_name: 'Pro',
      price_usd_monthly: 20,
      included_credits: includedCredits,
      next_billing_date: null,
    },
  };
}

describe('usage routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearUsageOverviewMemoryCache();
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
    const getOverviewSpy = vi
      .spyOn(usageService, 'getOverview')
      .mockResolvedValue(overviewFixture(49_999));

    const status = await assertWithinQuota(userId);

    expect(status).toMatchObject({
      creditsUsed: 49_999,
      includedCredits: 50_000,
      remainingCredits: 1,
      overQuota: false,
    });
    expect(getOverviewSpy).toHaveBeenCalledWith(userId, 'month_to_date');
  });

  it('blocks users at or above their included credit quota', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(usageService, 'getOverview').mockResolvedValue(overviewFixture(50_000));

    await expect(assertWithinQuota(userId)).rejects.toMatchObject({
      statusCode: 402,
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('reports over-quota status without throwing', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(usageService, 'getOverview').mockResolvedValue(overviewFixture(65_000));

    await expect(getQuotaStatus(userId)).resolves.toMatchObject({
      creditsUsed: 65_000,
      includedCredits: 50_000,
      remainingCredits: 0,
      overQuota: true,
    });
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
});
