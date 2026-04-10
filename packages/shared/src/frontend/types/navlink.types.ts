export interface NavLink {
    label: string;
    /** React Router path (preferred) */
    to?: string;
    /** External URL or fallback */
    href?: string;
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
    /** CTA button route (React Router) */
    ctaTo?: string;
    /** CTA button href (external link fallback) */
    ctaHref?: string;
    /** Brand link route (React Router) */
    brandTo?: string;
    /** Brand href (external link fallback) */
    brandHref?: string;
    /** Custom CSS classes */
    className?: string;
}