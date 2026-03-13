'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapStop {
    id: string;
    label: string;
    /** Leaflet format: [lat, lng] */
    coords: [number, number];
    type: 'store' | 'home';
    index: number;
    itemCount?: number;
    etaMins?: number;
}

interface Props {
    stops: MapStop[];
}

/** Auto-fits map bounds to show all markers */
function FitBounds({ stops }: { stops: MapStop[] }) {
    const map = useMap();
    useEffect(() => {
        if (stops.length > 0) {
            try {
                const bounds = L.latLngBounds(stops.map(s => s.coords));
                map.fitBounds(bounds, { padding: [44, 44], maxZoom: 15 });
            } catch { /* ignore if coords invalid */ }
        }
    }, [map, stops]);
    return null;
}

function fmtEta(n?: number): string {
    if (!n) return '';
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60); const m = n % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function makeStoreIcon(n: number) {
    return L.divIcon({
        html: `<div style="background:#fff;border:2.5px solid #16a34a;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:1.05rem;box-shadow:0 2px 10px rgba(22,163,74,0.28),0 1px 3px rgba(0,0,0,0.12);position:relative;">🏪<span style="position:absolute;top:-9px;right:-9px;background:#16a34a;color:#fff;border-radius:50%;width:18px;height:18px;font-size:0.62rem;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;">${n}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        className: '',
    });
}

const homeIcon = L.divIcon({
    html: `<div style="background:#fff;border:2.5px solid #2563eb;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 2px 10px rgba(37,99,235,0.28),0 1px 3px rgba(0,0,0,0.12);">🏠</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    className: '',
});

export default function DeliveryRouteMapBase({ stops }: Props) {
    if (stops.length === 0) return null;

    const storeStops = stops.filter(s => s.type === 'store');
    const homeStop = stops.find(s => s.type === 'home');

    // Build polyline: all store coords in order, then home
    const routeCoords = stops.map(s => s.coords);

    return (
        <MapContainer
            center={stops[0].coords}
            zoom={12}
            scrollWheelZoom={true}
            zoomControl={false}
            style={{ height: '300px', width: '100%', borderRadius: '12px', zIndex: 0 }}
        >
            {/* Light tile layer — OpenStreetMap via CARTO */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                subdomains="abcd"
                maxZoom={19}
            />
            <ZoomControl position="topright" />

            {/* Store-to-store pickup route (green dashed) */}
            {storeStops.length > 1 && (
                <Polyline
                    positions={storeStops.map(s => s.coords)}
                    pathOptions={{ color: '#16a34a', weight: 3, opacity: 0.85, dashArray: '9 5' }}
                />
            )}

            {/* Last-mile delivery to home (blue solid) */}
            {homeStop && storeStops.length > 0 && (
                <Polyline
                    positions={[storeStops[storeStops.length - 1].coords, homeStop.coords]}
                    pathOptions={{ color: '#2563eb', weight: 3.5, opacity: 0.85 }}
                />
            )}

            {/* Store markers */}
            {storeStops.map(stop => (
                <Marker key={stop.id} position={stop.coords} icon={makeStoreIcon(stop.index)}>
                    <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
                            #{stop.index} {stop.label}
                        </div>
                        {stop.itemCount !== undefined && (
                            <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '2px' }}>
                                {stop.itemCount} item{stop.itemCount !== 1 ? 's' : ''} · ~2 min stop
                            </div>
                        )}
                    </Tooltip>
                </Marker>
            ))}

            {/* Home marker */}
            {homeStop && (
                <Marker position={homeStop.coords} icon={homeIcon}>
                    <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
                            🏠 {homeStop.label || 'Your address'}
                        </div>
                        {homeStop.etaMins !== undefined && (
                            <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '2px' }}>
                                ETA: ~{fmtEta(homeStop.etaMins)}
                            </div>
                        )}
                    </Tooltip>
                </Marker>
            )}

            <FitBounds stops={stops} />
        </MapContainer>
    );
}
