'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import FaceLogin from '@/components/FaceLogin';

export default function LoginPage() {
    const { login, toast } = useApp();
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showFace, setShowFace] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast('Welcome back! 👋', 'success');
            router.push('/dashboard');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,210,106,0.08) 0%, transparent 60%)' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Welcome back</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Sign in to continue shopping</p>
                </div>

                <div className="card" style={{ padding: '32px' }}>
                    {!showFace ? (
                        <>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" placeholder="you@example.com"
                                        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input className="form-input" type="password" placeholder="••••••••"
                                        value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                                </div>
                                <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                                    {loading ? '⏳ Signing in...' : 'Sign In →'}
                                </button>
                            </form>

                            <div className="divider" style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>or</span>
                            </div>

                            <button onClick={() => setShowFace(true)} className="btn btn-secondary w-full" style={{ gap: '10px' }}>
                                <span>🪪</span> Sign in with Face ID
                            </button>
                        </>
                    ) : (
                        <FaceLogin onBack={() => setShowFace(false)} />
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    New here?{' '}
                    <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create an account</Link>
                </p>
            </div>
        </div>
    );
}
