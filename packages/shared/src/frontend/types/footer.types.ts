export interface FooterLink {
    label: string;
    href: string;
}

export interface FooterColumn {
    title: string;
    links: FooterLink[];
}

export interface SocialLink<Icon = unknown> {
    label: string;
    icon: Icon;
    href: string;
}

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