'use client';

import dynamic from 'next/dynamic';
import type { MapPickerProps } from './MapPickerBase';

const MapPickerBase = dynamic(() => import('./MapPickerBase'), {
    ssr: false,
    loading: () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px', width: '100%', position: 'relative', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 40, height: 40, marginBottom: '16px' }}></div>
            <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading Map...</div>
        </div>
    )
});

export default function MapPicker(props: MapPickerProps) {
    return <MapPickerBase {...props} />;
}
