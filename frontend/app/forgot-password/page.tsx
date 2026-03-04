'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';

export default function ForgotPasswordPage() {
    const { api, toast } = useApp();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(1); // 1: Request, 2: Reset
    const [loading, setLoading] = useState(false);

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/reset-password-request', { email });
            toast(data.message, 'success');
            setStep(2);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Email not found', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/reset-password', { email, newPassword });
            toast(data.message, 'success');
            router.push('/login');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Reset failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,210,106,0.08) 0%, transparent 60%)' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>{step === 1 ? 'Enter your email to receive reset steps' : 'Now enter your new password'}</p>
                </div>

                <div className="card" style={{ padding: '32px' }}>
                    {step === 1 ? (
                        <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div className="form-group">
                                <label className="form-label">Account Email</label>
                                <input className="form-input" type="email" placeholder="you@example.com"
                                    value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                                {loading ? '⏳ Checking...' : 'Continue →'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input className="form-input" type="password" placeholder="Min 6 characters"
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                            </div>
                            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                                {loading ? '⏳ Resetting...' : 'Change Password →'}
                            </button>
                        </form>
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Remembered?{' '}
                    <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Back to login</Link>
                </p>
            </div>
        </div>
    );
}
