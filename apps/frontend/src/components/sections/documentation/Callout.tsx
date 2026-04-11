import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";
import type { CalloutProps, CalloutType } from "@/types/documentation.types";

const styles: Record<CalloutType, {
    bg: string;
    border: string;
    icon: typeof Info;
    iconColor: string;
    titleColor: string;
}> = {
    info: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        icon: Info,
        iconColor: "text-blue-500",
        titleColor: "text-blue-400",
    },
    warning: {
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        icon: AlertTriangle,
        iconColor: "text-amber-500",
        titleColor: "text-amber-400",
    },
    tip: {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        icon: Lightbulb,
        iconColor: "text-emerald-500",
        titleColor: "text-emerald-400",
    },
    error: {
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        icon: AlertCircle,
        iconColor: "text-red-500",
        titleColor: "text-red-400",
    },
};

export function Callout({ type = "info", title, children }: CalloutProps) {
    const style = styles[type];
    const Icon = style.icon;

    return (
        <div className={`rounded-xl border ${style.border} ${style.bg} p-4 my-6`}>
            <div className="flex gap-3">
                <Icon className={`shrink-0 ${style.iconColor}`} size={20} />
                <div className="flex-1">
                    {title && (
                        <p className={`font-semibold text-sm mb-1 ${style.titleColor}`}>
                            {title}
                        </p>
                    )}
                    <div className="text-sm text-foreground/80 leading-relaxed">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
