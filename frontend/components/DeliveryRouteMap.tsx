'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MapStop } from './DeliveryRouteMapBase';

/** Dynamically imported Leaflet map — no SSR */
const RouteMapDisplay = dynamic(() => import('./DeliveryRouteMapBase'), {
    ssr: false,
    loading: () => (
        <div style={{ height: 240, background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading map…</span>
        </div>
    ),
});

// ── Haversine distance between two [lng, lat] GeoJSON coords ──────────
function haversine(c1: [number, number], c2: [number, number]): number {
    const R = 6371;
    const dLat = (c2[1] - c1[1]) * Math.PI / 180;
    const dLon = (c2[0] - c1[0]) * Math.PI / 180;
    const lat1 = c1[1] * Math.PI / 180;
    const lat2 = c2[1] * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format a clamped ETA value to human-readable string */
function formatEta(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Route optimisation for delivery: start from the farthest shop (deepest into the
 * route) and use nearest-neighbour back toward home. This avoids the wrong pattern
 * of Home → nearby shop → faraway shop → Home (unnecessary round trip).
 * Correct pattern: Home → farthest shop → (greedy nearest) → closest shop → Home.
 * @param home   [lng, lat] GeoJSON — customer delivery address
 * @param shops  shop groups that have shopLocation.coordinates
 */
function farthestFirstRoute(home: [number, number], shops: any[]): any[] {
    if (shops.length <= 1) return shops;

    // 1. The first pickup is the shop farthest from home
    let farthestIdx = 0;
    let maxDist = -1;
    shops.forEach((s, i) => {
        const d = haversine(home, s.shopLocation.coordinates as [number, number]);
        if (d > maxDist) { maxDist = d; farthestIdx = i; }
    });

    // 2. Nearest-neighbour from that farthest shop, progressively heading back toward home
    const remaining = shops.filter((_, i) => i !== farthestIdx);
    const ordered: any[] = [shops[farthestIdx]];
    let current: [number, number] = shops[farthestIdx].shopLocation.coordinates as [number, number];

    while (remaining.length > 0) {
        let minDist = Infinity;
        let nearestIdx = 0;
        remaining.forEach((s, i) => {
            const d = haversine(current, s.shopLocation.coordinates as [number, number]);
            if (d < minDist) { minDist = d; nearestIdx = i; }
        });
        ordered.push(remaining[nearestIdx]);
        current = remaining[nearestIdx].shopLocation.coordinates as [number, number];
        remaining.splice(nearestIdx, 1);
    }
    return ordered;
}

interface Props {
    cartAnalysis: any;
    /** GeoJSON [lng, lat] */
    userCoords?: [number, number];
    userAddress?: string;
}

export default function DeliveryRouteMap({ cartAnalysis, userCoords, userAddress }: Props) {
    const [showMap, setShowMap] = useState(false);

    // Only shops that have valid coordinates from the backend
    const shopsWithCoords = useMemo(() =>
        (cartAnalysis?.shopGroups || []).filter(
            (g: any) => Array.isArray(g.shopLocation?.coordinates) && g.shopLocation.coordinates[0] !== 0
        ),
        [cartAnalysis]
    );

    // Optimised pickup order: farthest-first so the agent travels out to the
    // most distant shop and collects others on the way back home.
    const orderedShops = useMemo(() => {
        if (shopsWithCoords.length === 0 || !userCoords) return shopsWithCoords;
        return farthestFirstRoute(userCoords, shopsWithCoords);
    }, [shopsWithCoords, userCoords]);

    // Total ETA: worst-case shop delivery + 2 min per extra stop, capped at 120 min
    const totalEta = useMemo(() => {
        if (orderedShops.length === 0) return 30;
        const maxEta = Math.max(...orderedShops.map((s: any) => s.deliveryEstimateMins || 20));
        const raw = maxEta + (orderedShops.length - 1) * 2;
        return Math.min(raw, 120); // cap to avoid bad-coordinate blowout
    }, [orderedShops]);

    // Leaflet-ready stops ([lat, lng] format + home at end)
    const mapStops = useMemo((): MapStop[] => {
        if (!userCoords) return [];
        const stops: MapStop[] = orderedShops.map((s: any, i: number) => ({
            id: s.shopId?.toString() ?? `shop-${i}`,
            label: s.shopName ?? 'Shop',
            coords: [s.shopLocation.coordinates[1], s.shopLocation.coordinates[0]], // [lat, lng]
            type: 'store',
            index: i + 1,
            itemCount: s.items?.length,
            etaMins: s.deliveryEstimateMins,
        }));
        stops.push({
            id: 'home',
            label: userAddress || 'Your address',
            coords: [userCoords[1], userCoords[0]], // [lat, lng]
            type: 'home',
            index: stops.length + 1,
            itemCount: undefined,
            etaMins: totalEta,
        });
        return stops;
    }, [orderedShops, userCoords, userAddress, totalEta]);

    // Nothing to show if no shops have coordinates or user hasn't set location
    if (orderedShops.length === 0 || !userCoords || (userCoords[0] === 0 && userCoords[1] === 0)) {
        return null;
    }

    return (
        <div style={{ marginBottom: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>

            {/* ── Header ───────────────────────────────────────────── */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,210,106,0.18), rgba(0,122,255,0.12))', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🗺️</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Delivery Route</div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {orderedShops.length} pickup stop{orderedShops.length > 1 ? 's' : ''} · ETA ~{formatEta(totalEta)}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setShowMap(v => !v)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.73rem', padding: '4px 10px', border: '1px solid var(--border)', flexShrink: 0 }}
                >
                    {showMap ? 'Hide Map' : '🗺 View Map'}
                </button>
            </div>

            {/* ── Horizontal flow bar ──────────────────────────────── */}
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
                    {orderedShops.map((shop: any, i: number) => (
                        <div key={shop.shopId ?? i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '5px 10px', fontSize: '0.73rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                                <span style={{ background: 'var(--accent)', color: '#000', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                                🏪 {shop.shopName}
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>→</span>
                        </div>
                    ))}
                    <div style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.3)', borderRadius: '8px', padding: '5px 10px', fontSize: '0.73rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', color: '#4da6ff' }}>
                        🏠 Your Home
                    </div>
                </div>
            </div>

            {/* ── Route summary list ───────────────────────────────── */}
            <div style={{ padding: '12px 16px' }}>
                {orderedShops.map((shop: any, i: number) => (
                    <div key={shop.shopId ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                        <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>🏪 {shop.shopName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {shop.items?.length ?? 0} item{shop.items?.length !== 1 ? 's' : ''} · ~2 min stop
                                {shop.deliveryEstimateMins ? ` · ${formatEta(Math.min(shop.deliveryEstimateMins, 120))} from your location` : ''}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Home / final delivery */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)', marginTop: '4px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#007aff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>🏠</div>
                    <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>Deliver to your address</div>
                        {userAddress && (
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userAddress}</div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '3px' }}>
                            ETA: ~{formatEta(totalEta)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Interactive Leaflet map (toggled) ────────────────── */}
            {showMap && (
                <div style={{ padding: '0 14px 14px' }}>
                    <RouteMapDisplay stops={mapStops} />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span><span style={{ color: '#16a34a', fontWeight: 700 }}>——</span> Pickup route</span>
                        <span><span style={{ color: '#2563eb', fontWeight: 700 }}>——</span> Last-mile delivery</span>
                    </div>
                </div>
            )}
        </div>
    );
}
