import type { FooterColumn, SocialLink } from "@nirex/shared";

export const defaultColumns: FooterColumn[] = [
    {
        title: 'Product',
        links: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Changelog', href: '#' },
            { label: 'Docs', href: '#' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '#about' },
            { label: 'Blog', href: '#' },
            { label: 'Careers', href: '#' },
            { label: 'Contact', href: '#contact' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Privacy', href: '#' },
            { label: 'Terms', href: '#' },
        ],
    },
];

export function Footer({
    columns,
    brandName,
    brandSuffix,
    brandHref = '/',
    description,
    socialLinks,
    copyrightName,
}: {
    columns?: FooterColumn[];
    brandName: string;
    brandSuffix?: string;
    brandHref?: string;
    description?: string;
    socialLinks?: SocialLink[];
    copyrightName?: string;
}) {

    return (
        <footer className="bg-nirex-surface border-t border-border py-16 text-nirex-text-primary">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-12">

                    {/* Brand Column */}
                    <div className="md:col-span-4">
                        <a href={brandHref} className="flex items-center gap-2 text-2xl font-bold text-nirex-text-primary">
                            {brandName}
                            {brandSuffix && <span className="text-nirex-accent">{brandSuffix}</span>}
                        </a>

                        {description && (
                            <p className="mt-4 text-nirex-text-secondary max-w-md">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Links Columns */}
                    {columns?.map((column, idx) => (
                        <div key={idx} className="md:col-span-2">
                            <h3 className="font-semibold mb-4 text-nirex-text-primary">{column.title}</h3>
                            <ul className="space-y-2.5 text-sm">
                                {column.links?.map((link: any, i: number) => (
                                    <li key={i}>
                                        <a
                                            href={link.href}
                                            className="text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Social Links */}
                    {socialLinks && socialLinks.length > 0 && (
                        <div className="md:col-span-2">
                            <h3 className="font-semibold mb-4 text-nirex-text-primary">Follow Us</h3>
                            <div className="flex gap-4">
                                {socialLinks.map((social: any, i: number) => (
                                    <a
                                        key={i}
                                        href={social.href}
                                        className="text-nirex-text-secondary hover:text-nirex-text-primary transition-colors"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={social.label}
                                    >
                                        <social.icon className="w-5 h-5" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Copyright */}
                <div className="mt-16 pt-8 border-t border-border text-center text-xs text-nirex-text-muted">
                    © {new Date().getFullYear()} {copyrightName || brandName}. All rights reserved.
                </div>
            </div>
        </footer>
    );
}