'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useApp } from '@/lib/context';
import FaceLogin from '@/components/FaceLogin';
import { fadeUp, staggerContainer } from '@/lib/animations';

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
            const loggedInUser = await login(form.email, form.password);
            toast('Welcome back! 👋', 'success');
            if (loggedInUser?.role === 'seller') {
                router.replace('/dashboard');
            } else {
                router.replace('/shop');
            }
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            {/* Background */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,210,106,0.1) 0%, transparent 65%)' }} />
            <div className="blob blob-green" style={{ width: 500, height: 500, top: '-20%', right: '-10%', opacity: 0.4 }} />
            <div className="blob blob-blue" style={{ width: 350, height: 350, bottom: '-10%', left: '-8%', opacity: 0.3 }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(0,210,106,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,106,0.025) 1px, transparent 1px)`, backgroundSize: '50px 50px', pointerEvents: 'none' }} />

            <motion.div variants={staggerContainer} initial="hidden" animate="visible"
                style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '20px', textDecoration: 'none' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Welcome back</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Sign in to continue shopping</p>
                </motion.div>

                <motion.div variants={fadeUp} className="glass-panel" style={{ padding: '32px' }}>
                    {!showFace ? (
                        <>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <motion.div variants={fadeUp} className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input glass-input" type="email" placeholder="you@example.com"
                                        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                                </motion.div>
                                <motion.div variants={fadeUp} className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="form-label">Password</label>
                                        <Link href="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>Forgot Password?</Link>
                                    </div>
                                    <input className="form-input glass-input" type="password" placeholder="••••••••"
                                        value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                                </motion.div>
                                <motion.div variants={fadeUp} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <button type="submit" className="btn btn-primary w-full btn-lg btn-glow" disabled={loading}>
                                        {loading ? '⏳ Signing in...' : 'Sign In →'}
                                    </button>
                                </motion.div>
                            </form>

                            <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative', height: '1px', background: 'var(--border)' }}>
                                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>or</span>
                            </div>

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <button onClick={() => setShowFace(true)} className="btn btn-secondary w-full" style={{ gap: '10px' }}>
                                    <span>🪪</span> Sign in with Face ID
                                </button>
                            </motion.div>
                        </>
                    ) : (
                        <FaceLogin onBack={() => setShowFace(false)} />
                    )}
                </motion.div>

                <motion.p variants={fadeUp} style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    New here?{' '}
                    <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create an account</Link>
                </motion.p>
            </motion.div>
        </div>
    );
}
