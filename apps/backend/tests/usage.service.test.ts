import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { usageService } from '../src/modules/usage/usage.service.js';
import { usageRepository } from '../src/modules/usage/usage.repository.js';
import { tokenPricingService } from '../src/modules/chat-session/token-pricing.service.js';
import { billingRepository } from '../src/modules/billing/billing.repository.js';

describe('usage service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns chart windows according to selected range', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 0,
    });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(null);

    const thirtyDay = await usageService.getOverview(userId, '30d');
    const monthToDate = await usageService.getOverview(userId, 'month_to_date');

    expect(thirtyDay.chart).toHaveLength(30);
    expect(monthToDate.chart).toHaveLength(22);
  });

  it('calculates trend metrics from current vs previous period', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([
      {
        session_id: 's1',
        model: 'gpt-4o',
        project_id: 'p1',
        project_name: 'core',
      },
    ]);
    vi
      .spyOn(usageRepository, 'getSessionUsageFromMessages')
      .mockImplementation(async (_userId, range) => {
        if (range.start.toISOString() === '2026-03-24T00:00:00.000Z') {
          return [
            {
              session_id: 's1',
              requests: 100,
              input_tokens: 1000,
              output_tokens: 1000,
              cached_tokens: 0,
              total_tokens: 2000,
            },
          ];
        }
        if (range.start.toISOString() === '2026-02-24T00:00:00.000Z') {
          return [
            {
              session_id: 's1',
              requests: 50,
              input_tokens: 500,
              output_tokens: 500,
              cached_tokens: 0,
              total_tokens: 1000,
            },
          ];
        }
        return [];
      });
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 0,
    });
    vi
      .spyOn(usageRepository, 'getAverageResponseTimeMs')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(200)
      .mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi
      .spyOn(tokenPricingService, 'calculateCost')
      .mockImplementation(async (_model, inputTokens) => {
        if (inputTokens === 1000) {
          return { cost: 10, currency: 'USD' };
        }
        if (inputTokens === 500) {
          return { cost: 5, currency: 'USD' };
        }
        return { cost: 0, currency: 'USD' };
      });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(null);

    const overview = await usageService.getOverview(userId, '30d');

    expect(overview.summary.total_requests).toBe(100);
    expect(overview.summary.total_requests_trend_pct).toBe(100);
    expect(overview.summary.total_usage_cost_usd).toBe(10);
    expect(overview.summary.total_usage_cost_trend_pct).toBe(100);
    expect(overview.summary.avg_response_time_ms).toBe(100);
    expect(overview.summary.avg_response_time_trend_pct).toBe(-50);
    expect(overview.top_projects[0]?.trend_pct).toBe(100);
  });

  it('exports overview in json and csv formats', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 0,
    });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(null);

    const jsonReport = await usageService.exportOverview(userId, '30d', 'json');
    const csvReport = await usageService.exportOverview(userId, '30d', 'csv');

    expect(jsonReport.contentType).toBe('application/json');
    expect(jsonReport.fileName.endsWith('.json')).toBe(true);
    expect(() => JSON.parse(jsonReport.content)).not.toThrow();

    expect(csvReport.contentType).toContain('text/csv');
    expect(csvReport.fileName.endsWith('.csv')).toBe(true);
    expect(csvReport.content).toContain('section,key,date_or_label');
    expect(csvReport.content).toContain('summary,totals');
  });

  it('uses the authenticated user billing plan in usage response', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi
      .spyOn(usageRepository, 'getEventTotals')
      .mockImplementation(async (_userId, range) => {
        if (range.start.toISOString() === '2026-04-10T00:00:00.000Z') {
          return { credits: 1200 };
        }
        return { credits: 0 };
      });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue({
      planId: 'pro',
      billingCycle: 'month',
      amountCents: 4900,
      currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    } as never);

    const overview = await usageService.getOverview(userId, '30d');

    expect(overview.current_plan.plan_id).toBe('pro');
    expect(overview.current_plan.included_credits).toBe(50000);
    expect(overview.summary.credits_limit).toBe(50000);
    expect(overview.current_plan.next_billing_date).toBe('2026-05-01T00:00:00.000Z');
  });

  it('falls back to free plan when latest subscription is not active', async () => {
    const userId = new Types.ObjectId();

    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi
      .spyOn(usageRepository, 'getEventTotals')
      .mockImplementation(async (_userId, range) => {
        if (range.start.toISOString() === '2026-04-10T00:00:00.000Z') {
          return { credits: 1200 };
        }
        return { credits: 0 };
      });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(null);

    const overview = await usageService.getOverview(userId, '30d');

    expect(overview.current_plan.plan_id).toBe('free');
    expect(overview.current_plan.included_credits).toBe(10000);
    expect(overview.summary.credits_limit).toBe(10000);
  });

  it('renews yearly-plan credits monthly using subscription anchor date', async () => {
    const userId = new Types.ObjectId();

    vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'));
    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi
      .spyOn(usageRepository, 'getEventTotals')
      .mockImplementation(async (_userId, range) => {
        if (range.start.toISOString() === '2026-04-10T00:00:00.000Z') {
          return { credits: 1200 };
        }
        return { credits: 0 };
      });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue({
      planId: 'pro',
      billingCycle: 'year',
      amountCents: 47040,
      currentPeriodStart: new Date('2026-01-10T00:00:00.000Z'),
      currentPeriodEnd: new Date('2027-01-10T00:00:00.000Z'),
    } as never);

    const overview = await usageService.getOverview(userId, '30d');

    expect(overview.current_plan.plan_id).toBe('pro');
    expect(overview.summary.credits_limit).toBe(50000);
    expect(overview.summary.credits_used).toBe(1200);
    expect(overview.summary.credits_used_pct).toBe(2.4);
  });

  it('keeps yearly credit window aligned for month-end anchors', async () => {
    const userId = new Types.ObjectId();

    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));
    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi
      .spyOn(usageRepository, 'getEventTotals')
      .mockImplementation(async (_userId, range) => {
        if (range.start.toISOString() === '2026-02-28T00:00:00.000Z') {
          return { credits: 900 };
        }
        return { credits: 0 };
      });
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi.spyOn(tokenPricingService, 'calculateCost').mockResolvedValue({ cost: 0, currency: 'USD' });
    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue({
      planId: 'pro',
      billingCycle: 'year',
      amountCents: 47040,
      currentPeriodStart: new Date('2026-01-31T00:00:00.000Z'),
      currentPeriodEnd: new Date('2027-01-31T00:00:00.000Z'),
    } as never);

    const overview = await usageService.getOverview(userId, '30d');

    expect(overview.summary.credits_used).toBe(900);
    expect(overview.summary.credits_used_pct).toBe(1.8);
  });
});
