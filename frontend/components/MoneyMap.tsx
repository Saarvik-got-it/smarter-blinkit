'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

export default function MoneyMap({ data }: { data: [number, number, number][] }) {
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Bengaluru default center
        const center: [number, number] = [12.9716, 77.5946];

        if (!mapRef.current) {
            mapRef.current = L.map('money-map-container').setView(center, 11);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
            }).addTo(mapRef.current);
        }

        if (data && data.length > 0) {
            // Add heatmap layer
            // @ts-ignore - leaflet.heat adds this to L
            const heat = L.heatLayer(data, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
                gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
            }).addTo(mapRef.current);

            // Fit bounds if data contains points
            const bounds = L.latLngBounds(data.map(d => [d[0], d[1]]));
            if (bounds.isValid()) {
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            }

            return () => {
                if (mapRef.current) mapRef.current.removeLayer(heat);
            }
        }
    }, [data]);

    return (
        <div
            id="money-map-container"
            style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-lg)', minHeight: 400 }}
        />
    );
}
