'use client';
import { useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
    value: string;
    label: string;
    emoji?: string;
}

interface MultiSelectDropdownProps {
    options: MultiSelectOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    allLabel?: string;
}

export default function MultiSelectDropdown({
    options,
    selected,
    onChange,
    placeholder = 'Select...',
    allLabel = 'All',
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const clearAll = () => onChange([]);

    const filtered = options.filter(o =>
        !search || o.label.toLowerCase().includes(search.toLowerCase())
    );

    const displayLabel = () => {
        if (selected.length === 0) return allLabel;
        if (selected.length === 1) {
            const opt = options.find(o => o.value === selected[0]);
            return opt ? `${opt.emoji || ''} ${opt.label}`.trim() : selected[0];
        }
        return `${selected.length} selected`;
    };

    const isActive = selected.length > 0;

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: '160px' }}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    background: isActive ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.875rem',
                    width: '100%',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s, background 0.15s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel()}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {isActive && (
                        <span
                            onClick={e => { e.stopPropagation(); clearAll(); }}
                            style={{ fontSize: '0.7rem', background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700 }}
                            title="Clear"
                        >
                            ✕
                        </span>
                    )}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </span>
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: '220px',
                    maxWidth: '300px',
                    zIndex: 999,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                    overflow: 'hidden',
                    animation: 'msDropdown 0.15s ease-out',
                }}>
                    {/* Search inside dropdown */}
                    {options.length > 6 && (
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                            <input
                                autoFocus
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                }}
                            />
                        </div>
                    )}

                    {/* Options */}
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        {filtered.length === 0 && (
                            <div style={{ padding: '12px 14px', fontSize: '0.825rem', color: 'var(--text-muted)' }}>No results</div>
                        )}
                        {filtered.map(opt => {
                            const checked = selected.includes(opt.value);
                            return (
                                <label
                                    key={opt.value}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '9px 14px',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: checked ? 600 : 400,
                                        color: checked ? 'var(--accent)' : 'var(--text-primary)',
                                        background: checked ? 'var(--accent-subtle)' : 'transparent',
                                        transition: 'background 0.1s',
                                        borderBottom: '1px solid var(--border)',
                                        userSelect: 'none',
                                    }}
                                    onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                                    onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {/* Custom checkbox */}
                                    <span style={{
                                        width: 18, height: 18,
                                        borderRadius: '5px',
                                        border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                                        background: checked ? 'var(--accent)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background 0.15s, border 0.15s',
                                    }}>
                                        {checked && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(opt.value)}
                                        style={{ display: 'none' }}
                                    />
                                    <span>{opt.emoji && `${opt.emoji} `}{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {selected.length > 0 && (
                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{selected.length} selected</span>
                            <button type="button" onClick={clearAll} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Clear all</button>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes msDropdown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
