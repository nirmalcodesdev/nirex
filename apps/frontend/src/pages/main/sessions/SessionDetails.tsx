// Session Details Page - Individual session view
import { Link, useParams } from "react-router-dom";
import {
  Clock,
  Calendar,
  User,
  Copy,
  MoreHorizontal,
  RefreshCw,
  ArrowLeft,
  Terminal,
} from "lucide-react";
import { Dropdown, DropdownItem } from "@nirex/ui";
import { useToast } from "../../../components/ToastProvider";
import { useSimulatedLoading } from "../../../hooks/useSimulatedLoading";
import { StatusBadge } from "../../../components/ui/StatusBadge";

interface SessionLog {
  line: string;
  type: "default" | "error" | "success" | "command";
}

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

const sessionData = {
  id: "ses_1a2b3c",
  command: "npm run build",
  status: "success" as const,
  duration: "45s",
  user: "john@example.com",
  date: "Oct 12, 2026, 14:32:01 UTC",
  environment: "Node.js v20.x (Ubuntu 22.04)",
  project: "nirex-app",
  branch: "main",
  commit: "a1b2c3d",
  logs: [
    { line: "[14:32:01] > nirex-app@1.0.0 build", type: "command" },
    { line: "[14:32:01] > tsc && vite build", type: "command" },
    { line: "[14:32:04] vite v6.2.0 building for production...", type: "default" },
    { line: "[14:32:05] transforming...", type: "default" },
    { line: "[14:32:20] ✓ 1245 modules transformed.", type: "success" },
    { line: "[14:32:25] rendering chunks...", type: "default" },
    { line: "[14:32:30] computing gzip size...", type: "default" },
    { line: "[14:32:45] dist/index.html                   0.45 kB │ gzip:  0.29 kB", type: "default" },
    { line: "[14:32:45] dist/assets/index-D8g7y2.css     12.30 kB │ gzip:  3.12 kB", type: "default" },
    { line: "[14:32:45] dist/assets/index-B4k9m1.js     145.20 kB │ gzip: 45.80 kB", type: "default" },
    { line: "[14:32:46] ✓ built in 45.12s", type: "success" },
  ] as SessionLog[],
};

function getLogColor(type: SessionLog["type"]) {
  switch (type) {
    case "error":
      return "text-nirex-error";
    case "success":
      return "text-nirex-success";
    case "command":
      return "text-nirex-accent";
    default:
      return "text-nirex-text-secondary";
  }
}

export function SessionDetails() {
  const { id } = useParams();
  const isLoading = useSimulatedLoading();
  const { toast } = useToast();

  if (isLoading) {
    return <SessionDetailsSkeleton />;
  }

  const session = { ...sessionData, id: id || sessionData.id };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(session.command);
    toast("Command copied to clipboard", "success");
  };

  const handleCopyLogs = () => {
    const logsText = session.logs.map((log) => log.line).join("\n");
    navigator.clipboard.writeText(logsText);
    toast("Logs copied to clipboard", "success");
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
                {session.id}
              </h1>
              <StatusBadge status={session.status} showIcon={false} />
            </div>
            <div className="flex items-center gap-2 text-sm font-mono bg-muted px-3 py-2 rounded-lg border border-border w-fit">
              <Terminal size={14} className="text-muted-foreground" />
              <span>{session.command}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCommand}
              className="flex items-center gap-2 bg-background border border-border hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy</span>
            </button>
            <button
              type="button"
              onClick={() => toast("Re-running session...", "info")}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Re-run</span>
            </button>
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-2 bg-background border border-border hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              }
            >
              <DropdownItem onClick={() => toast("Exporting logs...", "info")}>
                Export Logs
              </DropdownItem>
              <DropdownItem onClick={() => toast("Sharing session...", "info")}>
                Share Session
              </DropdownItem>
              <DropdownItem
                onClick={() => toast("Session deleted", "success")}
                className="text-destructive"
              >
                Delete
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetadataCard icon={Clock} label="Duration" value={session.duration} />
        <MetadataCard icon={User} label="User" value={session.user} />
        <MetadataCard icon={Calendar} label="Date" value={session.date} />
        <MetadataCard icon={Terminal} label="Project" value={session.project} />
        <MetadataCard icon={Terminal} label="Branch" value={session.branch} />
        <MetadataCard
          icon={Terminal}
          label="Commit"
          value={session.commit}
          mono
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
              Execution Logs
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLogs}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy size={14} /> Copy
          </button>
        </div>

        {/* Terminal Content */}
        <div className="p-4 overflow-x-auto font-mono text-sm leading-relaxed bg-nirex-void">
          {session.logs.map((log, index) => (
            <div key={index} className="whitespace-pre">
              <span className={getLogColor(log.type)}>{log.line}</span>
            </div>
          ))}
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
