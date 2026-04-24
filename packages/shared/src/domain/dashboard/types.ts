import type { UsageRange, UsageSummary } from '../usage/types.js';
import type { NotificationItem } from '../notifications/types.js';

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
  next_billing_date: string | null;
  total_paid_ytd_cents: number | null;
  currency: string | null;
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
