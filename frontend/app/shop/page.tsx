'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import ProductCarousel from '@/components/ProductCarousel';
import { useApp } from '@/lib/context';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import { fadeUp, staggerContainer } from '@/lib/animations';

export default function ShopPage() {
    const { api, addToCart, user, toast } = useApp();
    const [products, setProducts] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchMode, setSearchMode] = useState<'text' | 'intent'>('text');
    const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
    const [availableShops, setAvailableShops] = useState<any[]>([]);
    const [selectedShops, setSelectedShops] = useState<string[]>([]);
    const [categoriesList, setCategoriesList] = useState<string[]>([]);
    const [nearbyOnly, setNearbyOnly] = useState(true);

    const emoji: Record<string, string> = { Groceries: '🌾', Dairy: '🥛', Fresh: '🥬', Pharmacy: '💊', Beverages: '🥤', Snacks: '🍿', Electronics: '📱', Staples: '🍚', Stationery: '✏️', Meat: '🥩', Bakery: '🍞' };
    const getCategoryEmoji = (cat: string) => emoji[cat] || '📦';

    /** Fires a cart-fly particle from the clicked button toward the navbar cart icon. */
    const triggerCartFly = useCallback((_productImage: string | undefined, e: React.MouseEvent) => {
        const btn = e.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        const el = document.createElement('div');
        el.textContent = '🛒';
        const startX = rect.left + rect.width / 2 - 22;
        const startY = rect.top + rect.height / 2 - 22;
        el.style.cssText = `position:fixed;left:${startX}px;top:${startY}px;width:44px;height:44px;border-radius:50%;pointer-events:none;z-index:9999;animation:cart-fly 0.65s cubic-bezier(0.45,0,0.55,1) forwards;font-size:1.4rem;display:flex;align-items:center;justify-content:center;background:rgba(0,210,106,0.12);border:1px solid rgba(0,210,106,0.35);backdrop-filter:blur(8px);`;
        const targetX = window.innerWidth - startX - 50;
        const targetY = 32 - startY;
        el.style.setProperty('--fly-x', `${targetX * 0.5}px`);
        el.style.setProperty('--fly-y', `${targetY * 0.5}px`);
        el.style.setProperty('--fly-x2', `${targetX}px`);
        el.style.setProperty('--fly-y2', `${targetY}px`);
        document.body.appendChild(el);
        el.addEventListener('animationend', () => { if (el.parentNode) el.parentNode.removeChild(el); });
    }, []);

    /** Briefly play the add-to-cart pulse on the clicked button */
    const triggerAddPulse = useCallback((e: React.MouseEvent) => {
        const btn = e.currentTarget as HTMLElement;
        btn.classList.remove('btn-cart-pulse');
        void btn.offsetWidth; // reflow to restart animation
        btn.classList.add('btn-cart-pulse');
        btn.addEventListener('animationend', () => btn.classList.remove('btn-cart-pulse'), { once: true });
    }, []);

    /** Render a stock chip based on remaining stock count */
    const stockChip = (stock: number) => {
        if (stock === 0) return <span className="stock-chip">Out of stock</span>;
        if (stock <= 5) return <span className="stock-chip">{stock} left</span>;
        if (stock <= 15) return <span className="stock-chip medium">{stock} left</span>;
        return null;
    };

    useEffect(() => {
        // Fetch all shops for the filter dropdown
        api.get('/shops/all').then((r) => setAvailableShops(r.data.shops || [])).catch(() => { });
        // Fetch dynamic categories
        api.get('/products/categories').then((r) => setCategoriesList(r.data.categories || [])).catch(() => { });
    }, [api]);

    const doSearch = async (q: string, cats: string[], shops: string[], nearby: boolean) => {
        setLoading(true); setExpandedKeywords([]);
        try {
            const lat = user?.location?.coordinates?.[1];
            const lng = user?.location?.coordinates?.[0];
            const catParam = cats.join(',');
            const shopParam = shops.join(',');
            // When specific shops are selected, bypass the nearby filter
            const effectiveNearby = shops.length > 0 ? false : nearby;

            if (searchMode === 'intent' && q) {
                const { data } = await api.post('/ai/intent-search', { query: q, lat, lng, nearbyOnly: effectiveNearby, shopId: shopParam || undefined });
                let intentResults = data.results || [];
                // Frontend-side category filtering for AI results
                if (catParam) intentResults = intentResults.filter((r: any) => cats.some(c => r.product?.category?.toLowerCase() === c.toLowerCase()));
                setProducts(intentResults.map((r: any) => ({ ...r.product, distance: r.product.distance })));
                setExpandedKeywords(data.expandedKeywords || []);
            } else {
                const { data } = await api.get('/products/search', { params: { q, category: catParam, shopId: shopParam, limit: 500, lat, lng, nearbyOnly: effectiveNearby } });
                setProducts(data.products || []);
            }
        } catch { } finally { setLoading(false); }
    };

    // Live sync search: Trigger doSearch whenever dependencies change, with a 300ms debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            doSearch(query, categories, selectedShops, nearbyOnly);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, categories, selectedShops, searchMode, nearbyOnly, user]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(query, categories, selectedShops, nearbyOnly); };

    return (
        <>
            <Navbar />
            <CartSidebar />
            <main style={{ paddingTop: '64px', minHeight: '100vh' }}>
                {/* Search Hero */}
                <motion.div variants={fadeUp} initial="hidden" animate="visible"
                    style={{ background: 'linear-gradient(135deg, rgba(0,210,106,0.06) 0%, transparent 60%)', padding: '40px 24px', borderBottom: '1px solid var(--border)' }}>
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

                            {/* Filter Row */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, marginRight: '4px' }}>Filters:</span>

                                <MultiSelectDropdown
                                    options={categoriesList.map(cat => ({ value: cat, label: cat, emoji: getCategoryEmoji(cat) }))}
                                    selected={categories}
                                    onChange={setCategories}
                                    placeholder="All Categories"
                                    allLabel="All Categories"
                                />

                                <MultiSelectDropdown
                                    options={availableShops.map(shop => ({ value: shop._id, label: shop.name, emoji: '🏪' }))}
                                    selected={selectedShops}
                                    onChange={setSelectedShops}
                                    placeholder="All Shops"
                                    allLabel="All Shops"
                                />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                    <input type="checkbox" id="nearbyOnly" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="nearbyOnly" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Nearby Only (50km)</label>
                                </div>

                                {(categories.length > 0 || selectedShops.length > 0) && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCategories([]); setSelectedShops([]); }}>Clear all</button>
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
                        {/* Live result count signal */}
                        {products.length > 0 && !loading && (
                            <div style={{ marginTop: '12px' }}>
                                <span className="activity-signal">
                                    <span className="signal-dot" />{products.length} products matched
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>
                <div className="container" style={{ padding: '28px 24px' }}>
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ textAlign: 'center', padding: '80px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                                    {[0, 1, 2].map(i => <div key={i} className="ai-thinking-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
                                </div>
                                <p className="text-muted">Finding products...</p>
                            </motion.div>
                        ) : products.length === 0 ? (
                            <motion.div key="empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔍</div>
                                    <div className="empty-state-title">No products found</div>
                                    <div className="empty-state-hint">Try a different search term, adjust your filters, or disable &quot;Nearby Only&quot; to see more results.</div>
                                </div>
                            </motion.div>
                        ) : selectedShops.length === 1 ? (
                            /* Single Shop View - Professional Grid */
                            <motion.div key="single" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
                                    <button onClick={() => setSelectedShops([])} className="btn btn-secondary btn-sm">← Back to all shops</button>
                                </div>
                                    <div className="product-grid">
                                    {products.map(p => (
                                        <div key={p._id} className={`product-card${p.stock === 0 ? ' out-of-stock' : ''}`}>
                                            <Link href={`/shop/${p._id}`}>
                                                <div className="product-card-image">
                                                    {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getCategoryEmoji(p.category)}
                                                </div>
                                                <div className="product-card-body">
                                                    <div className="product-card-name" style={{ height: '3rem', overflow: 'hidden' }}>{p.name}</div>
                                                    {stockChip(p.stock) && <div style={{ marginBottom: '4px' }}>{stockChip(p.stock)}</div>}
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
                                                                triggerCartFly(p.image, e);
                                                                triggerAddPulse(e);
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
                            </motion.div>
                        ) : (
                            /* Multi-Shop Bucketed View — with discovery rows and improved headers */
                            (() => {
                                const shopsMap: Record<string, { shop: any, products: any[] }> = {};
                                products.forEach(p => {
                                    const sid = p.shopId?._id || 'local';
                                    if (!shopsMap[sid]) {
                                        shopsMap[sid] = {
                                            shop: p.shopId ? { ...p.shopId, distance: p.distance } : { name: 'Local Shop', distance: 0 },
                                            products: []
                                        };
                                    }
                                    shopsMap[sid].products.push(p);
                                });
                                const sortedShops = Object.values(shopsMap).sort((a, b) => (a.shop.distance || 0) - (b.shop.distance || 0));

                                // Derive discovery rows from products already loaded
                                const trendingProducts = [...products]
                                    .filter(p => p.stock > 0)
                                    .slice(0, 12);
                                const essentials = [...products]
                                    .filter(p => p.stock > 5 && (p.distance === undefined || p.distance < 5))
                                    .slice(0, 10);

                                const renderProductCard = (p: any, compact = false) => (
                                    <div key={p._id} className={`product-card${p.stock === 0 ? ' out-of-stock' : ''}`} style={{ width: compact ? '190px' : '230px' }}>
                                        <Link href={`/shop/${p._id}`}>
                                            <div className="product-card-image">
                                                {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getCategoryEmoji(p.category)}
                                            </div>
                                            <div className="product-card-body" style={{ padding: '12px 14px' }}>
                                                <div className="product-card-name" style={{ fontSize: '0.88rem', height: '2.4rem', overflow: 'hidden' }}>{p.name}</div>
                                                {stockChip(p.stock) && <div style={{ marginBottom: '4px' }}>{stockChip(p.stock)}</div>}
                                                <div className="product-card-footer" style={{ marginTop: '8px' }}>
                                                    <div>
                                                        <div className="product-card-price">₹{p.price}</div>
                                                        <div className="product-card-unit">per {p.unit}</div>
                                                    </div>
                                                    <button
                                                        disabled={p.stock === 0}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (!user) { toast('Please login to add to cart', 'error'); return; }
                                                            triggerCartFly(p.image, e);
                                                            triggerAddPulse(e);
                                                            addToCart({ productId: p._id, name: p.name, price: p.price, quantity: 1, image: p.image, shopId: p.shopId?._id, shopName: p.shopId?.name });
                                                        }}
                                                        className="btn btn-primary btn-sm"
                                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        {p.stock === 0 ? 'N/A' : '+ Add'}
                                                    </button>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                );

                                return (
                                    <>
                                        <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.875rem' }}>
                                            Found results from {sortedShops.length} shop{sortedShops.length !== 1 ? 's' : ''}
                                        </p>

                                        {/* ── Discovery sections: only shown on landing (no active search) ── */}
                                        {!query.trim() && trendingProducts.length > 0 && (
                                            <div className="discovery-section shop-section-ambient">
                                                <div className="discovery-header">
                                                    <div className="discovery-title">
                                                        🔥 Trending Near You
                                                        <span className="discovery-label">Hot right now</span>
                                                    </div>
                                                </div>
                                                <ProductCarousel>
                                                    {trendingProducts.map(p => renderProductCard(p, true))}
                                                </ProductCarousel>
                                            </div>
                                        )}

                                        {!query.trim() && essentials.length >= 3 && (
                                            <div className="discovery-section">
                                                <div className="discovery-header">
                                                    <div className="discovery-title">
                                                        ⚡ 10-Minute Essentials
                                                        <span className="discovery-label blue">Nearby stock</span>
                                                    </div>
                                                </div>
                                                <ProductCarousel>
                                                    {essentials.map(p => renderProductCard(p, true))}
                                                </ProductCarousel>
                                            </div>
                                        )}

                                        {/* ── Per-shop rows with rich headers ── */}
                                        {sortedShops.map(({ shop, products: shopProducts }) => {
                                            const dist = shop.distance;
                                            const distFar = dist !== undefined && dist > 20;
                                            const deliveryMins = dist !== undefined ? Math.round(10 + dist * 3) : 15;
                                            const isVerified = (shop.rating ?? 0) >= 4.5 || shopProducts.length > 10;
                                            const isFast = deliveryMins <= 20;

                                            return (
                                                <div key={shop._id || 'local'} style={{ marginBottom: '48px' }}>
                                                    {/* Improved shop header */}
                                                    <div className="shop-header-card">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div className="shop-header-title">
                                                                    🏪 {shop.name}
                                                                    <span className="shop-chip open">🟢 Open</span>
                                                                </div>
                                                                <div className="shop-header-meta">
                                                                    {shop.rating && (
                                                                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>⭐ {shop.rating}</span>
                                                                    )}
                                                                    {dist !== undefined && (
                                                                        <>
                                                                            {shop.rating && <span className="shop-meta-dot">•</span>}
                                                                            <span style={{ color: distFar ? 'var(--danger)' : 'var(--accent)', fontWeight: 600 }}>
                                                                                {dist < 1 ? '&lt; 1 km' : `${Math.round(dist)} km`} away
                                                                            </span>
                                                                            <span className="shop-meta-dot">•</span>
                                                                            <span>~{deliveryMins} min delivery</span>
                                                                        </>
                                                                    )}
                                                                    <span className="shop-meta-dot">•</span>
                                                                    <span>{shopProducts.length} products</span>
                                                                </div>
                                                                <div className="shop-chips">
                                                                    {isVerified && <span className="shop-chip verified">✅ Verified Store</span>}
                                                                    {isFast && <span className="shop-chip fast">⚡ Fast Delivery</span>}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => setSelectedShops([shop._id])}
                                                                className="btn btn-ghost btn-sm"
                                                                style={{ fontWeight: 600, flexShrink: 0 }}
                                                            >
                                                                View all →
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Product carousel */}
                                                    <ProductCarousel>
                                                        {shopProducts.map(p => renderProductCard(p))}
                                                    </ProductCarousel>
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </>
    );
}
