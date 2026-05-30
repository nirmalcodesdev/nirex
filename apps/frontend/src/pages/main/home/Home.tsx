import { Link } from "react-router-dom";
import type { NotificationItem } from "@nirex/shared";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  FileText,
  Gauge,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { KpiCard, PageHeader, Skeleton, CardSkeleton, SectionCard, StatusBadge } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useAppSelector } from "../../../store/hooks";
import { getSubscriptionStatusDetail } from "../../../features/billing/billingDisplay";
import { useDashboardOverviewQuery } from "../../../features/dashboard/useDashboardOverview";

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

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateTime(value);
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
      return { icon: CheckCircle2, variant: "success" as const, borderClass: "hover:border-l-emerald-500" };
    case "warning":
      return { icon: AlertTriangle, variant: "warning" as const, borderClass: "hover:border-l-amber-500" };
    case "error":
      return { icon: XCircle, variant: "error" as const, borderClass: "hover:border-l-red-500" };
    default:
      return { icon: CircleAlert, variant: "info" as const, borderClass: "hover:border-l-sky-500" };
  }
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <Skeleton className="h-10 w-48" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-card border border-border p-4 space-y-3">
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
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <PageHeader
        title="Overview"
        description="Dashboard overview."
      />
      <div className="bg-card border border-border overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-red-500/10 shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Dashboard data is temporarily unavailable</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shrink-0"
          >
            <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { toast } = useToast();
  const user = useAppSelector((state) => state.auth.user);
  const {
    data: overview,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useDashboardOverviewQuery({
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


  const rollingWindowText = (() => {
    const rw = overview.billing.rolling_window;
    const w5hUsed = rw?.window5h.used ?? 0;
    const w5hLimit = rw?.window5h.limit;
    const w7dUsed = rw?.window7d.used ?? 0;
    const w7dLimit = rw?.window7d.limit;
    if (overview.billing.quota_lifted) {
      return `${w5hUsed.toLocaleString()}/${w5hLimit?.toLocaleString() ?? '∞'} (5h) · ${w7dUsed.toLocaleString()}/${w7dLimit?.toLocaleString() ?? '∞'} (7d)`;
    }
    if (w5hLimit != null && w7dLimit != null) {
      return `${w5hUsed.toLocaleString()}/${w5hLimit.toLocaleString()} (5h) · ${w7dUsed.toLocaleString()}/${w7dLimit.toLocaleString()} (7d)`;
    }
    return "";
  })();

  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      {/* Welcome + Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold font-display tracking-tight">
            Welcome back{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what&apos;s happening with your account today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <StatusBadge
              label={`${formatNumber(unreadCount)} unread`}
              variant="info"
              icon={Bell}
            />
          )}
          <button
            type="button"
            onClick={() => {
              toast("Refreshing dashboard...", "info");
              void refetch();
            }}
            disabled={isFetching}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 border border-border"
            title="Refresh"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Requests"
          value={usageSummary ? formatNumber(usageSummary.total_requests) : "N/A"}
          change={formatTrend(requestsTrend)}
          changeType={standardChangeType(requestsTrend)}
          changeContext="all time"
          backgroundClass="bg-nirex-surface"
        />
        <KpiCard
          title="Total Balance Used"
          value={usageSummary?.credits_total_used ? `$${(usageSummary.credits_total_used / 100).toFixed(2)}` : "N/A"}
          change="Lifetime"
          changeType="neutral"
          changeContext="all time"
          backgroundClass="bg-nirex-surface"
        />
        <KpiCard
          title="Active Alerts"
          value={formatNumber(activeAlerts)}
          change={overview.health_status.toUpperCase()}
          changeType={healthChangeType(overview.health_status)}
          changeContext="system health"
          backgroundClass="bg-nirex-surface"
        />
        <KpiCard
          title="Unread Notifications"
          value={formatNumber(unreadCount)}
          change={unreadCount > 0 ? `${formatNumber(unreadCount)} pending` : "All clear"}
          changeType={unreadCount > 0 ? "negative" : "positive"}
          changeContext="inbox status"
          backgroundClass="bg-nirex-surface"
        />
      </div>

      {/* Usage Summary */}
      <SectionCard
        title="Usage Summary"
        icon={Gauge}

      >
        {overview.usage.available && usageSummary ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Balance Used</p>
                <p className="mt-1 text-2xl font-bold font-mono">${((usageSummary.credits_total_used ?? 0) / 100).toFixed(2)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Cumulative consumption across all billing periods</p>
              </div>
              <div className="border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Requests</p>
                <p className="mt-1 text-2xl font-bold font-mono">{formatNumber(usageSummary.total_requests)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {requestsTrend !== null ? (
                    <span className={requestsTrend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {requestsTrend >= 0 ? "+" : ""}{requestsTrend.toFixed(1)}% from previous period
                    </span>
                  ) : "No trend data available"}
                </p>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance consumption</span>
                <span className="font-medium font-mono">
                  {creditsUsedPct === null ? "N/A" : formatPercent(creditsUsedPct)}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-nirex-accent to-nirex-accent-hi transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, creditsUsedPct ?? 0))}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on your current plan&apos;s included balance
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="flex items-center justify-center w-12 h-12 bg-muted/60 mb-3">
              <Activity size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">No usage data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Usage metrics will appear once you start making requests</p>
          </div>
        )}
      </SectionCard>

      {/* Bottom Grid: Notifications + Billing */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <SectionCard
          title="Recent Notifications"
          icon={Bell}
          headerAction={
            <Link
              to="/notifications"
              className="inline-flex items-center gap-1 text-xs font-medium text-nirex-accent hover:underline transition-colors"
            >
              View all
              <ArrowRight size={12} />
            </Link>
          }

        >
          {overview.notifications.available && overview.notifications.recent.length > 0 ? (
            <div className="space-y-1">
              {overview.notifications.recent.map((notification) => {
                const meta = severityMeta(notification.severity);
                const Icon = meta.icon;

                return (
                  <article
                    key={notification.id}
                    className={`border-l-2 border-l-transparent border-b border-border last:border-0 px-3 py-3.5 hover:bg-muted/60 ${meta.borderClass} transition-colors duration-150 cursor-pointer`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex items-center justify-center w-7 h-7 shrink-0 mt-0.5 ${
                        meta.variant === 'success' ? 'bg-emerald-500/10' :
                        meta.variant === 'warning' ? 'bg-amber-500/10' :
                        meta.variant === 'error' ? 'bg-red-500/10' :
                        'bg-sky-500/10'
                      }`}>
                        <Icon size={14} className={
                          meta.variant === 'success' ? 'text-emerald-500' :
                          meta.variant === 'warning' ? 'text-amber-500' :
                          meta.variant === 'error' ? 'text-red-500' :
                          'text-sky-500'
                        } />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground font-mono">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="flex items-center justify-center w-12 h-12 bg-muted/60 mb-3">
                <Bell size={24} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up</p>
            </div>
          )}
        </SectionCard>

        {/* Billing Snapshot */}
        <SectionCard
          title="Billing Snapshot"
          icon={CreditCard}
          headerAction={
            <Link
              to="/billing"
              className="inline-flex items-center gap-1 text-xs font-medium text-nirex-accent hover:underline transition-colors"
            >
              View details
              <ArrowRight size={12} />
            </Link>
          }

        >
          {overview.billing.available ? (
            <div className="space-y-4">
              {overview.billing.balance_usd !== null && (
                <div className="border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Available Balance</p>
                    {overview.billing.quota_lifted && (
                      <StatusBadge label="Limits lifted" variant="success" icon={Shield} />
                    )}
                  </div>
                  <p className="text-2xl font-bold font-mono">${overview.billing.balance_usd.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rollingWindowText}</p>
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Included</span>
                      <span className="font-medium font-mono">${((overview.billing.included_credits ?? 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Top-up</span>
                      <span className="font-medium font-mono">${((overview.billing.topup_balance ?? 0) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-0">
                <MetricRow
                  icon={FileText}
                  label="Current plan"
                  value={overview.billing.current_plan_name ?? "N/A"}
                  detail={overview.billing.current_plan_id ?? "No active plan"}
                />
                <MetricRow
                  icon={Activity}
                  label="Subscription status"
                  value={overview.billing.subscription_status ?? "N/A"}
                  detail={getSubscriptionStatusDetail(
                    {
                      status: overview.billing.subscription_status,
                      cancelAtPeriodEnd: overview.billing.cancel_at_period_end,
                      currentPeriodEnd: overview.billing.current_period_end,
                      trialEnd: overview.billing.trial_end,
                      nextBillingDate: overview.billing.next_billing_date,
                    },
                    formatDateTime,
                  )}
                />
                <MetricRow
                  icon={CreditCard}
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="flex items-center justify-center w-12 h-12 bg-muted/60 mb-3">
                <CreditCard size={24} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No billing data</p>
              <p className="text-xs text-muted-foreground mt-1">Billing information will appear once you subscribe</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, detail }: { icon?: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 border-b border-border last:border-0">
      {Icon && (
        <div className="flex items-center justify-center w-7 h-7 bg-muted/60 shrink-0 mt-0.5">
          <Icon size={14} className="text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-base font-semibold font-mono">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
