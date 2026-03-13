'use client';
import { useRef, useCallback, useEffect, useState, type ReactNode, type CSSProperties } from 'react';

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
    const [isHovered, setIsHovered] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const maxScrollLeft = el.scrollWidth - el.clientWidth;
        setCanScrollLeft(el.scrollLeft > 2);
        setCanScrollRight(el.scrollLeft < maxScrollLeft - 2);
    }, []);

    const handleWheelCapture = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;

        const canScroll = el.scrollWidth > el.clientWidth;
        if (!canScroll) return;

        // Force wheel gestures to stay inside the carousel and move horizontally.
        event.preventDefault();
        event.stopPropagation();
        const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (primaryDelta !== 0) {
            el.scrollLeft += primaryDelta * (event.shiftKey ? 1.8 : 1.2);
            updateScrollState();
        }
    }, [updateScrollState]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const onScrollNative = () => updateScrollState();
        el.addEventListener('scroll', onScrollNative, { passive: true });

        updateScrollState();
        return () => {
            el.removeEventListener('scroll', onScrollNative as EventListener);
        };
    }, [updateScrollState]);

    const scrollByAmount = useCallback((direction: -1 | 1) => {
        const el = ref.current;
        if (!el) return;
        const cardStep = Math.max(260, Math.round(el.clientWidth * 0.82));
        el.scrollBy({ left: direction * cardStep, behavior: 'smooth' });
        requestAnimationFrame(updateScrollState);
    }, [updateScrollState]);

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
        const delta = (x - dragStartX.current) * 1.25;
        el.scrollLeft = scrollAtDragStart.current - delta;
        updateScrollState();
    }, [updateScrollState]);

    const stopDrag = useCallback(() => {
        dragging.current = false;
        ref.current?.classList.remove('dragging');
        updateScrollState();
    }, [updateScrollState]);

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
        updateScrollState();
    }, [updateScrollState]);

    return (
        <div
            className="product-carousel-shell"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); stopDrag(); }}
            onWheelCapture={handleWheelCapture}
        >
            <button
                type="button"
                aria-label="Scroll products left"
                className={`product-carousel-nav left ${isHovered && canScrollLeft ? 'show' : ''}`}
                onClick={() => scrollByAmount(-1)}
                tabIndex={isHovered && canScrollLeft ? 0 : -1}
            >
                ‹
            </button>

            <div
                ref={ref}
                className={`product-carousel ${className}`}
                style={style}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDrag}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
            >
                {children}
            </div>

            <button
                type="button"
                aria-label="Scroll products right"
                className={`product-carousel-nav right ${isHovered && canScrollRight ? 'show' : ''}`}
                onClick={() => scrollByAmount(1)}
                tabIndex={isHovered && canScrollRight ? 0 : -1}
            >
                ›
            </button>

            <div className={`product-carousel-edge left ${canScrollLeft ? 'visible' : ''}`} aria-hidden="true" />
            <div className={`product-carousel-edge right ${canScrollRight ? 'visible' : ''}`} aria-hidden="true" />
        </div>
    );
}
