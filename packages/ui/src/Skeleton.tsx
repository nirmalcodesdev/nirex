import { cn } from "@nirex/shared";
import type { CSSProperties } from "react";

interface SkeletonProps {
    className?: string;
    variant?: "default" | "circle" | "text" | "card";
    style?: CSSProperties;
}

export function Skeleton({ className, variant = "default", style }: SkeletonProps) {
    const baseStyles = "animate-pulse bg-muted";

    const variants = {
        default: "rounded-md",
        circle: "rounded-full",
        text: "rounded-sm",
        card: "rounded-xl",
    };

    return (
        <div
            className={cn(baseStyles, variants[variant], className)}
            style={style}
            aria-hidden="true"
        />
    );
}

// Shimmer variant with gradient animation
export function SkeletonShimmer({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-md bg-muted",
                className
            )}
            aria-hidden="true"
        >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent" />
        </div>
    );
}

// Pre-built skeleton layouts
export function CardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" variant="default" />
                <Skeleton className="h-4 w-24" variant="text" />
            </div>
            <Skeleton className="h-8 w-32" variant="text" />
            <Skeleton className="h-3 w-20" variant="text" />
        </div>
    );
}

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
    return (
        <div className="flex items-center gap-4 py-3 px-4">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn("h-4", i === 0 ? "w-24" : i === columns - 1 ? "w-8" : "flex-1")}
                    variant="text"
                />
            ))}
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" variant="text" />
                <Skeleton className="h-8 w-8 rounded-lg" variant="default" />
            </div>
            <Skeleton className="h-[220px] w-full" variant="card" />
        </div>
    );
}
