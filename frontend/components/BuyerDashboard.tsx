'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';

export default function BuyerDashboard() {
    const { user, api } = useApp();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                <a href="/dashboard" className="sidebar-link active"><span className="link-icon">📋</span> My Orders</a>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main">
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Welcome back, {user?.name.split(' ')[0]} 👋</h1>
                    <p className="text-muted">Here's your shopping overview</p>
                </div>

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
                </div>

                {/* Orders */}
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
                                    <tr><th>Order ID</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o._id}>
                                            <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{o._id.slice(-8)}</span></td>
                                            <td><span style={{ fontWeight: 500 }}>{o.items?.length} items</span></td>
                                            <td><span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{o.totalAmount?.toFixed(2)}</span></td>
                                            <td><span className={`badge badge-${statusColor[o.status] || 'blue'}`}>{o.status}</span></td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
