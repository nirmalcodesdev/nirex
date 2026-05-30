import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description: string;
    actions?: ReactNode;
    titleClassName?: string;
    descriptionClassName?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    titleClassName = "text-2xl sm:text-3xl font-semibold tracking-tight mb-1 sm:mb-2 font-display",
    descriptionClassName = "text-sm sm:text-base text-muted-foreground",
}: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-6 w-[3px] bg-gradient-to-b from-primary to-primary/30" />
                    <h1 className={titleClassName}>{title}</h1>
                </div>
                <p className={`pl-[15px] ${descriptionClassName}`}>{description}</p>
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}
