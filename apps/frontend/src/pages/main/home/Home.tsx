// Home Page - Main Dashboard
import { useState } from "react";
import { MoreHorizontal, Terminal, Activity, Zap } from "lucide-react";
import { BarChart, Bar, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useSimulatedLoading } from "../../../hooks/useSimulatedLoading";
import { Skeleton, CardSkeleton, ChartSkeleton } from "@nirex/ui/Skeleton";

// Data - Chart data for CLI executions
const executionData = [
  { name: "Jan", value: 65200 },
  { name: "Feb", value: 54800 },
  { name: "Mar", value: 48600 },
  { name: "Apr", value: 38300 },
  { name: "May", value: 32900 },
];

const retentionData = [
  { name: "Jan", value: 20 },
  { name: "Feb", value: 25 },
  { name: "Mar", value: 42 },
  { name: "Apr", value: 30 },
  { name: "May", value: 35 },
  { name: "Jun", value: 22 },
];

// Generate stable random heights for the chart visualization
function useStableRandomHeights(count: number) {
  const [heights] = useState(() =>
    Array.from({ length: count }, () => Math.random() * 60 + 20)
  );
  return heights;
}

// Loading skeleton using Skeleton component
function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <Skeleton className="h-8 w-32" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    </div>
  );
}

export function Home() {
  const isLoading = useSimulatedLoading();
  const { toast } = useToast();
  const barHeights = useStableRandomHeights(24);

  if (isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <PageHeader
        title="Overview"
        description="Monitor your CLI executions and compute usage"
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Total Executions"
          value="2,847"
          change="+12.5%"
          changeType="positive"
          icon={Terminal}
          changeContext="vs last week"
        />
        <KpiCard
          title="Success Rate"
          value="94.2%"
          change="+2.1%"
          changeType="positive"
          icon={Activity}
          changeContext="vs last week"
        />
        <KpiCard
          title="Compute Time"
          value="142h"
          change="-8.2%"
          changeType="negative"
          icon={Zap}
          changeContext="vs last week"
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CLI Executions Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">CLI Executions</h2>
            <Dropdown
              align="right"
              trigger={
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem onClick={() => toast("Exporting data...", "info")}>
                Export Data
              </DropdownItem>
              <DropdownItem onClick={() => toast("Refreshing data...", "info")}>
                Refresh
              </DropdownItem>
            </Dropdown>
          </div>

          {/* Metrics Row */}
          <div className="flex gap-6 mb-6 overflow-x-auto pb-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Initiated</div>
              <div className="text-xl font-semibold text-muted-foreground/70">
                65.2k
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Authorized</div>
              <div className="text-xl font-semibold text-muted-foreground/70">
                54.8k
              </div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1">Successful</div>
              <div className="text-xl font-semibold">48.6k</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Failed</div>
              <div className="text-xl font-semibold text-muted-foreground/70">
                38.3k
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Retried</div>
              <div className="text-xl font-semibold text-muted-foreground/70">
                32.9k
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={executionData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--nirex-accent))"
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--nirex-accent))"
                      stopOpacity={0.2}
                    />
                  </linearGradient>
                  <pattern
                    id="stripes"
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect
                      width="4"
                      height="8"
                      transform="translate(0,0)"
                      fill="hsl(var(--nirex-accent))"
                      fillOpacity="0.15"
                    />
                  </pattern>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value: number) => `${value / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {executionData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 2 ? "url(#colorValue)" : "url(#stripes)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Rate Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Error Rate</h2>
            <Dropdown
              align="right"
              trigger={
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem onClick={() => toast("Exporting data...", "info")}>
                Export Data
              </DropdownItem>
              <DropdownItem onClick={() => toast("Refreshing data...", "info")}>
                Refresh
              </DropdownItem>
            </Dropdown>
          </div>
          <div className="h-[200px] w-full relative">
            <div className="absolute top-2 left-1/4 text-sm font-semibold bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border z-10">
              42%
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={retentionData}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
              >
                <Line
                  type="stepAfter"
                  dataKey="value"
                  stroke="hsl(var(--nirex-accent))"
                  strokeWidth={2.5}
                  dot={false}
                />
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  horizontal={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-between px-1 pointer-events-none opacity-20">
              {barHeights.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-nirex-accent"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between text-xs font-medium text-muted-foreground mt-4 px-2">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>
      </div>

      {/* Insights Card */}
      <div className="bg-gradient-to-br from-nirex-surface via-nirex-elevated to-nirex-base text-nirex-text-primary rounded-xl p-6 border border-nirex-accent/20 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-nirex-accent/20 to-transparent rounded-full blur-3xl -mr-20 -mt-20" />

        <div className="flex items-center gap-2 bg-nirex-accent/10 backdrop-blur-md w-fit px-3 py-1.5 rounded-full text-xs font-medium mb-6 border border-nirex-accent/20">
          <Zap size={12} className="text-nirex-accent" /> Insights
        </div>

        <div className="text-5xl font-light mb-4 tracking-tight">75%</div>
        <h3 className="text-lg font-medium mb-3 leading-snug">
          Success rate increased by 4% compared to last week.
        </h3>
        <p className="text-sm text-nirex-text-secondary leading-relaxed mb-6">
          This improvement reduced failed executions by 950 and is projected to
          save 12,400s of compute time.
        </p>

        <div className="mt-auto h-1.5 w-full bg-nirex-text-muted/20 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-nirex-accent to-nirex-accent-hi w-[75%] rounded-full shadow-[0_0_10px_hsl(var(--nirex-accent)/0.5)]" />
        </div>
      </div>
    </div>
  );
}
