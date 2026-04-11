import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Zap, Shield, Terminal } from "lucide-react";
import {
    Callout,
    CodeExample,
    TableOfContents,
    SearchModal,
    DocSidebar,
    DocHeader,
} from "@/components/sections/documentation";
import {
    navigation,
    installBlocks,
    initProjectBlocks,
    deployBlocks,
    macosInstallBlocks,
    linuxInstallBlocks,
    windowsInstallBlocks,
    loginBlocks,
} from "@/constant/documentation";
import type { DocContent } from "@/types/documentation.types";

// ============================================================================
// Document Content
// ============================================================================

const getDocContent = (activeDoc: string, currentNavTitle?: string, currentItemTitle?: string): DocContent => {
    const contents: Record<string, DocContent> = {
        introduction: {
            id: "introduction",
            title: "Introduction",
            description: "Welcome to Nirex - the modern platform for CLI applications.",
            sections: [
                {
                    id: "what-is-nirex",
                    title: "What is Nirex?",
                    content: (
                        <>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                                Nirex is a cloud platform designed for developers who want to deploy,
                                manage, and scale CLI-based applications with ease. Built with modern
                                infrastructure and developer experience in mind.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                                {[
                                    { icon: Zap, title: "Lightning Fast", desc: "Global edge deployment" },
                                    { icon: Shield, title: "Secure", desc: "Enterprise-grade security" },
                                    { icon: Terminal, title: "CLI-First", desc: "Built for developers" },
                                ].map((item) => (
                                    <div
                                        key={item.title}
                                        className="p-4 rounded-xl border border-border bg-card/50"
                                    >
                                        <item.icon className="text-nirex-accent mb-3" size={24} />
                                        <h3 className="font-semibold mb-1">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ),
                },
                {
                    id: "getting-started-install",
                    title: "Getting Started",
                    content: (
                        <>
                            <p className="text-muted-foreground mb-4">
                                Get up and running with Nirex in under 5 minutes.
                            </p>
                            <CodeExample blocks={installBlocks} />
                            <Callout type="tip" title="Pro Tip">
                                Use the autocomplete feature by running{" "}
                                <code>nirex completion</code> after installation.
                            </Callout>
                        </>
                    ),
                },
                {
                    id: "next-steps",
                    title: "Next Steps",
                    content: (
                        <>
                            <ul className="space-y-3 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <ChevronRight className="shrink-0 mt-0.5 text-nirex-accent" size={16} />
                                    <span>
                                        Follow the{" "}
                                        <Link
                                            to="/docs?section=quickstart"
                                            className="text-nirex-accent hover:underline"
                                        >
                                            Quick Start guide
                                        </Link>{" "}
                                        to deploy your first application
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight className="shrink-0 mt-0.5 text-nirex-accent" size={16} />
                                    <span>
                                        Explore the{" "}
                                        <Link
                                            to="/docs?section=commands"
                                            className="text-nirex-accent hover:underline"
                                        >
                                            CLI commands
                                        </Link>{" "}
                                        reference
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight className="shrink-0 mt-0.5 text-nirex-accent" size={16} />
                                    <span>
                                        Learn about{" "}
                                        <Link
                                            to="/docs?section=authentication-api"
                                            className="text-nirex-accent hover:underline"
                                        >
                                            API authentication
                                        </Link>
                                    </span>
                                </li>
                            </ul>
                        </>
                    ),
                },
            ],
        },
        quickstart: {
            id: "quickstart",
            title: "Quick Start",
            description: "Deploy your first application in minutes.",
            sections: [
                {
                    id: "prerequisites",
                    title: "Prerequisites",
                    content: (
                        <>
                            <p className="text-muted-foreground mb-4">
                                Before you begin, make sure you have:
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-6">
                                <li>Node.js 18.0 or higher</li>
                                <li>A Nirex account (sign up at nirex.io)</li>
                                <li>Your API key from the dashboard</li>
                            </ul>
                        </>
                    ),
                },
                {
                    id: "create-project",
                    title: "Create a Project",
                    content: (
                        <>
                            <p className="text-muted-foreground mb-4">
                                Initialize a new Nirex project:
                            </p>
                            <CodeExample
                                filename="Terminal"
                                blocks={initProjectBlocks}
                            />
                        </>
                    ),
                },
                {
                    id: "deploy",
                    title: "Deploy",
                    content: (
                        <>
                            <p className="text-muted-foreground mb-4">
                                Deploy your application to production:
                            </p>
                            <CodeExample
                                filename="Terminal"
                                blocks={deployBlocks}
                            />
                            <Callout type="info">
                                Your application will be available at{" "}
                                <code>https://my-awesome-project.nirex.app</code>
                            </Callout>
                        </>
                    ),
                },
            ],
        },
        installation: {
            id: "installation",
            title: "Installation",
            description: "Install the Nirex CLI on your system.",
            sections: [
                {
                    id: "macos",
                    title: "macOS",
                    content: (
                        <>
                            <CodeExample blocks={macosInstallBlocks} />
                        </>
                    ),
                },
                {
                    id: "linux",
                    title: "Linux",
                    content: (
                        <>
                            <CodeExample blocks={linuxInstallBlocks} />
                        </>
                    ),
                },
                {
                    id: "windows",
                    title: "Windows",
                    content: (
                        <>
                            <CodeExample blocks={windowsInstallBlocks} />
                        </>
                    ),
                },
            ],
        },
        authentication: {
            id: "authentication",
            title: "Authentication",
            description: "Authenticate with the Nirex platform.",
            sections: [
                {
                    id: "login",
                    title: "Login",
                    content: (
                        <>
                            <p className="text-muted-foreground mb-4">
                                Authenticate using your API key:
                            </p>
                            <CodeExample blocks={loginBlocks} />
                            <Callout type="warning" title="Security">
                                Never commit your API key to version control. Use environment
                                variables instead.
                            </Callout>
                        </>
                    ),
                },
            ],
        },
    };

    return (
        contents[activeDoc] || {
            id: activeDoc,
            title: currentItemTitle || "Documentation",
            description: "Learn more about this feature.",
            sections: [
                {
                    id: "overview",
                    title: "Overview",
                    content: (
                        <p className="text-muted-foreground">
                            Documentation for {currentItemTitle} is coming soon.
                        </p>
                    ),
                },
            ],
        }
    );
};

// ============================================================================
// Main Documentation Component
// ============================================================================

export default function Documentation() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>(["getting-started"]);
    const [activeDoc, setActiveDoc] = useState("introduction");
    const [activeSection, setActiveSection] = useState("");

    // Toggle section expansion
    const toggleSection = (sectionId: string) => {
        setExpandedSections((prev) =>
            prev.includes(sectionId)
                ? prev.filter((id) => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Scroll spy for table of contents
    useEffect(() => {
        const handleScroll = () => {
            const sections = document.querySelectorAll("[data-section]");
            let current = "";
            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 150) {
                    current = section.getAttribute("data-section") || "";
                }
            });
            setActiveSection(current);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Current document content
    const currentNav = navigation.find((n) =>
        n.items?.some((item) => item.id === activeDoc)
    );
    const currentItem = currentNav?.items?.find((item) => item.id === activeDoc);
    const docContent = getDocContent(activeDoc, currentNav?.title, currentItem?.title);

    // Handle document selection
    const handleSelectDoc = (docId: string) => {
        setActiveDoc(docId);
    };

    // Get all items for navigation
    const allItems = navigation.flatMap((n) => n.items || []);
    const currentIndex = allItems.findIndex((i) => i.id === activeDoc);

    const handlePrevious = () => {
        if (currentIndex > 0) {
            const prevItem = allItems[currentIndex - 1];
            if (prevItem) {
                setActiveDoc(prevItem.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < allItems.length - 1) {
            const nextItem = allItems[currentIndex + 1];
            if (nextItem) {
                setActiveDoc(nextItem.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <DocHeader
                onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                mobileMenuOpen={mobileMenuOpen}
                onSearchOpen={() => setSearchOpen(true)}
            />

            {/* Search Modal */}
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Main Content */}
            <div className="flex max-w-[1400px] mx-auto">
                {/* Sidebar Navigation */}
                <DocSidebar
                    navigation={navigation}
                    activeDoc={activeDoc}
                    expandedSections={expandedSections}
                    onToggleSection={toggleSection}
                    onSelectDoc={handleSelectDoc}
                    mobileMenuOpen={mobileMenuOpen}
                    onCloseMobile={() => setMobileMenuOpen(false)}
                />

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                    <div className="flex">
                        {/* Article */}
                        <article className="flex-1 px-6 py-8 lg:px-12 lg:py-10 max-w-3xl">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                <span>Docs</span>
                                <ChevronRight size={14} />
                                <span>{currentNav?.title}</span>
                                <ChevronRight size={14} />
                                <span className="text-foreground">{docContent.title}</span>
                            </div>

                            {/* Title */}
                            <h1 className="text-4xl font-bold tracking-tight mb-4">
                                {docContent.title}
                            </h1>
                            <p className="text-xl text-muted-foreground mb-10">
                                {docContent.description}
                            </p>

                            {/* Content Sections */}
                            <div className="space-y-12">
                                {docContent.sections.map((section) => (
                                    <section key={section.id} data-section={section.id}>
                                        <h2
                                            id={section.id}
                                            className="text-2xl font-semibold tracking-tight mb-4 scroll-mt-24"
                                        >
                                            {section.title}
                                        </h2>
                                        <div className="prose prose-neutral dark:prose-invert max-w-none">
                                            {section.content}
                                        </div>
                                    </section>
                                ))}
                            </div>

                            {/* Footer Navigation */}
                            <div className="mt-16 pt-8 border-t border-border">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handlePrevious}
                                        disabled={currentIndex <= 0}
                                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight
                                            size={16}
                                            className="rotate-180"
                                        /> Previous
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={currentIndex >= allItems.length - 1}
                                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </article>

                        {/* Table of Contents */}
                        <TableOfContents
                            sections={docContent.sections.map((s) => ({
                                id: s.id,
                                title: s.title,
                            }))}
                            activeSection={activeSection}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}
