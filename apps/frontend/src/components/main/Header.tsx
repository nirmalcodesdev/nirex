import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// Removed framer-motion: no animations in core dashboard chrome
import {
    Search,
    Bell,
    Check,
    Settings,
    Command,
    Menu,
    Activity,
    Zap,
    CreditCard,
    BookOpen,
    AlertTriangle,
    CheckCircle2,
    CircleAlert,
    RefreshCw,
    XCircle,
    LogOut,
    User,
    ChevronDown,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { useSidebar } from "./Sidebar";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useClickOutside } from "../../hooks/useClickOutside";
import { APP_NAME, APP_NAME_SUFFIX, type NotificationItem } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { signOutUser } from "../../features/auth/authSlice";
import { ROUTES } from "../../constant/routes";
import {
    useMarkAllNotificationsReadMutation,
    useNotificationsQuery,
} from "../../features/notifications/useNotifications";
import { useRealtimeNotifications } from "../../features/realtime/useRealtimeNotifications";
import { useAutoMarkAsRead } from "../../features/notifications/useAutoMarkAsRead";

const searchItems = [
    { id: "dashboard", label: "Dashboard", path: "/", icon: Activity },
    { id: "usage", label: "Usage", path: "/usage", icon: Zap },
    { id: "billing", label: "Billing", path: "/billing", icon: CreditCard },
    { id: "settings", label: "Settings", path: "/settings", icon: Settings },
    { id: "documentation", label: "Documentation", path: "/documentation", icon: BookOpen },
];

