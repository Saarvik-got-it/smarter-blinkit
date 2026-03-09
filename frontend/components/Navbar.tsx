'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/lib/context';

import { useEffect, useState } from 'react';

export default function Navbar() {
    const { user, logout, cartCount, setCartOpen, api } = useApp();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const savedTheme = localStorage.getItem('sb_theme');
        if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const [scrolled, setScrolled] = useState(false);

    const handleLogout = () => {
        if (logout()) {
            router.push('/');
        }
    };

    return (
        <motion.nav className={`navbar${scrolled ? ' scrolled' : ''}`}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <div className="navbar-inner">
                <motion.div whileHover={{ scale: 1.04 }} transition={{ duration: 0.2 }}>
                    <Link href="/" className="navbar-logo">
                        <div className="navbar-logo-icon">⚡</div>
                        <span>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                </motion.div>

                <div className="navbar-links">
                    {user ? (
                        <>
                            <Link href="/dashboard" className={`navbar-link ${pathname.startsWith('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
                            {user.role === 'buyer' && (
                                <>
                                    <Link href="/shop" className={`navbar-link ${pathname.startsWith('/shop') ? 'active' : ''}`}>Shop</Link>
                                    <Link href="/ai-agent" className={`navbar-link ${pathname.startsWith('/ai-agent') ? 'active' : ''}`}>
                                        <span className="ai-badge" style={{ fontSize: '0.65rem' }}>AI</span> Agent
                                    </Link>

                                    {/* Prominent Storeboard Link */}
                                    <Link href="/storeboard" className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none', boxShadow: '0 0 10px rgba(255,82,82,0.4)', fontWeight: 800 }}>
                                        <span style={{ animation: 'pulse 1.5s infinite' }}>🔴</span> LIVE Storeboard
                                    </Link>

                                    <Link href="/money-map" className={`navbar-link ${pathname.startsWith('/money-map') ? 'active' : ''}`}>🗺 Map</Link>
                                </>
                            )}
                            {user.role === 'buyer' && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setCartOpen(true)} style={{ gap: '6px' }}>
                                    🛒 <span>Cart ({cartCount})</span>
                                </button>
                            )}
                            {/* Address Switcher */}
                            {user.role === 'buyer' && user.savedAddresses && user.savedAddresses.length > 0 && (
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', padding: '4px 12px', borderRadius: '16px', border: '1px solid var(--border)', cursor: 'pointer', maxWidth: '200px' }}
                                    onMouseEnter={(e) => { const el = document.getElementById('navbar-addr-dropdown'); if (el) el.style.display = 'block'; }}
                                    onMouseLeave={(e) => { const el = document.getElementById('navbar-addr-dropdown'); if (el) el.style.display = 'none'; }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                        <span style={{ fontSize: '1rem' }}>📍</span>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delivering to</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {user.location?.address?.split(',')[0] || user.location?.city || 'Select Address'}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
                                    </div>

                                    {/* Dropdown Menu */}
                                    <div id="navbar-addr-dropdown" style={{ display: 'none', position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', minWidth: '240px', boxShadow: 'var(--shadow-lg)', zIndex: 100 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', marginBottom: '4px' }}>SAVED ADDRESSES</div>
                                        {user.savedAddresses.map((addr: any) => {
                                            const isActive = user.location?.coordinates && addr.coordinates && user.location.coordinates[0] === addr.coordinates[0] && user.location.coordinates[1] === addr.coordinates[1];
                                            return (
                                                <div key={addr._id}
                                                    onClick={async () => {
                                                        if (isActive) return;
                                                        try {
                                                            const { data } = await api.put('/auth/addresses/active', { addressId: addr._id });
                                                            useApp().updateUser(data.user);
                                                            useApp().toast('Delivery address updated', 'success');
                                                        } catch (e) { }
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px', borderRadius: '8px', cursor: isActive ? 'default' : 'pointer', background: isActive ? 'var(--accent-subtle)' : 'transparent', transition: 'var(--transition)' }}
                                                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>{addr.tag === 'Home' ? '🏠' : addr.tag === 'Work' ? '🏢' : '📍'}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>{addr.tag}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>{addr.address}</div>
                                                    </div>
                                                    {isActive && <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>✅</span>}
                                                </div>
                                            );
                                        })}
                                        <div style={{ borderTop: '1px outset var(--border)', margin: '4px 0' }} />
                                        <Link href="/dashboard" style={{ display: 'block', padding: '8px', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, textAlign: 'center', borderRadius: '8px' }}>
                                            + Add / Manage Addresses
                                        </Link>
                                    </div>
                                </div>
                            )}

                            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {user.name.split(' ')[0]} <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '2px 7px' }}>{user.role}</span>
                            </span>

                            {/* Theme Toggle Button */}
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                                document.documentElement.setAttribute('data-theme', newTheme);
                                localStorage.setItem('sb_theme', newTheme);
                            }} style={{ fontSize: '1.2rem', padding: '4px' }} title="Toggle Theme">
                                🌗
                            </button>

                            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="navbar-link">Sign in</Link>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                                document.documentElement.setAttribute('data-theme', t);
                                localStorage.setItem('sb_theme', t);
                            }} style={{ fontSize: '1.1rem', padding: '6px 8px' }} title="Toggle Theme">🌗</button>
                            <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
                        </>
                    )}
                </div>
            </div>
        </motion.nav>
    );
}
