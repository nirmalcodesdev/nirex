/**
 * Usage Analytics Types
 */

export type UsageRange = '30d' | '90d' | 'month_to_date';
export type UsageExportFormat = 'json' | 'csv';

export interface UsageSummary {
  credits_used: number;
  credits_used_trend_pct: number;
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

export interface UsageTopProject {
  project_id: string;
  project_name: string;
  credits: number;
  requests: number;
  trend_pct: number;
}

export interface UsageCurrentPlan {
  plan_id: string;
  plan_name: string;
  included_credits: number;
  next_billing_date: string | null; // ISO date
}

export interface UsageOverviewResponse {
  summary: UsageSummary;
  chart: UsageChartPoint[];
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
