import type { UsageRange, UsageSummary } from '../usage/types.js';
import type { NotificationItem } from '../notifications/types.js';
import type { RollingWindowUsage } from '../billing/types.js';

export type DashboardHealthStatus = 'healthy' | 'degraded' | 'critical';

export interface DashboardOverviewQuery {
  usage_range?: UsageRange;
  include_recent_notifications?: boolean;
  notifications_limit?: number;
}

export interface DashboardUsageOverview {
  available: boolean;
  range: UsageRange;
  summary: UsageSummary | null;
}

export interface DashboardBillingOverview {
  available: boolean;
  billing_enabled: boolean | null;
  current_plan_id: string | null;
  current_plan_name: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean | null;
  next_billing_date: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  total_paid_ytd_cents: number | null;
  currency: string | null;
  balance_usd: number | null;
  total_credits: number | null;
  included_credits: number | null;
  topup_balance: number | null;
  quota_lifted: boolean | null;
  rolling_window: RollingWindowUsage | null;
}

export interface DashboardNotificationsOverview {
  available: boolean;
  unread_count: number | null;
  recent: NotificationItem[];
}

export interface DashboardKpis {
  active_alerts: number | null;
}

export interface DashboardOverviewResponse {
  generated_at: string;
  health_status: DashboardHealthStatus;
  errors: string[];
  usage: DashboardUsageOverview;
  billing: DashboardBillingOverview;
  notifications: DashboardNotificationsOverview;
  kpis: DashboardKpis;
}
