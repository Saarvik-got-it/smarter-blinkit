'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import { useApp } from '@/lib/context';

export default function ShopPage() {
    const { api, addToCart, user, toast } = useApp();
    const [products, setProducts] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchMode, setSearchMode] = useState<'text' | 'intent'>('text');
    const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);

    const doSearch = async (q: string, cat: string) => {
        setLoading(true); setExpandedKeywords([]);
        try {
            if (searchMode === 'intent' && q) {
                const { data } = await api.post('/ai/intent-search', { query: q });
                setProducts(data.results?.map((r: any) => r.product) || []);
                setExpandedKeywords(data.expandedKeywords || []);
            } else {
                const { data } = await api.get('/products/search', { params: { q, category: cat, limit: 40 } });
                setProducts(data.products || []);
            }
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { doSearch('', ''); }, []);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(query, category); };

    const emoji: Record<string, string> = { Groceries: '🌾', Dairy: '🥛', Fresh: '🥬', Pharmacy: '💊', Beverages: '🥤', Snacks: '🍿', Electronics: '📱' };
    const getCategoryEmoji = (cat: string) => emoji[cat] || '📦';

    return (
        <>
            <Navbar />
            <CartSidebar />
            <main style={{ paddingTop: '64px', minHeight: '100vh' }}>
                {/* Search Hero */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0,210,106,0.06) 0%, transparent 60%)', padding: '40px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🛒 Shop</h1>
                        <p className="text-muted" style={{ marginBottom: '20px', fontSize: '0.875rem' }}>
                            {searchMode === 'intent' ? '💡 AI intent mode: describe what you need' : '🔍 Search products by name'}
                        </p>

                        {/* Search Mode Toggle */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button onClick={() => setSearchMode('text')} className={`btn btn-sm ${searchMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}>📝 Text Search</button>
                            <button onClick={() => setSearchMode('intent')} className={`btn btn-sm ${searchMode === 'intent' ? 'btn-primary' : 'btn-secondary'}`}>🧠 AI Intent</button>
                        </div>

                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div className="search-bar" style={{ flex: '1', minWidth: '260px' }}>
                                <span style={{ fontSize: '1rem' }}>{searchMode === 'intent' ? '🧠' : '🔍'}</span>
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={searchMode === 'intent' ? 'e.g. "I have a cold" or "movie night snacks"' : 'Search products...'}
                                />
                                <button type="submit" className="search-btn">Search</button>
                            </div>
                            {searchMode === 'text' && (
                                <input className="form-input" style={{ width: '160px' }} placeholder="Category..." value={category} onChange={e => setCategory(e.target.value)} />
                            )}
                        </form>

                        {/* AI expanded keywords */}
                        {expandedKeywords.length > 0 && (
                            <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🧠 Searching for:</span>
                                {expandedKeywords.map(k => <span key={k} className="badge badge-green">{k}</span>)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Products Grid */}
                <div className="container" style={{ padding: '28px 24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '80px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
                            <p>No products found. Try a different search.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>{products.length} products found</p>
                            <div className="product-grid">
                                {products.map(p => (
                                    <div key={p._id} className="product-card">
                                        <Link href={`/shop/${p._id}`} style={{ display: 'block' }}>
                                            <div className="product-card-image">
                                                {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getCategoryEmoji(p.category)}
                                            </div>
                                            {p.stock < 10 && p.stock > 0 && <span className="product-badge" style={{ background: 'var(--warning)', color: '#2d1a00' }}>Low Stock</span>}
                                            {p.stock === 0 && <span className="product-badge" style={{ background: 'var(--danger)', color: '#fff' }}>Out of Stock</span>}
                                            <div className="product-card-body">
                                                <div className="product-card-name">{p.name}</div>
                                                <div className="product-card-shop">🏪 {p.shopId?.name || 'Local Shop'}</div>
                                            </div>
                                        </Link>
                                        <div style={{ padding: '0 14px 14px' }}>
                                            <div className="product-card-footer">
                                                <div>
                                                    <div className="product-card-price">₹{p.price}</div>
                                                    <div className="product-card-unit">per {p.unit}</div>
                                                </div>
                                                <button
                                                    disabled={p.stock === 0}
                                                    onClick={() => {
                                                        if (!user) { toast('Please login to add to cart', 'error'); return; }
                                                        addToCart({ productId: p._id, name: p.name, price: p.price, quantity: 1, image: p.image, shopId: p.shopId?._id, shopName: p.shopId?.name });
                                                    }}
                                                    className="btn btn-primary btn-sm"
                                                >
                                                    {p.stock === 0 ? 'N/A' : '+ Add'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
