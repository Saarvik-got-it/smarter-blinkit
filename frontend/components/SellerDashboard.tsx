'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import FaceRegister from '@/components/FaceRegister';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function SellerDashboard() {
    const { user, api, toast, deleteAccount } = useApp();
    const router = useRouter();
    const [shop, setShop] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tab, setTab] = useState<'overview' | 'inventory' | 'orders' | 'barcode' | 'settings'>('overview');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '', unit: 'piece', barcode: '', description: '' });
    const [shopEdit, setShopEdit] = useState({ name: '', address: '', phone: '' });
    const [savingShop, setSavingShop] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const [shopSetup, setShopSetup] = useState({ name: '', address: '', phone: '' });
    const [creatingShop, setCreatingShop] = useState(false);

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
            const { data } = await api.post('/products', { ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock) });
            setProducts(p => [...p, data.product]);
            setNewProduct({ name: '', price: '', stock: '', category: '', unit: 'piece', barcode: '', description: '' });
            toast('Product added! ✅', 'success');
        } catch (err: any) { toast(err?.response?.data?.message || 'Failed to add product', 'error'); }
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
            setNewProduct(p => ({ ...p, barcode: code }));
            setTab('inventory');
            toast(`Barcode scanned: ${code} ✅`, 'success');
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

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);

    const sidebarLinks = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'inventory', icon: '📦', label: 'Inventory' },
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
                                    <div className="stat-card"><div className="stat-icon red">⚠️</div><div className="stat-label">Low Stock</div><div className="stat-value">{products.filter(p => p.stock < 10).length}</div></div>
                                </div>
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ marginBottom: '16px' }}>Top Products by Sales</h3>
                                    {products.sort((a, b) => b.salesCount - a.salesCount).slice(0, 5).map(p => (
                                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <span className="badge badge-green">{p.salesCount} sold</span>
                                                <span style={{ color: p.stock < 10 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8rem' }}>Stock: {p.stock}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {products.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No products yet. Add your first product!</p>}
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
                                            <div className="form-group"><label className="form-label">Category*</label><input className="form-input" placeholder="Groceries, Dairy..." value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} required /></div>
                                            <div className="form-group"><label className="form-label">Unit</label>
                                                <select className="form-select" value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}>
                                                    {['piece', 'kg', 'g', 'litre', 'ml', 'pack', 'dozen'].map(u => <option key={u}>{u}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Barcode</label><input className="form-input" placeholder="Scan or enter" value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} /></div>
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
                                                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                                                        <td><span className="badge badge-blue">{p.category}</span></td>
                                                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{p.price}</td>
                                                        <td><span style={{ color: p.stock < 10 ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>{p.stock} {p.unit}</span></td>
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
