'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent floating AI helper bubble in the bottom-right corner.
 * Appears 2.5 s after page load. Click → navigate to /ai-agent.
 * Hidden on the AI agent page itself. Fully dismissible.
 * Pure visual — zero business logic.
 */
export default function FloatingAIBubble() {
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 2500);
        return () => clearTimeout(t);
    }, []);

    // Hide on AI page (redundant there)
    if (pathname === '/ai-agent' || dismissed) return null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ scale: 0, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0, y: 24 }}
                    transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                    style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 200 }}
                >
                    <div style={{ position: 'relative' }}>
                        <Link href="/ai-agent" className="fab-inner">
                            <span className="fab-icon">🧠</span>
                            <div>
                                <div className="fab-label">Need help?</div>
                                <div className="fab-sub">Ask AI Agent</div>
                            </div>
                            <span className="fab-pulse" />
                        </Link>
                        <button
                            className="fab-dismiss"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDismissed(true);
                            }}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
