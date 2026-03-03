'use client';
import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { useApp } from '@/lib/context';

declare global { interface Window { L: any; } }

export default function MoneyMapPage() {
    const { api } = useApp();
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [heatmapData, setHeatmapData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalRevenue: 0, totalSales: 0, topShop: '' });

    useEffect(() => {
        const loadLeaflet = async () => {
            // Load Leaflet CSS
            if (!document.querySelector('#leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            // Load Leaflet JS
            if (!window.L) {
                await new Promise<void>((res) => {
                    const s = document.createElement('script');
                    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    s.onload = () => res();
                    document.head.appendChild(s);
                });
            }

            // Fetch data
            let data: any[] = [];
            try {
                const { data: res } = await api.get('/shops/money-map');
                data = res.heatmapData || [];
                setHeatmapData(data);

                const totalRevenue = data.reduce((s: number, d: any) => s + d.totalRevenue, 0);
                const totalSales = data.reduce((s: number, d: any) => s + d.totalSales, 0);
                const topShop = data[0]?.shopName || 'N/A';
                setStats({ totalRevenue, totalSales, topShop });
            } catch { }

            setLoading(false);

            // Init map
            if (mapRef.current && !mapInstanceRef.current && window.L) {
                const map = window.L.map(mapRef.current).setView([12.9716, 77.5946], 13);
                mapInstanceRef.current = map;

                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                }).addTo(map);

                // Add shop markers with custom radius proportional to revenue
                if (data.length > 0) {
                    const maxRevenue = Math.max(...data.map((d: any) => d.totalRevenue), 1);
                    data.forEach((shop: any) => {
                        if (!shop.coordinates || shop.coordinates.length < 2) return;
                        const [lng, lat] = shop.coordinates;
                        const radius = 20 + (shop.totalRevenue / maxRevenue) * 60;
                        const intensity = shop.totalRevenue / maxRevenue;
                        const r = Math.round(intensity * 255);
                        const g = Math.round((1 - intensity) * 210 + 100);

                        window.L.circleMarker([lat, lng], {
                            radius,
                            fillColor: `rgb(${r}, ${g}, 0)`,
                            color: '#000',
                            weight: 1,
                            opacity: 0.8,
                            fillOpacity: 0.6,
                        }).addTo(map).bindPopup(`
              <b>${shop.shopName}</b><br>
              📦 Sales: ${shop.totalSales}<br>
              💰 Revenue: ₹${shop.totalRevenue?.toFixed(0)}<br>
              📍 ${shop.address || 'Bengaluru'}
            `);
                    });
                } else {
                    // Add sample markers for seeded shops (no orders yet)
                    const sampleShops = [
                        { name: 'Ramesh General Store', lat: 12.9716, lng: 77.5946, revenue: 12500, sales: 180 },
                        { name: "Priya's Pharmacy & Fresh", lat: 12.9784, lng: 77.6413, revenue: 8400, sales: 120 },
                    ];
                    sampleShops.forEach(shop => {
                        window.L.circleMarker([shop.lat, shop.lng], {
                            radius: 35,
                            fillColor: '#00d26a',
                            color: '#001a0d',
                            weight: 2,
                            opacity: 0.9,
                            fillOpacity: 0.65,
                        }).addTo(map).bindPopup(`
              <b>${shop.name}</b><br>
              📦 Sales: ${shop.sales}<br>
              💰 Est. Revenue: ₹${shop.revenue}<br>
              💡 Place more orders to see real data
            `);
                    });
                }
            }
        };

        loadLeaflet();
        return () => {
            if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        };
    }, [api]);

    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 64, minHeight: '100vh' }}>
                <div className="container" style={{ padding: '36px 24px' }}>
                    {/* Header */}
                    <div style={{ marginBottom: 28 }}>
                        <h1 style={{ fontSize: '2rem', marginBottom: 6 }}>🗺 Money Map</h1>
                        <p className="text-muted" style={{ fontSize: '0.9rem' }}>Neighbourhood-level purchasing heatmap · Bubble size = revenue · Colour = intensity</p>
                    </div>

                    {/* Stats */}
                    <div className="stats-grid" style={{ marginBottom: 28 }}>
                        <div className="stat-card"><div className="stat-icon green">💰</div><div className="stat-label">Total Revenue (mapped)</div><div className="stat-value">₹{stats.totalRevenue.toFixed(0)}</div></div>
                        <div className="stat-card"><div className="stat-icon blue">📦</div><div className="stat-label">Total Units Sold</div><div className="stat-value">{stats.totalSales}</div></div>
                        <div className="stat-card"><div className="stat-icon orange">🏆</div><div className="stat-label">Top Shop</div><div className="stat-value" style={{ fontSize: '1.1rem' }}>{stats.topShop || '—'}</div></div>
                        <div className="stat-card"><div className="stat-icon green">🏪</div><div className="stat-label">Active Locations</div><div className="stat-value">{heatmapData.length || 2}</div></div>
                    </div>

                    {/* Map */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>📍 Bengaluru Sales Map</span>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00d26a', display: 'inline-block' }} /> Low revenue</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff6b00', display: 'inline-block' }} /> High revenue</span>
                            </div>
                        </div>
                        {loading ? (
                            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="spinner" />
                            </div>
                        ) : (
                            <div ref={mapRef} style={{ height: 500, width: '100%' }} />
                        )}
                    </div>

                    {/* Legend */}
                    <div className="card" style={{ marginTop: 20 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>💡 How to read this map</h3>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-secondary)', fontSize: '0.875rem', listStyle: 'none' }}>
                            <li>🔵 <strong>Bubble size</strong> — larger bubbles = more revenue generated from that neighbourhood</li>
                            <li>🟢 <strong>Green bubbles</strong> — lower revenue areas (good opportunity to open new shops)</li>
                            <li>🟠 <strong>Orange/Red bubbles</strong> — high spending zones (saturated but high demand)</li>
                            <li>🖱 <strong>Click a bubble</strong> — to see shop name, total units sold, and revenue</li>
                        </ul>
                    </div>
                </div>
            </main>
        </>
    );
}
