import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Bell,
    Check,
    Settings,
    Command,
    Menu,
    Activity,
    Terminal,
    Zap,
    CreditCard,
    BookOpen,
    AlertTriangle,
    CheckCircle2,
    CircleAlert,
    RefreshCw,
    XCircle,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { useSidebar } from "./Sidebar";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useClickOutside } from "../../hooks/useClickOutside";
import { APP_NAME, APP_NAME_SUFFIX, type NotificationItem } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { useAppSelector } from "../../store/hooks";
import {
    useMarkAllNotificationsReadMutation,
    useNotificationsQuery,
} from "../../features/notifications/useNotifications";

const searchItems = [
    { id: "dashboard", label: "Dashboard", path: "/", icon: Activity },
    { id: "sessions", label: "Sessions", path: "/sessions", icon: Terminal },
    { id: "usage", label: "Usage", path: "/usage", icon: Zap },
    { id: "billing", label: "Billing", path: "/billing", icon: CreditCard },
    { id: "settings", label: "Settings", path: "/settings", icon: Settings },
    { id: "documentation", label: "Documentation", path: "/documentation", icon: BookOpen },
];

function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filtered =
        query.trim() === ""
            ? searchItems
            : searchItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" onClick={onClose} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center px-4 py-3 border-b border-border">
                            <Search size={18} className="text-muted-foreground mr-3" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search..."
                                className="flex-1 bg-transparent border-none outline-none rounded px-1.5 py-0.5 text-foreground placeholder:text-muted-foreground"
                            />
                            <kbd className="text-[10px] ml-3 bg-muted border border-border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto">
                            {filtered.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        navigate(item.path);
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg text-left"
                                >
                                    <item.icon size={16} className="text-muted-foreground" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function NotificationsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const lastToastedIdRef = useRef<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();
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
            refetchInterval: 30_000, // Poll every 30 seconds for new notifications
        },
    );
    const markAllReadMutation = useMarkAllNotificationsReadMutation();

    useClickOutside(ref, () => setIsOpen(false));

    const unreadCount = notifications?.unread_count ?? 0;
    const recentNotifications = notifications?.items ?? [];

    // Effect to show Toast for new unread notifications
    useEffect(() => {
        const items = notifications?.items;
        if (!items || items.length === 0) return;

        const latest = items[0];
        if (!latest) return;

        // Only toast if it's unread and we haven't toasted it in this session yet
        if (!latest.read_at && latest.id !== lastToastedIdRef.current) {
            // Check if the notification was created very recently (within the last minute)
            // to avoid toasting old unread notifications on page load.
            const createdTime = new Date(latest.created_at).getTime();
            const now = Date.now();
            const isFresh = now - createdTime < 60_000;

            if (isFresh) {
                const toastType =
                    latest.severity === "error"
                        ? "error"
                        : latest.severity === "warning"
                          ? "warning"
                          : "success";

                // Since our toast provider doesn't support titles, we combine title and message
                toast(`${latest.title}: ${latest.message}`, toastType);
            }
            lastToastedIdRef.current = latest.id;
        }
    }, [notifications, toast]);

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
            <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <Bell size={20} />
                {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-nirex-accent text-[10px] leading-[18px] text-white text-center font-medium">
                        {Math.min(unreadCount, 99)}
                    </span>
                ) : null}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
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
                                        {recentNotifications.map((notification) => {
                                            const { Icon, iconClass } = getSeverityMeta(notification.severity);

                                            return (
                                                <article key={notification.id} className="px-3 py-2 hover:bg-muted rounded-lg">
                                                    <div className="flex items-start gap-2.5">
                                                        <Icon size={14} className={`mt-0.5 ${iconClass}`} />
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
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigate("/notifications");
                                                setIsOpen(false);
                                            }}
                                            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                                        >
                                            View all notifications
                                        </button>
                                    </>
                                ) : (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">
                                        No recent notifications.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function Header() {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { open, toggleCollapse, isCollapsed } = useSidebar();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

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
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 border-b border-border bg-card">
                <div className="flex items-center justify-between h-full px-4">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={open} className="p-2 -ml-2 hover:bg-muted rounded-lg">
                            <Menu size={20} />
                        </button>
                        <Link to="/" className="flex items-center gap-2.5">
                            <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                            <div className=" items-center gap-0 flex ">
                                <span className="font-display font-bold text-lg">{APP_NAME}</span>
                                {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
                            </div>
                        </Link>
                    </div>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => navigate("/documentation")} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Documentation">
                            <BookOpen size={20} />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button type="button" onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                            <Search size={20} />
                        </button>
                        <UserAvatar className="w-8 h-8" name={user?.fullName} />
                    </div>
                </div>
            </header>

            <header className="hidden lg:flex fixed top-0 z-30 h-16 border-b border-border bg-card/95 backdrop-blur transition-all duration-300" style={{ left: isCollapsed ? '72px' : '240px', right: 0 }}>
                <div className="flex items-center justify-between h-full px-4 w-full">
                    <div className="flex-1 max-w-2xl">
                        <button type="button" onClick={() => setIsSearchOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 text-muted-foreground transition-all">
                            <Search size={18} />
                            <span className="flex-1 text-left text-sm">Search anything...</span>
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border rounded text-[10px] font-mono">
                                <Command size={10} /> K
                            </kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                        <button
                            type="button"
                            onClick={() => navigate("/documentation")}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Documentation"
                        >
                            <BookOpen size={20} />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <NotificationsDropdown />
                    </div>
                </div>
            </header>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
