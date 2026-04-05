import { useEffect, useRef } from 'react';

export function useScrollReveal() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
        );

        const el = ref.current;
        if (el) {
            const elements = el.querySelectorAll('[data-reveal]');
            elements.forEach(child => observer.observe(child));
        }

        return () => observer.disconnect();
    }, []);

    return ref;
}
