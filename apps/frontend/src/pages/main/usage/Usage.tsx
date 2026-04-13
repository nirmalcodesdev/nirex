// Usage Page - Resource consumption monitoring
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Zap,
  Server,
  Database,
  ArrowUpRight,
  MoreHorizontal,
  DollarSign,
  TrendingUp as TrendingUpIcon,
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
import { Dropdown, DropdownItem } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useSimulatedLoading } from "../../../hooks/useSimulatedLoading";
import { Skeleton, CardSkeleton, ChartSkeleton } from "@nirex/ui/Skeleton";

interface ProjectUsageData {
  name: string;
  compute: string;
  requests: string;
  cost: string;
  trend: string;
  trendUp: boolean;
}

const usageData = [
  { date: "Mar 01", compute: 120, storage: 45, network: 30 },
  { date: "Mar 05", compute: 180, storage: 50, network: 40 },
  { date: "Mar 10", compute: 150, storage: 55, network: 35 },
  { date: "Mar 15", compute: 220, storage: 60, network: 50 },
  { date: "Mar 20", compute: 310, storage: 65, network: 70 },
  { date: "Mar 25", compute: 280, storage: 70, network: 60 },
  { date: "Mar 30", compute: 350, storage: 75, network: 80 },
];

const topProjects: ProjectUsageData[] = [
  {
    name: "nirex-core-api",
    compute: "145h",
    requests: "1.2M",
    cost: "$45.20",
    trend: "+12%",
    trendUp: true,
  },
  {
    name: "frontend-dashboard",
    compute: "82h",
    requests: "850K",
    cost: "$28.50",
    trend: "+5%",
    trendUp: true,
  },
  {
    name: "auth-service-worker",
    compute: "45h",
    requests: "2.1M",
    cost: "$18.90",
    trend: "-2%",
    trendUp: false,
  },
  {
    name: "data-pipeline-cron",
    compute: "120h",
    requests: "45K",
    cost: "$35.00",
    trend: "+24%",
    trendUp: true,
  },
];

const costBreakdown = [
  {
    name: "Compute Hours",
    description: "845 hours @ $0.05/hr",
    cost: "$42.25",
    icon: Clock,
    color: "nirex-accent",
  },
  {
    name: "Database Storage",
    description: "12.4 GB @ $0.25/GB",
    cost: "$3.10",
    icon: Database,
    color: "nirex-accent-hi",
  },
  {
    name: "Bandwidth",
    description: "850 GB @ $0.01/GB",
    cost: "$8.50",
    icon: Server,
    color: "nirex-success",
  },
  {
    name: "Edge Requests",
    description: "4.2M requests @ $0.001/1K",
    cost: "$4.20",
    icon: Activity,
    color: "nirex-warning",
  },
];

