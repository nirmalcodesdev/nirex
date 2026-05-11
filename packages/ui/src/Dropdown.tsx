import { cloneElement, isValidElement, useEffect, useRef, useState, type MouseEventHandler, type ReactElement, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface TriggerProps {
    onClick?: MouseEventHandler;
    type?: "button" | "submit" | "reset";
}

interface DropdownProps {
    trigger: ReactElement<TriggerProps>;
    children: ReactNode;
    align?: "left" | "right";
    side?: "top" | "bottom";
    portal?: boolean;
    className?: string;
}

export function Dropdown({
    trigger,
    children,
    align = "left",
    side = "bottom",
    portal = false,
    className = "",
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!isOpen || !portal) {
            setMenuPosition(null);
            return;
        }

        const viewportPadding = 8;
        const menuGap = 8;

        const updateMenuPosition = () => {
            if (!dropdownRef.current) return;
            const rect = dropdownRef.current.getBoundingClientRect();
            const menuWidth = menuRef.current?.offsetWidth ?? 200;
            const menuHeight = menuRef.current?.offsetHeight ?? 0;

            const desiredLeft =
                align === "right" ? rect.right - menuWidth : rect.left;
            const maxLeft = Math.max(
                viewportPadding,
                window.innerWidth - menuWidth - viewportPadding,
            );
            const left = Math.min(Math.max(desiredLeft, viewportPadding), maxLeft);

            const desiredTop =
                side === "top"
                    ? rect.top - menuHeight - menuGap
                    : rect.bottom + menuGap;
            const maxTop = Math.max(
                viewportPadding,
                window.innerHeight - menuHeight - viewportPadding,
            );
            const top = Math.min(Math.max(desiredTop, viewportPadding), maxTop);

            setMenuPosition({
                top,
                left,
            });
        };

        updateMenuPosition();
        const rafId = window.requestAnimationFrame(updateMenuPosition);
        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, true);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [align, isOpen, portal, side]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            const clickedTrigger = Boolean(dropdownRef.current?.contains(target));
            const clickedMenu = Boolean(menuRef.current?.contains(target));
            if (!clickedTrigger && !clickedMenu) {
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

    const menuStyle = portal
        ? {
            top: `${menuPosition?.top ?? 0}px`,
            left: `${menuPosition?.left ?? 0}px`,
            visibility: menuPosition ? "visible" as const : "hidden" as const,
        }
        : {};

    const dropdownMenu = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, y: side === "top" ? -8 : 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: side === "top" ? -8 : 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={
                        portal
                            ? "fixed min-w-[200px] bg-popover border border-border rounded-xl overflow-hidden z-[9999]"
                            : `absolute ${align === "right" ? "right-0" : "left-0"} ${side === "top" ? "bottom-full mb-2" : "mt-2"} min-w-[200px] bg-popover border border-border rounded-xl overflow-hidden z-50`
                    }
                    style={menuStyle}
                    onClick={() => setIsOpen(false)}
                >
                    <div className="p-1">{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {enhancedTrigger}
            {portal && typeof document !== "undefined"
                ? createPortal(dropdownMenu, document.body)
                : dropdownMenu}
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
