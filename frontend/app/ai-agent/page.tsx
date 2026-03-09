'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import { useApp } from '@/lib/context';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import { fadeUp, staggerContainer, scaleIn } from '@/lib/animations';
import NeuralCanvas from '@/components/NeuralCanvas';

interface CartSuggestion {
    ingredient: { item: string; packsToBuy: number; amountText: string; searchQuery: string };
    bestMatch: any;
    alternatives: any[];
    addToCart: boolean;
}

export default function AIAgentPage() {
    const { api, addMultipleToCart, user, toast } = useApp();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ cartItems: CartSuggestion[]; notFound: any[]; ingredients: any[]; fallback?: boolean; modelUsed?: string | null } | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [nearbyOnly, setNearbyOnly] = useState(true);
    const [availableShops, setAvailableShops] = useState<any[]>([]);
    const [selectedShops, setSelectedShops] = useState<string[]>([]);

    const examples = ['Make pizza for 4 people', 'Biryani for 6 people', 'Healthy breakfast for the week', 'I have a cold, suggest remedies', 'Movie night snacks'];

    // Fetch shops for the filter once
    useEffect(() => {
        api.get('/shops/all').then((r) => setAvailableShops(r.data.shops || [])).catch(() => { });
    }, [api]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setLoading(true); setResults(null);
        try {
            const lat = user?.location?.coordinates?.[1];
            const lng = user?.location?.coordinates?.[0];
            const shopParam = selectedShops.join(',');
            const effectiveNearby = selectedShops.length > 0 ? false : nearbyOnly;

            const payload = {
                prompt,
                lat,
                lng,
                nearbyOnly: effectiveNearby,
                shopId: shopParam || undefined
            };

            const { data } = await api.post('/ai/recipe-agent', payload);
            setResults(data);
            const allIndices = new Set<number>(data.cartItems.map((_: any, i: number) => i));
            setSelected(allIndices);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'AI agent failed. Try again.', 'error');
        } finally { setLoading(false); }
    };

    const addSelectedToCart = () => {
        if (!user) { toast('Please login first', 'error'); return; }
        const itemsToAdd: any[] = [];
        results?.cartItems.forEach((item, index) => {
            if (selected.has(index)) {
                itemsToAdd.push({
                    productId: item.bestMatch._id,
                    name: item.bestMatch.name,
                    price: item.bestMatch.price,
                    quantity: item.ingredient.packsToBuy,
                    image: item.bestMatch.image,
                    shopId: item.bestMatch.shopId?._id,
                    shopName: item.bestMatch.shopId?.name
                });
            }
        });
        if (itemsToAdd.length > 0) {
            addMultipleToCart(itemsToAdd);
        }
    };

    const toggleItem = (index: number) => setSelected(s => { const n = new Set(s); if (n.has(index)) n.delete(index); else n.add(index); return n; });

    return (
        <>
            <Navbar />
            <CartSidebar />
            <main style={{ paddingTop: '64px', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
                {/* Neural network canvas background */}
                <NeuralCanvas opacity={0.28} count={60} connectionDistance={130} zIndex={0} />
                {/* Ambient blobs behind canvas */}
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                    <div className="blob blob-green" style={{ width: 500, height: 500, top: '-10%', right: '-5%', opacity: 0.15 }} />
                    <div className="blob blob-blue" style={{ width: 400, height: 400, bottom: '10%', left: '-5%', opacity: 0.10 }} />
                    <div className="mesh-hero" />
                </div>
                <div className="container" style={{ padding: '40px 24px', maxWidth: '820px', position: 'relative', zIndex: 1 }}>
                    {/* Header */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div className="ai-glow-ring" style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent), var(--info))', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, boxShadow: '0 0 32px rgba(0,210,106,0.35)' }}>🧠</div>
                            <div>
                                <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>AI Recipe Agent</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div className="ai-badge" style={{ display: 'inline-block' }}>Powered by Gemini</div>
                                    <div className="ai-status-bar"><span className="ai-status-dot" />Model online</div>
                                </div>
                            </div>
                        </div>
                        <p className="text-muted">Tell me what you want to cook or need — I&apos;ll find the ingredients from nearby shops and fill your cart automatically.</p>
                    </motion.div>

                    {/* Input */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}
                        className="glass-panel" style={{ marginBottom: '28px', padding: '24px' }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>What do you want to make?</label>
                                <textarea
                                    className="form-input glass-input"
                                    rows={3}
                                    placeholder='e.g. "Make pizza margherita for 4 people" or "Healthy breakfast meal prep for the week"'
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            {/* Filters */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, marginRight: '8px' }}>Filters:</span>

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

                                {selectedShops.length > 0 && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedShops([])}>Clear</button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                    <button type="submit" className="btn btn-primary btn-glow" disabled={loading || !prompt.trim()}>
                                        {loading ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span className="ai-thinking-dot" style={{ background: '#fff' }} />
                                                <span className="ai-thinking-dot" style={{ background: '#fff', animationDelay: '0.2s' }} />
                                                <span className="ai-thinking-dot" style={{ background: '#fff', animationDelay: '0.4s' }} />
                                                Thinking...
                                            </span>
                                        ) : '🧠 Find Ingredients'}
                                    </button>
                                </motion.div>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPrompt(''); setResults(null); }}>Clear</button>
                            </div>
                        </form>

                        {/* Example Prompts */}
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ marginTop: '16px' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>💡 Try these:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {examples.map((ex, i) => (
                                    <motion.button key={ex}
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.3 + i * 0.06 }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => setPrompt(ex)} className="btn btn-ghost btn-sm"
                                        style={{ fontSize: '0.75rem', padding: '4px 12px', border: '1px solid var(--border)' }}>
                                        {ex}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Loading */}
                    <AnimatePresence>
                        {loading && (
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                                style={{ textAlign: 'center', padding: '64px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className="ai-thinking-dot" style={{ width: 16, height: 16, animationDelay: `${i * 0.18}s` }} />
                                    ))}
                                </div>
                                <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>🧠 Gemini is analyzing your request...</p>
                                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>Identifying ingredients · Matching nearby shops · Optimising cart</p>
                                <div style={{ maxWidth: 320, margin: '0 auto', overflow: 'hidden', background: 'var(--bg-elevated)', borderRadius: 999, height: 3 }}>
                                    <div className="inference-progress" style={{ height: '100%', borderRadius: 999 }} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Results */}
                    <AnimatePresence>
                        {results && !loading && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                {results.fallback && (
                                    <div style={{ background: 'rgba(255, 170, 0, 0.08)', border: '1px solid rgba(255, 170, 0, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#ffaa00', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        ⚡ AI is currently busy — showing keyword-based matches instead. Results may be broader.
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>
                                            Found {results.cartItems.length} ingredient{results.cartItems.length !== 1 ? 's' : ''}
                                            {results.notFound.length > 0 && <span className="badge badge-red" style={{ marginLeft: 10, fontSize: '0.75rem' }}>{results.notFound.length} not found</span>}
                                        </h2>
                                        {results.modelUsed && (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.65, marginTop: '2px' }}>
                                                Generated using {results.modelUsed}
                                            </div>
                                        )}
                                    </div>
                                    {results.cartItems.length > 0 && (
                                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                            <button className="btn btn-primary" onClick={addSelectedToCart}>
                                                🛒 Add {selected.size} to Cart
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Cart Items */}
                                <motion.div variants={staggerContainer} initial="hidden" animate="visible"
                                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                    {results.cartItems.map((item, index) => (
                                        <motion.div key={index} variants={scaleIn}
                                            whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                                            className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', cursor: 'pointer', borderColor: selected.has(index) ? 'var(--accent)' : 'var(--border)', background: selected.has(index) ? 'var(--accent-subtle)' : 'var(--bg-card)' }} onClick={() => toggleItem(index)}>
                                            <input type="checkbox" readOnly checked={selected.has(index)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                                            <div style={{ fontSize: '2rem', width: 50, height: 50, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {item.bestMatch.image ? <img src={item.bestMatch.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700 }}>{item.bestMatch.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    For: {item.ingredient.item} · {item.ingredient.amountText} ·
                                                    🏪 {item.bestMatch.shopId?.name || 'Local Shop'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1.1rem' }}>₹{(item.bestMatch.price * item.ingredient.packsToBuy).toFixed(2)}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{item.bestMatch.price}/{item.bestMatch.unit}</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>

                                {/* Not Found */}
                                {results.notFound.length > 0 && (
                                    <div className="card" style={{ background: 'rgba(255,82,82,0.05)', borderColor: 'rgba(255,82,82,0.2)' }}>
                                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--danger)' }}>⚠️ Items not found in nearby shops</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {results.notFound.map((item: any) => (
                                                <span key={item.item} className="badge badge-red">{item.item} ({item.amountText})</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </>
    );
}
