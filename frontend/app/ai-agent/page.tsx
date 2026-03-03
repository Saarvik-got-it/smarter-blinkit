'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import { useApp } from '@/lib/context';

interface CartSuggestion {
    ingredient: { item: string; quantity: number; unit: string; searchQuery: string };
    bestMatch: any;
    alternatives: any[];
    addToCart: boolean;
}

export default function AIAgentPage() {
    const { api, addToCart, user, toast } = useApp();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ cartItems: CartSuggestion[]; notFound: any[]; ingredients: any[]; fallback?: boolean } | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const examples = ['Make pizza for 4 people', 'Biryani for 6 people', 'Healthy breakfast for the week', 'I have a cold, suggest remedies', 'Movie night snacks'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setLoading(true); setResults(null);
        try {
            const { data } = await api.post('/ai/recipe-agent', { prompt });
            setResults(data);
            const allIds = new Set<string>(data.cartItems.map((c: CartSuggestion) => c.bestMatch?._id));
            setSelected(allIds);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'AI agent failed. Try again.', 'error');
        } finally { setLoading(false); }
    };

    const addSelectedToCart = () => {
        if (!user) { toast('Please login first', 'error'); return; }
        let count = 0;
        results?.cartItems.forEach(item => {
            if (selected.has(item.bestMatch?._id)) {
                addToCart({ productId: item.bestMatch._id, name: item.bestMatch.name, price: item.bestMatch.price, quantity: item.ingredient.quantity, image: item.bestMatch.image, shopId: item.bestMatch.shopId?._id, shopName: item.bestMatch.shopId?.name });
                count++;
            }
        });
        toast(`${count} items added to cart! 🎉`, 'success');
    };

    const toggleItem = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    return (
        <>
            <Navbar />
            <CartSidebar />
            <main style={{ paddingTop: '64px', minHeight: '100vh' }}>
                <div className="container" style={{ padding: '40px 24px', maxWidth: '820px' }}>
                    {/* Header */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, var(--accent), var(--info))', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>🧠</div>
                            <div>
                                <h1 style={{ fontSize: '1.75rem', marginBottom: '2px' }}>AI Recipe Agent</h1>
                                <div className="ai-badge" style={{ display: 'inline-block' }}>Powered by Gemini</div>
                            </div>
                        </div>
                        <p className="text-muted">Tell me what you want to cook or need — I'll find the ingredients from nearby shops and fill your cart automatically.</p>
                    </div>

                    {/* Input */}
                    <div className="ai-widget" style={{ marginBottom: '28px' }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>What do you want to make?</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder='e.g. "Make pizza margherita for 4 people" or "Healthy breakfast meal prep for the week"'
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button type="submit" className="btn btn-primary" disabled={loading || !prompt.trim()}>
                                    {loading ? '⏳ Thinking...' : '🧠 Find Ingredients'}
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPrompt(''); setResults(null); }}>Clear</button>
                            </div>
                        </form>

                        {/* Example Prompts */}
                        <div style={{ marginTop: '16px' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>💡 Try these:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {examples.map(ex => (
                                    <button key={ex} onClick={() => setPrompt(ex)} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '4px 12px', border: '1px solid var(--border)' }}>{ex}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '48px' }}>
                            <div className="spinner" style={{ margin: '0 auto 12px' }} />
                            <p className="text-muted">🧠 Gemini is analyzing your request and finding ingredients...</p>
                        </div>
                    )}

                    {/* Results */}
                    {results && !loading && (
                        <div>
                            {results.fallback && (
                                <div style={{ background: 'rgba(255, 170, 0, 0.08)', border: '1px solid rgba(255, 170, 0, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#ffaa00', display: 'flex', gap: 8, alignItems: 'center' }}>
                                    ⚡ AI is currently busy — showing keyword-based matches instead. Results may be broader.
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '1.2rem' }}>
                                    Found {results.cartItems.length} ingredient{results.cartItems.length !== 1 ? 's' : ''}
                                    {results.notFound.length > 0 && <span className="badge badge-red" style={{ marginLeft: 10, fontSize: '0.75rem' }}>{results.notFound.length} not found</span>}
                                </h2>
                                {results.cartItems.length > 0 && (
                                    <button className="btn btn-primary" onClick={addSelectedToCart}>
                                        🛒 Add {selected.size} to Cart
                                    </button>
                                )}
                            </div>

                            {/* Cart Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                {results.cartItems.map(item => (
                                    <div key={item.bestMatch._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', cursor: 'pointer', borderColor: selected.has(item.bestMatch._id) ? 'var(--accent)' : 'var(--border)', background: selected.has(item.bestMatch._id) ? 'var(--accent-subtle)' : 'var(--bg-card)' }} onClick={() => toggleItem(item.bestMatch._id)}>
                                        <input type="checkbox" readOnly checked={selected.has(item.bestMatch._id)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                                        <div style={{ fontSize: '2rem', width: 50, height: 50, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {item.bestMatch.image ? <img src={item.bestMatch.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '📦'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700 }}>{item.bestMatch.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                For: {item.ingredient.item} · {item.ingredient.quantity} {item.ingredient.unit} ·
                                                🏪 {item.bestMatch.shopId?.name || 'Local Shop'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1.1rem' }}>₹{(item.bestMatch.price * item.ingredient.quantity).toFixed(2)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{item.bestMatch.price}/{item.bestMatch.unit}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Not Found */}
                            {results.notFound.length > 0 && (
                                <div className="card" style={{ background: 'rgba(255,82,82,0.05)', borderColor: 'rgba(255,82,82,0.2)' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--danger)' }}>⚠️ Items not found in nearby shops</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {results.notFound.map((item: any) => (
                                            <span key={item.item} className="badge badge-red">{item.item} ({item.quantity} {item.unit})</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
