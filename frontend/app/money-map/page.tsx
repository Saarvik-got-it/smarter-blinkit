'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { useApp } from '@/lib/context';
import { fadeUp, staggerContainer, scaleIn } from '@/lib/animations';

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
            <main style={{ paddingTop: 64, minHeight: '100vh', position: 'relative' }}>
                {/* Ambient mesh background */}
                <div className="mesh-hero" style={{ position: 'fixed' }} />
                <div className="container" style={{ padding: '36px 24px' }}>
                    {/* Header */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: 8 }}>
                            <h1 style={{ fontSize: '2rem', marginBottom: 0 }}>🗺 Money Map</h1>
                            {!loading && heatmapData.length > 0 && (
                                <span className="activity-signal"><span className="signal-dot" />{heatmapData.length} active shops</span>
                            )}
                        </div>
                        <p className="text-muted" style={{ fontSize: '0.9rem' }}>Neighbourhood-level purchasing heatmap · Bubble size = revenue · Colour = intensity</p>
                    </motion.div>

                    {/* Stats */}
                    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                        <div className="stats-grid" style={{ marginBottom: 28 }}>
                            {[
                                { icon: '💰', iconClass: 'green', label: 'Total Revenue (mapped)', value: `₹${stats.totalRevenue.toFixed(0)}` },
                                { icon: '📦', iconClass: 'blue', label: 'Total Units Sold', value: String(stats.totalSales) },
                                { icon: '🏆', iconClass: 'orange', label: 'Top Shop', value: stats.topShop || '—', small: true },
                                { icon: '🏪', iconClass: 'green', label: 'Active Locations', value: String(heatmapData.length || 2) },
                            ].map((s, i) => (
                                <motion.div key={s.label} variants={scaleIn} className="stat-card depth-card">
                                    <div className={`stat-icon ${s.iconClass}`}>{s.icon}</div>
                                    <div className="stat-label">{s.label}</div>
                                    <div className="stat-value" style={s.small ? { fontSize: '1.1rem' } : {}}>{s.value}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Stat ticker */}
                    {!loading && (
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="map-stat-ticker" style={{ marginBottom: 20, borderRadius: 'var(--radius-md)' }}>
                            <div className="map-stat-ticker-item"><strong>{stats.totalSales}</strong> units sold · mapped live</div>
                            <div className="map-stat-ticker-item"><strong>₹{(stats.totalRevenue / Math.max(heatmapData.length, 1)).toFixed(0)}</strong> avg revenue/shop</div>
                            <div className="map-stat-ticker-item"><strong>{heatmapData.length || 2}</strong> locations tracked</div>
                        </motion.div>
                    )}

                    {/* Map */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card depth-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>📍 Bengaluru Sales Map</span>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00d26a', display: 'inline-block' }} /> Low revenue</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff6b00', display: 'inline-block' }} /> High revenue</span>
                            </div>
                        </div>
                        {loading ? (
                            <div style={{ height: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[0, 1, 2].map(i => <div key={i} className="ai-thinking-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
                                </div>
                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading map data...</p>
                            </div>
                        ) : (
                            <div ref={mapRef} style={{ height: 500, width: '100%' }} />
                        )}
                    </motion.div>

                    {/* Legend */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card" style={{ marginTop: 20 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>💡 How to read this map</h3>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-secondary)', fontSize: '0.875rem', listStyle: 'none' }}>
                            <li>🔵 <strong>Bubble size</strong> — larger bubbles = more revenue generated from that neighbourhood</li>
                            <li>🟢 <strong>Green bubbles</strong> — lower revenue areas (good opportunity to open new shops)</li>
                            <li>🟠 <strong>Orange/Red bubbles</strong> — high spending zones (saturated but high demand)</li>
                            <li>🖱 <strong>Click a bubble</strong> — to see shop name, total units sold, and revenue</li>
                        </ul>
                    </motion.div>
                </div>
            </main>
        </>
    );
}
