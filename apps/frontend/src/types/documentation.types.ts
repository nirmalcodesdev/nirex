import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export type CodeLanguage = "bash" | "javascript" | "typescript" | "json" | "yaml";

export interface CodeBlock {
    language: CodeLanguage;
    label: string;
    code: string;
}

export interface DocNavItem {
    id: string;
    title: string;
}

export interface DocSection {
    id: string;
    title: string;
    icon: LucideIcon;
    items?: DocNavItem[];
}

export interface DocContentSection {
    id: string;
    title: string;
    content: React.ReactNode;
}

export interface DocContent {
    id: string;
    title: string;
    description: string;
    sections: DocContentSection[];
}

export type CalloutType = "info" | "warning" | "tip" | "error";

export interface CalloutProps {
    type?: CalloutType;
    title?: string;
    children: React.ReactNode;
}

export interface CodeExampleProps {
    blocks: CodeBlock[];
    filename?: string;
}

export interface TableOfContentsProps {
    sections: { id: string; title: string }[];
    activeSection: string;
}

export interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export interface DocNavigationProps {
    navigation: DocSection[];
    activeDoc: string;
    expandedSections: string[];
    onToggleSection: (sectionId: string) => void;
    onSelectDoc: (docId: string) => void;
    mobileMenuOpen: boolean;
    onCloseMobile: () => void;
}

export interface DocHeaderProps {
    onMenuToggle: () => void;
    mobileMenuOpen: boolean;
    onSearchOpen: () => void;
}

export interface DocLayoutProps {
    children: React.ReactNode;
}
