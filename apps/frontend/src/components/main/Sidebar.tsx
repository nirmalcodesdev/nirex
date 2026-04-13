import React, { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import {
    Activity,
    Terminal,
    Zap,
    CreditCard,
    Settings,
    Bell,
    X,
    LogOut,
    User,
    Hexagon,
    Sparkles,
    ChevronDown,
    HelpCircle,
    ChevronLeft,
    ChevronRight,
    type LucideIcon,
} from "lucide-react";
import { APP_NAME, APP_NAME_SUFFIX, cn } from "@nirex/shared";
import { useToast } from "../../components/ToastProvider";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { usePlansDialog } from "../../hooks/usePlansDialog";

// ============================================================================
// Types & Context
// ============================================================================

interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
    badge?: number | string;
    badgeVariant?: "default" | "accent" | "warning" | "error";
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

interface SidebarContextType {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    expand: () => void;
    collapse: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) throw new Error("useSidebar must be used within SidebarProvider");
    return context;
}

import { ROUTES } from "../../constant/routes";

// ============================================================================
// Navigation Data
// ============================================================================

const navGroups: NavGroup[] = [
    {
        label: "WORKSPACE",
        items: [
            { id: "home", label: "Home", path: ROUTES.DASHBOARD.ROOT, icon: Activity },
            { id: "sessions", label: "Sessions", path: ROUTES.DASHBOARD.SESSIONS, icon: Terminal, badge: 3, badgeVariant: "accent" },
            { id: "usage", label: "Usage", path: ROUTES.DASHBOARD.USAGE, icon: Zap },
        ],
    },
    {
        label: "ACCOUNT",
        items: [
            { id: "billing", label: "Billing", path: ROUTES.DASHBOARD.BILLING, icon: CreditCard },
            { id: "notifications", label: "Notifications", path: ROUTES.DASHBOARD.NOTIFICATIONS, icon: Bell, badge: 2, badgeVariant: "warning" },
            { id: "settings", label: "Settings", path: ROUTES.DASHBOARD.SETTINGS, icon: Settings },
        ],
    },
];

// ============================================================================
// Tooltip Component for Collapsed Sidebar
// ============================================================================

