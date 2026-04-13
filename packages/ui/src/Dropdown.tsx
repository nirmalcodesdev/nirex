import { cloneElement, isValidElement, useEffect, useRef, useState, type MouseEventHandler, type ReactElement, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TriggerProps {
    onClick?: MouseEventHandler;
    type?: "button" | "submit" | "reset";
}

interface DropdownProps {
    trigger: ReactElement<TriggerProps>;
    children: ReactNode;
    align?: "left" | "right";
    className?: string;
}

export function Dropdown({ trigger, children, align = "left", className = "" }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const enhancedTrigger = isValidElement(trigger)
        ? cloneElement(trigger, {
            onClick: (event) => {
                trigger.props.onClick?.(event);
                setIsOpen((prev) => !prev);
            },
            type: trigger.props.type ?? "button",
        })
        : trigger;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {enhancedTrigger}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 min-w-[200px] bg-popover border border-border rounded-xl overflow-hidden z-50`}
                        onClick={() => setIsOpen(false)}
                    >
                        <div className="p-1">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function DropdownItem({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-2 ${className}`}
        >
            {children}
        </button>
    );
}
