// ================================================================
// SMARTER BLINKIT — Animation System
// Framer Motion variants and reusable animation configs
// ================================================================
import type { Variants } from 'framer-motion';

type Bezier = [number, number, number, number];

const ease1: Bezier = [0.25, 0.46, 0.45, 0.94];
const ease2: Bezier = [0.34, 1.56, 0.64, 1];

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: ease1 },
    },
    exit: { opacity: 0, y: -12, transition: { duration: 0.25 } },
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.45, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.4, ease: ease2 },
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

export const slideInRight: Variants = {
    hidden: { opacity: 0, x: 40 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.5, ease: ease1 },
    },
    exit: { opacity: 0, x: -20, transition: { duration: 0.25 } },
};

export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -40 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.5, ease: ease1 },
    },
};

export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05,
        },
    },
};

export const staggerContainerFast: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.0,
        },
    },
};

export const cardHover: Variants = {
    rest: { y: 0 },
    hover: {
        y: -6,
        transition: { duration: 0.3, ease: ease1 },
    },
};

export const floatAnimation: Variants = {
    animate: {
        y: [0, -12, 0],
        transition: {
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
        },
    },
};

export const glowPulse: Variants = {
    animate: {
        boxShadow: [
            '0 0 20px rgba(0, 210, 106, 0.3)',
            '0 0 40px rgba(0, 210, 106, 0.6)',
            '0 0 20px rgba(0, 210, 106, 0.3)',
        ],
        transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
    },
};

export const pageTransition: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: ease1 },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: { duration: 0.3 },
    },
};

export const heroTextVariant = {
    hidden: { opacity: 0, y: 40, filter: 'blur(8px)' },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            delay: i * 0.15,
            duration: 0.7,
            ease: ease1,
        },
    }),
};

export const buttonTap = {
    whileTap: { scale: 0.96 },
    whileHover: { scale: 1.03 },
    transition: { duration: 0.15, ease: 'easeOut' },
};
