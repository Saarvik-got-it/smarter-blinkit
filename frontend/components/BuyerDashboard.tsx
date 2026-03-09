'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import FaceRegister from '@/components/FaceRegister';
import MapPicker from '@/components/MapPicker';
import type { MapLocationData } from '@/components/MapPickerBase';

export default function BuyerDashboard() {
    const { user, api, updateUser, deleteAccount, toast } = useApp();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'orders' | 'faceid' | 'account'>('orders');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [profileForm, setProfileForm] = useState<any>({ name: '', phone: '', address: '', city: '', state: '', pincode: '', location: null });
    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingPincode, setLoadingPincode] = useState(false);
    const [addingAddress, setAddingAddress] = useState(false);
    const [newAddrTag, setNewAddrTag] = useState('Home');
    const router = useRouter();

    useEffect(() => {
        if (user) {
            let addr = user.location?.address || '';
            let cty = user.location?.city || '';
            let st = user.location?.state || '';
            let pin = user.location?.pincode || '';

            // Backwards compatibility: Extract city, state, pin from old full-string geocoded addresses
            if (addr && (!cty || !st || !pin)) {
                const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 3) {
                    const pinIndex = parts.findIndex(p => /^\d{6}$/.test(p));
                    if (pinIndex !== -1) {
                        if (!pin) pin = parts[pinIndex];
                        if (!st && pinIndex >= 1) st = parts[pinIndex - 1];
                        if (!cty && pinIndex >= 2) cty = parts[pinIndex - 2];
                        addr = parts.slice(0, pinIndex - 2).join(', ');
                    }
                }
            }

            setProfileForm({
                name: user.name || '',
                phone: user.phone || '',
                address: addr,
                city: cty,
                state: st,
                pincode: pin,
                location: user.location?.coordinates?.[0] !== 0 ? user.location : null
            });
        }
    }, [user]);

    const handleGetLocation = () => {
        if (!navigator.geolocation) return toast('Geolocation is not supported by your browser', 'error');
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
                        setProfileForm((f: any) => ({
                            ...f, address: street, city: addr.city || addr.town || addr.state_district || '', state: addr.state || '', pincode: addr.postcode || '',
                            location: { type: 'Point', coordinates: [lon, lat], address: data.display_name, city: addr.city || addr.town || '', state: addr.state || '', pincode: addr.postcode || '', country: 'India' }
                        }));
                        toast('Location & Address mapped successfully!', 'success');
                    } else {
                        setProfileForm((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                    }
                } catch {
                    setProfileForm((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                } finally { setLoadingLocation(false); }
            },
            (err) => { toast('Failed to get location: ' + err.message, 'error'); setLoadingLocation(false); }
        );
    };

    const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pin = e.target.value.replace(/\D/g, '');
        setProfileForm((f: any) => ({ ...f, pincode: pin }));
        if (pin.length === 6) {
            setLoadingPincode(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data?.[0]?.Status === 'Success') {
                    const postOffice = data[0].PostOffice[0];
                    setProfileForm((f: any) => ({ ...f, city: postOffice.District, state: postOffice.State }));
                    toast(`Mapped to ${postOffice.District}, ${postOffice.State}`, 'success');
                }
            } catch { } finally { setLoadingPincode(false); }
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdatingProfile(true);
        try {
            let coords = profileForm.location?.coordinates || [0, 0];
            
            if (!profileForm.location || profileForm.address !== profileForm.location.address || profileForm.city !== profileForm.location.city || profileForm.pincode !== profileForm.location.pincode) {
                const queriesToTry = [
                    `${profileForm.address}, ${profileForm.city}, ${profileForm.state}, ${profileForm.pincode}`,
                    `${profileForm.address}, ${profileForm.city}, ${profileForm.state}`,
                    `${profileForm.city}, ${profileForm.state}, ${profileForm.pincode}`,
                    `${profileForm.city}, ${profileForm.state}`,
                    profileForm.city
                ];

                let found = false;
                for (const q of queriesToTry) {
                    if (!q || !q.trim()) continue;
                    try {
                        const query = encodeURIComponent(q);
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
                        const data = await response.json();
                        if (data && data.length > 0) {
                            coords = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
                            found = true;
                            break;
                        }
                    } catch { } // ignore fetch errors and try next fallback
                }
                
                if (!found) {
                    toast('Warning: Could not pinpoint exact map coordinates for this address.', 'info');
                    coords = [0, 0]; // Reset so we don't serve stale nearby shops
                }
            }

            const payload = {
                name: profileForm.name,
                phone: profileForm.phone,
                location: {
                    type: 'Point',
                    coordinates: coords,
                    address: profileForm.address,
                    city: profileForm.city,
                    state: profileForm.state,
                    pincode: profileForm.pincode,
                    country: 'India'
                }
            };

            const { data } = await api.put('/auth/me', payload);
            updateUser(data.user);
            toast('Profile updated successfully', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Update failed', 'error');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleSaveNewAddress = async (locData: MapLocationData) => {
        setUpdatingProfile(true);
        try {
            const payload = {
                tag: newAddrTag,
                address: locData.address,
                street: locData.street,
                city: locData.city,
                state: locData.state,
                pincode: locData.pincode,
                coordinates: locData.coordinates
            };
            const { data } = await api.post('/auth/addresses', payload);
            updateUser(data.user);
            setAddingAddress(false);
            setProfileForm({ name: user?.name, phone: user?.phone, address: '', city: '', state: '', pincode: '', location: null });
            toast('Address added to Address Book', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to add address', 'error');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleUpdateProfileMap = async (locData: MapLocationData) => {
        setUpdatingProfile(true);
        try {
            const payload = {
                name: profileForm.name,
                phone: profileForm.phone,
                location: {
                    type: 'Point',
                    coordinates: locData.coordinates,
                    address: locData.address,
                    street: locData.street,
                    city: locData.city,
                    state: locData.state,
                    pincode: locData.pincode,
                    country: 'India'
                }
            };
            const { data } = await api.put('/auth/me', payload);
            updateUser(data.user);
            toast('Profile updated successfully', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Update failed', 'error');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleSetActiveAddress = async (addressId: string) => {
        try {
            const { data } = await api.put('/auth/addresses/active', { addressId });
            updateUser(data.user);
            toast('Active delivery address updated', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to switch address', 'error');
        }
    };

    const handleDeleteAddress = async (addressId: string) => {
        if (!confirm('Are you sure you want to delete this address?')) return;
        try {
            const { data } = await api.delete(`/auth/addresses/${addressId}`);
            updateUser(data.user);
            toast('Address removed', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to delete address', 'error');
        }
    };

    useEffect(() => {
        api.get('/orders/my').then(r => setOrders(r.data.orders || [])).catch(() => { }).finally(() => setLoading(false));
    }, [api]);

    const statusColor: Record<string, string> = {
        pending: 'yellow', confirmed: 'blue', processing: 'blue',
        out_for_delivery: 'blue', delivered: 'green', cancelled: 'red',
    };

    const getMostCommonCategory = () => {
        const cats: Record<string, number> = {};
        orders.forEach(o => o.items?.forEach((item: any) => {
            const cat = item.productId?.category || 'Groceries';
            cats[cat] = (cats[cat] || 0) + 1;
        }));
        return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Groceries';
    };

    const getFavoriteShop = () => {
        const shops: Record<string, number> = {};
        orders.forEach(o => o.items?.forEach((item: any) => {
            const name = item.shopId?.name || 'Local Shop';
            shops[name] = (shops[name] || 0) + 1;
        }));
        return Object.entries(shops).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Local Shop';
    };

    const getAvgOrder = () => {
        if (!orders.length) return '0';
        return (orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0) / orders.length).toFixed(0);
    };

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div style={{ padding: '0 12px 20px' }}>
                    <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent), var(--info))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '12px' }}>
                        {user?.name[0].toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 700 }}>{user?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    <div className="badge badge-green" style={{ marginTop: '8px' }}>Buyer</div>
                    <div className="sidebar-status-bar">
                        <span className="status-online-dot" />
                        Online · Ready to shop
                    </div>
                </div>
                <div className="sidebar-section-label">Navigate</div>
                <a href="/shop" className="sidebar-link"><span className="link-icon">🛒</span> Shop</a>
                <a href="/ai-agent" className="sidebar-link"><span className="link-icon">🧠</span> AI Agent</a>
                <button onClick={() => setActiveTab('orders')} className={`sidebar-link${activeTab === 'orders' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', color: 'inherit', font: 'inherit' }}>
                    <span className="link-icon">📋</span> My Orders
                </button>
                <button onClick={() => setActiveTab('faceid')} className={`sidebar-link${activeTab === 'faceid' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', color: 'inherit', font: 'inherit' }}>
                    <span className="link-icon">🪪</span> Face ID
                </button>
                <button onClick={() => setActiveTab('account')} className={`sidebar-link${activeTab === 'account' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', color: 'var(--text-primary)', font: 'inherit' }}>
                    <span className="link-icon">⚙️</span> Account
                </button>

                <div className="sidebar-section-label" style={{ marginTop: '20px' }}>Quick Actions</div>
                <div className="quick-action-row">
                    <a href="/shop" className="quick-action-btn primary"><span>🛍️</span> Browse Stores</a>
                    <a href="/ai-agent" className="quick-action-btn primary"><span>🧠</span> Ask AI Agent</a>
                    <button onClick={() => setActiveTab('account')} className="quick-action-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}><span>⚙️</span> Account Settings</button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main">
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Welcome back, {user?.name.split(' ')[0]} 👋</h1>
                    <p className="text-muted">{activeTab === 'faceid' ? 'Manage your Face ID' : activeTab === 'account' ? 'Manage your profile and settings' : "Here's your shopping overview"}</p>
                </div>

                {activeTab === 'faceid' ? (
                    <div className="card" style={{ maxWidth: '500px', padding: '32px' }}>
                        <h3 style={{ marginBottom: '8px' }}>🪪 Face ID Enrollment</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>
                            Set up or update your Face ID to enable instant camera-based login. Your face data is stored as an encrypted mathematical hash and never leaves the system.
                        </p>
                        <FaceRegister userRole="buyer" onSkip={() => setActiveTab('orders')} />
                    </div>
                ) : activeTab === 'account' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                        {/* Address Book */}
                        <div className="card" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>📍 Address Book</h3>
                                {!addingAddress && (
                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                        setAddingAddress(true);
                                        setProfileForm({ name: user?.name, phone: user?.phone, address: '', city: '', state: '', pincode: '', location: null });
                                    }}>+ Add New</button>
                                )}
                            </div>

                            {Array.isArray(user?.savedAddresses) && user.savedAddresses.length > 0 && !addingAddress ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                    {user.savedAddresses.map((addr: any) => {
                                        // Compare coordinates to determine if active
                                        const isActive = user.location?.coordinates && 
                                                        addr.coordinates && 
                                                        user.location.coordinates[0] === addr.coordinates[0] && 
                                                        user.location.coordinates[1] === addr.coordinates[1] &&
                                                        user.location.address === addr.address;
                                        
                                        return (
                                            <div key={addr._id} style={{ 
                                                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, 
                                                background: isActive ? 'var(--accent-subtle)' : 'var(--bg-elevated)', 
                                                padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span className={isActive ? "badge badge-green" : "badge"} style={{ background: isActive ? 'var(--accent)' : 'var(--bg-hover)', color: isActive ? '#000' : 'inherit' }}>{addr.tag}</span>
                                                        {isActive && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>Active Delivery Address</span>}
                                                    </div>
                                                    <p style={{ fontSize: '0.9rem', marginBottom: '4px', maxWidth: '300px', lineHeight: 1.4 }}>{addr.address}</p>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{addr.city}, {addr.state} {addr.pincode}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {!isActive && <button className="btn btn-secondary btn-sm" onClick={() => handleSetActiveAddress(addr._id)}>Set Active</button>}
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteAddress(addr._id)}>🗑</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !addingAddress && (
                                <p className="text-muted" style={{ marginBottom: '24px' }}>No saved addresses yet.</p>
                            )}

                            {/* Add/Edit Address Form */}
                            {(addingAddress || (!user?.savedAddresses?.length)) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-elevated)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0 }}>{addingAddress ? 'Add New Address' : 'Update Profile & Location'}</h4>
                                        {addingAddress && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setAddingAddress(false)}>✖ Cancel</button>
                                        )}
                                    </div>
                                    
                                    {!addingAddress && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                                            <div className="form-group">
                                                <label className="form-label">Full Name</label>
                                                <input className="form-input" placeholder="Your Name" value={profileForm.name} onChange={e => setProfileForm((f: any) => ({ ...f, name: e.target.value }))} required />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Phone Number</label>
                                                <input className="form-input" placeholder="+91 98765..." value={profileForm.phone} onChange={e => setProfileForm((f: any) => ({ ...f, phone: e.target.value }))} required />
                                            </div>
                                        </div>
                                    )}

                                    {addingAddress && (
                                        <div className="form-group" style={{ marginBottom: '8px' }}>
                                            <label className="form-label">Save As</label>
                                            <select className="form-input" value={newAddrTag} onChange={(e) => setNewAddrTag(e.target.value)} style={{ maxWidth: '200px' }}>
                                                <option value="Home">Home 🏠</option>
                                                <option value="Work">Work 🏢</option>
                                                <option value="Other">Other 📍</option>
                                            </select>
                                        </div>
                                    )}

                                    <div style={{ width: '100%', height: '450px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <MapPicker 
                                            onConfirm={addingAddress ? handleSaveNewAddress : handleUpdateProfileMap} 
                                            buttonText={updatingProfile ? 'Saving...' : addingAddress ? `Save as ${newAddrTag}` : 'Update Profile'} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Danger Zone */}
                        <div className="card" style={{ padding: '32px', border: '1px solid var(--danger, #ff5252)' }}>
                            <h3 style={{ marginBottom: '8px', color: 'var(--danger, #ff5252)' }}>⚠️ Danger Zone</h3>
                            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>
                                Permanently delete your account and all associated data including order history. This action <strong>cannot be undone</strong>.
                            </p>
                            <button
                                className="btn"
                                style={{ background: 'var(--danger, #ff5252)', color: '#fff', border: 'none' }}
                                onClick={async () => {
                                    const deleted = await deleteAccount();
                                    if (deleted) { toast('Account deleted', 'success'); router.replace('/'); }
                                    else toast('Account deletion failed', 'error');
                                }}
                            >
                                🗑️ Delete My Account
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="stats-grid" style={{ marginBottom: '32px' }}>
                            <div className="stat-card">
                                <div className="stat-icon green">🛒</div>
                                <div className="stat-label">Total Orders</div>
                                <div className="stat-value">{orders.length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue">✅</div>
                                <div className="stat-label">Delivered</div>
                                <div className="stat-value">{orders.filter(o => o.status === 'delivered').length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon orange">💰</div>
                                <div className="stat-label">Total Spent</div>
                                <div className="stat-value">₹{orders.reduce((s, o) => s + o.totalAmount, 0).toFixed(0)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">⏳</div>
                                <div className="stat-label">Active Orders</div>
                                <div className="stat-value">{orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length}</div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
                            <a href="/shop" className="btn btn-primary"><span>🛒</span> Browse Shop</a>
                            <a href="/ai-agent" className="btn btn-secondary"><span>🧠</span> AI Recipe Agent</a>
                            <button onClick={() => setActiveTab('faceid')} className="btn btn-ghost"><span>🪪</span> Setup Face ID</button>
                        </div>
                        {/* AI Insights + Recent Activity */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                            <div className="ai-insight-card">
                                <div className="ai-insight-title">
                                    <span className="status-online-dot" />
                                    AI Shopping Insights
                                </div>
                                {orders.length > 0 ? (
                                    <>
                                        <div className="ai-insight-item">
                                            <span>💡</span>
                                            <span>You shop most for <strong>{getMostCommonCategory()}</strong> items — check out the latest deals.</span>
                                        </div>
                                        <div className="ai-insight-item">
                                            <span>🏪</span>
                                            <span>Your favourite shop: <strong>{getFavoriteShop()}</strong>. New stock may be available.</span>
                                        </div>
                                        <div className="ai-insight-item">
                                            <span>💰</span>
                                            <span>Average order value: <strong>₹{getAvgOrder()}</strong>. Use AI Agent to optimise costs.</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="ai-insight-item"><span>🎯</span><span>Try the AI Recipe Agent — describe a meal and we fill your cart instantly.</span></div>
                                        <div className="ai-insight-item"><span>🔍</span><span>Use intent search — type &quot;I have a cold&quot; to get health-focused suggestions.</span></div>
                                        <div className="ai-insight-item"><span>🏪</span><span>Enable location to discover the closest shops with real-time stock.</span></div>
                                    </>
                                )}
                            </div>

                            {orders.length > 0 && (
                                <div className="contextual-panel">
                                    <div className="panel-header">
                                        <span className="panel-title">📋 Recent Activity</span>
                                        <span className="panel-badge">{orders.length} orders</span>
                                    </div>
                                    <div className="activity-feed">
                                        {orders.slice(0, 3).map((o: any) => (
                                            <div key={o._id} className="activity-item">
                                                <div className="activity-icon-wrap">
                                                    {o.status === 'delivered' ? '✅' : o.status === 'cancelled' ? '❌' : '📦'}
                                                </div>
                                                <div className="activity-text">
                                                    <div className="activity-main">{o.items?.length} items · ₹{o.totalAmount?.toFixed(0)}</div>
                                                    <div className="activity-sub">{o.status} · {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                                                </div>
                                                <span className={`badge badge-${statusColor[o.status] || 'blue'}`} style={{ fontSize: '0.65rem' }}>{o.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Orders */}
                        {selectedOrderId ? (
                            <div className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, marginBottom: '4px' }}>Order Details</h3>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: #{selectedOrderId}</span>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrderId(null)}>⬅ Back to Orders</button>
                                </div>
                                {(() => {
                                    const order = orders.find(o => o._id === selectedOrderId);
                                    if (!order) return <p className="text-muted">Order not found.</p>;
                                    return (
                                        <div>
                                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                                                <div className={`badge badge-${statusColor[order.status] || 'blue'}`}>{order.status.toUpperCase()}</div>
                                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Placed on {new Date(order.createdAt).toLocaleString('en-IN')}</div>
                                            </div>

                                            <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Items ({order.items?.length})</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {order.items?.map((item: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            {item.image || item.productId?.image ? (
                                                                <img src={item.image || item.productId?.image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '8px' }} />
                                                            ) : <div style={{ fontSize: '1.8rem', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px' }}>📦</div>}
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{item.name || item.productId?.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                    Qty: {item.quantity} · 🏪 {item.shopId?.name || (typeof item.shopId === 'object' ? item.shopId.name : 'Independent Shop')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1.1rem' }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{item.price} each</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ borderTop: '2px dashed var(--border)', marginTop: '24px', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Grand Total</span>
                                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>₹{order.totalAmount?.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '0' }}>
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3>My Orders</h3>
                                    <span className="badge badge-blue">{orders.length} total</span>
                                </div>
                                {loading ? (
                                    <div style={{ padding: '48px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                                ) : orders.length === 0 ? (
                                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🛍</div>
                                        <p>No orders yet. Start shopping!</p>
                                        <a href="/shop" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>Browse Products</a>
                                    </div>
                                ) : (
                                    <div className="table-wrap">
                                        <table className="table">
                                            <thead>
                                                <tr><th>Order ID</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th style={{ textAlign: 'right' }}>Action</th></tr>
                                            </thead>
                                            <tbody>
                                                {orders.map(o => (
                                                    <tr key={o._id}>
                                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{o._id.slice(-8)}</span></td>
                                                        <td><span style={{ fontWeight: 500 }}>{o.items?.length} items</span></td>
                                                        <td><span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{o.totalAmount?.toFixed(2)}</span></td>
                                                        <td><span className={`badge badge-${statusColor[o.status] || 'blue'}`}>{o.status}</span></td>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                                                        <td style={{ textAlign: 'right' }}><button onClick={() => setSelectedOrderId(o._id)} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>View</button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
