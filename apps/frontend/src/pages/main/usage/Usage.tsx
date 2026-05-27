import { useState } from "react";
import type { UsageExportFormat, UsageRange } from "@nirex/shared";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Layers,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, Dropdown, DropdownItem, KpiCard, PageHeader, type KpiChangeType } from "@nirex/ui";
import { CardSkeleton, ChartSkeleton } from "@nirex/ui/Skeleton";
import { useToast } from "../../../components/ToastProvider";
import {
  getCreditPeriodDateLabel,
  getCreditUsageFootnote,
} from "../../../features/billing/billingDisplay";
import { useUsageExportMutation, useUsageOverviewQuery } from "../../../features/usage";

const usageRangeLabels: Record<UsageRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month_to_date: "Current billing period",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatDateLabel(dateValue: string | null | undefined): string {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? dateValue
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function toKpiChange(value: number | null | undefined, positiveWhenHigher: boolean): { text: string; type: KpiChangeType } {
  const safeValue = value ?? 0;
  const isIncrease = safeValue >= 0;
  let type: KpiChangeType = "neutral";
  if (safeValue > 0) type = positiveWhenHigher ? "positive" : "negative";
  else if (safeValue < 0) type = positiveWhenHigher ? "negative" : "positive";
  return { text: `${isIncrease ? "+" : ""}${safeValue.toFixed(1)}%`, type };
}

function trendColorClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-muted-foreground";
}

function triggerFileDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

