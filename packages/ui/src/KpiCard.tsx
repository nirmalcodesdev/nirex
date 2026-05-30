import { BsArrowDownRight, BsArrowUpRight } from "react-icons/bs";

export type KpiChangeType = "positive" | "negative" | "neutral";
export type KpiLayoutVariant = "default" | "compact";

interface KpiCardProps {
    title: string;
    value: string;
    change: string;
    changeType: KpiChangeType;
    variant?: KpiLayoutVariant;
    changeContext?: string;
    backgroundClass?: string;
}

const changeColors: Record<KpiChangeType, string> = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
};

const dotColors: Record<KpiChangeType, string> = {
    positive: "bg-emerald-500",
    negative: "bg-red-500",
    neutral: "bg-slate-400 dark:bg-slate-500",
};

const gradientColors: Record<KpiChangeType, string> = {
    positive: "from-emerald-500/70 via-emerald-500/20 to-transparent",
    negative: "from-red-500/70 via-red-500/20 to-transparent",
    neutral: "from-slate-400/50 via-slate-400/10 to-transparent dark:from-slate-500/50 dark:via-slate-500/10",
};

export function KpiCard({
    title,
    value,
    change,
    changeType,
    variant = "default",
    changeContext,
    backgroundClass = "bg-card",
}: KpiCardProps) {
    const ChangeIcon =
        changeType === "positive"
            ? BsArrowUpRight
            : changeType === "negative"
                ? BsArrowDownRight
                : null;

    if (variant === "compact") {
        return (
            <div className={`relative ${backgroundClass} border border-border p-4 overflow-hidden`}>
                {/* Top gradient accent */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradientColors[changeType]}`} />
                {/* Status dot */}
                <div className="absolute top-3 right-3">
                    <div className={`w-2 h-2 ${dotColors[changeType]} rounded-full ring-2 ring-background`} />
                </div>

                <p className="text-sm text-muted-foreground pr-4">{title}</p>
                <p className="text-2xl font-semibold tracking-tight mt-1 font-mono">{value}</p>
                <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${changeColors[changeType]}`}>
                    {ChangeIcon && <ChangeIcon size={12} />}
                    <span>{change}</span>
                    {changeContext && <span className="text-muted-foreground font-normal">{changeContext}</span>}
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${backgroundClass} border border-border p-4 overflow-hidden`}>
            {/* Top gradient accent */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradientColors[changeType]}`} />
            {/* Status dot */}
            <div className="absolute top-3 right-3">
                <div className={`w-2 h-2 ${dotColors[changeType]} rounded-full ring-2 ring-background`} />
            </div>

            <p className="text-sm text-muted-foreground pr-4">{title}</p>
            <p className="text-2xl font-semibold mt-1 font-mono">{value}</p>
            <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${changeColors[changeType]}`}>
                {ChangeIcon && <ChangeIcon size={12} />}
                <span>{change}</span>
                {changeContext && <span className="text-muted-foreground font-normal">{changeContext}</span>}
            </div>
        </div>
    );
}
