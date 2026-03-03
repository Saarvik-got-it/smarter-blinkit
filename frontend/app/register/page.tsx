'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/context';

export default function RegisterPage() {
    const { register, toast } = useApp();
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer', phone: '', shopName: '' });
    const [loading, setLoading] = useState(false);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register(form);
            toast('Account created! Welcome aboard 🎉', 'success');
            router.push('/dashboard');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Registration failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,210,106,0.08) 0%, transparent 60%)' }}>
            <div style={{ width: '100%', maxWidth: '460px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Create Account</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Join the smarter marketplace</p>
                </div>

                {/* Role Picker */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    {[{ v: 'buyer', icon: '🛒', label: 'Buyer', sub: 'Shop & explore' }, { v: 'seller', icon: '🏪', label: 'Seller', sub: 'Sell products' }].map(r => (
                        <button key={r.v} onClick={() => setForm(f => ({ ...f, role: r.v }))} type="button"
                            style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-lg)', border: `2px solid ${form.role === r.v ? 'var(--accent)' : 'var(--border)'}`, background: form.role === r.v ? 'var(--accent-subtle)' : 'var(--bg-card)', cursor: 'pointer', transition: 'var(--transition)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{r.icon}</div>
                            <div style={{ fontWeight: 700, color: form.role === r.v ? 'var(--accent)' : 'var(--text-primary)' }}>{r.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                        </button>
                    ))}
                </div>

                <div className="card" style={{ padding: '32px' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-input" placeholder="John Doe" value={form.name} onChange={set('name')} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" placeholder="+91 98765..." value={form.phone} onChange={set('phone')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input className="form-input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
                        </div>
                        {form.role === 'seller' && (
                            <div className="form-group">
                                <label className="form-label">Shop Name</label>
                                <input className="form-input" placeholder="My Awesome Store" value={form.shopName} onChange={set('shopName')} required />
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                            {loading ? '⏳ Creating...' : `Create ${form.role === 'buyer' ? 'Buyer' : 'Seller'} Account →`}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Already have an account?{' '}
                    <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                </p>
            </div>
        </div>
    );
}
