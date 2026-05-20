import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardOverviewQuery, UsageRange } from "@nirex/shared";
import { dashboardApi } from "./dashboardApi";

interface DashboardOverviewOptions {
  usageRange?: UsageRange;
  includeRecentNotifications?: boolean;
  notificationsLimit?: number;
}

interface NormalizedDashboardOverviewOptions {
  usageRange: UsageRange;
  includeRecentNotifications: boolean;
  notificationsLimit: number;
}

export const dashboardBaseQueryKey = ["dashboard"] as const;

function normalizeOptions(options: DashboardOverviewOptions): NormalizedDashboardOverviewOptions {
  const notificationsLimit = options.notificationsLimit ?? 5;

  return {
    usageRange: options.usageRange ?? "30d",
    includeRecentNotifications: options.includeRecentNotifications ?? true,
    notificationsLimit: Math.max(1, Math.min(20, notificationsLimit)),
  };
}

function toApiQuery(options: NormalizedDashboardOverviewOptions): DashboardOverviewQuery {
  return {
    usage_range: options.usageRange,
    include_recent_notifications: options.includeRecentNotifications,
    notifications_limit: options.notificationsLimit,
  };
}

export function dashboardOverviewQueryKey(options: NormalizedDashboardOverviewOptions) {
  return [
    ...dashboardBaseQueryKey,
    "overview",
    options.usageRange,
    options.includeRecentNotifications,
    options.notificationsLimit,
  ] as const;
}

export function useDashboardOverviewQuery(options: DashboardOverviewOptions = {}) {
  const normalized = normalizeOptions(options);

  return useQuery({
    queryKey: dashboardOverviewQueryKey(normalized),
    queryFn: () => dashboardApi.getOverview(toApiQuery(normalized)),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
