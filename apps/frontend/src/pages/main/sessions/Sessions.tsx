// Sessions Page - CLI execution sessions listing
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  MoreHorizontal,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Calendar,
  Activity,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useSimulatedLoading } from "../../../hooks/useSimulatedLoading";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Skeleton, CardSkeleton, TableRowSkeleton } from "@nirex/ui/Skeleton";

interface SessionData {
  id: string;
  command: string;
  project: string;
  duration: string;
  status: "success" | "failed" | "running" | "pending";
  date: string;
}

const sessionsData: SessionData[] = [
  {
    id: "sess_8x2k9m",
    command: "npm run build",
    project: "api-service",
    duration: "45s",
    status: "success",
    date: "2 mins ago",
  },
  {
    id: "sess_3p7q4n",
    command: "deploy --staging",
    project: "web-dashboard",
    duration: "1m 12s",
    status: "success",
    date: "15 mins ago",
  },
  {
    id: "sess_9v5w2r",
    command: "docker-compose up",
    project: "worker-queue",
    duration: "3s",
    status: "failed",
    date: "1 hour ago",
  },
  {
    id: "sess_4j8h3b",
    command: "pytest tests/",
    project: "api-service",
    duration: "2m 34s",
    status: "success",
    date: "2 hours ago",
  },
  {
    id: "sess_2k5m9p",
    command: "npm run migrate",
    project: "database",
    duration: "12s",
    status: "running",
    date: "Just now",
  },
  {
    id: "sess_7c4x8v",
    command: "npm ci",
    project: "web-dashboard",
    duration: "4m 05s",
    status: "success",
    date: "3 hours ago",
  },
  {
    id: "sess_1n6b3z",
    command: "tsc --noEmit",
    project: "shared-lib",
    duration: "8s",
    status: "failed",
    date: "4 hours ago",
  },
];

// Loading skeleton using Skeleton component
function SessionsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <Skeleton className="h-8 w-32" variant="text" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full max-w-sm" variant="default" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <TableRowSkeleton key={i} columns={7} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sessions() {
  const [dateRange, setDateRange] = useState("Last 24h");
  const [statusFilter, setStatusFilter] = useState("All");
  const isLoading = useSimulatedLoading();
  const navigate = useNavigate();
  const { toast } = useToast();

  const totalSessions = sessionsData.length;
  const successCount = sessionsData.filter((s) => s.status === "success").length;
  const failedCount = sessionsData.filter((s) => s.status === "failed").length;
  const runningCount = sessionsData.filter((s) => s.status === "running").length;

  if (isLoading) {
    return <SessionsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto">
      <PageHeader
        title="Sessions"
        description="View your CLI execution sessions"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Sessions"
          value={totalSessions.toString()}
          change="+12%"
          changeType="positive"
          icon={Activity}
          variant="compact"
        />
        <KpiCard
          title="Successful"
          value={successCount.toString()}
          change="+8%"
          changeType="positive"
          icon={CheckCircle2}
          variant="compact"
        />
        <KpiCard
          title="Failed"
          value={failedCount.toString()}
          change="-2%"
          changeType="positive"
          icon={XCircle}
          variant="compact"
        />
        <KpiCard
          title="Running"
          value={runningCount.toString()}
          change="Active"
          changeType="neutral"
          icon={Clock}
          variant="compact"
        />
      </div>

      {/* Sessions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by ID, command, or user..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <Filter size={14} />
                  <span>{statusFilter}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem onClick={() => setStatusFilter("All")}>All</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter("Success")}>
                Success
              </DropdownItem>
              <DropdownItem onClick={() => setStatusFilter("Failed")}>
                Failed
              </DropdownItem>
              <DropdownItem onClick={() => setStatusFilter("Running")}>
                Running
              </DropdownItem>
            </Dropdown>

            <Dropdown
              trigger={
                <button className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <Calendar size={14} />
                  <span>{dateRange}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              }
            >
              <DropdownItem onClick={() => setDateRange("Last 1h")}>
                Last 1h
              </DropdownItem>
              <DropdownItem onClick={() => setDateRange("Last 24h")}>
                Last 24h
              </DropdownItem>
              <DropdownItem onClick={() => setDateRange("Last 7d")}>
                Last 7d
              </DropdownItem>
              <DropdownItem onClick={() => setDateRange("Last 30d")}>
                Last 30d
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Session
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Command
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Project
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessionsData.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <code className="text-xs font-mono text-muted-foreground">
                      {session.id}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Terminal
                        size={14}
                        className="text-muted-foreground shrink-0"
                      />
                      <span className="font-mono text-xs truncate max-w-[150px]">
                        {session.command}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {session.duration}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      {session.project}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-sm">
                    {session.date}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        align="right"
                        trigger={
                          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal size={16} />
                          </button>
                        }
                      >
                        <DropdownItem
                          onClick={() => navigate(`/sessions/${session.id}`)}
                        >
                          View Details
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => toast("Command copied", "success")}
                        >
                          Copy Command
                        </DropdownItem>
                        <DropdownItem
                          onClick={() =>
                            toast("Session re-run initiated", "success")
                          }
                        >
                          Re-run
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground bg-muted/20">
          <div>
            Showing 1 to {sessionsData.length} of 1,234 sessions
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              disabled
            >
              Previous
            </button>
            <button className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors bg-background">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
