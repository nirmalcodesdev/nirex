import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Bell,
    Settings,
    Command,
    Menu,
    Activity,
    Terminal,
    Zap,
    CreditCard,
    BookOpen,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { useSidebar } from "./Sidebar";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useClickOutside } from "../../hooks/useClickOutside";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";

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
    const { toast } = useToast();

    useClickOutside(ref, () => setIsOpen(false));

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-nirex-accent rounded-full" />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                                <h3 className="font-semibold text-sm">Notifications</h3>
                                <button type="button" onClick={() => toast("Marked all read", "success")} className="text-xs text-nirex-accent">
                                    Mark all read
                                </button>
                            </div>
                            <div className="p-2">
                                <div className="px-3 py-2 hover:bg-muted rounded-lg cursor-pointer">
                                    <p className="text-sm font-medium">New session started</p>
                                    <p className="text-xs text-muted-foreground">2 minutes ago</p>
                                </div>
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
                        <UserAvatar className="w-8 h-8" />
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
