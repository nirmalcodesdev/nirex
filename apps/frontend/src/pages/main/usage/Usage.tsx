import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  List,
  RefreshCw,
  Shield,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  LineChart,
  Area,
  Bar,
  Line,
  XAxis,
  ResponsiveContainer,
} from "recharts";
import { CardContent, PageHeader, SectionCard, StatusBadge, type KpiChangeType } from "@nirex/ui";
import { CardSkeleton, ChartSkeleton } from "@nirex/ui/Skeleton";
import { useToast } from "../../../components/ToastProvider";
import { useUsageOverviewQuery, useRequestLogsQuery } from "../../../features/usage";
import type { UsageRange } from "@nirex/shared";

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function toKpiChange(value: number | null | undefined, positiveWhenHigher: boolean): { text: string; type: KpiChangeType } {
  const safeValue = value ?? 0;
  const isIncrease = safeValue >= 0;
  let type: KpiChangeType = "neutral";
  if (safeValue > 0) type = positiveWhenHigher ? "positive" : "negative";
  else if (safeValue < 0) type = positiveWhenHigher ? "negative" : "positive";
  return { text: `${isIncrease ? "+" : ""}${safeValue.toFixed(1)}%`, type };
}

function formatTimeRemaining(resetsAt: string | null): string {
  if (!resetsAt) return "";
  const now = new Date();
  const reset = new Date(resetsAt);
  const diff = reset.getTime() - now.getTime();
  
  if (diff <= 0) return "Resetting...";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getWindowBarColor(percentage: number, isLifted: boolean): string {
  if (isLifted) return "bg-nirex-success";
  if (percentage >= 90) return "bg-destructive";
  if (percentage >= 75) return "bg-warning";
  return "bg-primary";
}

function getWindowStatusText(percentage: number, isLifted: boolean): string {
  if (isLifted) return "Limit lifted";
  if (percentage >= 90) return "Critical";
  if (percentage >= 75) return "Warning";
  if (percentage >= 50) return "Moderate";
  return "Healthy";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTiming(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(credits: number): string {
  return `${credits.toFixed(4)}`;
}

function truncateModel(model: string): string {
  if (model.length <= 24) return model;
  return `${model.slice(0, 21)}...`;
}

export function Usage() {
  const { toast } = useToast();
  const usageQuery = useUsageOverviewQuery();
  const [logsPage, setLogsPage] = useState(1);
  const [logsRange] = useState<UsageRange>("30d");
  const logsQuery = useRequestLogsQuery({ page: logsPage, limit: 20, range: logsRange });

  const overview = usageQuery.data;

  const requestChange = toKpiChange(overview?.summary.total_requests_trend_pct, true);
  const tokenChange = toKpiChange(overview?.summary.total_tokens_trend_pct, true);

  // Live balance fields from user record
  const balanceUsd = overview?.current_plan.balance_usd ?? 0;
  const remainingIncluded = overview?.current_plan.remaining_included_credits ?? 0;
  const topupBalance = overview?.current_plan.topup_balance ?? 0;
  const monthlyRequestCount = overview?.current_plan.monthly_request_count ?? 0;
  const liftedByTopup = topupBalance > 0;

  // Rolling window data
  const rollingWindow = overview?.current_plan.rolling_window;
  const window5hUsed = rollingWindow?.window5h.used ?? 0;
  const window5hLimit = rollingWindow?.window5h.limit;
  const window5hResetsAt = rollingWindow?.window5h.resetsAt ?? null;
  const window5hPct: number = window5hLimit ? (window5hUsed / window5hLimit) * 100 : 0;
  
  const window7dUsed = rollingWindow?.window7d.used ?? 0;
  const window7dLimit = rollingWindow?.window7d.limit;
  const window7dResetsAt = rollingWindow?.window7d.resetsAt ?? null;
  const window7dPct: number = window7dLimit ? (window7dUsed / window7dLimit) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-[1600px]">
      <PageHeader
        title="Usage"
        description="Usage metrics and trends."
        actions={
          <button
            type="button"
            onClick={() => {
              toast("Refreshing usage data...", "info");
              void usageQuery.refetch();
            }}
            disabled={usageQuery.isFetching}
            className="inline-flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 border border-border"
            title="Refresh"
            aria-label="Refresh usage data"
          >
            <RefreshCw size={15} className={usageQuery.isFetching ? "animate-spin" : ""} />
          </button>
        }
      />

      {usageQuery.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
          <ChartSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><CardSkeleton /></div>
            <div><CardSkeleton /></div>
          </div>
        </>
      ) : usageQuery.isError ? (
        <div className="bg-card border border-border overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-red-500/10 shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Unable to load usage data</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {usageQuery.error instanceof Error ? usageQuery.error.message : "Please try again."}
              </p>
            </div>
          </div>
        </div>
      ) : !overview ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="flex items-center justify-center w-12 h-12 bg-muted/60 mb-3">
            <Activity size={24} className="text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground">No usage data available yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Usage metrics will appear once you start making requests</p>
        </div>
      ) : (
        <>
          {/* Credit balance hero */}
          <div className="bg-card border border-border overflow-hidden">
            <CardContent className="py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 shrink-0">
                    <Wallet size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-2xl font-bold font-mono">${balanceUsd.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {liftedByTopup
                        ? `${window5hUsed} / ${window5hLimit ?? '∞'} (5h) · ${window7dUsed} / ${window7dLimit ?? '∞'} (7d) · limit lifted by top-up`
                        : window5hLimit !== null && window7dLimit !== null
                          ? `${window5hUsed} / ${window5hLimit} (5h) · ${window7dUsed} / ${window7dLimit} (7d)`
                          : `${monthlyRequestCount.toLocaleString()} requests this month`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 text-sm pl-14 sm:pl-0">
                  <div className="border-l-2 border-border pl-4">
                    <p className="text-muted-foreground text-xs">Included</p>
                    <p className="font-medium font-mono">${(remainingIncluded / 100).toFixed(2)}</p>
                  </div>
                  <div className="border-l-2 border-border pl-4">
                    <p className="text-muted-foreground text-xs">Top-up</p>
                    <p className="font-medium font-mono">${(topupBalance / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>

          {/* KPI Cards with Charts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Total Cost */}
            {(() => {
              const consumedIncluded = overview.current_plan.included_credits - remainingIncluded;
              const consumedIncludedUsd = consumedIncluded / 100;
              const budgetUsd = overview.current_plan.included_credits / 100;
              const consumedPct = overview.current_plan.included_credits > 0
                ? (consumedIncluded / overview.current_plan.included_credits) * 100
                : 0;
              const allBalanceUsed = balanceUsd <= 0;

              return (
                <div className="bg-nirex-surface border border-border p-5 overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-3xl font-bold mt-1 font-mono">${consumedIncludedUsd.toFixed(2)}</p>
                    </div>
                    <div className={`text-xs font-medium px-2.5 py-1 border ${
                      allBalanceUsed ? "text-destructive border-destructive/30 bg-destructive/5" :
                      consumedPct >= 75 ? "text-warning border-warning/30 bg-warning/5" :
                      "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                    }`}>
                      {consumedPct.toFixed(0)}% consumed
                    </div>
                  </div>

                  {/* Premium Progress Bar */}
                  <div className="space-y-5 flex-1 flex flex-col justify-center">
                    {/* Track + Fill */}
                    <div className="relative">
                      {/* Track background */}
                      <div className="h-7 w-full rounded-full bg-muted border border-border shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] relative overflow-hidden">
                        {/* Milestone ticks on track */}
                        <div className="absolute inset-0 flex items-center justify-between px-[2px] pointer-events-none z-10">
                          {[0, 25, 50, 75, 100].map((pct) => (
                            <div
                              key={pct}
                              className={`w-[2px] h-3 rounded-full transition-colors duration-500 ${
                                consumedPct >= pct ? "bg-white/30" : "bg-border/60"
                              }`}
                              style={{ marginLeft: pct === 0 ? '3px' : pct === 100 ? '0' : undefined, marginRight: pct === 100 ? '3px' : undefined }}
                            />
                          ))}
                        </div>

                        {/* Animated fill */}
                        <div
                          className="h-full rounded-full relative transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(0,0,0,0.1)]"
                          style={{
                            width: `${Math.min(100, consumedPct)}%`,
                            background: allBalanceUsed
                              ? 'linear-gradient(90deg, hsl(var(--color-error)) 0%, hsl(var(--color-error)) 100%)'
                              : consumedPct >= 75
                                ? 'linear-gradient(90deg, hsl(var(--color-warning)) 0%, #f59e0b 50%, #d97706 100%)'
                                : 'linear-gradient(90deg, hsl(var(--nirex-accent)) 0%, hsl(var(--nirex-accent-hi)) 60%, hsl(var(--primary)) 100%)',
                          }}
                        >
                          {/* Top glossy highlight */}
                          <div className="absolute top-0 left-0 right-0 h-[40%] rounded-t-full bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

                          {/* Bottom subtle shadow for depth */}
                          <div className="absolute bottom-0 left-0 right-0 h-[30%] rounded-b-full bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

                          {/* Striped overlay (subtle) */}
                          <div
                            className="absolute inset-0 rounded-full opacity-[0.06]"
                            style={{
                              backgroundImage: 'repeating-linear-gradient(60deg, transparent, transparent 6px, rgba(0,0,0,0.4) 6px, rgba(0,0,0,0.4) 12px)',
                            }}
                          />

                          {/* Glowing edge */}
                          <div
                            className="absolute top-0 bottom-0 right-0 w-3 rounded-full blur-[4px] opacity-60"
                            style={{
                              background: allBalanceUsed
                                ? 'hsl(var(--color-error))'
                                : consumedPct >= 75
                                  ? 'hsl(var(--color-warning))'
                                  : 'hsl(var(--nirex-accent-hi))',
                            }}
                          />

                          {/* Percentage inside fill */}
                          {consumedPct >= 30 && (
                            <span className="absolute inset-0 flex items-center justify-end pr-3 text-[11px] font-bold text-white/95 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] tracking-tight">
                              {consumedPct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Floating badge when bar too narrow */}
                      {consumedPct > 0 && consumedPct < 30 && (
                        <div
                          className="absolute -top-2 -translate-y-full"
                          style={{ left: `${Math.min(100, consumedPct)}%`, transform: `translateX(-50%) translateY(-100%)` }}
                        >
                          <div className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md text-white shadow-lg backdrop-blur-sm ${
                            allBalanceUsed ? "bg-red-500/90" : consumedPct >= 75 ? "bg-amber-500/90" : "bg-primary/90"
                          }`}>
                            {consumedPct.toFixed(0)}%
                          </div>
                          <div className={`w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent ${
                            allBalanceUsed ? "border-t-red-500/90" : consumedPct >= 75 ? "border-t-amber-500/90" : "border-t-primary/90"
                          }`} />
                        </div>
                      )}
                    </div>

                    {/* Labels row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Budget <span className="font-mono text-foreground ml-1">${budgetUsd.toFixed(2)}</span>
                      </span>
                      <span className={`font-medium ${
                        allBalanceUsed ? "text-destructive" : consumedPct >= 75 ? "text-warning" : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {allBalanceUsed
                          ? "Exhausted"
                          : consumedPct >= 75
                            ? "Approaching limit"
                            : `${(100 - consumedPct).toFixed(0)}% remaining`}
                      </span>
                    </div>

                    {/* Status message */}
                    <p className={`text-xs ${
                      allBalanceUsed ? "text-destructive font-medium" :
                      consumedPct >= 75 ? "text-warning font-medium" :
                      "text-muted-foreground"
                    }`}>
                      {allBalanceUsed
                        ? "All balance used up. Top up to continue using the service."
                        : consumedPct >= 75
                          ? "You're approaching your budget limit. Consider monitoring usage or upgrading your plan."
                          : `You have $${balanceUsd.toFixed(2)} remaining in your included credits.`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Total Requests — real data bar chart */}
            {(() => {
              const totalReq = overview.summary.total_requests;
              const requestChartData = overview.chart
                .filter((_, i, arr) => {
                  const step = arr.length > 30 ? Math.ceil(arr.length / 30) : 1;
                  return i % step === 0;
                })
                .map((p) => ({ day: p.date.slice(5), requests: p.requests }));

              return (
                <div className="bg-nirex-surface border border-border p-4 overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-semibold mt-1 font-mono">{formatNumber(totalReq)}</p>
                    </div>
                    <div className={`text-xs font-medium mt-2 ${
                      requestChange.type === "positive" ? "text-emerald-600 dark:text-emerald-400" :
                      requestChange.type === "negative" ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                    }`}>
                      {totalReq > 0 ? requestChange.text : "—"}
                    </div>
                  </div>

                  {/* Bar chart */}
                  <div className="h-[100px] mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={requestChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} dy={4} />
                        <Bar dataKey="requests" fill="hsl(var(--color-success))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Total Tokens — real data line chart */}
            {(() => {
              const totalTok = overview.summary.total_tokens;
              const inputTok = overview.summary.total_input_tokens;
              const outputTok = overview.summary.total_output_tokens;
              // Map the chart array (last N days) into chart-friendly format, sample every Nth point for readability
              const chartPoints = overview.chart
                .filter((_, i, arr) => {
                  // Show at most 30 points; sample if range is 90d
                  const step = arr.length > 30 ? Math.ceil(arr.length / 30) : 1;
                  return i % step === 0;
                })
                .map((p) => ({
                  day: p.date.slice(5), // "MM-DD"
                  tokens: p.tokens,
                }));

              return (
                <div className="bg-nirex-surface border border-border p-4 overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tokens</p>
                      <p className="text-2xl font-semibold mt-1 font-mono">{formatNumber(totalTok)}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ↑ <span className="text-foreground">{formatNumber(inputTok)}</span> in
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ↓ <span className="text-foreground">{formatNumber(outputTok)}</span> out
                        </span>
                      </div>
                    </div>
                    <div className={`text-xs font-medium mt-2 ${
                      tokenChange.type === "positive" ? "text-emerald-600 dark:text-emerald-400" :
                      tokenChange.type === "negative" ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                    }`}>
                      {totalTok > 0 ? tokenChange.text : "—"}
                    </div>
                  </div>

                  {/* Line chart with dots */}
                  <div className="h-[100px] mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartPoints} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--color-info))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--color-info))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} dy={4} />
                        <Area type="monotone" dataKey="tokens" stroke="none" fill="url(#tokenGradient)" />
                        <Line type="monotone" dataKey="tokens" stroke="hsl(var(--color-info))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Rolling Window Request Limits - Full Width Card */}
          <SectionCard
            title="Request Limits"
            icon={Gauge}
            headerAction={
              liftedByTopup ? (
                <StatusBadge label="Limits lifted" variant="success" icon={Shield} />
              ) : null
            }

          >
                {/* 5-hour window */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium font-display">5-Hour Rolling Window</p>
                      <p className="text-xs text-muted-foreground">
                        {window5hResetsAt
                          ? `Resets in ${formatTimeRemaining(window5hResetsAt)}`
                          : window5hUsed === 0
                            ? "No active requests"
                            : "Calculating..."
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono">
                        {formatNumber(window5hUsed)}
                        {window5hLimit !== null && (
                          <span className="text-base font-normal text-muted-foreground">
                            {" "}/ {formatNumber(window5hLimit!)}
                          </span>
                        )}
                      </p>
                      <p className={`text-xs font-medium ${ liftedByTopup ? "text-nirex-success" : window5hPct >= 90 ? "text-destructive" : window5hPct >= 75 ? "text-warning" : "text-muted-foreground" }`}>
                        {getWindowStatusText(window5hPct, liftedByTopup)}
                        {window5hLimit !== null && !liftedByTopup && ` · ${window5hPct.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden bg-muted">
                    <div
                      className={`h-full transition-all duration-500 ${getWindowBarColor(window5hPct, liftedByTopup)}`}
                      style={{ width: `${Math.min(100, window5hPct)}%` }}
                    />
                    {window5hPct >= 15 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
                        {window5hPct.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* 7-day window */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium font-display">7-Day Rolling Window</p>
                      <p className="text-xs text-muted-foreground">
                        {window7dResetsAt
                          ? `Resets in ${formatTimeRemaining(window7dResetsAt)}`
                          : window7dUsed === 0
                            ? "No active requests"
                            : "Calculating..."
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono">
                        {formatNumber(window7dUsed)}
                        {window7dLimit !== null && (
                          <span className="text-base font-normal text-muted-foreground">
                            {" "}/ {formatNumber(window7dLimit!)}
                          </span>
                        )}
                      </p>
                      <p className={`text-xs font-medium ${ liftedByTopup ? "text-nirex-success" : window7dPct >= 90 ? "text-destructive" : window7dPct >= 75 ? "text-warning" : "text-muted-foreground" }`}>
                        {getWindowStatusText(window7dPct, liftedByTopup)}
                        {window7dLimit !== null && !liftedByTopup && ` · ${window7dPct.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden bg-muted">
                    <div
                      className={`h-full transition-all duration-500 ${getWindowBarColor(window7dPct, liftedByTopup)}`}
                      style={{ width: `${Math.min(100, window7dPct)}%` }}
                    />
                    {window7dPct >= 15 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
                        {window7dPct.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>

            {/* Info footer */}
            {!liftedByTopup && (
              <div className="mt-4 bg-muted/50 p-3 text-xs text-muted-foreground border border-border">
                <div className="flex items-start gap-2">
                  <Shield size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium text-foreground font-display">Rolling windows</p>
                    <p className="mt-0.5">Limits reset continuously. Top up to lift restrictions.</p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>



          {/* Request History */}
          <SectionCard
            title="Request History"
            icon={List}
            headerAction={
              logsQuery.isFetching ? (
                <RefreshCw size={13} className="animate-spin text-muted-foreground" />
              ) : null
            }
          >
            {logsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : logsQuery.isError ? (
              <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <AlertTriangle size={16} className="text-destructive shrink-0" />
                Unable to load request history. Please try again.
              </div>
            ) : !logsQuery.data || logsQuery.data.logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity size={20} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No requests in this period.</p>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Model</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Mode</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Input</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Output</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Cost</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Timing</th>
                        <th className="text-center px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsQuery.data.logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap" title={log.model}>
                            {truncateModel(log.model)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border rounded">
                              {log.mode || "chat"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                            {formatNumber(log.input_tokens)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                            {formatNumber(log.output_tokens)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                            {formatCost(log.total_cost)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                            {formatTiming(log.timing_ms)}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {log.status === "success" ? (
                              <CheckCircle2 size={13} className="inline text-emerald-500" />
                            ) : (
                              <XCircle size={13} className="inline text-destructive" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsQuery.data.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-mono font-medium text-foreground">
                        {(logsPage - 1) * 20 + 1}–{Math.min(logsPage * 20, logsQuery.data.pagination.total)}
                      </span>{" "}
                      of{" "}
                      <span className="font-mono font-medium text-foreground">
                        {logsQuery.data.pagination.total}
                      </span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                        disabled={logsPage === 1 || logsQuery.isFetching}
                        className="inline-flex items-center justify-center w-7 h-7 border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span className="text-xs font-mono px-2 text-muted-foreground">
                        {logsPage} / {logsQuery.data.pagination.total_pages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLogsPage((p) => Math.min(logsQuery.data!.pagination.total_pages, p + 1))}
                        disabled={!logsQuery.data.pagination.has_more || logsQuery.isFetching}
                        className="inline-flex items-center justify-center w-7 h-7 border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {usageQuery.isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Updating usage data...
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
