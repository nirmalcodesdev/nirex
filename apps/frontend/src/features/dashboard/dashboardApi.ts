import type { DashboardOverviewQuery, DashboardOverviewResponse } from "@nirex/shared";
import { dataOrThrow, request } from "../../lib/backendApi";

const DASHBOARD_BASE = "/dashboard";

function buildOverviewPath(query: DashboardOverviewQuery): string {
  const params = new URLSearchParams();

  if (query.usage_range) {
    params.set("usage_range", query.usage_range);
  }

  if (query.include_recent_notifications !== undefined) {
    params.set("include_recent_notifications", String(query.include_recent_notifications));
  }

  if (query.notifications_limit !== undefined) {
    params.set("notifications_limit", String(query.notifications_limit));
  }

  const search = params.toString();
  return search ? `${DASHBOARD_BASE}/overview?${search}` : `${DASHBOARD_BASE}/overview`;
}

export const dashboardApi = {
  async getOverview(query: DashboardOverviewQuery): Promise<DashboardOverviewResponse> {
    const payload = await request<DashboardOverviewResponse>(buildOverviewPath(query), {
      method: "GET",
    });

    return dataOrThrow(payload, "DASHBOARD_OVERVIEW_FAILED");
  },
};
