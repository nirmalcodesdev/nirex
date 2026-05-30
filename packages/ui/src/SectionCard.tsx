import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  iconClassName?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function SectionCard({
  title,
  icon: Icon,
  iconClassName = "text-primary",
  headerAction,
  children,
  className = "",
  footer,
}: SectionCardProps) {
  return (
    <div className={`bg-card border border-border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex items-center justify-center w-7 h-7 bg-muted/60">
              <Icon size={15} className={iconClassName} strokeWidth={2} />
            </div>
          )}
          <h2 className="text-sm font-semibold text-foreground tracking-tight font-display">{title}</h2>
        </div>
        {headerAction ? <div className="flex items-center gap-2">{headerAction}</div> : null}
      </div>
      
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
      
      {/* Footer */}
      {footer ? (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