function SidebarTooltip({ children, content, show }: { children: React.ReactNode; content: string; show: boolean }) {
    const [isVisible, setIsVisible] = useState(false);

    if (!show) return <>{children}</>;

    return (
        <div
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg shadow-lg z-50 whitespace-nowrap"
                    >
                        <span className="text-xs font-medium text-foreground">{content}</span>
                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// Desktop Sidebar (Collapsible)
// ============================================================================

export function DesktopSidebar() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { openPlansDialog } = usePlansDialog();
    const { isCollapsed, toggleCollapse } = useSidebar();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const location = useLocation();

    return (
        <motion.aside
            initial={false}
            animate={{
                width: isCollapsed ? 72 : 240,
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
            }}
            className="hidden lg:flex flex-col h-screen sticky top-0 shrink-0 bg-card border-r border-border overflow-hidden"
        >
            {/* Logo */}
            <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between w-full">
                    <Link to={ROUTES.DASHBOARD.ROOT} className="flex items-center gap-2.5">
                        <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                        <div className="flex items-center gap-0 sm:flex">
                            <span className="font-display font-bold text-lg">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </Link>
                    {!isCollapsed && (
                        <button
                            onClick={toggleCollapse}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            title="Collapse sidebar (Ctrl+B)"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    )}
                </div>
                {isCollapsed && (
                    <button
                        onClick={toggleCollapse}
                        className="absolute right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Expand sidebar (Ctrl+B)"
                    >
                        <ChevronRight size={16} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
                {navGroups.map((group, groupIndex) => (
                    <div key={group.label} className={cn("mb-6", groupIndex > 0 && "mt-6")}>
                        <AnimatePresence mode="popLayout">
                            {!isCollapsed && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="px-3 mb-2 overflow-hidden"
                                >
                                    <span className="text-[11px] font-semibold text-muted-foreground/70 tracking-wider">
                                        {group.label}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive =
                                    location.pathname === item.path ||
                                    (item.path !== ROUTES.DASHBOARD.ROOT && location.pathname.startsWith(`${item.path}/`));
                                return (
                                    <div key={item.id}>
                                        <SidebarTooltip content={item.label} show={isCollapsed}>
                                            <NavLink
                                                to={item.path}
                                                className={cn(
                                                    "group relative flex items-center gap-3 h-9 px-3 rounded-md text-sm font-medium transition-all",
                                                    isCollapsed && "justify-center px-2",
                                                    isActive
                                                        ? "text-foreground"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="navIndicator"
                                                        className="absolute left-0 w-0.5 h-5 bg-nirex-accent rounded-r-full"
                                                        transition={{
                                                            type: "spring",
                                                            bounce: 0.2,
                                                            duration: 0.4,
                                                        }}
                                                    />
                                                )}
                                                <Icon
                                                    size={18}
                                                    className={cn(
                                                        "shrink-0",
                                                        isActive ? "text-nirex-accent" : "text-muted-foreground"
                                                    )}
                                                />
                                                <AnimatePresence mode="popLayout">
                                                    {!isCollapsed && (
                                                        <motion.span
                                                            initial={{ opacity: 0, width: 0 }}
                                                            animate={{ opacity: 1, width: "auto" }}
                                                            exit={{ opacity: 0, width: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="truncate flex-1 overflow-hidden whitespace-nowrap"
                                                        >
                                                            {item.label}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                                {!isCollapsed && item.badge && (
                                                    <span
                                                        className={cn(
                                                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                                                            item.badgeVariant === "accent" &&
                                                            "bg-nirex-accent text-nirex-text-inverse"
                                                        )}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {isCollapsed && item.badge && (
                                                    <span className="absolute top-1 right-1 w-2 h-2 bg-nirex-accent rounded-full" />
                                                )}
                                            </NavLink>
                                        </SidebarTooltip>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom */}
            <div className="p-2 border-t border-border shrink-0">
                <SidebarTooltip content="Help" show={isCollapsed}>
                    <button
                        onClick={() => navigate(ROUTES.DOCUMENTATION)}
                        className={cn(
                            "w-full flex items-center gap-3 h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
                            isCollapsed && "justify-center px-2"
                        )}
                    >
                        <HelpCircle size={18} className="shrink-0" />
                        <AnimatePresence mode="popLayout">
                            {!isCollapsed && (
                                <motion.span
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: "auto" }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-1 text-left overflow-hidden whitespace-nowrap"
                                >
                                    Help
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </SidebarTooltip>

                {/* Toggle button when collapsed */}
                {isCollapsed && (
                    <SidebarTooltip content="Expand sidebar" show={isCollapsed}>
                        <button
                            onClick={toggleCollapse}
                            className="w-full flex items-center justify-center gap-3 h-9 px-2 mt-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <ChevronRight size={18} className="shrink-0" />
                        </button>
                    </SidebarTooltip>
                )}

                {/* User Menu */}
                <div className={cn("relative mt-1", isCollapsed && "mt-2")}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={cn(
                            "w-full flex items-center gap-3 h-11 px-2 rounded-lg border transition-all",
                            isCollapsed && "justify-center px-1",
                            isUserMenuOpen
                                ? "bg-muted border-border"
                                : "border-transparent hover:bg-muted/50"
                        )}
                    >
                        <UserAvatar className="w-7 h-7" showStatusIndicator />
                        <AnimatePresence mode="popLayout">
                            {!isCollapsed && (
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: "auto" }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-1 min-w-0 text-left overflow-hidden"
                                >
                                    <p className="text-sm font-medium truncate">Alex Chen</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        Pro Plan
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {!isCollapsed && (
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-muted-foreground shrink-0 transition-transform",
                                    isUserMenuOpen && "rotate-180"
                                )}
                            />
                        )}
                    </button>
                    <AnimatePresence>
                        {isUserMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsUserMenuOpen(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    className={cn(
                                        "absolute left-0 bottom-full mb-2 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden",
                                        isCollapsed ? "w-56" : "right-0"
                                    )}
                                >
                                    <div className="p-3 bg-gradient-to-br from-nirex-accent/10 to-nirex-accent/5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Sparkles size={14} className="text-nirex-accent" />
                                            <span className="text-xs font-semibold">Pro</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                openPlansDialog();
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full py-1.5 px-3 rounded-md bg-nirex-accent text-nirex-text-inverse text-xs font-medium"
                                        >
                                            Upgrade
                                        </button>
                                    </div>
                                    <div className="p-1.5">
                                        <button
                                            onClick={() => {
                                                navigate(ROUTES.DASHBOARD.SETTINGS);
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted rounded-md"
                                        >
                                            <User size={16} /> Profile
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigate(ROUTES.DASHBOARD.SETTINGS);
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted rounded-md"
                                        >
                                            <Settings size={16} /> Settings
                                        </button>
                                    </div>
                                    <div className="p-1.5 border-t border-border">
                                        <button
                                            onClick={() => {
                                                toast("Logged out", "success");
                                                setIsUserMenuOpen(false);
                                                navigate(ROUTES.AUTH.SIGNIN);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-nirex-error hover:bg-nirex-error/10 rounded-md"
                                        >
                                            <LogOut size={16} /> Sign out
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.aside>
    );
}

// ============================================================================
// Mobile/Tablet Sidebar Overlay
// ============================================================================

function SidebarOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { openPlansDialog } = usePlansDialog();
    const location = useLocation();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={onClose} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[280px] bg-card border-r border-border z-50 lg:hidden flex flex-col">


                <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <UserAvatar className="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">Alex Chen</p>
                            <p className="text-xs text-muted-foreground truncate">alex@company.com</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {navGroups.map((group, groupIndex) => (
                        <div key={group.label} className={cn("mb-6", groupIndex > 0 && "mt-6")}>
                            <div className="px-3 mb-2">
                                <span className="text-[11px] font-semibold text-muted-foreground/70 tracking-wider">{group.label}</span>
                            </div>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <NavLink key={item.id} to={item.path} onClick={onClose} className={cn("flex items-center gap-3 h-10 px-3 rounded-md text-sm font-medium transition-colors", isActive ? "bg-nirex-accent/10 text-nirex-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                                            <Icon size={18} className={isActive ? "text-nirex-accent" : ""} />
                                            <span className="flex-1">{item.label}</span>
                                            {item.badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-nirex-accent text-nirex-text-inverse">{item.badge}</span>}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-border space-y-2">
                    <button onClick={() => { navigate(ROUTES.DOCUMENTATION); onClose(); }} className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-border hover:bg-muted/50 font-medium"><HelpCircle size={16} /> Help & Docs</button>
                    <button onClick={() => { openPlansDialog(); onClose(); }} className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-nirex-accent text-nirex-text-inverse font-medium"><Sparkles size={16} /> Upgrade</button>
                    <button onClick={() => { toast("Logged out", "success"); onClose(); navigate(ROUTES.AUTH.SIGNIN); }} className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-nirex-error hover:bg-nirex-error/10 font-medium"><LogOut size={16} /> Sign out</button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// ============================================================================
// Sidebar Provider
// ============================================================================

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        // Initialize from localStorage, default to false (expanded)
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("nirex-sidebar-collapsed");
            return saved === "true";
        }
        return false;
    });

    // Persist collapsed state to localStorage
    useEffect(() => {
        localStorage.setItem("nirex-sidebar-collapsed", String(isCollapsed));
    }, [isCollapsed]);

    const toggleCollapse = () => setIsCollapsed((prev) => !prev);
    const expand = () => setIsCollapsed(false);
    const collapse = () => setIsCollapsed(true);

    return (
        <SidebarContext.Provider
            value={{
                isOpen,
                open: () => setIsOpen(true),
                close: () => setIsOpen(false),
                isCollapsed,
                toggleCollapse,
                expand,
                collapse,
            }}
        >
            {children}
            <SidebarOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </SidebarContext.Provider>
    );
}
