import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Terminal, Code, X } from "lucide-react";
import type { SearchModalProps } from "@/types/documentation.types";

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="relative w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                            <Search className="text-muted-foreground" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search documentation..."
                                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base"
                            />
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-muted rounded text-muted-foreground"
                            >
                                <X size={16} />
                            </button>
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-muted border border-border rounded text-xs font-mono">
                                ESC
                            </kbd>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto">
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                {query ? `Search results for "${query}"` : "Start typing to search..."}
                            </div>
                            {!query && (
                                <>
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Recent
                                    </div>
                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg text-left">
                                        <Terminal size={16} className="text-muted-foreground" />
                                        <span>CLI Commands</span>
                                    </button>
                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg text-left">
                                        <Code size={16} className="text-muted-foreground" />
                                        <span>API Authentication</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
