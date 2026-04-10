import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { NavProps } from '@nirex/shared';
import MagneticButton from '../MagneticButton.js';

export default function Nav({
    brandName = 'Nirex',
    brandSuffix,
    links = [],
    ctaText = 'Get Started',
    ctaTo = '/auth/signup',
    brandTo = '/',
    className = '',
    logoSrc
}: NavProps & { logoSrc?: string; brandTo?: string; ctaTo?: string }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 40);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Helper to determine if a link is an anchor link
    const isAnchorLink = (url?: string) => url?.startsWith('#');

    // Helper to render a link - uses <a> for anchors, <Link> for routes
    const renderLink = (
        url: string,
        children: React.ReactNode,
        className: string,
        onClick?: () => void
    ) => {
        if (isAnchorLink(url)) {
            return (
                <a href={url} className={className} onClick={onClick}>
                    {children}
                </a>
            );
        }
        return (
            <Link to={url} className={className} onClick={onClick}>
                {children}
            </Link>
        );
    };

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-200 ${scrolled
                    ? 'backdrop-blur-2xl border-b border-border bg-nirex-base/80'
                    : 'bg-transparent border-b border-transparent'
                    } ${className}`}
                style={{ WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(180%)' : undefined }}
            >
                <div className="nirex-container-wide flex items-center justify-between h-16">
                    {/* Logo */}
                    {renderLink(
                        brandTo,
                        <>
                            {logoSrc && <img src={logoSrc} alt={brandName} className="w-8 h-8" />}
                            <div className="flex items-center gap-0">
                                <span className="font-display font-bold text-lg text-nirex-text-primary">{brandName}</span>
                                {brandSuffix && <span className="font-mono text-[0.85em] text-nirex-text-primary">{brandSuffix}</span>}
                            </div>
                        </>,
                        'flex items-center gap-2'
                    )}

                    {/* Center links - desktop */}
                    <div className="hidden md:flex items-center gap-8">
                        {links.map((link) => {
                            const url = link.to || link.href || '#';
                            return renderLink(
                                url,
                                link.label,
                                'font-body text-sm text-nirex-text-secondary hover:text-nirex-text-primary transition-colors duration-200'
                            );
                        })}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {renderLink(
                            ctaTo,
                            <MagneticButton
                                strength={0.35}
                                className="h-10 px-5 flex items-center gap-2 rounded-lg bg-nirex-accent text-nirex-text-inverse font-body text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                                {ctaText}
                                <span className="inline-block transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                            </MagneticButton>,
                            'hidden md:block'
                        )}

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`block w-5 h-px bg-nirex-text-primary transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-1' : ''}`} />
                            <span className={`block w-5 h-px bg-nirex-text-primary transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-0.5' : ''}`} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[99] bg-nirex-base flex flex-col items-center justify-center gap-8">
                    {links.map((link) => {
                        const url = link.to || link.href || '#';
                        return renderLink(
                            url,
                            link.label,
                            'font-display text-lg text-nirex-text-primary hover:text-nirex-accent transition-colors',
                            () => setMobileOpen(false)
                        );
                    })}
                    {renderLink(
                        ctaTo,
                        <>
                            {ctaText} ↗
                        </>,
                        'mt-4 h-12 px-8 rounded-lg bg-nirex-accent text-nirex-text-inverse font-body text-base font-medium flex items-center',
                        () => setMobileOpen(false)
                    )}
                </div>
            )}
        </>
    );
}
