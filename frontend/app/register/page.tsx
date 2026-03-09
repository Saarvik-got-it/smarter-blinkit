'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/context';
import FaceRegister from '@/components/FaceRegister';
import MapPicker from '@/components/MapPicker';
import type { MapLocationData } from '@/components/MapPickerBase';
import { fadeUp, staggerContainer } from '@/lib/animations';

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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            {/* Background */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,210,106,0.1) 0%, transparent 65%)' }} />
            <div className="blob blob-green" style={{ width: 500, height: 500, top: '-20%', right: '-10%', opacity: 0.35 }} />
            <div className="blob blob-blue" style={{ width: 350, height: 350, bottom: '-10%', left: '-8%', opacity: 0.25 }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(0,210,106,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,106,0.025) 1px, transparent 1px)`, backgroundSize: '50px 50px', pointerEvents: 'none' }} />

            <motion.div variants={staggerContainer} initial="hidden" animate="visible"
                style={{ width: '100%', maxWidth: step === 2 ? '800px' : '480px', transition: 'max-width 0.35s ease', position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '20px', textDecoration: 'none' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <AnimatePresence mode="wait">
                        <motion.div key={step}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.3 }}>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
                                {step === 1 ? 'Create Account' : step === 2 ? 'Set Delivery Location' : 'Setup Face ID'}
                            </h1>
                            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                                {step === 1 ? 'Join the smarter marketplace' : step === 2 ? 'Pinpoint exact location for faster delivery' : 'Lightning fast logins'}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Step Indicator */}
                <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
                    {[1, 2, 3].map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <motion.div
                                animate={{ scale: step === s ? 1.1 : 1, background: step > s ? '#00d26a' : step === s ? 'var(--accent)' : 'var(--border)' }}
                                transition={{ duration: 0.3 }}
                                style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: step >= s ? '#000' : 'var(--text-muted)', boxShadow: step === s ? '0 0 12px rgba(0,210,106,0.5)' : 'none' }}>
                                {step > s ? '✓' : s}
                            </motion.div>
                            {i < 2 && <motion.div animate={{ background: step > s ? 'var(--accent)' : 'var(--border)' }} transition={{ duration: 0.3 }} style={{ width: 52, height: 2 }} />}
                        </div>
                    ))}
                </motion.div>

                {/* Role Picker (Step 1 only) */}
                <AnimatePresence>
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                            style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            {[{ v: 'buyer', icon: '🛒', label: 'Buyer', sub: 'Shop & explore' }, { v: 'seller', icon: '🏪', label: 'Seller', sub: 'Sell products' }].map(r => (
                                <motion.button key={r.v} onClick={() => setForm((f: any) => ({ ...f, role: r.v }))} type="button"
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-lg)', border: `2px solid ${form.role === r.v ? 'var(--accent)' : 'var(--border)'}`, background: form.role === r.v ? 'var(--accent-subtle)' : 'var(--bg-card)', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', textAlign: 'center', boxShadow: form.role === r.v ? '0 0 16px rgba(0,210,106,0.2)' : 'none' }}>
                                    <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{r.icon}</div>
                                    <div style={{ fontWeight: 700, color: form.role === r.v ? 'var(--accent)' : 'var(--text-primary)' }}>{r.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    <motion.div key={step}
                        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="glass-panel"
                        style={{ padding: step === 2 ? '2px' : '32px', overflow: 'hidden' }}>

                        {step === 1 && (
                            <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input className="form-input glass-input" placeholder="John Doe" value={form.name} onChange={set('name')} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input className="form-input glass-input" placeholder="+91 98765..." value={form.phone} onChange={set('phone')} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input glass-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input className="form-input glass-input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
                                </div>
                                {form.role === 'seller' && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="form-group">
                                        <label className="form-label">Shop/Business Name</label>
                                        <input className="form-input glass-input" placeholder="My Awesome Store" value={form.shopName} onChange={set('shopName')} required />
                                    </motion.div>
                                )}
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ marginTop: '12px' }}>
                                    <button type="submit" className="btn btn-primary btn-lg w-full btn-glow">
                                        Continue to Location 📍
                                    </button>
                                </motion.div>
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
                    </motion.div>
                </AnimatePresence>

                {step === 1 && (
                    <motion.p variants={fadeUp} style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
}
