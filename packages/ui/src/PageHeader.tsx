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
    titleClassName = "text-2xl sm:text-3xl font-semibold tracking-tight mb-1 sm:mb-2",
    descriptionClassName = "text-sm sm:text-base text-muted-foreground",
}: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className={titleClassName}>{title}</h1>
                <p className={descriptionClassName}>{description}</p>
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}
