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
    const [availableShops, setAvailableShops] = useState<any[]>([]);
    const [selectedShop, setSelectedShop] = useState('');
    const [categoriesList, setCategoriesList] = useState<string[]>([]);
    const [nearbyOnly, setNearbyOnly] = useState(true);

    const emoji: Record<string, string> = { Groceries: '🌾', Dairy: '🥛', Fresh: '🥬', Pharmacy: '💊', Beverages: '🥤', Snacks: '🍿', Electronics: '📱', Staples: '🍚', Stationery: '✏️', Meat: '🥩', Bakery: '🍞' };
    const getCategoryEmoji = (cat: string) => emoji[cat] || '📦';

    useEffect(() => {
        // Fetch all shops for the filter dropdown
        api.get('/shops/all').then((r) => setAvailableShops(r.data.shops || [])).catch(() => { });
        // Fetch dynamic categories
        api.get('/products/categories').then((r) => setCategoriesList(r.data.categories || [])).catch(() => { });
    }, [api]);

    const doSearch = async (q: string, cat: string, shop: string, nearby: boolean) => {
        setLoading(true); setExpandedKeywords([]);
        try {
            const lat = user?.location?.coordinates?.[1];
            const lng = user?.location?.coordinates?.[0];
            // When a specific shop is selected, bypass the nearby filter — distance doesn't matter
            const effectiveNearby = shop ? false : nearby;

            if (searchMode === 'intent' && q) {
                const { data } = await api.post('/ai/intent-search', { query: q, lat, lng, nearbyOnly: effectiveNearby, shopId: shop || undefined });
                let intentResults = data.results || [];
                // Frontend-side category filtering for AI results
                if (cat) intentResults = intentResults.filter((r: any) => r.product?.category === cat);
                setProducts(intentResults.map((r: any) => ({ ...r.product, distance: r.product.distance })));
                setExpandedKeywords(data.expandedKeywords || []);
            } else {
                const { data } = await api.get('/products/search', { params: { q, category: cat, shopId: shop, limit: 500, lat, lng, nearbyOnly: effectiveNearby } });
                setProducts(data.products || []);
            }
        } catch { } finally { setLoading(false); }
    };

    // Live sync search: Trigger doSearch whenever dependencies change, with a 300ms debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            doSearch(query, category, selectedShop, nearbyOnly);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, category, selectedShop, searchMode, nearbyOnly, user]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(query, category, selectedShop, nearbyOnly); };

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

                        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="search-bar" style={{ width: '100%' }}>
                                <span style={{ fontSize: '1rem' }}>{searchMode === 'intent' ? '🧠' : '🔍'}</span>
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={searchMode === 'intent' ? 'e.g. "I have a cold" or "movie night snacks"' : 'Search products... (auto updates)'}
                                />
                                <button type="submit" className="search-btn">Search</button>
                            </div>

                            {/* Filter Dialog / Row */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, marginRight: '8px' }}>Filters:</span>

                                <select className="form-select" style={{ minWidth: '180px' }} value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">All Categories</option>
                                    {categoriesList.map(cat => <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>)}
                                </select>

                                <select className="form-select" style={{ minWidth: '180px' }} value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
                                    <option value="">All Shops</option>
                                    {availableShops.map(shop => <option key={shop._id} value={shop._id}>🏪 {shop.name}</option>)}
                                </select>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                    <input type="checkbox" id="nearbyOnly" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="nearbyOnly" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Nearby Only (50km)</label>
                                </div>

                                {(category || selectedShop) && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCategory(''); setSelectedShop(''); }}>Clear</button>
                                )}
                            </div>
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
                    ) : selectedShop ? (
                        /* Single Shop View - Professional Grid */
                        <>
                                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>🏪 {products[0]?.shopId?.name || 'Local Shop'}</h2>
                                            {products[0]?.distance !== undefined && (
                                                <span style={{ fontSize: '0.8rem', color: products[0].distance > 50 ? 'var(--danger)' : 'var(--accent)', fontWeight: 700, background: products[0].distance > 50 ? 'rgba(255,59,48,0.1)' : 'rgba(0,210,106,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                                    📍 {products[0].distance < 1 ? '< 1 km' : `${Math.round(products[0].distance)} km`} away
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-muted">{products.length} products available</p>
                                    </div>
                                    <button onClick={() => setSelectedShop('')} className="btn btn-secondary btn-sm">← Back to all shops</button>
                                </div>
                            <div className="product-grid">
                                {products.map(p => (
                                    <div key={p._id} className="product-card">
                                        <Link href={`/shop/${p._id}`}>
                                            <div className="product-card-image">
                                                {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getCategoryEmoji(p.category)}
                                            </div>
                                            <div className="product-card-body">
                                                <div className="product-card-name" style={{ height: '3rem', overflow: 'hidden' }}>{p.name}</div>
                                                <div className="product-card-footer">
                                                    <div>
                                                        <div className="product-card-price">₹{p.price}</div>
                                                        <div className="product-card-unit">per {p.unit}</div>
                                                    </div>
                                                    <button
                                                        disabled={p.stock === 0}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (!user) { toast('Please login to add to cart', 'error'); return; }
                                                            addToCart({ productId: p._id, name: p.name, price: p.price, quantity: 1, image: p.image, shopId: p.shopId?._id, shopName: p.shopId?.name });
                                                        }}
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        {p.stock === 0 ? 'N/A' : '+ Add'}
                                                    </button>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* Multi-Shop Bucketed View - Horizontal Rows */
                        (() => {
                            const shopsMap: Record<string, { shop: any, products: any[] }> = {};
                            products.forEach(p => {
                                const sid = p.shopId?._id || 'local';
                                if (!shopsMap[sid]) {
                                    shopsMap[sid] = {
                                        shop: p.shopId ? {
                                            ...p.shopId,
                                            distance: p.distance
                                        } : { name: 'Local Shop', distance: 0 },
                                        products: []
                                    };
                                }
                                shopsMap[sid].products.push(p);
                            });

                            const sortedShops = Object.values(shopsMap).sort((a, b) => (a.shop.distance || 0) - (b.shop.distance || 0));

                            return (
                                <>
                                    <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.875rem' }}>
                                        Found results from {sortedShops.length} shops
                                    </p>

                                    {sortedShops.map(({ shop, products: shopProducts }) => (
                                        <div key={shop._id || 'local'} style={{ marginBottom: '48px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', paddingRight: '12px' }}>
                                                <div>
                                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        🏪 {shop.name}
                                                    </h2>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: (shop.distance ?? 0) > 50 ? 'var(--danger)' : 'var(--accent)', fontWeight: 700, background: (shop.distance ?? 0) > 50 ? 'rgba(255,59,48,0.1)' : 'rgba(0,210,106,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                                            📍 {shop.distance === undefined ? 'Unknown distance' : shop.distance < 1 ? '< 1 km' : `${Math.round(shop.distance)} km`} away
                                                        </span>
                                                        {shop.rating && (
                                                            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>⭐ {shop.rating}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => setSelectedShop(shop._id)} className="btn btn-ghost btn-sm" style={{ fontWeight: 600 }}>
                                                    View all from this store →
                                                </button>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                gap: '20px',
                                                overflowX: 'auto',
                                                paddingBottom: '20px',
                                                scrollSnapType: 'x mandatory',
                                                msOverflowStyle: 'none',
                                                scrollbarWidth: 'none',
                                                margin: '0 -10px',
                                                padding: '0 10px 20px'
                                            }} className="no-scrollbar">
                                                {shopProducts.map(p => (
                                                    <div key={p._id} className="product-card" style={{ flex: '0 0 250px', scrollSnapAlign: 'start', margin: 0 }}>
                                                        <Link href={`/shop/${p._id}`}>
                                                            <div className="product-card-image">
                                                                {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getCategoryEmoji(p.category)}
                                                            </div>
                                                            <div className="product-card-body" style={{ padding: '16px' }}>
                                                                <div className="product-card-name" style={{ fontSize: '0.95rem', height: '2.5rem', overflow: 'hidden' }}>{p.name}</div>
                                                                <div className="product-card-footer" style={{ marginTop: '12px' }}>
                                                                    <div>
                                                                        <div className="product-card-price">₹{p.price}</div>
                                                                        <div className="product-card-unit">per {p.unit}</div>
                                                                    </div>
                                                                    <button
                                                                        disabled={p.stock === 0}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            if (!user) { toast('Please login to add to cart', 'error'); return; }
                                                                            addToCart({ productId: p._id, name: p.name, price: p.price, quantity: 1, image: p.image, shopId: p.shopId?._id, shopName: p.shopId?.name });
                                                                        }}
                                                                        className="btn btn-primary btn-sm"
                                                                    >
                                                                        {p.stock === 0 ? 'N/A' : '+ Add'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            );
                        })()
                    )}
                </div>
            </main>
        </>
    );
}
