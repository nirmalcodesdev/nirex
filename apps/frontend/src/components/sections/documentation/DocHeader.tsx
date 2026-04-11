import { Link } from "react-router-dom";
import { Hexagon, Menu, X, Search, Sun, Moon, Command } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { DocHeaderProps } from "@/types/documentation.types";
import { BsGithub } from "react-icons/bs";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";
import nirexLogo from "@nirex/assets/images/nirex.svg";

export function DocHeader({ onMenuToggle, mobileMenuOpen, onSearchOpen }: DocHeaderProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center px-4 lg:px-8">
                {/* Left: Logo & Mobile Menu */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-lg"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <Link to="/" className="flex items-center gap-2.5">
                        <img src={nirexLogo} alt={APP_NAME} className="w-8 h-8" />
                        <div className="flex items-center gap-0 hidden sm:flex">
                            <span className="font-display font-bold text-lg">{APP_NAME}</span>
                            {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
                        </div>
                    </Link>
                    <span className="text-muted-foreground hidden sm:inline">/</span>
                    <span className="text-muted-foreground text-sm hidden sm:inline">
                        Docs
                    </span>
                </div>

                {/* Center: Search */}
                <div className="flex-1 max-w-md mx-4 hidden md:block">
                    <button
                        onClick={onSearchOpen}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 text-muted-foreground transition-colors text-sm"
                    >
                        <Search size={16} />
                        <span className="flex-1 text-left">Search documentation...</span>
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono">
                            <Command size={10} /> K
                        </kbd>
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={onSearchOpen}
                        className="md:hidden p-2 hover:bg-muted rounded-lg text-muted-foreground"
                    >
                        <Search size={20} />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                    >
                        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <a
                        href="https://github.com/nirex"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex p-2 hover:bg-muted rounded-lg text-muted-foreground"
                    >
                        <BsGithub size={20} />
                    </a>
                    <Link
                        to="/dashboard"
                        className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </header>
    );
}
