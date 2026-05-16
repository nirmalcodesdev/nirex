// Sessions Page - CLI execution sessions listing
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Filter,
  Folder,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import { CardSkeleton, Skeleton } from "@nirex/ui/Skeleton";
import { Dropdown, DropdownItem, KpiCard, PageHeader } from "@nirex/ui";
import { cn, formatRelativeTime } from "@nirex/shared";
import type { ChatSessionDTO, ListSessionsQuery, UpdateSessionRequest } from "@nirex/shared";
import { useToast } from "../../../components/ToastProvider";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ROUTES } from "../../../constant/routes";
import { sessionApi } from "../../../features/sessions/sessionApi";

const PAGE_SIZE = 12;

type StatusFilter = "all" | "active" | "archived";
type SortKey = NonNullable<ListSessionsQuery["sort_by"]>;
type SortOrder = NonNullable<ListSessionsQuery["sort_order"]>;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "updated_at", label: "Last updated" },
  { value: "last_message_at", label: "Last message" },
  { value: "last_resumed_at", label: "Last resumed" },
  { value: "created_at", label: "Created" },
  { value: "name", label: "Name" },
];

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatCompactNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: Math.abs(value ?? 0) >= 10000 ? "compact" : "standard",
  }).format(value ?? 0);
}

function formatDateTime(value: Date | string | number | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function directoryLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const leaf = normalized.split("/").filter(Boolean).pop();
  return leaf || normalized || "/";
}

function latestActivity(session: ChatSessionDTO): Date | string {
  return session.last_message_at ?? session.last_resumed_at ?? session.updated_at;
}

function SessionsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
      <Skeleton className="h-8 w-36" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-10 w-full max-w-xl" variant="default" />
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="p-4 sm:p-5 space-y-3">
            <Skeleton className="h-5 w-72" variant="text" />
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-2/3" variant="text" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
      <PageHeader title="Sessions" description="Review CLI conversations, branches, and saved transcripts." />
      <section className="rounded-xl border border-nirex-error/30 bg-nirex-error/5 p-6">
        <div className="flex items-start gap-3">
          <Archive size={20} className="mt-0.5 text-nirex-error" />
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-medium">Unable to load sessions</h2>
              <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
              {isRetrying ? "Retrying" : "Retry"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Terminal size={22} className="text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold">No sessions found</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {hasFilters
            ? "Try a different search, status, or sort option."
            : "CLI and API conversations will appear here once they are created."}
        </p>
      </div>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function MetaPill({
  icon: Icon,
  children,
  title,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function SessionRow({
  session,
  isWorking,
  onOpen,
  onCopy,
  onCopyPath,
  onToggleArchive,
  onTogglePin,
}: {
  session: ChatSessionDTO;
  isWorking: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onCopyPath: () => void;
  onToggleArchive: () => void;
  onTogglePin: () => void;
}) {
  const activity = latestActivity(session);
  const totalTokens = session.token_usage?.total_tokens ?? 0;
  const messagePreview = session.last_message_preview || "No transcript messages captured yet.";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group grid cursor-pointer gap-4 p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 sm:p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.9fr)_auto]"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 max-w-full truncate text-base font-semibold tracking-tight">
            {session.name}
          </h2>
          <StatusBadge
            status={session.is_archived ? "archived" : "active"}
            showIcon={false}
            className="shrink-0"
          />
          {session.is_pinned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-nirex-accent/25 bg-nirex-accent/10 px-2 py-0.5 text-xs font-medium text-nirex-accent">
              <Pin size={11} />
              Pinned
            </span>
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{messagePreview}</p>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <MetaPill icon={Terminal}>{session.model}</MetaPill>
          <MetaPill icon={Folder} title={session.working_directory}>
            {directoryLabel(session.working_directory)}
          </MetaPill>
          {session.git_branch ? (
            <MetaPill icon={GitBranch}>{session.git_branch}</MetaPill>
          ) : null}
          {session.source ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
              {session.source}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground sm:grid-cols-4 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide">Messages</p>
          <p className="mt-1 font-medium text-foreground">{formatNumber(session.message_count)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide">Tokens</p>
          <p className="mt-1 font-medium text-foreground">{formatCompactNumber(totalTokens)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide">Checkpoints</p>
          <p className="mt-1 font-medium text-foreground">{formatNumber(session.checkpoint_count ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide">Updated</p>
          <p className="mt-1 font-medium text-foreground" title={formatDateTime(activity)}>
            {formatRelativeTime(activity)}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Copy session ID"
        >
          <Copy size={15} />
        </button>
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              disabled={isWorking}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Session actions"
            >
              <MoreHorizontal size={16} />
            </button>
          }
        >
          <DropdownItem onClick={onOpen}>View details</DropdownItem>
          <DropdownItem onClick={onCopy}>Copy session ID</DropdownItem>
          <DropdownItem onClick={onCopyPath}>Copy working directory</DropdownItem>
          <DropdownItem onClick={onTogglePin}>
            {session.is_pinned ? "Unpin session" : "Pin session"}
          </DropdownItem>
          <DropdownItem onClick={onToggleArchive}>
            {session.is_archived ? "Unarchive session" : "Archive session"}
          </DropdownItem>
        </Dropdown>
      </div>
    </article>
  );
}

export function Sessions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortOrder, statusFilter]);

  const sessionsQuery = useQuery({
    queryKey: ["sessions", { page, statusFilter, debouncedSearch, sortBy, sortOrder }],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const query: ListSessionsQuery = {
        page,
        limit: PAGE_SIZE,
        include_archived: statusFilter !== "active",
        archived_only: statusFilter === "archived",
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (debouncedSearch) {
        query.q = debouncedSearch;
      }

      return sessionApi.listSessions(query);
    },
  });

  const statsQuery = useQuery({
    queryKey: ["session-stats"],
    queryFn: () => sessionApi.getStats(),
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: UpdateSessionRequest }) =>
      sessionApi.updateSession(sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["session-stats"] });
    },
  });

  const stats = statsQuery.data;
  const sessionsResponse = sessionsQuery.data;
  const sessions = sessionsResponse?.sessions ?? [];
  const pagination = sessionsResponse?.pagination;
  const isUpdatingSessions = sessionsQuery.isFetching && !sessionsQuery.isLoading;
  const sortLabel = sortOptions.find((option) => option.value === sortBy)?.label ?? "Last updated";
  const hasFilters =
    statusFilter !== "active" || Boolean(searchQuery.trim()) || sortBy !== "updated_at" || sortOrder !== "desc";
  const archivedCount = stats?.archived_sessions ?? 0;
  const activeCount = Math.max(0, (stats?.total_sessions ?? 0) - archivedCount);

  const rangeText = useMemo(() => {
    if (!pagination || pagination.total === 0) return "No sessions";
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `Showing ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(pagination.total)}`;
  }, [pagination]);

  const resetFilters = () => {
    setStatusFilter("active");
    setSearchQuery("");
    setDebouncedSearch("");
    setSortBy("updated_at");
    setSortOrder("desc");
    setPage(1);
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`, "success");
    } catch {
      toast(`Unable to copy ${label.toLowerCase()}.`, "error");
    }
  };

  const handleUpdateSession = async (
    session: ChatSessionDTO,
    input: UpdateSessionRequest,
    successMessage: string,
  ) => {
    try {
      await updateSessionMutation.mutateAsync({ sessionId: session.id, input });
      toast(successMessage, "success");
    } catch (error) {
      toast(getErrorMessage(error, "Unable to update session."), "error");
    }
  };

  if (sessionsQuery.isLoading && !sessionsResponse) {
    return <SessionsSkeleton />;
  }

  if (sessionsQuery.isError && !sessionsResponse) {
    return (
      <ErrorState
        message={getErrorMessage(sessionsQuery.error, "Failed to load sessions.")}
        isRetrying={sessionsQuery.isFetching}
        onRetry={() => {
          void sessionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
      <PageHeader
        title="Sessions"
        description="Review CLI conversations, branches, checkpoints, and resume activity."
        actions={
          <button
            type="button"
            onClick={() => {
              void sessionsQuery.refetch();
              void statsQuery.refetch();
            }}
            disabled={sessionsQuery.isFetching || statsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw
              size={14}
              className={sessionsQuery.isFetching || statsQuery.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </button>
        }
      />

      {statsQuery.isLoading && !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Sessions"
            value={formatNumber(stats?.total_sessions)}
            change="All time"
            changeType="neutral"
            icon={Activity}
            variant="compact"
          />
          <KpiCard
            title="Active Sessions"
            value={formatNumber(activeCount)}
            change={`${formatNumber(archivedCount)} archived`}
            changeType="neutral"
            icon={Terminal}
            variant="compact"
          />
          <KpiCard
            title="Messages"
            value={formatNumber(stats?.total_messages)}
            change="Stored turns"
            changeType="neutral"
            icon={MessageSquare}
            variant="compact"
          />
          <KpiCard
            title="Tokens"
            value={formatCompactNumber(stats?.total_tokens.total_tokens)}
            change={`${formatCompactNumber(stats?.total_tokens.reasoning_tokens ?? 0)} reasoning`}
            changeType="neutral"
            icon={Clock}
            variant="compact"
          />
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search sessions, directories, branches, or message text..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    statusFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Filter size={14} />
                  {sortLabel}
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              }
            >
              {sortOptions.map((option) => (
                <DropdownItem key={option.value} onClick={() => setSortBy(option.value)}>
                  <span className="flex w-full items-center justify-between gap-4">
                    {option.label}
                    {sortBy === option.value ? <Check size={14} className="text-nirex-accent" /> : null}
                  </span>
                </DropdownItem>
              ))}
              <DropdownItem onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}>
                {sortOrder === "desc" ? "Oldest first" : "Newest first"}
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span>{rangeText}</span>
            {isUpdatingSessions ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs">
                <RefreshCw size={11} className="animate-spin" />
                Updating
              </span>
            ) : null}
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="w-fit text-sm font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card transition-opacity",
          isUpdatingSessions ? "opacity-75" : "opacity-100",
        )}
        aria-busy={isUpdatingSessions}
      >
        {isUpdatingSessions ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        ) : null}
        {sessions.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={resetFilters} />
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isWorking={updateSessionMutation.isPending}
                onOpen={() => navigate(ROUTES.DASHBOARD.SESSION_DETAILS(session.id))}
                onCopy={() => void handleCopy(session.id, "Session ID")}
                onCopyPath={() => void handleCopy(session.working_directory, "Working directory")}
                onToggleArchive={() =>
                  void handleUpdateSession(
                    session,
                    { is_archived: !session.is_archived },
                    session.is_archived ? "Session unarchived." : "Session archived.",
                  )
                }
                onTogglePin={() =>
                  void handleUpdateSession(
                    session,
                    { is_pinned: !session.is_pinned },
                    session.is_pinned ? "Session unpinned." : "Session pinned.",
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {pagination && pagination.total_pages > 1 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {formatNumber(pagination.page)} of {formatNumber(pagination.total_pages)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1 || sessionsQuery.isFetching}
              className="rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
              disabled={pagination.page >= pagination.total_pages || sessionsQuery.isFetching}
              className="rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
