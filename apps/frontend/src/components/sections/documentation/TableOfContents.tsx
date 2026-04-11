import type { TableOfContentsProps } from "@/types/documentation.types";

export function TableOfContents({ sections, activeSection }: TableOfContentsProps) {
    return (
        <nav className="hidden xl:block w-64 shrink-0">
            <div className="sticky top-24">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    On this page
                </p>
                <ul className="space-y-1">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className={`block text-sm py-1 px-2 rounded-md transition-colors ${activeSection === section.id
                                    ? "text-nirex-accent font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {section.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
