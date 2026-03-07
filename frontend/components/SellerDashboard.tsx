'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import FaceRegister from '@/components/FaceRegister';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import dynamic from 'next/dynamic';

const MoneyMap = dynamic(() => import('@/components/MoneyMap'), { ssr: false });

export default function SellerDashboard() {
    const { user, api, toast, deleteAccount } = useApp();
    const router = useRouter();
    const [shop, setShop] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tab, setTab] = useState<'overview' | 'inventory' | 'orders' | 'barcode' | 'settings' | 'storeboard'>('overview');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '', unit: 'piece', barcode: '', description: '', expiryDate: '' });
    const [shopEdit, setShopEdit] = useState({ name: '', address: '', phone: '' });
    const [savingShop, setSavingShop] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const [shopSetup, setShopSetup] = useState({ name: '', address: '', phone: '' });
    const [creatingShop, setCreatingShop] = useState(false);
    const [catDropdownOpen, setCatDropdownOpen] = useState(false);

    // Derive unique categories from the shop's current inventory
    const shopCategories: string[] = [...new Set(products.map((p: any) => p.category).filter(Boolean))] as string[];

    useEffect(() => {
        // Fetch shop separately so a 404 (no shop yet) doesn't crash the whole dashboard
        api.get('/shops/my')
            .then(r => {
                setShop(r.data.shop);
                setShopEdit({ name: r.data.shop.name, address: r.data.shop.location?.address || '', phone: r.data.shop.phone || '' });
            })
            .catch(() => { /* shop not created yet — handled by render below */ });
        api.get('/orders/shop').then(r => setOrders(r.data.orders || [])).catch(() => { });
        setLoading(false);
    }, [api]);

    useEffect(() => {
        if (shop) api.get(`/products/shop/${shop._id}`).then(r => setProducts(r.data.products || []));
    }, [shop, api]);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = { ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock) };
            if (!payload.expiryDate) delete payload.expiryDate;
            const { data } = await api.post('/products', payload);
            setProducts(p => [...p, data.product]);
            setNewProduct({ name: '', price: '', stock: '', category: '', unit: 'piece', barcode: '', description: '', expiryDate: '' });
            toast('Product added! ✅', 'success');
        } catch (err: any) { toast(err?.response?.data?.message || 'Failed to add product', 'error'); }
    };

    const generateDemoBarcode = () => {
        const code = Math.floor(100000000000 + Math.random() * 900000000000).toString(); // 12-digit numeric
        setNewProduct(p => ({ ...p, barcode: code }));
        toast(`Generated demo barcode: ${code}`, 'success');
    };

    // Create shop for sellers who didn't set one up at registration
    const handleCreateShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopSetup.name.trim()) return toast('Shop name is required', 'error');
        setCreatingShop(true);
        try {
            const { data } = await api.post('/shops', shopSetup);
            setShop(data.shop);
            setShopEdit({ name: data.shop.name, address: data.shop.location?.address || '', phone: data.shop.phone || '' });
            toast('Your shop is live! 🎉', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to create shop', 'error');
        } finally {
            setCreatingShop(false);
        }
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false); // true while decoding a frame

    const stopScanner = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setScanning(false);
        setCapturing(false);
    };

    useEffect(() => { if (tab !== 'barcode') stopScanner(); }, [tab]);
    useEffect(() => () => { stopScanner(); }, []);

    const startBarcodeScanner = async () => {
        if (!videoRef.current) return;
        try {
            // Start a fresh camera stream each time — no ZXing continuous polling
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
        } catch (err: any) {
            toast(err.message || 'Camera access denied', 'error');
        }
    };

    // Called when user clicks "Capture Barcode" — decode exactly one frame
    const captureAndDecode = async () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
        setCapturing(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();
            // decodeFromCanvas decodes ONE frame — no continuous loop, no buffer replay
            const result = reader.decodeFromCanvas(canvas);
            const code = result.getText();
            stopScanner();
            toast(`Barcode scanned: ${code} ✅. Checking details...`, 'info');

            try {
                const res = await api.post('/products/barcode/lookup', { barcode: code });
                if (res.data.found) {
                    if (window.confirm(`Product "${res.data.product.name}" already exists in inventory. Increase stock by 1?`)) {
                        await api.post('/products/barcode/update', { barcode: code, stockDelta: 1 });
                        setProducts(prev => prev.map(p => p._id === res.data.product._id ? { ...p, stock: p.stock + 1 } : p));
                        toast(`Stock for ${res.data.product.name} increased by 1 ✅`, 'success');
                        setTab('inventory');
                    } else {
                        // Populate form for editing
                        setNewProduct({
                            ...res.data.product,
                            price: res.data.product.price.toString(),
                            stock: res.data.product.stock.toString(),
                            expiryDate: res.data.product.expiryDate ? new Date(res.data.product.expiryDate).toISOString().split('T')[0] : ''
                        });
                        setTab('inventory');
                    }
                } else if (res.data.external && res.data.productData) {
                    setNewProduct(p => ({
                        ...p,
                        barcode: code,
                        name: res.data.productData.name || '',
                        category: res.data.productData.category || '',
                        description: res.data.productData.brand ? `Brand: ${res.data.productData.brand}` : ''
                    }));
                    toast('External product details found! Auto-filled form.', 'success');
                    setTab('inventory');
                } else {
                    setNewProduct(p => ({ ...p, barcode: code }));
                    toast('Product not found. Please enter details manually.', 'info');
                    setTab('inventory');
                }
            } catch (err: any) {
                setNewProduct(p => ({ ...p, barcode: code }));
                toast('Error checking barcode. Please enter details manually.', 'error');
                setTab('inventory');
            }
        } catch {
            toast('No barcode detected — try holding still and try again.', 'info');
        } finally {
            setCapturing(false);
        }
    };




    const handleSaveShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingShop(true);
        try {
            const { data } = await api.put('/shops/my', {
                name: shopEdit.name,
                phone: shopEdit.phone,
                'location.address': shopEdit.address,
            });
            setShop(data.shop);
            toast('Shop updated! ✅', 'success');
        } catch (err: any) { toast(err?.response?.data?.message || 'Update failed', 'error'); }
        finally { setSavingShop(false); }
    };

    // Storeboard logic
    const [storeboardData, setStoreboardData] = useState<any>({ fastestSelling: [], topRatedShops: [], heatmapData: [] });
    const [liveEvents, setLiveEvents] = useState<any[]>([]);

    useEffect(() => {
        if (tab === 'storeboard') {
            api.get('/admin/storeboard').then(r => setStoreboardData(r.data));
            const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
            const socket = io(socketUrl);
            socket.on('newOrder', (data) => {
                setLiveEvents(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 10)); // Keep last 10
                // Re-fetch rankings on new order to keep charts strictly up-to-date
                api.get('/admin/storeboard').then(r => setStoreboardData(r.data));
            });
            return () => { socket.disconnect(); };
        }
    }, [tab, api]);

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);

    const sidebarLinks = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'inventory', icon: '📦', label: 'Inventory' },
        { id: 'storeboard', icon: '⚡', label: 'Live Storeboard' },
        { id: 'orders', icon: '📋', label: 'Orders' },
        { id: 'barcode', icon: '🔲', label: 'Barcode Scanner' },
        { id: 'settings', icon: '⚙️', label: 'Shop Settings' },
    ];

    // ✅ FIX: If seller has no shop yet, show an onboarding setup screen
    if (!loading && !shop) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.08) 0%, transparent 60%)' }}>
                <div style={{ width: '100%', maxWidth: '460px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🏪</div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Set Up Your Shop</h1>
                        <p className="text-muted">You don't have a shop yet. Create one to start selling!</p>
                    </div>
                    <div className="card" style={{ padding: '32px' }}>
                        <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Shop Name *</label>
                                <input className="form-input" placeholder="e.g. Ramesh General Store" value={shopSetup.name} onChange={e => setShopSetup(s => ({ ...s, name: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Shop Address</label>
                                <input className="form-input" placeholder="123 Main Street, Bengaluru" value={shopSetup.address} onChange={e => setShopSetup(s => ({ ...s, address: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" placeholder="+91 98765 43210" value={shopSetup.phone} onChange={e => setShopSetup(s => ({ ...s, phone: e.target.value }))} />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={creatingShop}>
                                {creatingShop ? '⏳ Creating...' : '🚀 Launch My Shop'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">

            <aside className="sidebar">
                <div style={{ padding: '0 12px 20px' }}>
                    <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #ff6b35, #f7c59f)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '12px' }}>
                        🏪
                    </div>
                    <div style={{ fontWeight: 700 }}>{shop?.name || 'My Shop'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    <div className="badge badge-yellow" style={{ marginTop: '8px' }}>Seller</div>
                </div>
                <div className="sidebar-section-label">Manage</div>
                {sidebarLinks.map(l => (
                    <button key={l.id} onClick={() => setTab(l.id as any)} className={`sidebar-link ${tab === l.id ? 'active' : ''}`}>
                        <span className="link-icon">{l.icon}</span> {l.label}
                    </button>
                ))}
            </aside>

            <main className="dashboard-main">
                {loading ? <div style={{ textAlign: 'center', paddingTop: '20vh' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
                    <>
                        {tab === 'overview' && (
                            <>
                                <div style={{ marginBottom: '28px' }}>
                                    <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Seller Dashboard 🏪</h1>
                                    <p className="text-muted">{shop?.name} · {shop?.location?.address || 'No address set'}</p>
                                </div>
                                <div className="stats-grid" style={{ marginBottom: '28px' }}>
                                    <div className="stat-card"><div className="stat-icon orange">📦</div><div className="stat-label">Total Products</div><div className="stat-value">{products.length}</div></div>
                                    <div className="stat-card"><div className="stat-icon green">💰</div><div className="stat-label">Total Revenue</div><div className="stat-value">₹{totalRevenue.toFixed(0)}</div></div>
                                    <div className="stat-card"><div className="stat-icon blue">📋</div><div className="stat-label">Total Orders</div><div className="stat-value">{orders.length}</div></div>
                                    <div className="stat-card"><div className="stat-icon red">⚠️</div><div className="stat-label">Low Stock</div><div className="stat-value">{products.filter(p => p.stock < 5).length}</div></div>
                                </div>
                                
                                {products.filter(p => p.stock < 5).length > 0 && (
                                    <div className="card" style={{ padding: '20px', marginBottom: '28px', borderLeft: '4px solid var(--danger)' }}>
                                        <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>⚠️ Low Stock Alerts</h3>
                                        {products.filter(p => p.stock < 5).map(p => (
                                            <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ fontWeight: 500 }}>{p.name} <span className="text-muted" style={{ fontSize: '0.8rem' }}>({p.category})</span></span>
                                                <span className="badge badge-red">{p.stock} remaining</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ marginBottom: '16px' }}>Top Products by Sales</h3>
                                    {products.sort((a, b) => b.salesCount - a.salesCount).slice(0, 5).map(p => (
                                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <span className="badge badge-green">{p.salesCount} sold</span>
                                                <span style={{ color: p.stock < 5 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8rem' }}>Stock: {p.stock}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {products.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No products yet. Add your first product!</p>}
                                </div>
                            </>
                        )}

                        {tab === 'storeboard' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h2>⚡ Live Storeboard</h2>
                                    <div className="badge badge-red" style={{ animation: 'pulse 1.5s infinite' }}>● LIVE</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
                                    {/* Left: Charts */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div className="card" style={{ padding: '24px' }}>
                                            <h3 style={{ marginBottom: '16px' }}>🔥 Fastest Selling Items across City</h3>
                                            <div style={{ height: 280, width: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={storeboardData.fastestSelling} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                        <Bar dataKey="salesCount" radius={[0, 4, 4, 0]}>
                                                            {storeboardData.fastestSelling.map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ff6b35' : '#f7c59f'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="card" style={{ padding: '24px' }}>
                                            <h3 style={{ marginBottom: '16px' }}>⭐ Top Rated Shops</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {storeboardData.topRatedShops.map((s: any, i: number) => (
                                                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: i === 0 ? '#ff6b35' : 'var(--text-muted)' }}>#{i + 1}</div>
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.city}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: '#fbbf24', fontWeight: 700 }}>★ {s.rating}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.totalOrders} Orders</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Live Feed */}
                                    <div className="card" style={{ padding: '20px', background: 'var(--bg-card)', border: '2px solid var(--accent-subtle)' }}>
                                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>📡 Live Feed {liveEvents.length > 0 && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {liveEvents.length === 0 ? (
                                                <div className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>Waiting for new orders...</div>
                                            ) : (
                                                liveEvents.map((evt) => (
                                                    <div key={evt.id} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', animation: 'slideIn 0.3s ease-out' }}>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                            Just now • Order #{evt.order?.slice(-6)}
                                                        </div>
                                                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>₹{evt.totalAmount?.toFixed(2)}</div>
                                                        <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                                                            {evt.shopGroups?.map((sg: any) => `${sg.items.length} items from ${sg.shopName || 'Shop'}`).join(' & ')}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Full Width: Money Map */}
                                <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <h3>🗺️ The Money Map</h3>
                                            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Geospatial heatmap of city-wide orders. See where demand is highest to plan your next dark store.</p>
                                        </div>
                                        <div className="badge badge-blue">Data Science</div>
                                    </div>
                                    <div style={{ width: '100%', height: 400, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        {storeboardData.heatmapData && storeboardData.heatmapData.length > 0 ? (
                                            <MoneyMap data={storeboardData.heatmapData} />
                                        ) : (
                                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                Loading geographical insights...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'inventory' && (
                            <>
                                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h2>Inventory Management</h2>
                                </div>
                                {/* Add Product Form */}
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ marginBottom: '20px' }}>➕ Add Product {newProduct.barcode && <span className="badge badge-green" style={{ marginLeft: 8 }}>Barcode: {newProduct.barcode}</span>}</h3>
                                    <form onSubmit={handleAddProduct}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                            <div className="form-group"><label className="form-label">Product Name*</label><input className="form-input" placeholder="e.g. Wheat Flour" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required /></div>
                                            <div className="form-group"><label className="form-label">Price (₹)*</label><input className="form-input" type="number" min="0" step="0.01" placeholder="49.99" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} required /></div>
                                            <div className="form-group"><label className="form-label">Stock*</label><input className="form-input" type="number" min="0" placeholder="100" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} required /></div>
                                            <div className="form-group" style={{ position: 'relative' }}>
                                                <label className="form-label">Category*</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="Select or type a category..."
                                                    value={newProduct.category}
                                                    onChange={e => {
                                                        setNewProduct(p => ({ ...p, category: e.target.value }));
                                                        setCatDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setCatDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setCatDropdownOpen(false), 200)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Escape') setCatDropdownOpen(false);
                                                        if (e.key === 'Enter' && catDropdownOpen) {
                                                            e.preventDefault();
                                                            const filtered = shopCategories.filter(c => c.toLowerCase().includes(newProduct.category.toLowerCase()));
                                                            if (filtered.length > 0) {
                                                                setNewProduct(p => ({ ...p, category: filtered[0] }));
                                                            }
                                                            setCatDropdownOpen(false);
                                                        }
                                                    }}
                                                    required
                                                    autoComplete="off"
                                                />
                                                {catDropdownOpen && (
                                                    <div style={{
                                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                                        maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                                                    }}>
                                                        {shopCategories
                                                            .filter(c => !newProduct.category || c.toLowerCase().includes(newProduct.category.toLowerCase()))
                                                            .map(c => (
                                                                <div key={c}
                                                                    onMouseDown={() => { setNewProduct(p => ({ ...p, category: c })); setCatDropdownOpen(false); }}
                                                                    style={{
                                                                        padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                                                        borderBottom: '1px solid var(--border)',
                                                                        transition: 'background 0.15s'
                                                                    }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                >
                                                                    {c}
                                                                </div>
                                                            ))
                                                        }
                                                        {newProduct.category.trim() && !shopCategories.some(c => c.toLowerCase() === newProduct.category.toLowerCase()) && (
                                                            <div
                                                                onMouseDown={() => { setCatDropdownOpen(false); }}
                                                                style={{
                                                                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                                                    color: 'var(--accent)', fontWeight: 600,
                                                                    background: 'var(--accent-subtle)',
                                                                    borderTop: '2px solid var(--accent)'
                                                                }}
                                                            >
                                                                + Add &ldquo;{newProduct.category.trim()}&rdquo; as new category
                                                            </div>
                                                        )}
                                                        {!newProduct.category.trim() && shopCategories.length === 0 && (
                                                            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                No categories yet — type to create one
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group"><label className="form-label">Unit</label>
                                                <select className="form-select" value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}>
                                                    {['piece', 'kg', 'g', 'litre', 'ml', 'pack', 'dozen'].map(u => <option key={u}>{u}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Barcode</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input className="form-input" placeholder="Scan or enter" value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} />
                                                    <button type="button" className="btn btn-secondary" onClick={generateDemoBarcode} title="Generate Demo Barcode">🎲</button>
                                                </div>
                                            </div>
                                            {['dairy', 'packaged food', 'beverages'].includes(newProduct.category.toLowerCase()) && (
                                                <div className="form-group"><label className="form-label">Expiry Date</label><input className="form-input" type="date" value={newProduct.expiryDate} onChange={e => setNewProduct(p => ({ ...p, expiryDate: e.target.value }))} /></div>
                                            )}
                                        </div>
                                        <div className="form-group" style={{ marginBottom: '16px' }}><label className="form-label">Description</label><input className="form-input" placeholder="Brief product description..." value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} /></div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button type="submit" className="btn btn-primary">Add Product</button>
                                            <button type="button" className="btn btn-secondary" onClick={() => setTab('barcode')}>🔲 Scan Barcode</button>
                                        </div>
                                    </form>
                                </div>

                                {/* Products Table */}
                                <div className="card" style={{ padding: 0 }}>
                                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                                        <h3>All Products ({products.length})</h3>
                                    </div>
                                    <div className="table-wrap">
                                        <table className="table">
                                            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th></tr></thead>
                                            <tbody>
                                                {products.map(p => (
                                                    <tr key={p._id}>
                                                        <td style={{ fontWeight: 500 }}>{p.name} {p.expiryDate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Exp: {new Date(p.expiryDate).toLocaleDateString()}</span>}</td>
                                                        <td><span className="badge badge-blue">{p.category}</span></td>
                                                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{p.price}</td>
                                                        <td><span style={{ color: p.stock < 5 ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>{p.stock} {p.unit}</span></td>
                                                        <td>{p.salesCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {products.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No products yet</div>}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'orders' && (
                            <>
                                <h2 style={{ marginBottom: '24px' }}>Shop Orders</h2>
                                <div className="card" style={{ padding: 0 }}>
                                    <div className="table-wrap">
                                        <table className="table">
                                            <thead><tr><th>Order ID</th><th>Buyer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                                            <tbody>
                                                {orders.map(o => (
                                                    <tr key={o._id}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{o._id.slice(-8)}</td>
                                                        <td>{o.buyerId?.name || 'Customer'}</td>
                                                        <td>{o.items?.length} items</td>
                                                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{o.totalAmount?.toFixed(2)}</td>
                                                        <td><span className="badge badge-green">{o.status}</span></td>
                                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {orders.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</div>}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'barcode' && (
                            <div>
                                <h2 style={{ marginBottom: '24px' }}>🔲 Barcode Scanner</h2>
                                <div className="card" style={{ maxWidth: '460px' }}>
                                    <h3 style={{ marginBottom: '8px' }}>Scan Product Barcode</h3>
                                    <p className="text-muted" style={{ marginBottom: '20px', fontSize: '0.875rem' }}>
                                        Start the camera, point it at the barcode, then click <strong>Capture</strong> when it's in frame.
                                    </p>

                                    {/* Live camera preview */}
                                    <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: scanning ? '2px solid var(--accent)' : '2px solid var(--border)' }}>
                                        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} />
                                        {!scanning && <span style={{ fontSize: '3.5rem' }}>🔲</span>}
                                        {scanning && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px', background: 'rgba(0,0,0,0.55)', textAlign: 'center', fontSize: '0.75rem', color: '#fff' }}>
                                                Aim at barcode, then click Capture ↓
                                            </div>
                                        )}
                                    </div>

                                    {/* Hidden canvas used for single-frame decode */}
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {!scanning ? (
                                            <button className="btn btn-primary" onClick={startBarcodeScanner}>📷 Start Camera</button>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary" onClick={captureAndDecode} disabled={capturing} style={{ flex: 2 }}>
                                                    {capturing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Decoding...</> : '📸 Capture Barcode'}
                                                </button>
                                                <button className="btn btn-danger" onClick={stopScanner}>⏹ Stop</button>
                                            </>
                                        )}
                                        <button className="btn btn-secondary" onClick={() => setTab('inventory')}>← Inventory</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'settings' && (
                            <div>
                                <h2 style={{ marginBottom: '24px' }}>⚙️ Shop Settings</h2>
                                <div className="card" style={{ maxWidth: '520px' }}>
                                    <h3 style={{ marginBottom: '20px' }}>Edit Shop Profile</h3>
                                    <form onSubmit={handleSaveShop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Shop Name</label>
                                            <input className="form-input" value={shopEdit.name} onChange={e => setShopEdit(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Ramesh General Store" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Shop Address</label>
                                            <input className="form-input" value={shopEdit.address} onChange={e => setShopEdit(s => ({ ...s, address: e.target.value }))} placeholder="123 Main Street, Bengaluru" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone</label>
                                            <input className="form-input" value={shopEdit.phone} onChange={e => setShopEdit(s => ({ ...s, phone: e.target.value }))} placeholder="+91 98765 43210" />
                                        </div>
                                        <button type="submit" className="btn btn-primary" disabled={savingShop}>
                                            {savingShop ? '⏳ Saving...' : '💾 Save Changes'}
                                        </button>
                                    </form>
                                </div>

                                {/* Face ID Enrollment */}
                                <div className="card" style={{ maxWidth: '520px', marginTop: '24px' }}>
                                    <h3 style={{ marginBottom: '8px' }}>🪪 Face ID Setup</h3>
                                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>Enroll or update your Face ID to allow instant camera-based login to your seller dashboard.</p>
                                    <FaceRegister userRole="seller" onSkip={() => { }} />
                                </div>

                                {/* Danger Zone */}
                                <div className="card" style={{ maxWidth: '520px', marginTop: '24px', border: '1px solid var(--danger, #ff5252)' }}>
                                    <h3 style={{ marginBottom: '8px', color: 'var(--danger, #ff5252)' }}>⚠️ Danger Zone</h3>
                                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>
                                        Permanently delete your seller account and shop. All products and orders will be removed. This action <strong>cannot be undone</strong>.
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
                                        🗑️ Delete Account & Shop
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
