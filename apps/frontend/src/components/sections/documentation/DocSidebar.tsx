import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";
import { sonnerToast } from "@nirex/ui";
import type { DocNavigationProps } from "@/types/documentation.types";

export function DocSidebar({
    navigation,
    activeDoc,
    expandedSections,
    onToggleSection,
    onSelectDoc,
    mobileMenuOpen,
    onCloseMobile,
}: DocNavigationProps) {
    const handleSupportClick = () => {
        sonnerToast("Support chat coming soon!", {
            description: "We're working on it. Stay tuned!",
        });
    };

    return (
        <>
            <aside
                className={`fixed lg:sticky top-16 left-0 z-30 w-72 h-[calc(100vh-4rem)] border-r border-border bg-background overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 lg:translate-x-0 transition-transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="p-4">
                    <nav className="space-y-1">
                        {navigation.map((section) => {
                            const Icon = section.icon;
                            const isExpanded = expandedSections.includes(section.id);
                            const hasItems = section.items && section.items.length > 0;
                            const isActive = section.items?.some(
                                (item) => item.id === activeDoc
                            );

                            return (
                                <div key={section.id}>
                                    <button
                                        onClick={() => hasItems && onToggleSection(section.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? "text-nirex-accent"
                                            : "text-foreground hover:bg-muted"
                                            }`}
                                    >
                                        <Icon
                                            size={16}
                                            className={isActive ? "text-nirex-accent" : "text-muted-foreground"}
                                        />
                                        <span className="flex-1 text-left">{section.title}</span>
                                        {hasItems && (
                                            <ChevronDown
                                                size={14}
                                                className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""
                                                    }`}
                                            />
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {hasItems && isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="ml-4 pl-4 border-l border-border mt-1 space-y-0.5">
                                                    {section.items?.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                onSelectDoc(item.id);
                                                                onCloseMobile();
                                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${activeDoc === item.id
                                                                ? "text-nirex-accent font-medium"
                                                                : "text-muted-foreground hover:text-foreground"
                                                                }`}
                                                        >
                                                            {item.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </nav>

                    {/* Support Card */}
                    <div className="mt-8 p-4 rounded-xl border border-border bg-gradient-to-br from-nirex-accent/5 to-transparent">
                        <MessageCircle
                            size={20}
                            className="text-nirex-accent mb-2"
                        />
                        <h4 className="font-medium text-sm mb-1">Need help?</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                            Can&apos;t find what you&apos;re looking for?
                        </p>
                        <button
                            onClick={handleSupportClick}
                            className="text-xs text-nirex-accent hover:underline font-medium"
                        >
                            Contact Support →
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={onCloseMobile}
                />
            )}
        </>
    );
}
