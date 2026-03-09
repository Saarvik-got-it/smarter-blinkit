'use client';
import { useRef, useCallback, type ReactNode, type CSSProperties } from 'react';

interface TiltCardProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    intensity?: number;
    glowColor?: string;
}

/**
 * Pure visual wrapper that applies a subtle 3-D perspective tilt
 * based on the mouse cursor position within the card.
 * Zero business logic — safe to wrap any existing element.
 */
export default function TiltCard({
    children,
    className,
    style,
    intensity = 8,
    glowColor = 'rgba(0,210,106,0.07)',
}: TiltCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const card = ref.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -intensity;
        const rotY = ((x - cx) / cx) * intensity;
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.015,1.015,1)`;
        card.style.transition = 'transform 0.08s linear';
        card.style.backgroundImage = `radial-gradient(circle at ${px}% ${py}%, ${glowColor} 0%, transparent 65%)`;
    }, [intensity, glowColor]);

    const handleMouseLeave = useCallback(() => {
        const card = ref.current;
        if (!card) return;
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
        card.style.transition = 'transform 0.45s ease, background-image 0.4s ease';
        card.style.backgroundImage = '';
    }, []);

    return (
        <div
            ref={ref}
            className={className}
            style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}
        </div>
    );
}
