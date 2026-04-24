import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { usageService } from '../src/modules/usage/usage.service.js';
import { usageRepository } from '../src/modules/usage/usage.repository.js';
import { tokenPricingService } from '../src/modules/chat-session/token-pricing.service.js';

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
      .mockResolvedValueOnce([
        {
          session_id: 's1',
          requests: 100,
          input_tokens: 1000,
          output_tokens: 1000,
          cached_tokens: 0,
          total_tokens: 2000,
        },
      ])
      .mockResolvedValueOnce([
        {
          session_id: 's1',
          requests: 50,
          input_tokens: 500,
          output_tokens: 500,
          cached_tokens: 0,
          total_tokens: 1000,
        },
      ]);
    vi.spyOn(usageRepository, 'getEventTotals').mockResolvedValue({
      credits: 0,
    });
    vi
      .spyOn(usageRepository, 'getAverageResponseTimeMs')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(200);
    vi.spyOn(usageRepository, 'getDailyTokenTotals').mockResolvedValue([]);
    vi.spyOn(usageRepository, 'getDailyEventTotals').mockResolvedValue([]);
    vi
      .spyOn(tokenPricingService, 'calculateCost')
      .mockResolvedValueOnce({ cost: 10, currency: 'USD' })
      .mockResolvedValueOnce({ cost: 5, currency: 'USD' });

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
});
