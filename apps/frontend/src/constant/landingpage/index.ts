import type { FooterColumn, NavLink, SocialLink } from "@nirex/shared";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsDiscord } from "react-icons/bs";

import type { ComponentType } from "react";
export const navLinks: NavLink[] = [
    {
        label: "Features",
        href: "#features"
    },
    {
        label: "Demo",
        href: "#demo"
    },
    {
        label: "Pricing",
        href: "#pricing"
    },
    {
        label: "Docs",
        href: "/docs"
    }

]

export const footerLinks: FooterColumn[] = [
    {
        title: 'Product',
        links: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Changelog', href: '#' },
            { label: 'Documentation', href: '#' },
            { label: 'CLI Reference', href: '#' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Getting Started', href: '#' },
            { label: 'API Reference', href: '#' },
            { label: 'Integrations', href: '#' },
            { label: 'Blog', href: '#' },
            { label: 'Status', href: '#' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '#' },
            { label: 'Careers', href: '#' },
            { label: 'Contact', href: '#' },
            { label: 'Press Kit', href: '#' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Privacy Policy', href: '#' },
            { label: 'Terms of Service', href: '#' },
            { label: 'Security', href: '#' },
            { label: 'DPA', href: '#' },
        ],
    },
];

export const socialLinks: SocialLink<ComponentType>[] = [
    {
        label: 'GitHub',
        icon: FaGithub,
        href: "#"
    },
    {
        label: 'X',
        icon: FaXTwitter,
        href: "#"
    },
    {
        label: 'Discord',
        icon: BsDiscord,
        href: "#"
    },
];

export interface FooterProps {
    /** Brand name (e.g., "Nirex") */
    brandName: string;
    /** Brand suffix (e.g., "Code") */
    brandSuffix?: string;
    /** Brand description text */
    description: string;
    /** Navigation columns */
    columns?: FooterColumn[];
    /** Social media links */
    socialLinks?: SocialLink[];
    /** Copyright holder name */
    copyrightName: string;
    /** Tagline shown in bottom bar */
    tagline?: string;
    /** Custom CSS classes */
    className?: string;
    /** Base URL for brand link */
    brandHref?: string;
    /** Current year (auto-detected if not provided) */
    year?: number;
}

export const footerDescription = "Multi-agent AI that lives in your terminal. Fix, generate, explain, and refactor — powered by the world's best AI models."

export const terminalLines = [
    { text: '$ nirex fix "token refresh keeps failing after 30min"', delay: 40 },
    { text: '', delay: 10 },
    { text: '  Orchestrating agents: CodeAnalyzer → ContextMapper → PatchWriter', delay: 25 },
    { text: '  Agents scanning 847 files across 12 modules...', delay: 20 },
    { text: '  Agent[Search] querying latest auth best practices...', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Found › src/auth/tokenService.ts:142', delay: 25 },
    { text: '  Issue  › Refresh timer uses Date.now() at mount,', delay: 25 },
    { text: '           not at execution — token expires too early.', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Diff:', delay: 30 },
    { text: '  - const expiresAt = Date.now() + TOKEN_TTL', delay: 25 },
    { text: '  + const expiresAt = () => Date.now() + TOKEN_TTL', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Apply this patch? [Y/n] Y', delay: 60 },
    { text: '', delay: 10 },
    { text: '  ✓ Patch applied  ·  1 file changed, 1 insertion(+), 1 deletion(-)', delay: 20 },
];