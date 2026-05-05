import { cn } from "@nirex/shared";
import { User } from "lucide-react";

interface UserAvatarProps {
    className?: string;
    showStatusIndicator?: boolean;
    name?: string | undefined;
}

function getInitials(name: string | undefined): string {
    if (!name) return "";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function UserAvatar({ className, showStatusIndicator = false, name }: UserAvatarProps) {
    const initials = getInitials(name);

    return (
        <div className={cn("relative", className)}>
            <div className={cn(
                "w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden",
                className
            )}>
                {initials ? (
                    <span className="text-[0.7em] font-semibold text-white">{initials}</span>
                ) : (
                    <User className="w-1/2 h-1/2 text-white/80" />
                )}
            </div>
            {showStatusIndicator && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
            )}
        </div>
    );
}
