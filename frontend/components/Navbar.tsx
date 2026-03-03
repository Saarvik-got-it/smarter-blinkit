'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';

export default function Navbar() {
    const { user, logout, cartCount, setCartOpen } = useApp();
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => { logout(); router.push('/'); };

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link href="/" className="navbar-logo">
                    <div className="navbar-logo-icon">⚡</div>
                    <span>Smarter<span className="text-accent">Blinkit</span></span>
                </Link>

                <div className="navbar-links">
                    {user ? (
                        <>
                            <Link href="/dashboard" className={`navbar-link ${pathname.startsWith('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
                            {user.role === 'buyer' && (
                                <>
                                    <Link href="/shop" className={`navbar-link ${pathname.startsWith('/shop') ? 'active' : ''}`}>Shop</Link>
                                    <Link href="/ai-agent" className={`navbar-link ${pathname.startsWith('/ai-agent') ? 'active' : ''}`}>
                                        <span className="ai-badge" style={{ fontSize: '0.65rem' }}>AI</span> Recipe Agent
                                    </Link>
                                </>
                            )}
                            {user.role === 'buyer' && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setCartOpen(true)} style={{ gap: '6px' }}>
                                    🛒 <span>Cart ({cartCount})</span>
                                </button>
                            )}
                            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {user.name.split(' ')[0]} · <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '2px 7px' }}>{user.role}</span>
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="navbar-link">Sign in</Link>
                            <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
