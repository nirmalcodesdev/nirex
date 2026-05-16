import { useState } from "react";
import type { NotificationItem, UsageRange } from "@nirex/shared";
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Layers,
  MoreHorizontal,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Dropdown, DropdownItem, KpiCard, PageHeader, Skeleton, CardSkeleton } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useDashboardOverviewQuery } from "../../../features/dashboard/useDashboardOverview";

const usageRangeLabels: Record<UsageRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month_to_date: "Month to date",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTrend(value: number | null): string {
  if (value === null) return "No trend";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function standardChangeType(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function healthChangeType(status: "healthy" | "degraded" | "critical"): "positive" | "negative" | "neutral" {
  if (status === "healthy") return "positive";
  if (status === "critical") return "negative";
  return "neutral";
}

function severityMeta(severity: NotificationItem["severity"]) {
  switch (severity) {
    case "success":
      return { icon: CheckCircle2, iconClass: "text-nirex-success", dotClass: "bg-nirex-success/20" };
    case "warning":
      return { icon: AlertTriangle, iconClass: "text-nirex-warning", dotClass: "bg-nirex-warning/20" };
    case "error":
      return { icon: XCircle, iconClass: "text-nirex-error", dotClass: "bg-nirex-error/20" };
    default:
      return { icon: CircleAlert, iconClass: "text-nirex-accent", dotClass: "bg-nirex-accent/20" };
  }
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <Skeleton className="h-8 w-40" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 sm:p-6 space-y-3">
          <Skeleton className="h-6 w-36" variant="text" />
          <Skeleton className="h-4 w-60" variant="text" />
          <Skeleton className="h-3 w-full" variant="text" />
          <Skeleton className="h-3 w-5/6" variant="text" />
          <Skeleton className="h-3 w-4/6" variant="text" />
        </div>
        <CardSkeleton />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

function HomeErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <PageHeader
        title="Overview"
        description="Monitor platform health, usage, and billing in one place."
      />
      <section className="rounded-xl border border-nirex-error/30 bg-nirex-error/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 text-nirex-error" />
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-medium">Dashboard data is temporarily unavailable</h2>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
              {isRetrying ? "Retrying..." : "Retry"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function Home() {
  const [usageRange, setUsageRange] = useState<UsageRange>("30d");
  const { toast } = useToast();
  const {
    data: overview,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useDashboardOverviewQuery({
    usageRange,
    includeRecentNotifications: true,
    notificationsLimit: 5,
  });

  if (isLoading && !overview) {
    return <HomeSkeleton />;
  }

  if (isError && !overview) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard overview.";
    return (
      <HomeErrorState
        message={message}
        isRetrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!overview) {
    return <HomeSkeleton />;
  }

  const usageSummary = overview.usage.summary;
  const unreadCount = overview.notifications.unread_count ?? 0;
  const activeAlerts = overview.kpis.active_alerts ?? 0;
  const creditsUsedPct = usageSummary?.credits_used_pct ?? null;
  const requestsTrend = usageSummary?.total_requests_trend_pct ?? null;
  const creditsTrend = usageSummary?.credits_used_trend_pct ?? null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <PageHeader
        title="Overview"
        description="Monitor platform health, usage, and billing in one place."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                toast("Refreshing dashboard...", "info");
                void refetch();
              }}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
              {isFetching ? "Refreshing" : "Refresh"}
            </button>
            <Dropdown
              align="right"
              trigger={
                <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                  <span>{usageRangeLabels[usageRange]}</span>
                  <MoreHorizontal size={14} className="text-muted-foreground" />
                </button>
              }
            >
              {(Object.keys(usageRangeLabels) as UsageRange[]).map((rangeOption) => (
                <DropdownItem key={rangeOption} onClick={() => setUsageRange(rangeOption)}>
                  <span className="flex w-full items-center justify-between">
                    {usageRangeLabels[rangeOption]}
                    {usageRange === rangeOption ? <Check size={14} className="text-nirex-accent" /> : null}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Requests"
          value={usageSummary ? formatNumber(usageSummary.total_requests) : "N/A"}
          change={formatTrend(requestsTrend)}
          changeType={standardChangeType(requestsTrend)}
          icon={Activity}
          changeContext={usageRangeLabels[usageRange]}
        />
        <KpiCard
          title="Credits Used"
          value={usageSummary ? formatNumber(usageSummary.credits_used) : "N/A"}
          change={formatTrend(creditsTrend)}
          changeType={standardChangeType(creditsTrend)}
          icon={Layers}
          changeContext="plan quota"
        />
        <KpiCard
          title="Active Alerts"
          value={formatNumber(activeAlerts)}
          change={overview.health_status.toUpperCase()}
          changeType={healthChangeType(overview.health_status)}
          icon={AlertTriangle}
          changeContext="system health"
        />
        <KpiCard
          title="Unread Notifications"
          value={formatNumber(unreadCount)}
          change={unreadCount > 0 ? `${formatNumber(unreadCount)} pending` : "All clear"}
          changeType={unreadCount > 0 ? "negative" : "positive"}
          icon={Bell}
          changeContext="inbox status"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Usage Summary</h2>
          {overview.usage.available && usageSummary ? (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <MetricRow
                  label="Credits used"
                  value={`${formatNumber(usageSummary.credits_used)} / ${formatNumber(usageSummary.credits_limit)}`}
                  detail={`${formatPercent(usageSummary.credits_used_pct)} of quota`}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credits consumption</span>
                  <span className="font-medium">
                    {creditsUsedPct === null ? "N/A" : formatPercent(creditsUsedPct)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-nirex-accent transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, creditsUsedPct ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Usage insights are temporarily unavailable for this account.
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Recent Notifications</h2>
          {overview.notifications.available && overview.notifications.recent.length > 0 ? (
            <div className="mt-4 space-y-3">
              {overview.notifications.recent.map((notification) => {
                const meta = severityMeta(notification.severity);
                const Icon = meta.icon;

                return (
                  <article
                    key={notification.id}
                    className="rounded-lg border border-border bg-background px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-md p-2 ${meta.dotClass}`}>
                        <Icon size={14} className={meta.iconClass} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{notification.title}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No recent notifications.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Billing Snapshot</h2>
          {overview.billing.available ? (
            <div className="mt-4 space-y-4">
              <MetricRow
                label="Current plan"
                value={overview.billing.current_plan_name ?? "N/A"}
                detail={overview.billing.current_plan_id ?? "No active plan"}
              />
              <MetricRow
                label="Subscription status"
                value={overview.billing.subscription_status ?? "N/A"}
                detail={overview.billing.next_billing_date ? `Next billing ${formatDateTime(overview.billing.next_billing_date)}` : "No next billing date"}
              />
              <MetricRow
                label="Total paid (YTD)"
                value={
                  overview.billing.total_paid_ytd_cents === null
                    ? "N/A"
                    : new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: overview.billing.currency ?? "USD",
                        maximumFractionDigits: 2,
                      }).format(overview.billing.total_paid_ytd_cents / 100)
                }
                detail={overview.billing.currency ?? "USD"}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Billing overview is temporarily unavailable.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
