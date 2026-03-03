'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import FaceRegister from '@/components/FaceRegister';

export default function BuyerDashboard() {
    const { user, api, deleteAccount, toast } = useApp();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'orders' | 'faceid' | 'account'>('orders');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        api.get('/orders/my').then(r => setOrders(r.data.orders || [])).catch(() => { }).finally(() => setLoading(false));
    }, [api]);

    const statusColor: Record<string, string> = {
        pending: 'yellow', confirmed: 'blue', processing: 'blue',
        out_for_delivery: 'blue', delivered: 'green', cancelled: 'red',
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
                <button onClick={() => setActiveTab('account')} className={`sidebar-link${activeTab === 'account' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', color: 'var(--danger, #ff5252)', font: 'inherit' }}>
                    <span className="link-icon">⚙️</span> Account
                </button>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main">
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Welcome back, {user?.name.split(' ')[0]} 👋</h1>
                    <p className="text-muted">{activeTab === 'faceid' ? 'Manage your Face ID' : "Here's your shopping overview"}</p>
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
                    <div className="card" style={{ maxWidth: '500px', padding: '32px', border: '1px solid var(--danger, #ff5252)' }}>
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
