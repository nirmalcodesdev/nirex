import { useState } from "react";
import { cn, type UsageExportFormat, type UsageRange } from "@nirex/shared";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Gauge,
  Layers,
  RefreshCw,
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
import { useUsageExportMutation, useUsageOverviewQuery } from "../../../features/usage";

const usageRangeLabels: Record<UsageRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month_to_date: "Current credit period",
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

  if (safeValue > 0) {
    type = positiveWhenHigher ? "positive" : "negative";
  } else if (safeValue < 0) {
    type = positiveWhenHigher ? "negative" : "positive";
  }

  return {
    text: `${isIncrease ? "+" : ""}${safeValue.toFixed(1)}%`,
    type,
  };
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

  const creditsChange = toKpiChange(overview?.summary.credits_used_trend_pct, false);
  const requestChange = toKpiChange(overview?.summary.total_requests_trend_pct, true);
  const responseTimeChange = toKpiChange(overview?.summary.avg_response_time_trend_pct, false);
  const remainingCredits = overview
    ? Math.max(0, overview.summary.credits_limit - overview.summary.credits_used)
    : 0;
  const nextCreditResetAt = overview?.current_plan.next_credit_reset_at
    ?? overview?.current_plan.next_billing_date
    ?? null;
  const creditPeriodLabel = overview?.current_plan.credit_period_start && overview.current_plan.credit_period_end
    ? `${formatDateLabel(overview.current_plan.credit_period_start)} - ${formatDateLabel(overview.current_plan.credit_period_end)}`
    : null;

  const handleExport = async (format: UsageExportFormat) => {
    try {
      const exported = await exportMutation.mutateAsync({
        range: usageRange,
        format,
      });

      triggerFileDownload(exported.blob, exported.fileName);
      toast(`Usage report exported as ${format.toUpperCase()}.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export usage report.";
      toast(message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage"
        description="Monitor credit usage trends and plan utilization."
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
          <DropdownItem onClick={() => setUsageRange("month_to_date")}>Current credit period</DropdownItem>
        </Dropdown>
      </div>

      {usageQuery.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
          <ChartSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CardSkeleton />
            </div>
            <div>
              <CardSkeleton />
            </div>
          </div>
        </>
      ) : usageQuery.isError ? (
        <Card className="border-destructive/20">
          <CardContent className="flex flex-col gap-2 py-8">
            <h3 className="text-base font-semibold text-destructive">Unable to load usage data</h3>
            <p className="text-sm text-muted-foreground">
              {usageQuery.error instanceof Error ? usageQuery.error.message : "Please try again in a moment."}
            </p>
          </CardContent>
        </Card>
      ) : !overview ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">No usage data available yet.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Credits Used"
              value={formatNumber(overview.summary.credits_total_used ?? 0)}
              change="Total consumption"
              changeType="neutral"
              icon={Layers}
            />
            <KpiCard
              title="Credits Remaining"
              value={formatNumber(remainingCredits)}
              change={`${overview.summary.credits_used_pct.toFixed(1)}% used`}
              changeType={overview.summary.credits_used_pct >= 90 ? "negative" : "neutral"}
              icon={Gauge}
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
              <CardTitle>Credits usage trend</CardTitle>
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
                      formatter={(value) => [formatNumber(Number(value ?? 0)), "Credits"]}
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
                        <div>{formatNumber(project.credits)} credits</div>
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
                  <p className="text-sm text-muted-foreground">Next credit reset</p>
                  <p className="text-sm">
                    {formatDateLabel(nextCreditResetAt)}
                  </p>
                </div>

                {creditPeriodLabel ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Credit period</p>
                    <p className="text-sm">{creditPeriodLabel}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits used</span>
                    <span>
                      {formatNumber(overview.summary.credits_used)} / {formatNumber(overview.current_plan.included_credits)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, overview.summary.credits_used_pct)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {overview.summary.credits_used_pct.toFixed(1)}% of plan credits consumed. Unused credits expire at reset.
                  </p>
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
