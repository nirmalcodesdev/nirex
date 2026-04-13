import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { cn } from "@nirex/shared";

type Status = "success" | "failed" | "running" | "pending";

interface StatusBadgeProps {
    status: Status;
    showIcon?: boolean;
    className?: string;
}

const statusConfig: Record<Status, { label: string; icon: typeof CheckCircle2; colors: string }> = {
    success: {
        label: "Success",
        icon: CheckCircle2,
        colors: "bg-nirex-success/10 text-nirex-success border-nirex-success/20",
    },
    failed: {
        label: "Failed",
        icon: XCircle,
        colors: "bg-nirex-error/10 text-nirex-error border-nirex-error/20",
    },
    running: {
        label: "Running",
        icon: Loader2,
        colors: "bg-nirex-accent/10 text-nirex-accent border-nirex-accent/20",
    },
    pending: {
        label: "Pending",
        icon: Clock,
        colors: "bg-nirex-warning/10 text-nirex-warning border-nirex-warning/20",
    },
};

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                config.colors,
                className
            )}
        >
            {showIcon && <Icon size={12} className={status === "running" ? "animate-spin" : ""} />}
            {config.label}
        </span>
    );
}
