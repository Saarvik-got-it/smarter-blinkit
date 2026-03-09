'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet icon fix for Next.js
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

export interface MapLocationData {
    coordinates: [number, number]; // [lng, lat] for GeoJSON
    address: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
}

export interface MapPickerProps {
    onConfirm: (location: MapLocationData) => void;
    initialCoords?: [number, number]; // [lng, lat]
    buttonText?: string;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]; // New Delhi [lat, lng]

function RecenterController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);
    return null;
}

function InteractiveMarker({ position, setPosition, onDragEnd }: { position: [number, number], setPosition: any, onDragEnd: any }) {
    const markerRef = useRef<L.Marker>(null);
    const map = useMap();

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                const pos = marker.getLatLng();
                setPosition([pos.lat, pos.lng]);
                map.setView(pos, map.getZoom(), { animate: true });
                onDragEnd([pos.lat, pos.lng]);
            }
        },
    };

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
            map.setView(e.latlng, map.getZoom(), { animate: true });
            onDragEnd([e.latlng.lat, e.latlng.lng]);
        }
    });

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

export default function MapPickerBase({ onConfirm, initialCoords, buttonText = "Confirm Location" }: MapPickerProps) {
    const [center, setCenter] = useState<[number, number]>(initialCoords ? [initialCoords[1], initialCoords[0]] : DEFAULT_CENTER);
    const [markerPos, setMarkerPos] = useState<[number, number]>(initialCoords ? [initialCoords[1], initialCoords[0]] : DEFAULT_CENTER);
    const [locationData, setLocationData] = useState<MapLocationData | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial Geolocation
    useEffect(() => {
        if (!initialCoords) {
            handleLocateMe();
        } else {
            reverseGeocode(initialCoords[1], initialCoords[0]);
        }
    }, []);

    const handleLocateMe = () => {
        setIsLocating(true);
        if (!navigator.geolocation) {
            setIsLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setCenter([lat, lon]);
                setMarkerPos([lat, lon]);
                reverseGeocode(lat, lon);
                setIsLocating(false);
            },
            () => {
                reverseGeocode(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    const reverseGeocode = async (lat: number, lon: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
            const data = await res.json();
            
            if (data && data.address) {
                const addr = data.address;
                const street = [addr.road, addr.suburb, addr.neighbourhood, addr.residential].filter(Boolean).join(', ') || '';
                const city = addr.city || addr.town || addr.village || addr.state_district || addr.county || '';
                const state = addr.state || '';
                const pincode = addr.postcode || '';

                setLocationData({
                    coordinates: [lon, lat], // GeoJSON
                    address: data.display_name,
                    street,
                    city,
                    state,
                    pincode
                });
            }
        } catch (err) {
            console.error('Reverse Geocoding failed', err);
        }
    };

    // Debounced Search
    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error('Search failed', err);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce
    };

    const selectSearchResult = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        setCenter([lat, lon]);
        setMarkerPos([lat, lon]);
        setSearchResults([]);
        setSearchQuery('');
        reverseGeocode(lat, lon);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px', width: '100%', position: 'relative', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000 }}>
                <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="🔍 Search street, area, building..." 
                            value={searchQuery}
                            onChange={handleSearchInput}
                            style={{ width: '100%', paddingLeft: '40px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}
                        />
                        {isSearching && <div className="spinner" style={{ position: 'absolute', right: 12, top: 12, width: 16, height: 16 }}></div>}
                    </div>
                </div>

                {searchResults.length > 0 && (
                    <div style={{ background: 'var(--bg-card)', marginTop: '8px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        {searchResults.map((res: any, idx: number) => (
                            <div 
                                key={res.place_id || idx}
                                onClick={() => selectSearchResult(res)}
                                style={{ padding: '12px 16px', borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                📍 {res.display_name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ position: 'absolute', bottom: 180, right: 16, zIndex: 1000 }}>
                <button 
                    onClick={handleLocateMe}
                    type="button"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', cursor: 'pointer', fontSize: '1.2rem' }}
                    title="Use My Current Location"
                >
                    {isLocating ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : '🧭'}
                </button>
            </div>

            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RecenterController center={center} />
                    <InteractiveMarker position={markerPos} setPosition={setMarkerPos} onDragEnd={(pos: [number, number]) => reverseGeocode(pos[0], pos[1])} />
                </MapContainer>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '20px', borderTop: '1px solid var(--border)', zIndex: 1000, position: 'relative', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
                {locationData ? (
                    <>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📍 Selected Address
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>
                            {locationData.street || 'Selected Area'}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {locationData.address}
                        </div>
                        <button 
                            className="btn btn-primary w-full btn-lg" 
                            onClick={() => onConfirm(locationData)}
                            type="button"
                        >
                            {buttonText}
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ width: 24, height: 24, marginRight: '12px' }}></div>
                        Fetching location details...
                    </div>
                )}
            </div>
        </div>
    );
}
