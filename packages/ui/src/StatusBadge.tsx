import type { LucideIcon } from "lucide-react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: LucideIcon;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ label, variant = "default", icon: Icon, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  );
}