function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered =
        query.trim() === ""
            ? searchItems
            : searchItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

    const resetAndClose = () => {
        setQuery("");
        setSelectedIndex(0);
        onClose();
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
        } else if (event.key === "Enter" && filtered[selectedIndex]) {
            event.preventDefault();
            navigate(filtered[selectedIndex].path);
            resetAndClose();
        } else if (event.key === "Escape") {
            resetAndClose();
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const focusTimer = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
        return () => window.clearTimeout(focusTimer);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" role="dialog" aria-modal="true" aria-label="Search">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-xl bg-popover border border-border shadow-modal overflow-hidden"
                onKeyDown={handleKeyDown}
            >
                {/* Search input header */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                    <Search size={18} className="text-muted-foreground shrink-0" strokeWidth={2} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search pages..."
                        className="flex-1 bg-transparent border-none outline-none px-0 py-0 text-foreground placeholder:text-muted-foreground text-base font-normal caret-primary"
                        aria-label="Search pages"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted border border-border px-2 py-1 font-mono shrink-0 select-none">ESC</kbd>
                </div>

                {/* Results list */}
                <div className="max-h-80 overflow-y-auto py-2">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 flex flex-col items-center gap-2">
                            <Search size={32} className="text-muted-foreground/40" strokeWidth={1.5} />
                            <p className="text-sm text-muted-foreground">No results found</p>
                            <p className="text-xs text-muted-foreground/60">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="px-2">
                            {filtered.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        navigate(item.path);
                                        onClose();
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors rounded-sm ${ index === selectedIndex ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/50" }`}
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 shrink-0 ${ index === selectedIndex ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground" }`}>
                                        <item.icon size={16} />
                                    </div>
                                    <span className="flex-1 font-medium">{item.label}</span>
                                    {index === selectedIndex && (
                                        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline-flex items-center gap-0.5">
                                            <kbd className="bg-muted border border-border px-1 py-0.5">↵</kbd>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="hidden sm:flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <kbd className="bg-muted border border-border px-1 py-0.5 font-mono text-[10px]">↑</kbd>
                            <kbd className="bg-muted border border-border px-1 py-0.5 font-mono text-[10px]">↓</kbd>
                            <span>to navigate</span>
                        </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <kbd className="bg-muted border border-border px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
                        <span>to select</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

function NotificationsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    // Realtime push: socket events update the query cache directly, so the
    // dropdown stays current without polling. A long-interval refetch acts
    // as a belt-and-suspenders backfill in case the socket misses an event.
    useRealtimeNotifications();

    // Auto-read pipeline: rows visible inside the open dropdown for >1.5s
    // get batched into one PATCH /notifications/read request.
    const { observe: observeRef, flush: flushAutoRead } = useAutoMarkAsRead();

    const {
        data: notifications,
        isFetching,
        refetch,
    } = useNotificationsQuery(
        {
            limit: 4,
            includeRead: true,
            includeArchived: false,
        },
        {
            refetchInterval: 5 * 60_000,
        },
    );
    const markAllReadMutation = useMarkAllNotificationsReadMutation();

    useClickOutside(ref, () => {
        if (isOpen) {
            // Flush any pending auto-read batch before the dropdown unmounts
            // so a quick open/close still lands the read writes.
            flushAutoRead();
        }
        setIsOpen(false);
    });

    const unreadCount = notifications?.unread_count ?? 0;
    const recentNotifications = notifications?.items ?? [];

    const formatTime = (value: string) =>
        new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));

    const getSeverityMeta = (severity: NotificationItem["severity"]) => {
        switch (severity) {
            case "success":
                return { Icon: CheckCircle2, iconClass: "text-nirex-success" };
            case "warning":
                return { Icon: AlertTriangle, iconClass: "text-nirex-warning" };
            case "error":
                return { Icon: XCircle, iconClass: "text-nirex-error" };
            default:
                return { Icon: CircleAlert, iconClass: "text-nirex-accent" };
        }
    };

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="relative p-2 hover:bg-muted text-muted-foreground hover:text-foreground" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`} aria-expanded={isOpen} aria-haspopup="true">
                <Bell size={20} aria-hidden="true" />
                {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-nirex-accent text-[10px] leading-[18px] text-white text-center font-medium" aria-hidden="true">
                        {Math.min(unreadCount, 99)}
                    </span>
                ) : null}
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-popover border border-border shadow-elevated z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                            <h3 className="font-semibold text-sm">
                                Notifications
                                {unreadCount > 0 ? (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {unreadCount} unread
                                    </span>
                                ) : null}
                            </h3>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (unreadCount > 0) {
                                        try {
                                            const result = await markAllReadMutation.mutateAsync();
                                            if (result.updated_count > 0) {
                                                toast("Marked all as read.", "success");
                                            } else {
                                                toast("All notifications are already read.", "info");
                                            }
                                        } catch (error) {
                                            toast(
                                                error instanceof Error
                                                    ? error.message
                                                    : "Unable to mark notifications as read.",
                                                "error",
                                            );
                                        }
                                        return;
                                    }

                                    toast("Refreshing notifications...", "info");
                                    void refetch();
                                }}
                                className="inline-flex items-center gap-1 text-xs text-nirex-accent"
                            >
                                {unreadCount > 0 ? (
                                    <Check size={12} />
                                ) : (
                                    <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
                                )}
                                {unreadCount > 0
                                    ? markAllReadMutation.isPending
                                        ? "Updating..."
                                        : "Mark all read"
                                    : "Refresh"}
                            </button>
                        </div>
                        <div className="p-2">
                            {recentNotifications.length > 0 ? (
                                <>
                                    <div className="max-h-[min(360px,calc(100vh-12rem))] overflow-y-auto">
                                        {recentNotifications.map((notification) => {
                                            const { Icon, iconClass } = getSeverityMeta(notification.severity);

                                            return (
                                                <article
                                                    key={notification.id}
                                                    ref={(el) => observeRef(el, notification.id, !notification.read_at)}
                                                    className="px-3 py-2 hover:bg-muted transition-colors duration-150"
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <Icon size={14} className={`mt-0.5 shrink-0 ${iconClass}`} />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">
                                                                {notification.title}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {notification.message}
                                                            </p>
                                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                                {formatTime(notification.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate("/notifications");
                                            setIsOpen(false);
                                        }}
                                        className="mt-2 w-full border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors duration-150"
                                    >
                                        View all notifications
                                    </button>
                                </>
                            ) : (
                                <div className="px-3 py-6 flex flex-col items-center gap-2">
                                    <Bell size={20} className="text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground">No recent notifications</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function ProfileDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { toast } = useToast();
    const user = useAppSelector((state) => state.auth.user);

    useClickOutside(ref, () => setIsOpen(false));

    const handleSignOut = () => {
        void dispatch(signOutUser()).then(() => {
            toast("Signed out", "success");
            navigate(ROUTES.AUTH.SIGNIN, { replace: true });
        });
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 hover:bg-muted"
                aria-label="Open profile menu"
                aria-expanded={isOpen}
            >
                <UserAvatar className="w-8 h-8" name={user?.fullName} showStatusIndicator />
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border shadow-elevated z-50">
                    <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-sm font-medium text-foreground">{user?.fullName || "User"}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="py-1">
                        <button
                            type="button"
                            onClick={() => { navigate("/settings"); setIsOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                        >
                            <User size={14} className="text-muted-foreground" />
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => { navigate("/settings"); setIsOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                        >
                            <Settings size={14} className="text-muted-foreground" />
                            Settings
                        </button>
                    </div>
                    <div className="border-t border-border py-1">
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted text-left"
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function Header() {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { open, toggleCollapse, isCollapsed } = useSidebar();
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "k") {
                event.preventDefault();
                setIsSearchOpen(true);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "b") {
                event.preventDefault();
                toggleCollapse();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [toggleCollapse]);

    return (
        <>
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 border-b border-border bg-background">
                <div className="flex items-center justify-between h-full px-4">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={open} className="p-2 -ml-2 hover:bg-muted " aria-label="Open navigation menu">
                            <Menu size={20} />
                        </button>
                        <Link to="/" className="flex items-center gap-2.5">
                            <img src={nirexLogo} alt="" className="w-8 h-8" />
                            <div className="flex items-center gap-0">
                                <span className="font-display font-bold text-lg">{APP_NAME}</span>
                                {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
                            </div>
                        </Link>
                    </div>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => navigate("/documentation")} className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Documentation">
                            <BookOpen size={20} />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button type="button" onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-muted text-muted-foreground" aria-label="Search">
                            <Search size={20} />
                        </button>
                        <ProfileDropdown />
                    </div>
                </div>
            </header>

            <header className="hidden lg:flex fixed top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur transition-all duration-300" style={{ left: isCollapsed ? '72px' : '240px', right: 0 }}>
                <div className="flex items-center justify-between h-full px-4 w-full">
                    <div className="flex-1 max-w-2xl">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen(true)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Open search"
                        >
                            <Search size={16} aria-hidden="true" className="shrink-0" />
                            <span className="flex-1 text-left text-sm">Search</span>
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground bg-muted border border-border font-mono">
                                <Command size={10} aria-hidden="true" />K
                            </kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                    <button
                        type="button"
                        onClick={() => navigate("/documentation")}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Documentation"
                        aria-label="Open documentation"
                    >
                        <BookOpen size={20} />
                    </button>
                    <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
                    <NotificationsDropdown />
                </div>
                </div>
            </header>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
