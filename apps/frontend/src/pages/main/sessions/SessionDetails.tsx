// Session Details Page - Individual session inspection
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  GitBranch,
  History,
  MessageSquare,
  MoreHorizontal,
  Pin,
  RefreshCw,
  RotateCcw,
  Search,
  Split,
  Terminal,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { CardSkeleton, Skeleton } from "@nirex/ui/Skeleton";
import { Dropdown, DropdownItem, KpiCard, PageHeader } from "@nirex/ui";
import { cn, formatDate, formatRelativeTime } from "@nirex/shared";
import type {
  ChatMessage,
  CheckpointDTO,
  ExportFormat,
  MessageRole,
  UpdateSessionRequest,
} from "@nirex/shared";
import { useToast } from "../../../components/ToastProvider";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ROUTES } from "../../../constant/routes";
import { sessionApi } from "../../../features/sessions/sessionApi";

const MESSAGE_PAGE_SIZE = 50;

type TranscriptRoleFilter = "all" | MessageRole;

const roleFilters: Array<{ value: TranscriptRoleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
  { value: "system", label: "System" },
  { value: "tool", label: "Tool" },
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

function shortId(id: string | undefined): string {
  if (!id) return "None";
  return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function directoryLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const leaf = normalized.split("/").filter(Boolean).pop();
  return leaf || normalized || "/";
}

function roleMeta(role: MessageRole): {
  icon: typeof User;
  label: string;
  className: string;
} {
  switch (role) {
    case "assistant":
      return {
        icon: Terminal,
        label: "Assistant",
        className: "border-nirex-success/30 bg-nirex-success/10 text-nirex-success",
      };
    case "system":
      return {
        icon: Archive,
        label: "System",
        className: "border-nirex-accent/30 bg-nirex-accent/10 text-nirex-accent",
      };
    case "tool":
      return {
        icon: Wrench,
        label: "Tool",
        className: "border-nirex-warning/30 bg-nirex-warning/10 text-nirex-warning",
      };
    case "user":
    default:
      return {
        icon: User,
        label: "User",
        className: "border-border bg-background text-foreground",
      };
  }
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

function messageRangeText(
  pagination: NonNullable<Awaited<ReturnType<typeof sessionApi.getSession>>["messages_pagination"]> | undefined,
  shownCount: number,
): string {
  if (!pagination || pagination.total === 0) {
    return `${formatNumber(shownCount)} message${shownCount === 1 ? "" : "s"}`;
  }

  const end = Math.max(0, pagination.total - (pagination.page - 1) * pagination.limit);
  const start = Math.max(1, end - shownCount + 1);
  return `Showing ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(pagination.total)}`;
}

function SessionDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
      <Skeleton className="h-6 w-36" variant="text" />
      <Skeleton className="h-12 w-2/3" variant="text" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-96 w-full" variant="default" />
        </div>
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

function MetadataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 max-w-[65%] truncate text-right font-medium", mono ? "font-mono text-xs" : "")}>
        {value}
      </span>
    </div>
  );
}

