// Sessions Page - CLI execution sessions listing
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Filter,
  MoreHorizontal,
  Terminal,
  Clock,
  ChevronDown,
  Calendar,
  Activity,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { KpiCard } from "@nirex/ui";
import { PageHeader } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Skeleton, CardSkeleton, TableRowSkeleton } from "@nirex/ui/Skeleton";
import { sessionApi } from "../../../features/sessions/sessionApi";
import { formatRelativeTime } from "@nirex/shared";
import type { ChatSessionDTO } from "@nirex/shared";

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export function Sessions() {
  const [dateRange, setDateRange] = useState("Last 24h");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: sessionsResponse, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ["sessions", statusFilter],
    queryFn: () => sessionApi.listSessions({ 
      include_archived: statusFilter === "Archived" || statusFilter === "All" 
    }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["session-stats"],
    queryFn: () => sessionApi.getStats(),
  });

  const sessions = useMemo(() => {
    if (!sessionsResponse?.sessions) return [];
    
    let filtered = [...sessionsResponse.sessions];
    
    if (statusFilter === "Active") {
      filtered = filtered.filter(s => !s.is_archived);
    } else if (statusFilter === "Archived") {
      filtered = filtered.filter(s => s.is_archived);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.id.toLowerCase().includes(q) || 
        s.name.toLowerCase().includes(q) || 
        s.working_directory.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [sessionsResponse, statusFilter, searchQuery]);

  if (sessionsLoading || statsLoading) {
    return <SessionsSkeleton />;
  }

  if (sessionsError) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">
          {getErrorMessage(sessionsError, "Failed to load sessions")}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
        >
          Try again
        </button>
      </div>
    );
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
          value={stats?.total_sessions.toString() || "0"}
          change=""
          changeType="neutral"
          icon={Activity}
          variant="compact"
        />
        <KpiCard
          title="Total Messages"
          value={stats?.total_messages.toString() || "0"}
          change=""
          changeType="neutral"
          icon={Terminal}
          variant="compact"
        />
        <KpiCard
          title="Tokens Used"
          value={stats?.total_tokens.total_tokens.toLocaleString() || "0"}
          change=""
          changeType="neutral"
          icon={Activity}
          variant="compact"
        />
        <KpiCard
          title="Estimated Cost"
          value={`$${stats?.estimated_cost_usd.toFixed(2) || "0.00"}`}
          change=""
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, name, or directory..."
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
              <DropdownItem onClick={() => setStatusFilter("Active")}>
                Active
              </DropdownItem>
              <DropdownItem onClick={() => setStatusFilter("Archived")}>
                Archived
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
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Messages
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Model
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((session: ChatSessionDTO) => (
                <tr
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <code className="text-xs font-mono text-muted-foreground">
                      {session.id.substring(0, 8)}...
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Terminal
                        size={14}
                        className="text-muted-foreground shrink-0"
                      />
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {session.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={session.is_archived ? "archived" : "active"} className={session.is_archived ? "opacity-60" : ""} />
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {session.message_count}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono text-muted-foreground">
                      {session.model}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-sm">
                    {formatRelativeTime(new Date(session.updated_at))}
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
                          onClick={() => {
                            navigator.clipboard.writeText(session.id);
                            toast("ID copied", "success");
                          }}
                        >
                          Copy ID
                        </DropdownItem>
                        <DropdownItem
                          onClick={async () => {
                            try {
                              await sessionApi.updateSession(session.id, { is_archived: !session.is_archived });
                              toast(session.is_archived ? "Session unarchived" : "Session archived", "success");
                              // Refetch
                              window.location.reload();
                            } catch (err) {
                              toast(getErrorMessage(err, "Action failed"), "error");
                            }
                          }}
                        >
                          {session.is_archived ? "Unarchive" : "Archive"}
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sessionsResponse?.pagination && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground bg-muted/20">
            <div>
              Showing {sessions.length} of {sessionsResponse.pagination.total} sessions
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                disabled={sessionsResponse.pagination.page === 1}
              >
                Previous
              </button>
              <button 
                className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors bg-background"
                disabled={sessionsResponse.pagination.page === sessionsResponse.pagination.total_pages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
