/**
 * Usage Analytics Types
 */

import type { RollingWindowUsage } from '../billing/types.js';

export type UsageRange = '30d' | '90d' | 'month_to_date';
export type UsageExportFormat = 'json' | 'csv';


export interface UsageSummary {
  credits_used: number;
  credits_used_trend_pct: number;
  credits_total_used?: number;
  credits_limit: number;
  credits_remaining: number;
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
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  next_billing_date: string | null; // ISO date
  trial_end: string | null; // ISO date
  credit_period_start: string | null; // ISO date
  credit_period_end: string | null; // ISO date
  next_credit_reset_at: string | null; // ISO date
  credits_expire_at: string | null; // ISO date
  // Live credit balance from user record
  remaining_included_credits: number;
  topup_balance: number;
  total_credits: number;
  balance_usd: number;
  monthly_request_count: number;
  request_quota: number | null;
  quota_lifted: boolean;
  rolling_window: RollingWindowUsage;
}

export interface UsageOverviewResponse {
  summary: UsageSummary;
  credits_total_used?: number;
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
