'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';

declare global { interface Window { Quagga: any; } }

export default function SellerDashboard() {
    const { user, api, toast } = useApp();
    const [shop, setShop] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tab, setTab] = useState<'overview' | 'inventory' | 'orders' | 'barcode'>('overview');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '', unit: 'piece', barcode: '', description: '' });
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        Promise.all([
            api.get('/shops/my').then(r => setShop(r.data.shop)),
            api.get('/orders/shop').then(r => setOrders(r.data.orders || [])),
        ]).catch(() => { }).finally(() => setLoading(false));
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

    const startBarcodeScanner = async () => {
        if (typeof window === 'undefined') return;
        if (!window.Quagga) {
            await new Promise<void>((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
                s.onload = () => res(); s.onerror = () => rej();
                document.head.appendChild(s);
            });
        }
        setScanning(true);
        window.Quagga.init({
            inputStream: { type: 'LiveStream', target: scannerRef.current, constraints: { width: 320, height: 240, facingMode: 'environment' } },
            decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader'] },
        }, (err: any) => {
            if (err) { setScanning(false); toast('Camera error: ' + err.message, 'error'); return; }
            window.Quagga.start();
        });
        window.Quagga.onDetected((data: any) => {
            const code = data.codeResult.code;
            window.Quagga.stop(); setScanning(false);
            setNewProduct(p => ({ ...p, barcode: code }));
            setTab('inventory');
            toast(`Barcode scanned: ${code} ✅`, 'success');
        });
    };

    const stopScanner = () => {
        if (window.Quagga) window.Quagga.stop();
        setScanning(false);
    };

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);

    const sidebarLinks = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'inventory', icon: '📦', label: 'Inventory' },
        { id: 'orders', icon: '📋', label: 'Orders' },
        { id: 'barcode', icon: '🔲', label: 'Barcode Scanner' },
    ];

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
                                    <h3 style={{ marginBottom: '16px' }}>Scan Product Barcode</h3>
                                    <p className="text-muted" style={{ marginBottom: '20px', fontSize: '0.875rem' }}>Point your camera at a product barcode to automatically fill in the product code. Then add inventory details.</p>

                                    <div ref={scannerRef} style={{ width: '100%', height: 200, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                        {!scanning && <span style={{ fontSize: '3rem' }}>🔲</span>}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {!scanning ? (
                                            <button className="btn btn-primary" onClick={startBarcodeScanner}>📷 Start Camera</button>
                                        ) : (
                                            <button className="btn btn-danger" onClick={stopScanner}>⏹ Stop</button>
                                        )}
                                        <button className="btn btn-secondary" onClick={() => setTab('inventory')}>← Back to Inventory</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
