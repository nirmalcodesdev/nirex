import { useEffect, useRef } from 'react';

export default function CustomCursor() {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.matchMedia('(hover: none)').matches) return;

        const dot = dotRef.current;
        const ring = ringRef.current;
        if (!dot || !ring) return;

        let mx = 0, my = 0, rx = 0, ry = 0;
        let rafId: number;

        const onMouseMove = (e: MouseEvent) => {
            mx = e.clientX;
            my = e.clientY;
            dot.style.transform = `translate(${mx}px, ${my}px)`;
        };

        function lerpRing() {
            rx += (mx - rx) * 0.12;
            ry += (my - ry) * 0.12;
            if (ring) ring.style.transform = `translate(${rx}px, ${ry}px)`;
            rafId = requestAnimationFrame(lerpRing);
        }

        document.addEventListener('mousemove', onMouseMove);
        rafId = requestAnimationFrame(lerpRing);

        const interactives = document.querySelectorAll('a, button, [role="button"], input, textarea, select');
        const terminals = document.querySelectorAll('.terminal');

        const addHover = () => document.body.classList.add('cursor-hover');
        const removeHover = () => document.body.classList.remove('cursor-hover');
        const addTerminal = () => document.body.classList.add('cursor-terminal');
        const removeTerminal = () => document.body.classList.remove('cursor-terminal');

        interactives.forEach(el => {
            el.addEventListener('mouseenter', addHover);
            el.addEventListener('mouseleave', removeHover);
        });

        terminals.forEach(el => {
            el.addEventListener('mouseenter', addTerminal);
            el.addEventListener('mouseleave', removeTerminal);
        });

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(rafId);
            interactives.forEach(el => {
                el.removeEventListener('mouseenter', addHover);
                el.removeEventListener('mouseleave', removeHover);
            });
            terminals.forEach(el => {
                el.removeEventListener('mouseenter', addTerminal);
                el.removeEventListener('mouseleave', removeTerminal);
            });
        };
    }, []);

    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
        return null;
    }

    return (
        <>
            <div ref={dotRef} className="cursor-dot" />
            <div ref={ringRef} className="cursor-ring" />
        </>
    );
}
