'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import FaceRegister from '@/components/FaceRegister';
import MapPicker from '@/components/MapPicker';
import type { MapLocationData } from '@/components/MapPickerBase';

export default function RegisterPage() {
    const { register, toast } = useApp();
    const router = useRouter();
    const [form, setForm] = useState<any>({
        name: '', email: '', password: '', role: 'buyer', phone: '', shopName: '',
        streetAddress: '', city: '', state: '', pincode: '', country: 'India',
        location: null
    });
    const [loading, setLoading] = useState(false);
    
    // 1 = General Details, 2 = Location Map, 3 = Face ID
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f: any) => ({ ...f, [field]: e.target.value }));

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(2);
    };

    const handleLocationConfirm = async (loc: MapLocationData) => {
        const finalForm = {
            ...form,
            streetAddress: loc.street || form.streetAddress, // fallback if empty
            city: loc.city || form.city,
            state: loc.state || form.state,
            pincode: loc.pincode || form.pincode,
            address: loc.address, // formatted full address
            location: {
                type: 'Point',
                coordinates: loc.coordinates,
                address: loc.address
            }
        };
        
        setForm(finalForm);
        setLoading(true);

        try {
            await register(finalForm);
            toast('Account created! Now set up your Face ID 🎉', 'success');
            setStep(3);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Registration failed', 'error');
            setStep(1); // send back to fix details
        } finally {
            setLoading(false);
        }
    };

    const handleSkipFace = () => {
        router.replace(form.role === 'seller' ? '/dashboard' : '/shop');
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,210,106,0.08) 0%, transparent 60%)' }}>
            <div style={{ width: '100%', maxWidth: step === 2 ? '800px' : '480px', transition: 'max-width 0.3s ease' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
                        {step === 1 ? 'Create Account' : step === 2 ? 'Set Delivery Location' : 'Setup Face ID'}
                    </h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                        {step === 1 ? 'Join the smarter marketplace' : step === 2 ? 'Pinpoint exact location for faster delivery' : 'Lightning fast logins'}
                    </p>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: step > 1 ? '#00d26a' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#000' }}>
                            {step > 1 ? '✓' : '1'}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: step === 1 ? 'var(--text-primary)' : 'var(--text-muted)', display: step === 2 ? 'none' : 'inline' }}>Account Info</span>
                    </div>
                    <div style={{ flex: 1, height: 2, background: step > 1 ? 'var(--accent)' : 'var(--border)', maxWidth: 60 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: step > 2 ? '#00d26a' : step === 2 ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: step >= 2 ? '#000' : 'var(--text-muted)' }}>
                            {step > 2 ? '✓' : '2'}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: step === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Location</span>
                    </div>
                    <div style={{ flex: 1, height: 2, background: step > 2 ? 'var(--accent)' : 'var(--border)', maxWidth: 60 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: step === 3 ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: step === 3 ? '#000' : 'var(--text-muted)' }}>3</div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: step === 3 ? 'var(--text-primary)' : 'var(--text-muted)', display: step === 2 ? 'none' : 'inline' }}>Face ID</span>
                    </div>
                </div>

                {/* Role Picker */}
                {step === 1 && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        {[{ v: 'buyer', icon: '🛒', label: 'Buyer', sub: 'Shop & explore' }, { v: 'seller', icon: '🏪', label: 'Seller', sub: 'Sell products' }].map(r => (
                            <button key={r.v} onClick={() => setForm((f: any) => ({ ...f, role: r.v }))} type="button"
                                style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-lg)', border: `2px solid ${form.role === r.v ? 'var(--accent)' : 'var(--border)'}`, background: form.role === r.v ? 'var(--accent-subtle)' : 'var(--bg-card)', cursor: 'pointer', transition: 'var(--transition)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{r.icon}</div>
                                <div style={{ fontWeight: 700, color: form.role === r.v ? 'var(--accent)' : 'var(--text-primary)' }}>{r.label}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="card" style={{ padding: step === 2 ? '2px' : '32px', overflow: 'hidden' }}>
                    {step === 1 && (
                        <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" placeholder="John Doe" value={form.name} onChange={set('name')} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" placeholder="+91 98765..." value={form.phone} onChange={set('phone')} required />
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
                                    <label className="form-label">Shop/Business Name</label>
                                    <input className="form-input" placeholder="My Awesome Store" value={form.shopName} onChange={set('shopName')} required />
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: '12px' }}>
                                Continue to Location 📍
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <div style={{ width: '100%', height: '600px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '16px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Move the pin to your exact delivery location</span>
                            </div>
                            <MapPicker onConfirm={handleLocationConfirm} buttonText={loading ? "Creating Account..." : "Confirm Location & Create Account"} />
                        </div>
                    )}

                    {step === 3 && (
                        <FaceRegister userRole={form.role} onSkip={handleSkipFace} />
                    )}
                </div>

                {step === 1 && (
                    <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                    </p>
                )}
            </div>
        </div>
    );
}