function CheckpointItem({ checkpoint }: { checkpoint: CheckpointDTO }) {
  return (
    <article className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {checkpoint.reason}
            </span>
            <span className="text-xs text-muted-foreground">Turn {formatNumber(checkpoint.turn_index)}</span>
          </div>
          {checkpoint.snapshot ? (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{checkpoint.snapshot}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Snapshot omitted from this response.</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(checkpoint.created_at)}>
          {formatRelativeTime(checkpoint.created_at)}
        </span>
      </div>
      {checkpoint.token_count !== undefined ? (
        <p className="mt-2 text-xs text-muted-foreground">{formatCompactNumber(checkpoint.token_count)} tokens</p>
      ) : null}
    </article>
  );
}

function MessageItem({
  message,
  index,
  sequenceNumber,
  onCopy,
}: {
  message: ChatMessage;
  index: number;
  sequenceNumber: number;
  onCopy: () => void;
}) {
  const meta = roleMeta(message.role);
  const Icon = meta.icon;
  const totalTokens = message.token_usage?.total_tokens ?? 0;

  return (
    <article className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", meta.className)}>
            <Icon size={12} />
            {meta.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">#{formatNumber(sequenceNumber)}</span>
          <span className="text-xs text-muted-foreground" title={formatDateTime(message.timestamp)}>
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {totalTokens > 0 ? <span>{formatCompactNumber(totalTokens)} tokens</span> : null}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted hover:text-foreground"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-foreground">
        {message.content || `[empty message ${index + 1}]`}
      </pre>
      {message.token_usage ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Input {formatCompactNumber(message.token_usage.input_tokens)}</span>
          <span>Output {formatCompactNumber(message.token_usage.output_tokens)}</span>
          {message.token_usage.reasoning_tokens ? (
            <span>Reasoning {formatCompactNumber(message.token_usage.reasoning_tokens)}</span>
          ) : null}
          {message.token_usage.cached_tokens ? (
            <span>Cached {formatCompactNumber(message.token_usage.cached_tokens)}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function SessionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [messagePage, setMessagePage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<TranscriptRoleFilter>("all");
  const [messageSearch, setMessageSearch] = useState("");

  const sessionQuery = useQuery({
    queryKey: ["session", id, { messagePage }],
    queryFn: () => sessionApi.getSession(id!, { page: messagePage, limit: MESSAGE_PAGE_SIZE }),
    enabled: Boolean(id),
  });

  const checkpointsQuery = useQuery({
    queryKey: ["session-checkpoints", id],
    queryFn: () => sessionApi.listCheckpoints(id!, { page: 1, limit: 6 }),
    enabled: Boolean(id),
  });

  const updateSessionMutation = useMutation({
    mutationFn: (input: UpdateSessionRequest) => sessionApi.updateSession(id!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", id] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["session-stats"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () =>
      sessionApi.resumeSession(id!, {
        last_seen_sequence: sessionQuery.data?.session.last_message_sequence ?? 0,
        message_limit: MESSAGE_PAGE_SIZE,
        client_metadata: { source: "web-session-details" },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", id] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast("Session resume state refreshed.", "success");
    },
    onError: (error) => {
      toast(getErrorMessage(error, "Unable to resume session."), "error");
    },
  });

  const forkMutation = useMutation({
    mutationFn: () =>
      sessionApi.forkSession(id!, {
        include_checkpoints: true,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast(`Fork created with ${formatNumber(result.copied_message_count)} messages.`, "success");
      navigate(ROUTES.DASHBOARD.SESSION_DETAILS(result.session.id));
    },
    onError: (error) => {
      toast(getErrorMessage(error, "Unable to fork session."), "error");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      sessionApi.clearSession(id!, {
        create_checkpoint: true,
      }),
    onSuccess: (result) => {
      setMessagePage(1);
      void queryClient.invalidateQueries({ queryKey: ["session", id] });
      void queryClient.invalidateQueries({ queryKey: ["session-checkpoints", id] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["session-stats"] });
      toast(`Cleared ${formatNumber(result.deleted_message_count)} messages.`, "success");
    },
    onError: (error) => {
      toast(getErrorMessage(error, "Unable to clear session."), "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => sessionApi.deleteSession(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["session-stats"] });
      toast("Session deleted.", "success");
      navigate(ROUTES.DASHBOARD.SESSIONS);
    },
    onError: (error) => {
      toast(getErrorMessage(error, "Unable to delete session."), "error");
    },
  });

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => sessionApi.exportSession(id!, format),
    onSuccess: (result) => {
      triggerFileDownload(result.blob, result.fileName);
      toast("Session export downloaded.", "success");
    },
    onError: (error) => {
      toast(getErrorMessage(error, "Unable to export session."), "error");
    },
  });

  const session = sessionQuery.data?.session;
  const pagination = sessionQuery.data?.messages_pagination;
  const checkpoints = checkpointsQuery.data?.checkpoints ?? [];
  const isWorking =
    updateSessionMutation.isPending ||
    resumeMutation.isPending ||
    forkMutation.isPending ||
    clearMutation.isPending ||
    deleteMutation.isPending ||
    exportMutation.isPending;

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    const messages = session?.messages ?? [];

    return messages.filter((message) => {
      if (roleFilter !== "all" && message.role !== roleFilter) return false;
      if (!query) return true;
      return message.content.toLowerCase().includes(query);
    });
  }, [messageSearch, roleFilter, session?.messages]);

  const firstVisibleSequence = useMemo(() => {
    if (!pagination || !session) return 1;
    const pageEnd = Math.max(0, pagination.total - (pagination.page - 1) * pagination.limit);
    return Math.max(1, pageEnd - session.messages.length + 1);
  }, [pagination, session]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`, "success");
    } catch {
      toast(`Unable to copy ${label.toLowerCase()}.`, "error");
    }
  };

  const handleArchiveToggle = async () => {
    if (!session) return;
    try {
      await updateSessionMutation.mutateAsync({ is_archived: !session.is_archived });
      toast(session.is_archived ? "Session unarchived." : "Session archived.", "success");
    } catch (error) {
      toast(getErrorMessage(error, "Unable to update session."), "error");
    }
  };

  const handlePinToggle = async () => {
    if (!session) return;
    try {
      await updateSessionMutation.mutateAsync({ is_pinned: !session.is_pinned });
      toast(session.is_pinned ? "Session unpinned." : "Session pinned.", "success");
    } catch (error) {
      toast(getErrorMessage(error, "Unable to update session."), "error");
    }
  };

  const handleCopyMessages = () => {
    if (!session) return;
    const text = visibleMessages.map((message) => `[${message.role.toUpperCase()}] ${message.content}`).join("\n\n");
    void copyText(text, "Loaded transcript");
  };

  if (sessionQuery.isLoading && !session) {
    return <SessionDetailsSkeleton />;
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
        <Link
          to={ROUTES.DASHBOARD.SESSIONS}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Sessions
        </Link>
        <section className="rounded-xl border border-nirex-error/30 bg-nirex-error/5 p-6">
          <h1 className="text-lg font-semibold text-nirex-error">Unable to load session</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(sessionQuery.error, "Session not found.")}
          </p>
        </section>
      </div>
    );
  }

  const latestCheckpoint = checkpoints[0];
  const transcriptRange = messageRangeText(pagination, session.messages.length);
  const messageSearchActive = Boolean(messageSearch.trim()) || roleFilter !== "all";

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-5 px-3 mx-auto max-w-7xl">
      <Link
        to={ROUTES.DASHBOARD.SESSIONS}
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back to Sessions
      </Link>

      <PageHeader
        title={session.name}
        description={`${directoryLabel(session.working_directory)} · ${session.model} · ${formatRelativeTime(session.updated_at)}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => resumeMutation.mutate()}
              disabled={isWorking}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <RotateCcw size={14} className={resumeMutation.isPending ? "animate-spin" : ""} />
              Resume
            </button>
            <button
              type="button"
              onClick={() => forkMutation.mutate()}
              disabled={isWorking}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              <Split size={14} />
              Fork
            </button>
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  disabled={isWorking}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  <MoreHorizontal size={15} />
                </button>
              }
            >
              <DropdownItem onClick={() => void copyText(session.id, "Session ID")}>Copy session ID</DropdownItem>
              <DropdownItem onClick={() => void copyText(session.working_directory, "Working directory")}>
                Copy working directory
              </DropdownItem>
              <DropdownItem onClick={handlePinToggle}>
                {session.is_pinned ? "Unpin session" : "Pin session"}
              </DropdownItem>
              <DropdownItem onClick={handleArchiveToggle}>
                {session.is_archived ? "Unarchive session" : "Archive session"}
              </DropdownItem>
              <DropdownItem onClick={() => exportMutation.mutate("json")}>Export JSON</DropdownItem>
              <DropdownItem onClick={() => exportMutation.mutate("markdown")}>Export Markdown</DropdownItem>
              <DropdownItem
                onClick={() => {
                  if (window.confirm("Clear this transcript and keep a checkpoint?")) {
                    clearMutation.mutate();
                  }
                }}
              >
                Clear transcript
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  if (window.confirm("Delete this session permanently? This cannot be undone.")) {
                    deleteMutation.mutate();
                  }
                }}
                className="text-destructive"
              >
                Delete permanently
              </DropdownItem>
            </Dropdown>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={session.is_archived ? "archived" : "active"} />
        {session.is_pinned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-nirex-accent/25 bg-nirex-accent/10 px-2.5 py-1 text-xs font-medium text-nirex-accent">
            <Pin size={12} />
            Pinned
          </span>
        ) : null}
        {session.source ? (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {session.source}
          </span>
        ) : null}
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {shortId(session.id)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Messages"
          value={formatNumber(session.message_count)}
          change={transcriptRange}
          changeType="neutral"
          icon={MessageSquare}
          variant="compact"
        />
        <KpiCard
          title="Tokens"
          value={formatCompactNumber(session.token_usage.total_tokens)}
          change={`${formatCompactNumber(session.token_usage.reasoning_tokens ?? 0)} reasoning`}
          changeType="neutral"
          icon={Clock}
          variant="compact"
        />
        <KpiCard
          title="Checkpoints"
          value={formatNumber(session.checkpoint_count ?? checkpointsQuery.data?.pagination.total ?? 0)}
          change={session.latest_checkpoint_at ? formatRelativeTime(session.latest_checkpoint_at) : "None yet"}
          changeType="neutral"
          icon={History}
          variant="compact"
        />
        <KpiCard
          title="Resumes"
          value={formatNumber(session.resume_count ?? 0)}
          change={session.last_resumed_at ? formatRelativeTime(session.last_resumed_at) : "Not resumed"}
          changeType="neutral"
          icon={RotateCcw}
          variant="compact"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Transcript</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {transcriptRange}. Page 1 is the newest transcript window.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    void sessionQuery.refetch();
                    void checkpointsQuery.refetch();
                  }}
                  disabled={sessionQuery.isFetching || checkpointsQuery.isFetching}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  <RefreshCw size={14} className={sessionQuery.isFetching ? "animate-spin" : ""} />
                  Refresh
                </button>
                <Dropdown
                  align="right"
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <Download size={14} />
                      Export
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  }
                >
                  <DropdownItem onClick={() => exportMutation.mutate("json")}>Export JSON</DropdownItem>
                  <DropdownItem onClick={() => exportMutation.mutate("markdown")}>Export Markdown</DropdownItem>
                  <DropdownItem onClick={handleCopyMessages}>Copy loaded messages</DropdownItem>
                </Dropdown>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <input
                  type="search"
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  placeholder="Search loaded messages..."
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="inline-flex rounded-lg border border-border bg-background p-1">
                {roleFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRoleFilter(filter.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                      roleFilter === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileText size={22} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">No messages in this view</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {messageSearchActive
                    ? "Try another role filter or search term for the loaded transcript page."
                    : "This session has not recorded any messages yet."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {visibleMessages.map((message, index) => {
                const originalIndex = session.messages.findIndex((item) => item.id === message.id);
                const sequenceNumber = firstVisibleSequence + Math.max(0, originalIndex >= 0 ? originalIndex : index);
                return (
                  <MessageItem
                    key={message.id || `${message.role}-${index}`}
                    message={message}
                    index={index}
                    sequenceNumber={sequenceNumber}
                    onCopy={() => void copyText(message.content, "Message")}
                  />
                );
              })}
            </div>
          )}

          {pagination && pagination.total_pages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Transcript page {formatNumber(pagination.page)} of {formatNumber(pagination.total_pages)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMessagePage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || sessionQuery.isFetching}
                  className="rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Newer
                </button>
                <button
                  type="button"
                  onClick={() => setMessagePage((current) => Math.min(pagination.total_pages, current + 1))}
                  disabled={!pagination.has_more || sessionQuery.isFetching}
                  className="rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Older
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold">Session State</h2>
            <div className="mt-3 divide-y divide-border">
              <MetadataRow label="Created" value={formatDate(session.created_at)} />
              <MetadataRow label="Updated" value={formatDateTime(session.updated_at)} />
              <MetadataRow label="Last message" value={formatDateTime(session.last_message_at)} />
              <MetadataRow label="Last resumed" value={formatDateTime(session.last_resumed_at)} />
              <MetadataRow label="Model" value={session.model} mono />
              <MetadataRow label="Directory" value={directoryLabel(session.working_directory)} />
              <MetadataRow label="Working hash" value={shortId(session.working_directory_hash)} mono />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Lineage</h2>
              {session.branch_depth ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  depth {formatNumber(session.branch_depth)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 divide-y divide-border">
              <MetadataRow label="Source" value={session.source ?? "api"} />
              <MetadataRow label="Git branch" value={session.git_branch ?? "None"} />
              <MetadataRow label="Root" value={shortId(session.root_session_id ?? session.id)} mono />
              <MetadataRow label="Parent" value={shortId(session.parent_session_id)} mono />
              <MetadataRow
                label="Branch point"
                value={
                  session.branch_point_sequence !== undefined
                    ? `Message ${formatNumber(session.branch_point_sequence)}`
                    : "None"
                }
              />
            </div>
            {session.parent_session_id ? (
              <button
                type="button"
                onClick={() => navigate(ROUTES.DASHBOARD.SESSION_DETAILS(session.parent_session_id!))}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <GitBranch size={14} />
                Open parent
              </button>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Checkpoints</h2>
              <span className="text-xs text-muted-foreground">
                {formatNumber(checkpointsQuery.data?.pagination.total ?? session.checkpoint_count ?? 0)} saved
              </span>
            </div>

            {checkpointsQuery.isLoading ? (
              <div className="mt-3 space-y-3">
                <Skeleton className="h-20 w-full" variant="default" />
                <Skeleton className="h-20 w-full" variant="default" />
              </div>
            ) : checkpoints.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No checkpoints have been saved for this session.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {checkpoints.map((checkpoint) => (
                  <CheckpointItem key={checkpoint.id} checkpoint={checkpoint} />
                ))}
              </div>
            )}

            {latestCheckpoint ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Latest checkpoint was saved {formatRelativeTime(latestCheckpoint.created_at)}.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => void copyText(session.id, "Session ID")}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy size={14} />
                  Copy ID
                </span>
              </button>
              <button
                type="button"
                onClick={() => exportMutation.mutate("markdown")}
                disabled={exportMutation.isPending}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={14} />
                  Markdown export
                </span>
              </button>
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={updateSessionMutation.isPending}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Archive size={14} />
                  {session.is_archived ? "Unarchive" : "Archive"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this session permanently? This cannot be undone.")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-nirex-error/30 px-3 py-2 text-sm font-medium text-nirex-error hover:bg-nirex-error/5 disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={14} />
                  Delete permanently
                </span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
