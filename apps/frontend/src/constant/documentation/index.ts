import {
    Play,
    Book,
    Code,
    Terminal,
    Database,
    Shield,
} from "lucide-react";
import type { DocSection, CodeBlock, DocContent } from "@/types/documentation.types";

export const navigation: DocSection[] = [
    {
        id: "getting-started",
        title: "Getting Started",
        icon: Play,
        items: [
            { id: "introduction", title: "Introduction" },
            { id: "quickstart", title: "Quick Start" },
            { id: "installation", title: "Installation" },
            { id: "authentication", title: "Authentication" },
        ],
    },
    {
        id: "core-concepts",
        title: "Core Concepts",
        icon: Book,
        items: [
            { id: "sessions", title: "Sessions" },
            { id: "projects", title: "Projects" },
            { id: "environments", title: "Environments" },
            { id: "deployments", title: "Deployments" },
        ],
    },
    {
        id: "api-reference",
        title: "API Reference",
        icon: Code,
        items: [
            { id: "authentication-api", title: "Authentication" },
            { id: "sessions-api", title: "Sessions" },
            { id: "projects-api", title: "Projects" },
            { id: "errors", title: "Errors" },
        ],
    },
    {
        id: "cli",
        title: "CLI Reference",
        icon: Terminal,
        items: [
            { id: "commands", title: "Commands" },
            { id: "configuration", title: "Configuration" },
            { id: "flags", title: "Global Flags" },
        ],
    },
    {
        id: "resources",
        title: "Resources",
        icon: Database,
        items: [
            { id: "compute", title: "Compute" },
            { id: "storage", title: "Storage" },
            { id: "networking", title: "Networking" },
        ],
    },
    {
        id: "security",
        title: "Security",
        icon: Shield,
        items: [
            { id: "api-keys", title: "API Keys" },
            { id: "2fa", title: "Two-Factor Auth" },
            { id: "best-practices", title: "Best Practices" },
        ],
    },
];

export const installBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "npm",
        code: "npm install -g @nirex/cli",
    },
    {
        language: "bash",
        label: "yarn",
        code: "yarn global add @nirex/cli",
    },
    {
        language: "bash",
        label: "pnpm",
        code: "pnpm add -g @nirex/cli",
    },
];

export const initProjectBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "bash",
        code: "nirex init my-awesome-project\ncd my-awesome-project",
    },
];

export const deployBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "bash",
        code: "nirex deploy --env=production",
    },
];

export const macosInstallBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "Homebrew",
        code: "brew install nirex/tap/nirex",
    },
    {
        language: "bash",
        label: "npm",
        code: "npm install -g @nirex/cli",
    },
];

export const linuxInstallBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "curl",
        code: "curl -fsSL https://nirex.io/install.sh | sh",
    },
    {
        language: "bash",
        label: "npm",
        code: "npm install -g @nirex/cli",
    },
];

export const windowsInstallBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "PowerShell",
        code: "winget install Nirex.CLI",
    },
    {
        language: "bash",
        label: "npm",
        code: "npm install -g @nirex/cli",
    },
];

export const loginBlocks: CodeBlock[] = [
    {
        language: "bash",
        label: "CLI",
        code: "nirex login",
    },
];

export const featureCards = [
    { icon: "Zap", title: "Lightning Fast", desc: "Global edge deployment" },
    { icon: "Shield", title: "Secure", desc: "Enterprise-grade security" },
    { icon: "Terminal", title: "CLI-First", desc: "Built for developers" },
];
