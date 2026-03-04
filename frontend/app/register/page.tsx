'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import FaceRegister from '@/components/FaceRegister';

export default function RegisterPage() {
    const { register, toast } = useApp();
    const router = useRouter();
    const [form, setForm] = useState<any>({
        name: '', email: '', password: '', role: 'buyer', phone: '',
        shopName: '', streetAddress: '', city: '', state: '', pincode: '', country: 'India',
        location: null
    });
    const [loading, setLoading] = useState(false);
    const [showFace, setShowFace] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingPincode, setLoadingPincode] = useState(false);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast('Geolocation is not supported by your browser', 'error');
            return;
        }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lon } = position.coords;

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
                    const data = await res.json();

                    if (data && data.address) {
                        const addr = data.address;
                        const street = [addr.road, addr.suburb, addr.neighbourhood, addr.residential].filter(Boolean).join(', ') || '';
                        const city = addr.city || addr.town || addr.village || addr.state_district || '';
                        const state = addr.state || '';
                        const pincode = addr.postcode || '';

                        setForm((f: any) => ({
                            ...f,
                            streetAddress: street,
                            city: city,
                            state: state,
                            pincode: pincode,
                            location: {
                                type: 'Point',
                                coordinates: [lon, lat],
                                address: data.display_name
                            }
                        }));
                        toast('Location & Address mapped successfully!', 'success');
                    } else {
                        setForm((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                        toast('Coordinates mapped, but address details unavailable.', 'info');
                    }
                } catch (err) {
                    setForm((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                    toast('Coordinates mapped (Geocoding failed).', 'info');
                } finally {
                    setLoadingLocation(false);
                }
            },
            (err) => {
                toast('Failed to get location: ' + err.message, 'error');
                setLoadingLocation(false);
            }
        );
    };

    const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pin = e.target.value.replace(/\D/g, '');
        setForm((f: any) => ({ ...f, pincode: pin }));

        if (pin.length === 6) {
            setLoadingPincode(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data?.[0]?.Status === 'Success') {
                    const postOffice = data[0].PostOffice[0];
                    setForm((f: any) => ({
                        ...f,
                        city: postOffice.District,
                        state: postOffice.State
                    }));
                    toast(`Mapped to ${postOffice.District}, ${postOffice.State}`, 'success');
                }
            } catch (err) {
                console.warn('Pincode lookup failed');
            } finally {
                setLoadingPincode(false);
            }
        }
    };

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f: any) => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalLocation = form.location;

            if (!finalLocation && form.streetAddress && form.city) {
                const query = encodeURIComponent(`${form.streetAddress}, ${form.city}, ${form.state}, ${form.pincode}, ${form.country}`);
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
                const data = await response.json();

                if (data?.[0]) {
                    finalLocation = {
                        type: 'Point',
                        coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
                        address: data[0].display_name
                    };
                }
            }

            const finalForm = {
                ...form,
                address: form.streetAddress,
                location: finalLocation || {
                    type: 'Point',
                    coordinates: [0, 0],
                    address: `${form.streetAddress}, ${form.city}, ${form.state}, ${form.pincode}, ${form.country}`.replace(/, ,/g, ',').trim()
                }
            };

            await register(finalForm);
            toast('Account created! Now set up your Face ID 🎉', 'success');
            setShowFace(true);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Registration failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipFace = () => {
        router.replace(form.role === 'seller' ? '/dashboard' : '/shop');
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,210,106,0.08) 0%, transparent 60%)' }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div className="navbar-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⚡</div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smarter<span className="text-accent">Blinkit</span></span>
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Create Account</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Join the smarter marketplace</p>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: !showFace ? 'var(--accent)' : '#00d26a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#000' }}>
                            {showFace ? '✓' : '1'}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: !showFace ? 'var(--text-primary)' : 'var(--text-muted)' }}>Account Info</span>
                    </div>
                    <div style={{ flex: 1, height: 2, background: showFace ? 'var(--accent)' : 'var(--border)', maxWidth: 60 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: showFace ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: showFace ? '#000' : 'var(--text-muted)' }}>2</div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: showFace ? 'var(--text-primary)' : 'var(--text-muted)' }}>Face ID Setup</span>
                    </div>
                </div>

                {/* Role Picker */}
                {!showFace && (
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

                <div className="card" style={{ padding: '32px' }}>
                    {!showFace ? (
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
                                    <label className="form-label">Shop/Business Name</label>
                                    <input className="form-input" placeholder="My Awesome Store" value={form.shopName} onChange={set('shopName')} required />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Street Address</label>
                                <input className="form-input" placeholder="e.g. 12, MG Road, Landmark" value={form.streetAddress} onChange={set('streetAddress')} required />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">PIN Code</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" placeholder="600001" value={form.pincode} onChange={handlePincodeChange} required maxLength={6} />
                                        {loadingPincode && <div className="spinner" style={{ position: 'absolute', right: '12px', top: '10px', width: '16px', height: '16px' }} />}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">City / District</label>
                                    <input className="form-input" placeholder="Bengaluru" value={form.city} onChange={set('city')} required />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">State</label>
                                    <input className="form-input" placeholder="Karnataka" value={form.state} onChange={set('state')} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <select className="form-input" value={form.country} onChange={set('country')}>
                                        <option value="India">India</option>
                                        <option value="USA">USA</option>
                                        <option value="UAE">UAE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Location (For faster delivery routing)</label>
                                <button
                                    type="button"
                                    onClick={handleGetLocation}
                                    disabled={loadingLocation}
                                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: form.location ? 'var(--accent-subtle)' : 'var(--bg-elevated)', border: `1px solid ${form.location ? 'var(--accent)' : 'var(--border)'}`, color: form.location ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, transition: 'var(--transition)' }}
                                >
                                    {loadingLocation ? 'Detecting...' : form.location ? '📍 Exact Coordinates Mapped via GPS' : '📍 Auto-Detect Exact GPS Location'}
                                </button>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>If not auto-detected, we will geocode your typed address.</p>
                            </div>

                            {/* Face ID teaser */}
                            <div style={{ padding: '12px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.3rem' }}>🪪</span>
                                <span>Next step: <strong>Set up Face ID</strong> for instant future logins — takes just 5 seconds.</span>
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '4px' }}>
                                {loading ? 'Creating...' : 'Create Account & Set Up Face ID →'}
                            </button>
                        </form>
                    ) : (
                        <FaceRegister userRole={form.role} onSkip={handleSkipFace} />
                    )}
                </div>

                {!showFace && (
                    <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                    </p>
                )}
            </div>
        </div>
    );
}
