export interface NavLink {
    label: string;
    href: string;
}

export interface NavProps {
    /** Brand name (e.g., "Nirex") */
    brandName: string;
    /** Brand suffix (e.g., "Code") */
    brandSuffix?: string;
    /** Navigation links */
    links: NavLink[];
    /** CTA button text */
    ctaText?: string;
    /** CTA button href */
    ctaHref?: string;
    /** Base URL for brand link */
    brandHref?: string;
    /** Custom CSS classes */
    className?: string;
}