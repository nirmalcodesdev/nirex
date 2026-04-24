import type {
  DashboardOverviewResponse,
  UsageRange,
} from '@nirex/shared';

export type { DashboardOverviewResponse };

export interface DashboardOverviewInput {
  usageRange: UsageRange;
  includeRecentNotifications: boolean;
  notificationsLimit: number;
}