export function Usage() {
  const { toast } = useToast();
  const [usageRange, setUsageRange] = useState<UsageRange>("30d");

  const usageQuery = useUsageOverviewQuery({ range: usageRange });
  const exportMutation = useUsageExportMutation();

  const overview = usageQuery.data;

  const requestChange = toKpiChange(overview?.summary.total_requests_trend_pct, true);
  const responseTimeChange = toKpiChange(overview?.summary.avg_response_time_trend_pct, false);

  const creditLifecycle = {
    status: overview?.current_plan.subscription_status,
    cancelAtPeriodEnd: overview?.current_plan.cancel_at_period_end,
    currentPeriodEnd: overview?.current_plan.next_billing_date,
    trialEnd: overview?.current_plan.trial_end,
    nextCreditResetAt: overview?.current_plan.next_credit_reset_at,
    creditsExpireAt: overview?.current_plan.credits_expire_at,
  };
  const nextCreditResetAt = creditLifecycle.nextCreditResetAt
    ?? creditLifecycle.creditsExpireAt
    ?? creditLifecycle.currentPeriodEnd
    ?? null;
  const creditDateLabel = getCreditPeriodDateLabel(creditLifecycle);
  const creditPeriodLabel = overview?.current_plan.credit_period_start && overview.current_plan.credit_period_end
    ? `${formatDateLabel(overview.current_plan.credit_period_start)} – ${formatDateLabel(overview.current_plan.credit_period_end)}`
    : null;

  // Live balance fields from user record
  const balanceUsd = overview?.current_plan.balance_usd ?? 0;
  const totalCredits = overview?.current_plan.total_credits ?? 0;
  const remainingIncluded = overview?.current_plan.remaining_included_credits ?? 0;
  const topupBalance = overview?.current_plan.topup_balance ?? 0;
  const requestQuota = overview?.current_plan.request_quota ?? null;
  const monthlyRequestCount = overview?.current_plan.monthly_request_count ?? 0;
  const isMaxPlan = overview?.current_plan.plan_id === 'max';
  const liftedByTopup = !isMaxPlan && topupBalance > 0;

  const handleExport = async (format: UsageExportFormat) => {
    try {
      const exported = await exportMutation.mutateAsync({ range: usageRange, format });
      triggerFileDownload(exported.blob, exported.fileName);
      toast(`Usage report exported as ${format.toUpperCase()}.`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to export usage report.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage"
        description="Monitor balance usage trends and plan utilization."
        actions={
          <>
            <button
              type="button"
              onClick={() => usageQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4 ${usageQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-4 w-4" />
                  {exportMutation.isPending ? "Exporting..." : "Export"}
                </button>
              }
              align="right"
            >
              <DropdownItem onClick={() => handleExport("csv")}>Export CSV</DropdownItem>
              <DropdownItem onClick={() => handleExport("json")}>Export JSON</DropdownItem>
            </Dropdown>
          </>
        }
      />

      <div className="flex justify-end">
        <Dropdown
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              {usageRangeLabels[usageRange]}
            </button>
          }
          align="right"
        >
          <DropdownItem onClick={() => setUsageRange("30d")}>Last 30 days</DropdownItem>
          <DropdownItem onClick={() => setUsageRange("90d")}>Last 90 days</DropdownItem>
          <DropdownItem onClick={() => setUsageRange("month_to_date")}>Current billing period</DropdownItem>
        </Dropdown>
      </div>

      {usageQuery.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
          <ChartSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><CardSkeleton /></div>
            <div><CardSkeleton /></div>
          </div>
        </>
      ) : usageQuery.isError ? (
        <Card className="border-destructive/20">
          <CardContent className="flex flex-col gap-2 py-8">
            <h3 className="text-base font-semibold text-destructive">Unable to load usage data</h3>
            <p className="text-sm text-muted-foreground">
              {usageQuery.error instanceof Error ? usageQuery.error.message : "Please try again."}
            </p>
          </CardContent>
        </Card>
      ) : !overview ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">No usage data available yet.</CardContent>
        </Card>
      ) : (
        <>
          {/* Credit balance hero */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold">${balanceUsd.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isMaxPlan
                      ? "Unlimited requests · Max plan"
                      : liftedByTopup
                        ? `${monthlyRequestCount.toLocaleString()} requests this month · limit lifted by top-up`
                        : requestQuota
                          ? `${monthlyRequestCount.toLocaleString()} / ${requestQuota.toLocaleString()} requests/mo`
                          : ""}
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Included</p>
                    <p className="font-medium">${(remainingIncluded / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Top-up</p>
                    <p className="font-medium">${(topupBalance / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Balance Used"
              value={`$${((overview.summary.credits_total_used ?? 0) / 100).toFixed(2)}`}
              change="Total consumption"
              changeType="neutral"
              icon={Layers}
            />
            <KpiCard
              title="Balance"
              value={`$${balanceUsd.toFixed(2)}`}
              change={totalCredits === 0 ? "No balance" : "Available"}
              changeType={totalCredits === 0 ? "negative" : "neutral"}
              icon={Zap}
            />
            <KpiCard
              title="Total Requests"
              value={formatNumber(overview.summary.total_requests)}
              change={requestChange.text}
              changeType={requestChange.type}
              icon={Activity}
            />
            <KpiCard
              title="Avg Response Time"
              value={`${(overview.summary.avg_response_time_ms ?? 0).toFixed(0)} ms`}
              change={responseTimeChange.text}
              changeType={responseTimeChange.type}
              icon={Clock}
            />
          </div>

          <Card>
            <CardHeader>
                <CardTitle>Balance usage trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {overview.chart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No chart data for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`$${(Number(value ?? 0) / 100).toFixed(2)}`, "Balance"]}
                      labelFormatter={(label) => formatDateLabel(String(label))}
                    />
                    <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {overview.top_projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No project usage found for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {overview.top_projects.map((project) => (
                      <div
                        key={project.project_id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center rounded-lg border border-border px-4 py-3 text-sm"
                      >
                        <div className="font-medium">{project.project_name}</div>
                        <div>${(project.credits / 100).toFixed(2)}</div>
                        <div>{formatNumber(project.requests)} reqs</div>
                        <div className="flex items-center justify-end gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs ${trendColorClass(project.trend_pct)}`}>
                            {project.trend_pct >= 0 ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {Math.abs(project.trend_pct).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-base font-semibold">{overview.current_plan.plan_name}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{creditDateLabel}</p>
                  <p className="text-sm">{formatDateLabel(nextCreditResetAt)}</p>
                </div>

                {creditPeriodLabel ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Billing period</p>
                    <p className="text-sm">{creditPeriodLabel}</p>
                  </div>
                ) : null}

                {/* Credit balance breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Balance breakdown</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Included remaining</span>
                      <span>${(remainingIncluded / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top-up balance</span>
                      <span>${(topupBalance / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 font-medium">
                      <span>Total</span>
                      <span>${balanceUsd.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Request quota */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requests this month</span>
                    <span>{formatNumber(monthlyRequestCount)}{requestQuota ? ` / ${formatNumber(requestQuota)}` : ""}</span>
                  </div>
                  {isMaxPlan ? (
                    <p className="text-xs text-nirex-success">Unlimited requests · included with Max plan</p>
                  ) : liftedByTopup ? (
                    <>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-muted-foreground/30"
                          style={{ width: `${requestQuota ? Math.min(100, (monthlyRequestCount / requestQuota) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-nirex-success">✓ Monthly limit lifted · top-up balance is above $0</p>
                      {requestQuota && (
                        <p className="text-xs text-muted-foreground">
                          Plan base limit is {formatNumber(requestQuota)} req/mo — resumes if top-up runs out
                        </p>
                      )}
                    </>
                  ) : requestQuota ? (
                    <>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (monthlyRequestCount / requestQuota) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getCreditUsageFootnote(
                          { ...creditLifecycle, usagePct: overview.summary.credits_used_pct },
                          formatDateLabel,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground/70">Top up to remove this monthly limit</p>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

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
