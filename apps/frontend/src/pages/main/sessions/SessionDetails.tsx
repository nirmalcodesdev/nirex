// Session Details Page - Individual session view
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Calendar,
  User,
  Copy,
  MoreHorizontal,
  ArrowLeft,
  Terminal,
  Trash2,
  Archive,
  Activity,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { sessionApi } from "../../../features/sessions/sessionApi";
import { formatDate, formatRelativeTime } from "@nirex/shared";
import type { ChatMessage, MessageRole } from "@nirex/shared";

// Simple loading skeleton
function SessionDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto max-w-7xl">
      <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      <div className="h-40 bg-muted rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-xl animate-pulse" />
    </div>
  );
}

function getRoleColor(role: MessageRole) {
  switch (role) {
    case "system":
      return "text-nirex-accent opacity-70";
    case "assistant":
      return "text-nirex-success";
    case "user":
      return "text-nirex-accent";
    default:
      return "text-nirex-text-secondary";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export function SessionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getSession(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => sessionApi.deleteSession(id!),
    onSuccess: () => {
      toast("Session deleted successfully", "success");
      navigate("/sessions");
    },
    onError: (err) => {
      toast(getErrorMessage(err, "Failed to delete session"), "error");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (is_archived: boolean) => sessionApi.updateSession(id!, { is_archived }),
    onSuccess: (response) => {
      toast(response.session.is_archived ? "Session archived" : "Session unarchived", "success");
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
    onError: (err) => {
      toast(getErrorMessage(err, "Action failed"), "error");
    },
  });

  if (isLoading) {
    return <SessionDetailsSkeleton />;
  }

  if (error || !data?.session) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">
          {getErrorMessage(error, "Session not found")}
        </p>
        <Link to="/sessions" className="mt-4 text-sm text-muted-foreground hover:text-foreground underline inline-block">
          Back to Sessions
        </Link>
      </div>
    );
  }

  const { session } = data;

  const handleCopyId = () => {
    navigator.clipboard.writeText(session.id);
    toast("Session ID copied to clipboard", "success");
  };

  const handleCopyMessages = () => {
    const text = session.messages.map((m) => `[${m.role.toUpperCase()}] ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast("Messages copied to clipboard", "success");
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 py-2 sm:py-4 lg:py-6 px-3 mx-auto max-w-7xl">
      {/* Back Link */}
      <Link
        to="/sessions"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Back to Sessions
      </Link>

      {/* Session Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl font-semibold tracking-tight font-mono">
                {session.id.substring(0, 12)}...
              </h1>
              <StatusBadge status={session.is_archived ? "archived" : "active"} showIcon={false} />
            </div>
            <div className="flex items-center gap-2 text-sm font-mono bg-muted px-3 py-2 rounded-lg border border-border w-fit">
              <Terminal size={14} className="text-muted-foreground" />
              <span>{session.name}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyId}
              className="flex items-center gap-2 bg-background border border-border hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy ID</span>
            </button>
            <button
              type="button"
              onClick={() => archiveMutation.mutate(!session.is_archived)}
              className="flex items-center gap-2 bg-background border border-border hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Archive size={16} />
              <span className="hidden sm:inline">{session.is_archived ? "Unarchive" : "Archive"}</span>
            </button>
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-2 bg-background border border-border hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              }
            >
              <DropdownItem onClick={() => toast("Export functionality coming soon", "info")}>
                Export Session
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  if (confirm("Are you sure you want to delete this session?")) {
                    deleteMutation.mutate();
                  }
                }}
                className="text-destructive"
              >
                <div className="flex items-center gap-2">
                  <Trash2 size={14} />
                  Delete Permanently
                </div>
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetadataCard icon={Terminal} label="Model" value={session.model} mono />
        <MetadataCard icon={User} label="Messages" value={session.message_count.toString()} />
        <MetadataCard icon={Calendar} label="Created" value={formatDate(new Date(session.created_at))} />
        <MetadataCard icon={Clock} label="Last Updated" value={formatRelativeTime(new Date(session.updated_at))} />
        <MetadataCard icon={Terminal} label="Directory" value={session.working_directory.split(/[\\/]/).pop() || "/"} />
        <MetadataCard
          icon={Activity}
          label="Tokens"
          value={session.token_usage.total_tokens.toLocaleString()}
        />
      </div>

      {/* Logs Terminal */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-nirex-error/80" />
              <div className="w-3 h-3 rounded-full bg-nirex-warning/80" />
              <div className="w-3 h-3 rounded-full bg-nirex-success/80" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Conversation History
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyMessages}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy size={14} /> Copy All
          </button>
        </div>

        {/* Terminal Content */}
        <div className="p-4 overflow-x-auto font-mono text-sm leading-relaxed bg-nirex-void min-h-[400px]">
          {session.messages.map((msg: ChatMessage, index: number) => (
            <div key={msg.id || index} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRoleColor(msg.role)} border-current opacity-80`}>
                  {msg.role}
                </span>
                <span className="text-[10px] text-muted-foreground opacity-50">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-nirex-text-secondary whitespace-pre-wrap pl-2 border-l border-border/20 ml-1">
                {msg.content}
              </div>
            </div>
          ))}
          {session.messages.length === 0 && (
            <div className="text-muted-foreground italic text-center py-12">
              No messages in this session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetadataCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}

function MetadataCard({ icon: Icon, label, value, mono }: MetadataCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
        <Icon size={14} /> {label}
      </div>
      <div className={`font-semibold truncate ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </div>
    </div>
  );
}
