import { useRef, useCallback } from 'react';

interface MagneticButtonProps {
    children: React.ReactNode;
    strength?: number;
    className?: string;
    onClick?: () => void;
}

export default function MagneticButton({ children, strength = 0.35, className = '', onClick }: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (window.matchMedia('(hover: none)').matches) return;
        const btn = ref.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * strength;
        const y = (e.clientY - rect.top - rect.height / 2) * strength;
        btn.style.transition = 'transform 100ms ease';
        btn.style.transform = `translate(${x}px, ${y}px)`;
    }, [strength]);

    const onMouseLeave = useCallback(() => {
        const btn = ref.current;
        if (!btn) return;
        btn.style.transition = 'transform 600ms cubic-bezier(0.34,1.4,0.64,1)';
        btn.style.transform = 'translate(0, 0)';
    }, []);

    return (
        <button
            ref={ref}
            className={className}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
