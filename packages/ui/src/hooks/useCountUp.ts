import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1000, suffix = '') {
    const [value, setValue] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const start = performance.now();

                    function easeOutQuart(t: number) {
                        return 1 - Math.pow(1 - t, 4);
                    }

                    function animate(now: number) {
                        const elapsed = now - start;
                        const progress = Math.min(elapsed / duration, 1);
                        const eased = easeOutQuart(progress);
                        setValue(Math.round(eased * target));
                        if (progress < 1) requestAnimationFrame(animate);
                    }

                    requestAnimationFrame(animate);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [target, duration]);

    const display = target >= 10000
        ? `${(value / 1000).toFixed(value >= target ? 0 : 0)}k+`
        : `${value}${suffix}`;

    return { ref, display: value >= target ? (target >= 10000 ? '10k+' : `${target}${suffix}`) : display };
}
