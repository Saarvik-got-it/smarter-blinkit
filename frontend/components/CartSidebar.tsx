'use client';
import { useApp } from '@/lib/context';
import { useState } from 'react';

export default function CartSidebar() {
    const { cart, cartOpen, setCartOpen, removeFromCart, updateQty, cartTotal, user, api, toast, clearCart } = useApp();
    const [step, setStep] = useState<'cart' | 'location' | 'payment' | 'processing'>('cart');
    const [address, setAddress] = useState('');
    const [coords, setCoords] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cod');

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast('Geolocation is not supported by your browser', 'error');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            setCoords([pos.coords.longitude, pos.coords.latitude]);
            try {
                // Free reverse geocoding via OpenStreetMap Nominatim
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                const data = await res.json();
                setAddress(data.display_name || 'Current Location detected');
                toast('Location detected!', 'success');
            } catch (err) {
                setAddress(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
                toast('Coordinates found, but address lookup failed.', 'info');
            } finally {
                setLocating(false);
            }
        }, () => {
            toast('Failed to get location. Please allow permissions.', 'error');
            setLocating(false);
        });
    };

    const handleCheckout = async () => {
        if (!user) return;
        setStep('processing');
        try {
            const { data: intent } = await api.post('/payments/mock-intent', { amount: cartTotal });
            await new Promise(r => setTimeout(r, 1500)); // Simulate UI processing
            await api.post('/payments/mock-verify', { paymentId: intent.paymentId });
            await api.post('/orders', {
                items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
                deliveryAddress: address,
                deliveryLocation: coords ? { type: 'Point', coordinates: coords } : undefined,
                paymentId: intent.paymentId,
            });
            clearCart();
            setStep('cart');
            setCartOpen(false);
            toast('Order placed successfully! 🎉', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Checkout failed', 'error');
            setStep('payment');
        }
    };

    const resetAndClose = () => {
        setStep('cart');
        setCartOpen(false);
    };

    return (
        <>
            {cartOpen && <div onClick={resetAndClose} className="sidebar-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }} />}
            <aside className={`cart-sidebar ${cartOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h3>
                        {step === 'cart' ? '🛒 My Cart' : step === 'location' ? '📍 Delivery Details' : step === 'payment' ? '💳 Payment' : '⏳ Processing'}
                        {step === 'cart' && <span className="badge badge-green" style={{ fontSize: '0.75rem', marginLeft: 6 }}>{cart.length} items</span>}
                    </h3>
                    <button className="btn btn-ghost btn-sm" onClick={resetAndClose}>✕</button>
                </div>

                {step === 'cart' && (
                    <>
                        <div className="cart-items">
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
                                    <p>Your cart is empty</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Start adding items from the shop!</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.productId} className="cart-item">
                                        <div className="cart-item-img">{item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '📦'}</div>
                                        <div className="cart-item-info">
                                            <div className="cart-item-name">{item.name}</div>
                                            <div className="cart-item-price">₹{(item.price * item.quantity).toFixed(2)}</div>
                                            <div className="qty-control" style={{ marginTop: 6 }}>
                                                <button className="qty-btn" onClick={() => updateQty(item.productId, -1)}>−</button>
                                                <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                                <button className="qty-btn" onClick={() => updateQty(item.productId, 1)}>+</button>
                                            </div>
                                        </div>
                                        <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(item.productId)} style={{ color: 'var(--danger)', fontSize: '0.9rem', padding: '6px' }}>🗑</button>
                                    </div>
                                ))
                            )}
                        </div>
                        {cart.length > 0 && (
                            <div className="cart-footer">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <span className="text-muted">Total</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{cartTotal.toFixed(2)}</span>
                                </div>
                                <button className="btn btn-primary w-full btn-lg" onClick={() => setStep('location')}>
                                    Checkout →
                                </button>
                            </div>
                        )}
                    </>
                )}

                {step === 'location' && (
                    <div className="cart-items" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Delivery Address</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Enter full address, floor, landmark etc."
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="divider" style={{ flex: 1, margin: 0 }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
                            <div className="divider" style={{ flex: 1, margin: 0 }} />
                        </div>
                        <button className="btn btn-secondary w-full" onClick={handleDetectLocation} disabled={locating}>
                            {locating ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📍'}
                            {locating ? ' Detecting...' : 'Auto-Detect Current Location'}
                        </button>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => setStep('cart')} style={{ flex: 1 }}>Back</button>
                            <button className="btn btn-primary" onClick={() => setStep('payment')} disabled={!address.trim()} style={{ flex: 2 }}>
                                Continue to Payment
                            </button>
                        </div>
                    </div>
                )}

                {step === 'payment' && (
                    <div className="cart-items" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Select Payment Method:</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { id: 'cod', name: 'Cash on Delivery', icon: '💵' },
                                { id: 'upi', name: 'UPI (Mock)', icon: '📱' },
                                { id: 'card', name: 'Credit/Debit Card (Mock)', icon: '💳' }
                            ].map(m => (
                                <button key={m.id} className={`card ${paymentMethod === m.id ? 'active' : ''}`}
                                    onClick={() => setPaymentMethod(m.id)}
                                    style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: paymentMethod === m.id ? 'var(--accent)' : 'var(--border)', background: paymentMethod === m.id ? 'var(--accent-subtle)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left' }}>
                                    <div style={{ fontSize: '1.5rem' }}>{m.icon}</div>
                                    <div style={{ fontWeight: 600, color: paymentMethod === m.id ? 'var(--accent)' : 'var(--text-primary)' }}>{m.name}</div>
                                    {paymentMethod === m.id && <div style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✅</div>}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0', padding: '16px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)' }}>
                            <span className="text-muted">Total</span>
                            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{cartTotal.toFixed(2)}</span>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => setStep('location')} style={{ flex: 1 }}>Back</button>
                            <button className="btn btn-primary" onClick={handleCheckout} style={{ flex: 2 }}>
                                Pay ₹{cartTotal.toFixed(2)}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="cart-items" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
                        <div className="spinner" style={{ width: 48, height: 48, marginBottom: '24px', borderWidth: 4 }}></div>
                        <h3 style={{ marginBottom: '8px' }}>Processing Payment...</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Please do not close this window.</p>
                        <div style={{ marginTop: '32px', padding: '12px 24px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-full)', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                            {paymentMethod === 'cod' ? 'Verifying Details...' : 'Connecting to Bank Gateway (Mock)...'}
                        </div>
                    </div>
                )}

            </aside>
        </>
    );
}
