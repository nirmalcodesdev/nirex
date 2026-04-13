import { BsActivity, BsArrowDownRight, BsArrowUpRight } from "react-icons/bs";

export type KpiChangeType = "positive" | "negative" | "neutral";
export type KpiLayoutVariant = "default" | "compact";

interface KpiCardProps {
    title: string;
    value: string;
    change: string;
    changeType: KpiChangeType;
    icon: any;
    variant?: KpiLayoutVariant;
    changeContext?: string;
}

const changeColors: Record<KpiChangeType, string> = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
};

const iconBackgrounds: Record<KpiChangeType, string> = {
    positive: "bg-emerald-500/10",
    negative: "bg-red-500/10",
    neutral: "bg-muted",
};

export function KpiCard({
    title,
    value,
    change,
    changeType,
    icon: Icon,
    variant = "default",
    changeContext,
}: KpiCardProps) {
    const ChangeIcon =
        changeType === "positive"
            ? BsArrowUpRight
            : changeType === "negative"
                ? BsArrowDownRight
                : BsActivity;

    if (variant === "compact") {
        return (
            <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${iconBackgrounds[changeType]}`}>
                        <Icon size={18} className={changeColors[changeType]} />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${changeColors[changeType]}`}>
                        <ChangeIcon size={12} />
                        <span>{change}</span>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold tracking-tight">{value}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
                <Icon size={18} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{title}</p>
            </div>
            <div className="space-y-1">
                <p className="text-2xl font-semibold">{value}</p>
                <div className={`flex items-center gap-1 text-xs font-medium ${changeColors[changeType]}`}>
                    <ChangeIcon size={12} />
                    <span>{change}</span>
                    {changeContext && <span className="text-muted-foreground font-normal">{changeContext}</span>}
                </div>
            </div>
        </div>
    );
}
