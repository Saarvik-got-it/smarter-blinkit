'use client';
import { useRef, useCallback, type ReactNode, type CSSProperties } from 'react';

interface Props {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}

/**
 * Horizontal product carousel with:
 *   - mouse-wheel → horizontal scroll (Shift+wheel = 3× faster)
 *   - click-drag  → scroll by dragging
 *   - touch-swipe → native touch scroll
 * Snap behaviour and scrollbar-hiding handled via the .product-carousel CSS class.
 */
export default function ProductCarousel({ children, className = '', style }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const dragStartX = useRef(0);
    const scrollAtDragStart = useRef(0);

    /* ── wheel → horizontal ── */
    const onWheel = useCallback((e: React.WheelEvent) => {
        const el = ref.current;
        if (!el) return;
        // If delta is mainly vertical, redirect to horizontal scroll
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY * (e.shiftKey ? 3 : 1);
        }
    }, []);

    /* ── mouse drag ── */
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const el = ref.current;
        if (!el) return;
        dragging.current = true;
        dragStartX.current = e.pageX - el.getBoundingClientRect().left;
        scrollAtDragStart.current = el.scrollLeft;
        el.classList.add('dragging');
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        const el = ref.current;
        if (!dragging.current || !el) return;
        e.preventDefault();
        const x = e.pageX - el.getBoundingClientRect().left;
        const delta = (x - dragStartX.current) * 1.4;
        el.scrollLeft = scrollAtDragStart.current - delta;
    }, []);

    const stopDrag = useCallback(() => {
        dragging.current = false;
        ref.current?.classList.remove('dragging');
    }, []);

    /* ── touch swipe ── */
    const touchStartX = useRef(0);
    const scrollAtTouchStart = useRef(0);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const el = ref.current;
        if (!el) return;
        touchStartX.current = e.touches[0].clientX;
        scrollAtTouchStart.current = el.scrollLeft;
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const el = ref.current;
        if (!el) return;
        el.scrollLeft = scrollAtTouchStart.current + (touchStartX.current - e.touches[0].clientX);
    }, []);

    return (
        <div
            ref={ref}
            className={`product-carousel ${className}`}
            style={style}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
        >
            {children}
        </div>
    );
}
