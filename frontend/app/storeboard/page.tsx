'use client';
import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { useApp } from '@/lib/context';
import { io, Socket } from 'socket.io-client';

export default function StoreboardPage() {
    const { api } = useApp();
    const [data, setData] = useState<{ topProducts: any[]; topShops: any[]; recentOrders: any[] }>({ topProducts: [], topShops: [], recentOrders: [] });
    const [liveEvents, setLiveEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const { data: res } = await api.get('/shops/storeboard');
            setData(res);
        } catch { }
    }, [api]);

    useEffect(() => {
        fetchData().finally(() => setLoading(false));
        const interval = setInterval(fetchData, 15000); // refresh every 15s

        // Socket.io live events
        const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');
        socket.emit('joinStoreboard');
        socket.on('newOrder', (evt) => {
            setLiveEvents(prev => [{ ...evt, id: Date.now() }, ...prev].slice(0, 10));
            fetchData(); // refresh
        });
        socket.on('saleUpdate', (evt) => {
            setLiveEvents(prev => [{ ...evt, id: Date.now() }, ...prev].slice(0, 10));
        });
        return () => { clearInterval(interval); socket.disconnect(); };
    }, [fetchData]);

    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 64, minHeight: '100vh' }}>
                <div className="container" style={{ padding: '36px 24px' }}>
                    {/* Header */}
                    <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', marginBottom: 6 }}>📡 Live Storeboard</h1>
                            <p className="text-muted" style={{ fontSize: '0.875rem' }}>Real-time sales across all shops · Refreshes every 15s</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>LIVE</span>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '80px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Top Selling Products */}
                            <div className="card" style={{ padding: 0 }}>
                                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>🔥</span><h3>Top Selling Products</h3>
                                </div>
                                <div style={{ padding: '4px 0' }}>
                                    {data.topProducts.map((p, i) => (
                                        <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? 'var(--accent-subtle)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🏪 {p.shopId?.name}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.875rem' }}>{p.salesCount} sold</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{p.price}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {data.topProducts.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No sales data yet</div>}
                                </div>
                            </div>

                            {/* Top Shops */}
                            <div className="card" style={{ padding: 0 }}>
                                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>⭐</span><h3>Top Rated Shops</h3>
                                </div>
                                <div style={{ padding: '4px 0' }}>
                                    {data.topShops.map((shop, i) => (
                                        <div key={shop._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? 'rgba(255,179,71,0.15)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: i < 3 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{shop.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shop.location?.address || shop.location?.city}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '0.875rem' }}>⭐ {shop.rating}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shop.totalOrders} orders</div>
                                            </div>
                                        </div>
                                    ))}
                                    {data.topShops.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No shops data</div>}
                                </div>
                            </div>

                            {/* Live Events Feed */}
                            <div className="card" style={{ padding: 0, gridColumn: 'span 2' }}>
                                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
                                    <h3>Live Events</h3>
                                    {liveEvents.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for orders...</span>}
                                </div>
                                <div style={{ padding: '8px 0', maxHeight: 260, overflowY: 'auto' }}>
                                    {liveEvents.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📡</div>
                                            <p>Place an order to see live events here</p>
                                        </div>
                                    ) : liveEvents.map(evt => (
                                        <div key={evt.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.875rem' }}>
                                            <span style={{ flex: 1 }}>🛒 New order placed · <strong>₹{evt.totalAmount?.toFixed(2)}</strong></span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
            </main>
        </>
    );
}
