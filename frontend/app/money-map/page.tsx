//trigger redeployment 2

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
                const { data: res } = await api.get('/admin/storeboard');
                const rawHeatmap = res.heatmapData || [];

                // Reuse Seller Dashboard's heatmap source and adapt it to this page's existing bubble data shape.
                data = rawHeatmap
                    .filter((point: any) => Array.isArray(point) && point.length >= 3)
                    .map((point: any, idx: number) => {
                        const lat = Number(point[0]);
                        const lng = Number(point[1]);
                        const intensity = Number(point[2]) || 0;
                        return {
                            shopName: `Location ${idx + 1}`,
                            coordinates: [lng, lat],
                            address: 'Bengaluru',
                            totalSales: Math.max(1, Math.round(intensity / 50)),
                            totalRevenue: intensity,
                        };
                    });

                setHeatmapData(data);

                const totalRevenue = data.reduce((s: number, d: any) => s + d.totalRevenue, 0);
                const totalSales = data.reduce((s: number, d: any) => s + d.totalSales, 0);
                const topShop = data[0]?.shopName || 'N/A';
                setStats({ totalRevenue, totalSales, topShop });
            } catch { }

            setLoading(false);

            // Init map
            if (mapRef.current && !mapInstanceRef.current && window.L) {
                const map = window.L.map(mapRef.current, { zoomControl: true, preferCanvas: true }).setView([12.9716, 77.5946], 13);
                mapInstanceRef.current = map;
                const pulseIntervals: any[] = [];

                const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
                const getBaseRadius = (revenue: number, maxRevenue: number) => {
                    const minRadius = 8;
                    const maxRadius = 35;
                    const normalized = Math.sqrt(Math.max(revenue, 0)) / Math.sqrt(Math.max(maxRevenue, 1));
                    return clamp(minRadius + normalized * (maxRadius - minRadius), minRadius, maxRadius);
                };
                const getZoomScaledRadius = (baseRadius: number, zoom: number) => {
                    const zoomBase = 13;
                    const scaled = baseRadius * Math.pow(zoom / zoomBase, 0.9);
                    return clamp(scaled, 6, 42);
                };
                const getRevenueColor = (intensity: number) => {
                    if (intensity >= 0.8) return { fill: '#ff6b3d', stroke: '#ffbe9f', glow: '#ff8a4f' };
                    if (intensity >= 0.6) return { fill: '#ff8f3f', stroke: '#ffd2a7', glow: '#ff9f50' };
                    if (intensity >= 0.35) return { fill: '#86d64f', stroke: '#d5f5bc', glow: '#9de26b' };
                    return { fill: '#46c870', stroke: '#b8f1cc', glow: '#67e093' };
                };
                const popupHtml = (shop: any) => `
                    <div class="sales-popup-card">
                        <div class="sales-popup-title">${shop.shopName || 'Shop'}</div>
                        <div class="sales-popup-row"><span>📦</span><span>Sales: <strong>${shop.totalSales || 0}</strong></span></div>
                        <div class="sales-popup-row"><span>💰</span><span>Revenue: <strong>₹${Number(shop.totalRevenue || 0).toFixed(0)}</strong></span></div>
                        <div class="sales-popup-row"><span>📍</span><span>${shop.address || 'Bengaluru'}</span></div>
                    </div>
                `;

                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                }).addTo(map);

                // Add shop markers with normalized revenue scaling and zoom-aware resizing
                if (data.length > 0) {
                    const maxRevenue = Math.max(...data.map((d: any) => d.totalRevenue), 1);
                    const enriched = data
                        .filter((shop: any) => shop.coordinates && shop.coordinates.length >= 2)
                        .map((shop: any) => {
                            const intensity = Math.max(0.08, shop.totalRevenue / maxRevenue);
                            const baseRadius = getBaseRadius(shop.totalRevenue || 0, maxRevenue);
                            return { ...shop, intensity, baseRadius };
                        })
                        .sort((a: any, b: any) => (a.totalRevenue || 0) - (b.totalRevenue || 0));

                    const markerBundle = enriched.map((shop: any) => {
                        if (!shop.coordinates || shop.coordinates.length < 2) return;
                        const [lng, lat] = shop.coordinates;
                        const colors = getRevenueColor(shop.intensity);
                        const marker = window.L.circleMarker([lat, lng], {
                            radius: 0,
                            fillColor: colors.fill,
                            color: colors.stroke,
                            weight: 1.3,
                            opacity: 0,
                            fillOpacity: 0,
                        }).addTo(map);

                        // Outer glow ring to add visual depth and hierarchy.
                        const glow = window.L.circleMarker([lat, lng], {
                            radius: 0,
                            fillColor: colors.glow,
                            color: colors.glow,
                            weight: 0,
                            opacity: 0,
                            fillOpacity: 0,
                            interactive: false,
                        }).addTo(map);

                        marker.bindPopup(popupHtml(shop), { className: 'money-map-popup', autoPanPadding: [32, 32] });
                        return { shop, marker, glow };
                    }).filter(Boolean) as any[];

                    const resizeMarkersForZoom = () => {
                        const zoom = map.getZoom();
                        markerBundle.forEach(({ shop, marker, glow }) => {
                            const targetRadius = getZoomScaledRadius(shop.baseRadius, zoom);
                            marker.setRadius(targetRadius);
                            marker.setStyle({
                                fillOpacity: 0.45 + Math.min(shop.intensity * 0.32, 0.28),
                                opacity: 0.7,
                            });
                            glow.setRadius(targetRadius + 6);
                            glow.setStyle({ fillOpacity: 0.12 + Math.min(shop.intensity * 0.18, 0.14), opacity: 0.2 });
                        });
                    };

                    // Entry animation for polished first impression.
                    markerBundle.forEach(({ shop, marker, glow }, idx) => {
                        const finalRadius = getZoomScaledRadius(shop.baseRadius, map.getZoom());
                        const finalGlowRadius = finalRadius + 6;
                        setTimeout(() => {
                            let frame = 0;
                            const frames = 14;
                            const timer = setInterval(() => {
                                frame += 1;
                                const t = frame / frames;
                                const eased = 1 - Math.pow(1 - t, 3);
                                marker.setRadius(finalRadius * eased);
                                marker.setStyle({ opacity: 0.7 * eased, fillOpacity: (0.45 + Math.min(shop.intensity * 0.32, 0.28)) * eased });
                                glow.setRadius(finalGlowRadius * eased);
                                glow.setStyle({ opacity: 0.2 * eased, fillOpacity: (0.12 + Math.min(shop.intensity * 0.18, 0.14)) * eased });
                                if (frame >= frames) clearInterval(timer);
                            }, 18);
                        }, idx * 35);

                        // Hover highlight for better interactivity.
                        marker.on('mouseover', () => {
                            const activeRadius = getZoomScaledRadius(shop.baseRadius, map.getZoom()) + 3;
                            marker.setRadius(activeRadius);
                            marker.setStyle({ weight: 2, fillOpacity: 0.82, opacity: 0.95 });
                            glow.setRadius(activeRadius + 9);
                            glow.setStyle({ fillOpacity: 0.26, opacity: 0.3 });
                            marker.bringToFront();
                        });
                        marker.on('mouseout', () => {
                            const normalRadius = getZoomScaledRadius(shop.baseRadius, map.getZoom());
                            marker.setRadius(normalRadius);
                            marker.setStyle({ weight: 1.3, fillOpacity: 0.45 + Math.min(shop.intensity * 0.32, 0.28), opacity: 0.7 });
                            glow.setRadius(normalRadius + 6);
                            glow.setStyle({ fillOpacity: 0.12 + Math.min(shop.intensity * 0.18, 0.14), opacity: 0.2 });
                        });

                        // Subtle pulse for high-revenue bubbles.
                        if (shop.intensity >= 0.75) {
                            let pulseDirection = 1;
                            const pulse = setInterval(() => {
                                const base = getZoomScaledRadius(shop.baseRadius, map.getZoom());
                                const delta = pulseDirection * 1.4;
                                glow.setRadius(base + 7 + delta);
                                glow.setStyle({ fillOpacity: 0.22 + (pulseDirection > 0 ? 0.06 : 0) });
                                pulseDirection *= -1;
                            }, 1100);
                            pulseIntervals.push(pulse);
                        }
                    });

                    resizeMarkersForZoom();
                    map.on('zoomend', resizeMarkersForZoom);

                    map.on('unload', () => {
                        pulseIntervals.forEach((timer: any) => clearInterval(timer));
                    });
                } else {
                    // Add sample markers for seeded shops (no orders yet)
                    const sampleShops = [
                        { name: 'Ramesh General Store', lat: 12.9716, lng: 77.5946, revenue: 12500, sales: 180 },
                        { name: "Priya's Pharmacy & Fresh", lat: 12.9784, lng: 77.6413, revenue: 8400, sales: 120 },
                    ];
                    sampleShops.forEach(shop => {
                        const marker = window.L.circleMarker([shop.lat, shop.lng], {
                            radius: 18,
                            fillColor: '#46c870',
                            color: '#d6ffe5',
                            weight: 1.5,
                            opacity: 0.8,
                            fillOpacity: 0.62,
                        }).addTo(map);

                        marker.bindPopup(`
                            <div class="sales-popup-card">
                                <div class="sales-popup-title">${shop.name}</div>
                                <div class="sales-popup-row"><span>📦</span><span>Sales: <strong>${shop.sales}</strong></span></div>
                                <div class="sales-popup-row"><span>💰</span><span>Est. Revenue: <strong>₹${shop.revenue}</strong></span></div>
                                <div class="sales-popup-row"><span>💡</span><span>Place more orders to see live data</span></div>
                            </div>
                        `, { className: 'money-map-popup' });
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
                            <span style={{ fontWeight: 600 }}>📍 All Stores Sales Map</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Bubble size tracks revenue (normalized)</span>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #8af0ad, #35b861)' }} />
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Low revenue</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffd28f, #ff8f3f)' }} />
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Medium</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffc8af, #ff6b3d)' }} />
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>High revenue</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 140, height: 8, borderRadius: 999, background: 'linear-gradient(90deg, #46c870 0%, #86d64f 40%, #ff8f3f 75%, #ff6b3d 100%)', opacity: 0.9 }} />
                        </div>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-secondary)', fontSize: '0.875rem', listStyle: 'none' }}>
                            <li>🔵 <strong>Bubble size</strong> — larger bubbles = more revenue generated from that neighbourhood</li>
                            <li>🟢 <strong>Green bubbles</strong> — lower revenue areas (good opportunity to open new shops)</li>
                            <li>🟠 <strong>Orange/Red bubbles</strong> — high spending zones (saturated but high demand)</li>
                            <li>🖱 <strong>Click a bubble</strong> — to see shop name, total units sold, and revenue</li>
                        </ul>
                    </motion.div>
                </div>

                <style>{`
                    .money-map-popup .leaflet-popup-content-wrapper {
                        border-radius: 14px;
                        background: rgba(9, 18, 24, 0.96);
                        color: #eaf7ef;
                        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
                        border: 1px solid rgba(96, 214, 140, 0.35);
                        animation: popupIn 180ms ease-out;
                    }
                    .money-map-popup .leaflet-popup-tip {
                        background: rgba(9, 18, 24, 0.96);
                        border: 1px solid rgba(96, 214, 140, 0.35);
                    }
                    .money-map-popup .leaflet-popup-content {
                        margin: 10px 12px;
                        min-width: 210px;
                    }
                    .sales-popup-card {
                        display: flex;
                        flex-direction: column;
                        gap: 7px;
                        font-size: 12.5px;
                        line-height: 1.35;
                    }
                    .sales-popup-title {
                        font-size: 13.5px;
                        font-weight: 700;
                        margin-bottom: 3px;
                        color: #bff9d2;
                    }
                    .sales-popup-row {
                        display: grid;
                        grid-template-columns: 16px 1fr;
                        gap: 6px;
                        align-items: center;
                    }
                    @keyframes popupIn {
                        from { opacity: 0; transform: translateY(6px) scale(0.96); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `}</style>
            </main>
        </>
    );
}
