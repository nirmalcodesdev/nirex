/**
 * Usage & Billing Analytics Types
 */

export type UsageRange = '30d' | '90d' | 'month_to_date';
export type UsageExportFormat = 'json' | 'csv';

export interface UsageSummary {
  total_usage_cost_usd: number;
  total_usage_cost_trend_pct: number;
  credits_used: number;
  credits_limit: number;
  credits_used_pct: number;
  total_requests: number;
  total_requests_trend_pct: number;
  avg_response_time_ms: number | null;
  avg_response_time_trend_pct: number | null;
}

export interface UsageChartPoint {
  date: string; // YYYY-MM-DD
  credits: number;
}

export type CostBreakdownKey = 'credits';

export interface UsageCostBreakdownItem {
  key: CostBreakdownKey;
  units: number;
  unit_price_usd: number;
  cost_usd: number;
  description: string;
}

export interface UsageCostBreakdown {
  items: UsageCostBreakdownItem[];
  total_cost_usd: number;
}

export interface UsageTopProject {
  project_id: string;
  project_name: string;
  credits: number;
  requests: number;
  cost_usd: number;
  trend_pct: number;
}

export interface UsageCurrentPlan {
  plan_id: string;
  plan_name: string;
  price_usd_monthly: number;
  included_credits: number;
  next_billing_date: string; // ISO date
}

export interface UsageOverviewResponse {
  summary: UsageSummary;
  chart: UsageChartPoint[];
  cost_breakdown: UsageCostBreakdown;
  top_projects: UsageTopProject[];
  current_plan: UsageCurrentPlan;
}

export interface UsageOverviewQuery {
  range?: UsageRange;
}

export interface UsageExportQuery {
  range?: UsageRange;
  format?: UsageExportFormat;
}
