import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Copy,
  CreditCard,
  KeyRound,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { KpiCard, PageHeader, Skeleton, CardSkeleton, SectionCard } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useAppSelector } from "../../../store/hooks";
import { useDashboardOverviewQuery } from "../../../features/dashboard/useDashboardOverview";

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);
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

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8 py-4 sm:py-6 lg:py-8 px-3 mx-auto max-w-[1600px]">
      <Skeleton className="h-10 w-48" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <CardSkeleton key={item} />
        ))}
      </div>
      <div className="bg-card border border-border p-4 space-y-3">
        <Skeleton className="h-6 w-36" variant="text" />
        <Skeleton className="h-4 w-60" variant="text" />
        <Skeleton className="h-3 w-full" variant="text" />
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
  const [copied, setCopied] = useState(false);
  const {
    data: overview,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useDashboardOverviewQuery({});

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
  const requestsTrend = usageSummary?.total_requests_trend_pct ?? null;
  const tokensTrend = usageSummary?.total_tokens_trend_pct ?? null;

  const balanceUsd = overview.billing.balance_usd ?? null;

  const quickLinks = [
    { to: "/usage", icon: BarChart3, label: "Usage Analytics", desc: "Track requests & tokens" },
    { to: "/billing", icon: CreditCard, label: "Billing", desc: "Manage plan & payments" },
    { to: "/settings?tab=api-keys", icon: KeyRound, label: "API Keys", desc: "Create & rotate keys" },
    { to: "/docs", icon: BookOpen, label: "Documentation", desc: "Guides & references" },
  ];

  const handleCopyInstall = () => {
    navigator.clipboard.writeText("npm install -g @nirex/cli");
    setCopied(true);
    toast("Copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Balance Available"
          value={balanceUsd != null ? `$${balanceUsd.toFixed(2)}` : "N/A"}
          change="Available"
          changeType="neutral"
          changeContext="now"
          backgroundClass="bg-nirex-surface"
        />
        <KpiCard
          title="Total Requests"
          value={usageSummary ? formatNumber(usageSummary.total_requests) : "N/A"}
          change={formatTrend(requestsTrend)}
          changeType={standardChangeType(requestsTrend)}
          changeContext="from previous period"
          backgroundClass="bg-nirex-surface"
        />
        <KpiCard
          title="Total Tokens Used"
          value={usageSummary ? formatNumber(usageSummary.total_tokens) : "N/A"}
          change={formatTrend(tokensTrend)}
          changeType={standardChangeType(tokensTrend)}
          changeContext="from previous period"
          backgroundClass="bg-nirex-surface"
        />
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight font-display mb-3">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="group relative bg-card border border-border p-4 overflow-hidden transition-colors hover:bg-muted/60"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center justify-center w-9 h-9 bg-muted/60 shrink-0">
                    <Icon size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{link.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{link.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Get Started */}
      <SectionCard title="Get Started" icon={Terminal}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Install the Nirex CLI and deploy your first project in minutes.
          </p>
          <div className="overflow-hidden bg-[#0d1117] border border-border">
            <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/10">
              <span className="text-xs font-medium text-gray-400">Terminal</span>
              <button
                type="button"
                onClick={handleCopyInstall}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy
                  </>
                )}
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm font-mono leading-relaxed">
                <code className="text-gray-300">npm install -g @nirex/cli</code>
              </pre>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <BookOpen size={14} />
              Docs
            </Link>
            <Link
              to="/docs?section=quickstart"
              className="inline-flex items-center gap-1 text-sm font-medium text-nirex-accent hover:underline transition-colors"
            >
              Quick Start
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