// Loading skeleton using Skeleton component
function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <Skeleton className="h-8 w-40" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" variant="text" />
            <Skeleton className="h-8 w-8 rounded-lg" variant="default" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" variant="default" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" variant="text" />
                  <Skeleton className="h-3 w-32" variant="text" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" variant="text" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Usage() {
  const isLoading = useSimulatedLoading();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (isLoading) {
    return <UsageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <PageHeader
        title="Usage & Billing"
        description="Monitor resource consumption and plan limits"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Usage Cost"
          value="$58.05"
          change="+12.5%"
          changeType="positive"
          icon={DollarSign}
          changeContext="vs last month"
        />
        <KpiCard
          title="Compute Hours"
          value="845h"
          change="84.5%"
          changeType="negative"
          icon={Clock}
          changeContext="of 1,000h limit"
        />
        <KpiCard
          title="Total Requests"
          value="4.2M"
          change="+8.2%"
          changeType="positive"
          icon={Activity}
          changeContext="vs last month"
        />
        <KpiCard
          title="Avg. Response Time"
          value="45ms"
          change="-15%"
          changeType="positive"
          icon={TrendingUpIcon}
          changeContext="faster than last month"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Usage Over Time</h2>
              <p className="text-sm text-muted-foreground">
                Daily resource consumption
              </p>
            </div>
            <Dropdown
              align="right"
              trigger={
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem
                onClick={() => toast("Exporting chart data...", "info")}
              >
                Export Data
              </DropdownItem>
              <DropdownItem onClick={() => toast("Refreshing chart...", "info")}>
                Refresh
              </DropdownItem>
            </Dropdown>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-sm mb-4">
            <LegendItem color="bg-nirex-accent" label="Compute" />
            <LegendItem color="bg-nirex-accent-hi" label="Storage" />
            <LegendItem color="bg-nirex-success" label="Network" />
          </div>

          {/* Chart */}
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usageData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  dataKey="date"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
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
                <Bar
                  dataKey="compute"
                  fill="hsl(var(--nirex-accent))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="storage"
                  fill="hsl(var(--nirex-accent-hi))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="network"
                  fill="hsl(var(--color-success))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Cost Breakdown</h2>
              <p className="text-sm text-muted-foreground">
                Current billing cycle
              </p>
            </div>
            <Dropdown
              align="right"
              trigger={
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem
                onClick={() => toast("Viewing detailed breakdown...", "info")}
              >
                View Details
              </DropdownItem>
              <DropdownItem
                onClick={() => toast("Exporting cost report...", "info")}
              >
                Export
              </DropdownItem>
            </Dropdown>
          </div>

          <div className="space-y-3 flex-1">
            {costBreakdown.map((item) => (
              <CostBreakdownItem key={item.name} {...item} />
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="font-medium">Total Usage Cost</span>
            <span className="text-xl font-semibold">$58.05</span>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Projects */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Top Projects by Usage</h2>
              <p className="text-sm text-muted-foreground">
                Most resource-intensive projects this billing cycle
              </p>
            </div>
            <Dropdown
              align="right"
              trigger={
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem
                onClick={() => toast("Exporting project data...", "info")}
              >
                Export Data
              </DropdownItem>
              <DropdownItem onClick={() => toast("Refreshing...", "info")}>
                Refresh
              </DropdownItem>
            </Dropdown>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Compute</th>
                  <th className="px-5 py-3 font-medium">Requests</th>
                  <th className="px-5 py-3 font-medium">Cost</th>
                  <th className="px-5 py-3 font-medium">Trend</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProjects.map((project) => (
                  <tr
                    key={project.name}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {project.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {project.compute}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {project.requests}
                    </td>
                    <td className="px-5 py-4 font-medium">{project.cost}</td>
                    <td className="px-5 py-4">
                      <div
                        className={`flex items-center gap-1 text-xs font-medium ${project.trendUp
                          ? "text-nirex-success"
                          : "text-nirex-error"
                          }`}
                      >
                        {project.trendUp ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}
                        {project.trend}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => navigate(`/sessions`)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        View <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Plan Summary */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Current Plan</h2>
              <p className="text-sm text-muted-foreground">
                Your subscription details
              </p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap size={18} className="text-primary" />
            </div>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <div className="mb-6">
              <div className="text-3xl font-semibold tracking-tight">Pro Plan</div>
              <div className="text-sm text-muted-foreground">$49/month</div>
            </div>

            <div className="space-y-3 mb-6">
              <PlanFeature label="Included compute" value="1,000h" />
              <PlanFeature label="Included storage" value="50GB" />
              <PlanFeature label="Included bandwidth" value="1TB" />
            </div>

            <div className="mt-auto">
              <p className="text-xs text-muted-foreground mb-3">
                Next billing date: Apr 1, 2026
              </p>
              <button
                onClick={() => navigate("/billing")}
                className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Billing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
interface LegendItemProps {
  color: string;
  label: string;
}

function LegendItem({ color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

interface CostBreakdownItemProps {
  name: string;
  description: string;
  cost: string;
  icon: React.ElementType;
  color: string;
}

function CostBreakdownItem({
  name,
  description,
  cost,
  icon: Icon,
  color,
}: CostBreakdownItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}/10`}>
          <Icon size={16} className={`text-${color}`} />
        </div>
        <div>
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="font-semibold text-sm">{cost}</span>
    </div>
  );
}

interface PlanFeatureProps {
  label: string;
  value: string;
}

function PlanFeature({ label, value }: PlanFeatureProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
