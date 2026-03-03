'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import { useApp } from '@/lib/context';

export default function ProductDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { api, addToCart, user, toast } = useApp();
    const router = useRouter();
    const [product, setProduct] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [suggestProducts, setSuggestProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [qty, setQty] = useState(1);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            api.get(`/products/${id}`),
            api.get(`/products/${id}/suggestions`),
        ]).then(async ([pRes, sRes]) => {
            setProduct(pRes.data.product);
            const sug = sRes.data.suggestions || [];
            setSuggestions(sug);
            // Fetch actual product data for suggestion IDs
            if (sug.length > 0) {
                const ids = sug.slice(0, 4).map((s: any) => s.id);
                const sugProducts = await Promise.allSettled(ids.map((sid: string) => api.get(`/products/${sid}`)));
                setSuggestProducts(sugProducts.filter((r: any) => r.status === 'fulfilled').map((r: any) => r.value.data.product));
            }
        }).catch(() => { }).finally(() => setLoading(false));
    }, [id, api]);

    const handleAddToCart = () => {
        if (!product) return;
        if (!user) { toast('Please login to add to cart', 'error'); return; }
        addToCart({ productId: product._id, name: product.name, price: product.price, quantity: qty, image: product.image, shopId: product.shopId?._id, shopName: product.shopId?.name });
    };

    const emoji: Record<string, string> = { Groceries: '🌾', Dairy: '🥛', Fresh: '🥬', Pharmacy: '💊', Beverages: '🥤', Snacks: '🍿' };

    if (loading) return (
        <><Navbar /><div style={{ paddingTop: 120, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div></>
    );
    if (!product) return (
        <><Navbar /><div style={{ paddingTop: 120, textAlign: 'center' }}><h2>Product not found</h2><button className="btn btn-secondary" onClick={() => router.push('/shop')}>← Back to Shop</button></div></>
    );

    const boughtWith = suggestions.filter(s => s.relationship === 'BOUGHT_WITH');
    const similar = suggestions.filter(s => s.relationship === 'SIMILAR_TO');

    return (
        <>
            <Navbar />
            <CartSidebar />
            <main style={{ paddingTop: 64, minHeight: '100vh' }}>
                <div className="container" style={{ padding: '36px 24px' }}>
                    {/* Back */}
                    <button onClick={() => router.push('/shop')} className="btn btn-ghost btn-sm" style={{ marginBottom: 24 }}>← Back to Shop</button>

                    {/* Product Card */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 48, alignItems: 'start' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6rem', height: 320, overflow: 'hidden' }}>
                            {product.image
                                ? <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span>{emoji[product.category] || '📦'}</span>}
                        </div>

                        <div>
                            <span className="badge badge-blue" style={{ marginBottom: 10, display: 'inline-block' }}>{product.category}</span>
                            <h1 style={{ fontSize: '2rem', marginBottom: 10 }}>{product.name}</h1>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.95rem', lineHeight: 1.6 }}>{product.description}</p>

                            {/* Price */}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent)' }}>₹{product.price}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>per {product.unit}</span>
                            </div>

                            {/* Shop */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <span>🏪</span> <strong>{product.shopId?.name}</strong>
                                <span>·</span>
                                <span>⭐ {product.shopId?.rating || '4.5'}</span>
                                {product.stock < 10 && product.stock > 0 && <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>Only {product.stock} left!</span>}
                                {product.stock === 0 && <span className="badge badge-red">Out of Stock</span>}
                            </div>

                            {/* Tags */}
                            {product.tags?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                                    {product.tags.slice(0, 6).map((t: string) => (
                                        <span key={t} style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t}</span>
                                    ))}
                                </div>
                            )}

                            {/* Qty + Add to Cart */}
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div className="qty-control" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--bg-card)' }}>
                                    <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                                    <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{qty}</span>
                                    <button className="qty-btn" onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</button>
                                </div>
                                <button disabled={product.stock === 0} onClick={handleAddToCart} className="btn btn-primary btn-lg">
                                    {product.stock === 0 ? 'Out of Stock' : `🛒 Add ₹${(product.price * qty).toFixed(2)} to Cart`}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Neo4j Suggestions */}
                    {suggestProducts.length > 0 && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>
                                    🔗 Smart Suggestions
                                    <span className="badge badge-green" style={{ marginLeft: 10, fontSize: '0.7rem' }}>Powered by Neo4j</span>
                                </h2>
                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    {boughtWith.length > 0 && `🛒 ${boughtWith.length} frequently bought together`}
                                    {boughtWith.length > 0 && similar.length > 0 && ' · '}
                                    {similar.length > 0 && `🔍 ${similar.length} similar items`}
                                </p>
                            </div>
                            <div className="product-grid">
                                {suggestProducts.map(p => (
                                    <div key={p?._id} className="product-card" onClick={() => router.push(`/shop/${p?._id}`)}>
                                        <div className="product-card-image">{p?.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emoji[p?.category] || '📦'}</div>
                                        <div className="product-card-body">
                                            <div className="product-card-name">{p?.name}</div>
                                            <div className="product-card-shop">🏪 {p?.shopId?.name}</div>
                                            <div className="product-card-footer">
                                                <div>
                                                    <div className="product-card-price">₹{p?.price}</div>
                                                    <div className="product-card-unit">per {p?.unit}</div>
                                                </div>
                                                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); if (!user) { toast('Login first', 'error'); return; } addToCart({ productId: p._id, name: p.name, price: p.price, quantity: 1, image: p.image, shopId: p.shopId?._id }); }}>+ Add</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
