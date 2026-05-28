import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { UsageService } from '../src/modules/usage/usage.service.js';
import { usageRepository, type DateRange } from '../src/modules/usage/usage.repository.js';
import { billingRepository } from '../src/modules/billing/billing.repository.js';
import { clearUsageOverviewMemoryCache } from '../src/modules/usage/usage.cache.js';
import { UserModel } from '../src/modules/user/user.model.js';
import type { IBillingSubscriptionDocument } from '../src/modules/billing/billing.model.js';

vi.mock('../src/modules/usage/rolling-window.service.js', () => ({
  rollingWindowService: {
    getUsageSnapshot: vi.fn().mockResolvedValue({
      window5h: { used: 0, limit: 500, remaining: 500, resetsAt: new Date().toISOString() },
      window7d: { used: 0, limit: 3000, remaining: 3000, resetsAt: new Date().toISOString() },
    }),
    checkWindow: vi.fn().mockResolvedValue({
      window5h: { used: 0, limit: 500, remaining: 500, resetsAt: new Date(), exceeded: false },
      window7d: { used: 0, limit: 3000, remaining: 3000, resetsAt: new Date(), exceeded: false },
      exceeded: false,
      exceededWindow: null,
    }),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

function subscriptionFixture(input: Partial<IBillingSubscriptionDocument> = {}): IBillingSubscriptionDocument {
  return {
    _id: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    planCode: 'pro',
    billingCycle: 'year',
    status: 'ACTIVE',
    provider: 'stripe',
    providerSubscriptionId: 'sub_123',
    providerPriceId: 'price_123',
    currency: 'usd',
    amountMinor: 20000,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date('2026-05-17T10:15:00.000Z'),
    currentPeriodEnd: new Date('2027-05-17T10:15:00.000Z'),
    createdAt: new Date('2026-05-17T10:15:00.000Z'),
    updatedAt: new Date('2026-05-17T10:15:00.000Z'),
    ...input,
  } as unknown as IBillingSubscriptionDocument;
}

describe('UsageService', () => {
  const userId = new Types.ObjectId();
  let service: UsageService;
  let requestedEventRanges: DateRange[];

  beforeEach(() => {
    service = new UsageService();
    requestedEventRanges = [];
    clearUsageOverviewMemoryCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            planId: 'pro',
            includedCredits: 3000,
            topupBalance: 0,
            monthlyRequestCount: 0,
          }),
        }),
      }),
    } as any);

    vi.spyOn(billingRepository, 'findLatestSubscriptionByUserId').mockResolvedValue(
      subscriptionFixture({ userId }),
    );
    vi.spyOn(usageRepository, 'listSessionProjectMeta').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getSessionUsageFromMessages').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getProjectEventTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getAverageResponseTimeMs').mockResolvedValue(null);
    vi.spyOn(usageRepository, 'getSessionEventTotals').mockResolvedValue(new Map());
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([
      {
        date: '2026-06-18',
        event_type: 'credits',
        total: 42,
      },
    ]);
    vi.spyOn(usageRepository, 'getEventTotals').mockImplementation(async (_id, range) => {
      requestedEventRanges.push(range);
      if (range.start.toISOString() === '2026-06-17T10:15:00.000Z') {
        return { credits: 42, requests: 4 };
      }
      return { credits: 7, requests: 1 };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearUsageOverviewMemoryCache();
  });

  it('uses the active purchase-anniversary credit period for month-to-date usage', async () => {
    const overview = await service.getOverview(userId, 'month_to_date');

    expect(overview.current_plan.credit_period_start).toBe('2026-06-17T10:15:00.000Z');
    expect(overview.current_plan.credit_period_end).toBe('2026-07-17T10:15:00.000Z');
    expect(overview.current_plan.next_credit_reset_at).toBe('2026-07-17T10:15:00.000Z');
    expect(overview.current_plan.credits_expire_at).toBe('2026-07-17T10:15:00.000Z');
    expect(overview.current_plan.cancel_at_period_end).toBe(false);
    expect(overview.current_plan.trial_end).toBeNull();
    // credits_used comes from analytics (UsageEvent collection)
    expect(overview.summary.credits_used).toBe(42);
    expect(overview.summary.credits_remaining).toBe(3000);
    expect(overview.chart.map((point) => point.date)).toEqual(['2026-06-17', '2026-06-18']);
    expect(requestedEventRanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          start: new Date('2026-06-17T10:15:00.000Z'),
          end: new Date('2026-06-18T23:59:59.999Z'),
        }),
      ]),
    );
  });

  it('reads spendable credits from user document instead of quota bucket', async () => {
    vi.mocked(UserModel.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            planId: 'pro',
            includedCredits: 2500,
            topupBalance: 0,
            monthlyRequestCount: 0,
          }),
        }),
      }),
    } as any);

    const overview = await service.getOverview(userId, 'month_to_date');

    // credits_used comes from analytics (42), credits_remaining from user document (2500)
    expect(overview.summary.credits_used).toBe(42);
    expect(overview.summary.credits_limit).toBe(3000);
    expect(overview.summary.credits_remaining).toBe(2500);
    expect(overview.summary.credits_used_pct).toBeCloseTo(1.4, 1);
  });
});
