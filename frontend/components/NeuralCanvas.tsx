'use client';
import { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    alpha: number;
}

interface NeuralCanvasProps {
    /** Opacity of entire canvas layer (default 0.35) */
    opacity?: number;
    /** Number of particles (default 55) */
    count?: number;
    /** Brand colour for nodes and edges (default green) */
    color?: string;
    /** Connection distance threshold px (default 140) */
    connectionDistance?: number;
    /** z-index of the canvas (default 0) */
    zIndex?: number;
    /** Position: fixed (full page) or absolute (parent container) */
    position?: 'fixed' | 'absolute';
}

/**
 * Pure-canvas animated neural-network background.
 * Renders drifting nodes connected by fading edges — no external deps.
 * Completely non-interactive (pointer-events: none) so it never blocks UI.
 */
export default function NeuralCanvas({
    opacity = 0.35,
    count = 55,
    color = '0,210,106',
    connectionDistance = 140,
    zIndex = 0,
    position = 'fixed',
}: NeuralCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();

        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        // Build particle pool
        const particles: Particle[] = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            r: Math.random() * 1.6 + 0.8,
            alpha: Math.random() * 0.5 + 0.4,
        }));

        let raf = 0;
        const tick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Move + bounce
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) { p.vx *= -1; p.x = Math.max(0, Math.min(p.x, canvas.width)); }
                if (p.y < 0 || p.y > canvas.height) { p.vy *= -1; p.y = Math.max(0, Math.min(p.y, canvas.height)); }
            }

            // Draw edges first (under nodes)
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < connectionDistance) {
                        const edgeAlpha = (1 - dist / connectionDistance) * 0.18;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(${color},${edgeAlpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            for (const p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${color},${p.alpha})`;
                ctx.fill();
            }

            raf = requestAnimationFrame(tick);
        };

        tick();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [count, color, connectionDistance]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position,
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex,
                opacity,
            }}
        />
    );
}
