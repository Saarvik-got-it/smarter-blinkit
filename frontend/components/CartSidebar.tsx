'use client';
import { useApp } from '@/lib/context';
import { useState, useEffect, useRef } from 'react';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

export default function CartSidebar() {
    const { cart, cartOpen, setCartOpen, removeFromCart, updateQty, cartTotal, user, api, toast, clearCart } = useApp();
    const [step, setStep] = useState<'cart' | 'location' | 'payment' | 'processing' | 'success'>('cart');
    const [address, setAddress] = useState('');
    const [coords, setCoords] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
    const cardMountRef = useRef<HTMLDivElement>(null);
    const [cardReady, setCardReady] = useState(false);
    const [cardError, setCardError] = useState('');

    // Initialize Stripe once (only when entering payment step)
    useEffect(() => {
        if (step === 'payment' && paymentMethod === 'card' && !stripe) {
            (async () => {
                const s = await stripePromise;
                if (s) setStripe(s);
            })();
        }
    }, [step, paymentMethod, stripe]);

    // Mount/unmount Stripe card element using a ref to track lifecycle
    const cardMountedRef = useRef(false);

    useEffect(() => {
        if (stripe && step === 'payment' && paymentMethod === 'card' && cardMountRef.current && !cardMountedRef.current) {
            const elements = stripe.elements({
                fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' }],
            });
            const card = elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        color: '#1a1a2e',
                        '::placeholder': { color: '#9ca3af' },
                        iconColor: '#00d26a',
                    },
                    invalid: { color: '#ff3b30', iconColor: '#ff3b30' },
                },
                hidePostalCode: true,
            });
            card.mount(cardMountRef.current);
            card.on('ready', () => setCardReady(true));
            card.on('change', (e) => setCardError(e.error?.message || ''));
            setCardElement(card);
            cardMountedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stripe, step, paymentMethod]);

    // Cleanup: destroy card element when step leaves 'payment' or on unmount
    useEffect(() => {
        if (step !== 'payment' && cardMountedRef.current && cardElement) {
            try { cardElement.destroy(); } catch { /* already destroyed */ }
            setCardElement(null);
            setCardReady(false);
            cardMountedRef.current = false;
        }
    }, [step, cardElement]);

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast('Geolocation is not supported by your browser', 'error');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            setCoords([pos.coords.longitude, pos.coords.latitude]);
            try {
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
            if (paymentMethod === 'cod') {
                // ── Cash on Delivery — No Stripe needed ──
                const codPaymentId = `cod_${Date.now()}`;
                await api.post('/orders', {
                    items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    deliveryAddress: address,
                    deliveryLocation: coords ? { type: 'Point', coordinates: coords } : undefined,
                    paymentId: codPaymentId,
                    paymentMode: 'cod',
                });
                clearCart();
                setStep('success');
                toast('Order placed successfully! 🎉 Pay on delivery.', 'success');
                return;
            }

            // ── Stripe Card Payment ──
            if (!stripe || !cardElement) {
                toast('Stripe is not ready. Please try again.', 'error');
                setStep('payment');
                return;
            }

            // 1. Create PaymentIntent on backend
            const { data: intentData } = await api.post('/payments/create-intent', { amount: grandTotal });

            if (intentData.mode === 'mock') {
                // Mock fallback if Stripe is not configured on backend
                await api.post('/orders', {
                    items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    deliveryAddress: address,
                    deliveryLocation: coords ? { type: 'Point', coordinates: coords } : undefined,
                    paymentId: intentData.paymentIntentId,
                    paymentMode: 'mock',
                });
                clearCart();
                setStep('success');
                toast('Order placed successfully! 🎉', 'success');
                return;
            }

            // 2. Confirm the card payment with Stripe.js
            const { error, paymentIntent } = await stripe.confirmCardPayment(intentData.clientSecret, {
                payment_method: { card: cardElement },
            });

            if (error) {
                toast(error.message || 'Payment failed', 'error');
                setStep('payment');
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                // 3. Verify on backend and create order
                await api.post('/payments/verify', { paymentIntentId: paymentIntent.id });
                await api.post('/orders', {
                    items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    deliveryAddress: address,
                    deliveryLocation: coords ? { type: 'Point', coordinates: coords } : undefined,
                    paymentId: paymentIntent.id,
                    paymentMode: 'stripe',
                });
                clearCart();
                setStep('success');
                toast('Payment successful! Order placed! 🎉💳', 'success');
            } else {
                toast('Payment processing not completed. Please try again.', 'error');
                setStep('payment');
            }
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Checkout failed', 'error');
            setStep('payment');
        }
    };

    const resetAndClose = () => {
        setStep('cart');
        setCartOpen(false);
        setCardError('');
    };

    const deliveryFee = cartTotal > 500 ? 0 : 29;
    const grandTotal = cartTotal + deliveryFee;

    return (
        <>
            {cartOpen && <div onClick={resetAndClose} className="sidebar-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }} />}
            <aside className={`cart-sidebar ${cartOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h3>
                        {step === 'cart' ? '🛒 My Cart' : step === 'location' ? '📍 Delivery Details' : step === 'payment' ? '💳 Payment' : step === 'processing' ? '⏳ Processing' : '✅ Order Placed'}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Subtotal</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>₹{cartTotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Delivery</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: deliveryFee === 0 ? 'var(--accent)' : 'inherit' }}>
                                        {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                    <span style={{ fontWeight: 700 }}>Total</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{grandTotal.toFixed(2)}</span>
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
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Select Payment Method:</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { id: 'card' as const, name: 'Credit / Debit Card', icon: '💳', badge: 'Powered by Stripe' },
                                { id: 'cod' as const, name: 'Cash on Delivery', icon: '💵', badge: null },
                            ].map(m => (
                                <button key={m.id} className={`card ${paymentMethod === m.id ? 'active' : ''}`}
                                    onClick={() => setPaymentMethod(m.id)}
                                    style={{
                                        padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
                                        borderColor: paymentMethod === m.id ? 'var(--accent)' : 'var(--border)',
                                        background: paymentMethod === m.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s ease'
                                    }}>
                                    <div style={{ fontSize: '1.5rem' }}>{m.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: paymentMethod === m.id ? 'var(--accent)' : 'var(--text-primary)' }}>{m.name}</div>
                                        {m.badge && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.badge}</div>}
                                    </div>
                                    {paymentMethod === m.id && <div style={{ color: 'var(--accent)' }}>✅</div>}
                                </button>
                            ))}
                        </div>

                        {/* Stripe Card Element */}
                        {paymentMethod === 'card' && (
                            <div style={{
                                padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)', transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Card Details</span>
                                    <span style={{
                                        fontSize: '0.65rem', background: '#635bff', color: '#fff',
                                        padding: '2px 8px', borderRadius: 999, fontWeight: 600, letterSpacing: '0.5px'
                                    }}>STRIPE</span>
                                </div>
                                <div
                                    ref={cardMountRef}
                                    style={{
                                        padding: '14px 12px', background: '#fff', borderRadius: '8px',
                                        border: cardError ? '2px solid var(--danger)' : '1px solid #e5e7eb',
                                        minHeight: '44px', transition: 'border-color 0.2s'
                                    }}
                                />
                                {cardError && (
                                    <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '8px', fontWeight: 500 }}>
                                        ⚠️ {cardError}
                                    </p>
                                )}
                                {!cardReady && stripe && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        <div className="spinner" style={{ width: 14, height: 14 }} />
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading secure card input...</span>
                                    </div>
                                )}
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                                    🔒 Test mode — use <strong>4242 4242 4242 4242</strong>, any future date, any CVC
                                </p>
                            </div>
                        )}

                        {/* Order Summary */}
                        <div style={{
                            padding: '16px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)',
                            display: 'flex', flexDirection: 'column', gap: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span className="text-muted">Subtotal ({cart.length} items)</span>
                                <span style={{ fontWeight: 600 }}>₹{cartTotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span className="text-muted">Delivery</span>
                                <span style={{ fontWeight: 600, color: deliveryFee === 0 ? 'var(--accent)' : 'inherit' }}>
                                    {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontWeight: 700 }}>Total</span>
                                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => { setStep('location'); }} style={{ flex: 1 }}>Back</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCheckout}
                                disabled={paymentMethod === 'card' && (!cardReady || !!cardError)}
                                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {paymentMethod === 'cod' ? '🛵 Place Order (COD)' : `💳 Pay ₹${grandTotal.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="cart-items" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
                        <div className="spinner" style={{ width: 48, height: 48, marginBottom: '24px', borderWidth: 4 }}></div>
                        <h3 style={{ marginBottom: '8px' }}>
                            {paymentMethod === 'cod' ? 'Confirming Order...' : 'Processing Payment...'}
                        </h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Please do not close this window.</p>
                        <div style={{
                            marginTop: '32px', padding: '12px 24px', background: 'var(--accent-subtle)',
                            borderRadius: 'var(--radius-full)', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600
                        }}>
                            {paymentMethod === 'cod' ? '📋 Verifying details...' : '🏦 Connecting to Stripe...'}
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="cart-items" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0', textAlign: 'center' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
                            marginBottom: '24px', animation: 'pulse 1.5s infinite'
                        }}>
                            ✅
                        </div>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.25rem' }}>Order Confirmed!</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem', maxWidth: '280px', lineHeight: 1.5 }}>
                            {paymentMethod === 'cod'
                                ? 'Your order has been placed. Pay the delivery partner when they arrive.'
                                : 'Payment successful! Your order is being prepared.'}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <div style={{
                                padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)', fontSize: '0.8rem'
                            }}>
                                {paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Paid via Stripe'}
                            </div>
                            <div style={{
                                padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)', fontSize: '0.8rem'
                            }}>
                                📍 {address.slice(0, 30)}{address.length > 30 ? '...' : ''}
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ marginTop: '32px' }} onClick={resetAndClose}>
                            Continue Shopping
                        </button>
                    </div>
                )}

            </aside>
        </>
    );
}
