'use client';
import { useApp } from '@/lib/context';
import { useState, useEffect, useRef } from 'react';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

export default function CartSidebar() {
    const { cart, cartOpen, setCartOpen, removeFromCart, updateQty, addToCart, cartTotal, user, api, toast, clearCart } = useApp();
    const [step, setStep] = useState<'cart' | 'payment' | 'processing' | 'success'>('cart');
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');
    const [paying, setPaying] = useState(false);
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
    const cardMountRef = useRef<HTMLDivElement>(null);
    const [cardReady, setCardReady] = useState(false);
    const [cardError, setCardError] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);

    const [cartAnalysis, setCartAnalysis] = useState<any>(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Refs to hold the latest card element
    const cardElementRef = useRef<StripeCardElement | null>(null);
    const cardMountedRef = useRef(false);

    useEffect(() => {
        if (cartOpen && cart.length > 0) {
            setAnalyzing(true);
            api.post('/cart/analyze', { 
                items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })), 
                location: user?.location?.coordinates && user.location.coordinates[0] !== 0 ? { coordinates: user.location.coordinates } : undefined 
            })
            .then(res => {
                if (res.data.success) {
                    setCartAnalysis(res.data.cartData);
                }
            })
            .catch(err => {
                console.error('Failed to analyze cart', err);
            })
            .finally(() => setAnalyzing(false));
        } else if (cart.length === 0) {
            setCartAnalysis(null);
        }
    }, [cart, cartOpen, user?.location, api]);

    // Initialize Stripe once
    useEffect(() => {
        if (step === 'payment' && paymentMethod === 'card' && !stripe) {
            (async () => {
                const s = await stripePromise;
                if (s) setStripe(s);
            })();
        }
    }, [step, paymentMethod, stripe]);

    // Mount Stripe card element
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
            cardElementRef.current = card;       
            cardMountedRef.current = true;
        }
    }, [stripe, step, paymentMethod]);

    useEffect(() => {
        if (step === 'cart' && cardMountedRef.current && cardElementRef.current) {
            try { cardElementRef.current.destroy(); } catch { /* ignore */ }
            setCardElement(null);
            cardElementRef.current = null;
            setCardReady(false);
            cardMountedRef.current = false;
        }
    }, [step]);



    const handleCheckout = async () => {
        if (!user) return;
        setPaying(true);

        const activeSubtotal = cartAnalysis?.totals?.grandTotal || baseGrandTotal;

        // Create the enriched items list properly for backend standard path
        // The /orders POST expects original full cart format, but it does its own splitting inside.
        // Wait, the backend /orders ALREADY calls cartSplitter. Yes! So we just send normal items array.
        const orderItems = cart.map(i => ({ productId: i.productId, quantity: i.quantity }));

        try {
            if (paymentMethod === 'cod') {
                setStep('processing');
                const codPaymentId = `cod_${Date.now()}`;
                await api.post('/orders', {
                    items: orderItems,
                    deliveryAddress: user?.location?.address || 'Address not provided',
                    deliveryLocation: user?.location?.coordinates ? { type: 'Point', coordinates: user.location.coordinates } : undefined,
                    paymentId: codPaymentId,
                    paymentMode: 'cod',
                });
                clearCart();
                setPaying(false);
                setStep('success');
                toast('Order placed successfully! 🎉 Pay on delivery.', 'success');
                return;
            }

            const currentCard = cardElementRef.current;
            if (!stripe || !currentCard) {
                toast('Stripe is not ready. Please try again.', 'error');
                setPaying(false);
                return;
            }

            const { data: intentData } = await api.post('/payments/create-intent', { amount: activeSubtotal });
            
            if (intentData.mode === 'mock') {
                setStep('processing');
                await api.post('/orders', {
                    items: orderItems,
                    deliveryAddress: user?.location?.address || 'Address not provided',
                    deliveryLocation: user?.location?.coordinates ? { type: 'Point', coordinates: user.location.coordinates } : undefined,
                    paymentId: intentData.paymentIntentId,
                    paymentMode: 'mock',
                });
                clearCart();
                setPaying(false);
                setStep('success');
                toast('Order placed successfully! 🎉', 'success');
                return;
            }

            const { error, paymentIntent } = await stripe.confirmCardPayment(intentData.clientSecret, {
                payment_method: { card: currentCard },
            });

            if (error) {
                toast(error.message || 'Payment failed', 'error');
                setPaying(false);
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                setStep('processing');
                await api.post('/payments/verify', { paymentIntentId: paymentIntent.id });
                await api.post('/orders', {
                    items: orderItems,
                    deliveryAddress: user?.location?.address || 'Address not provided',
                    deliveryLocation: user?.location?.coordinates ? { type: 'Point', coordinates: user.location.coordinates } : undefined,
                    paymentId: paymentIntent.id,
                    paymentMode: 'stripe',
                });
                clearCart();
                setPaying(false);
                setStep('success');
                toast('Payment successful! Order placed! 🎉💳', 'success');
            } else {
                toast(`Payment status: ${paymentIntent?.status}. Please try again.`, 'error');
                setPaying(false);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Checkout failed';
            toast(msg, 'error');
            setPaying(false);
            setStep('payment');
        }
    };

    const resetAndClose = () => {
        setStep('cart');
        setCartOpen(false);
        setCardError('');
    };

    const deliveryFee = cartTotal > 500 ? 0 : 29;
    const baseGrandTotal = cartTotal + deliveryFee;

    const displaySubtotals = cartAnalysis?.totals || { subtotal: cartTotal, deliveryFee, platformFee: 5, grandTotal: baseGrandTotal + 5 };

    return (
        <>
            {cartOpen && <div onClick={resetAndClose} className="sidebar-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }} />}
            <aside className={`cart-sidebar ${cartOpen ? 'open' : ''} ${isMaximized ? 'maximized' : ''}`}>
                <div className="cart-sidebar-container">
                    <div className="cart-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>
                                {step === 'cart' ? '🛒 My Cart' : step === 'payment' ? '💳 Payment' : step === 'processing' ? '⏳ Processing' : '✅ Order Placed'}
                                {step === 'cart' && <span className="badge badge-green" style={{ fontSize: '0.75rem', marginLeft: 6 }}>{cart.length} items</span>}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? 'Restore Size' : 'Maximize Cart'}>
                                {isMaximized ? '🗗' : '🗖'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={resetAndClose} title="Close Cart">✕</button>
                        </div>
                    </div>

                {step === 'cart' && (
                    <>
                        <div
                            className="cart-items"
                            style={{ paddingBottom: '20px' }}
                            onWheel={(e) => { e.stopPropagation(); }}
                        >
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
                                    <p>Your cart is empty</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Start adding items from the shop!</p>
                                </div>
                            ) : analyzing && !cartAnalysis ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                                    <div className="spinner" style={{ width: 32, height: 32, marginBottom: '16px' }}></div>
                                    <p style={{ color: 'var(--text-muted)' }}>Analyzing cart for optimal delivery...</p>
                                </div>
                            ) : cartAnalysis && (
                                <>
                                    {/* Out of Stock / Unavailable Items */}
                                    {cartAnalysis.unavailableItems?.length > 0 && (
                                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                                            <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>⚠️</span> Some items are currently unavailable
                                            </div>
                                            {cartAnalysis.unavailableItems.map((ui: any) => (
                                                <div key={ui.productId} style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <img src={ui.image || '/placeholder.png'} alt={ui.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', opacity: 0.5 }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{ui.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{ui.reason}</div>
                                                        </div>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(ui.productId)} style={{ color: 'var(--text-primary)' }}>Remove</button>
                                                    </div>
                                                    
                                                    {/* Replacements Dropdown */}
                                                    {ui.replacements?.length > 0 && (
                                                        <div style={{ marginTop: '12px', background: 'var(--bg-elevated)', padding: '10px', borderRadius: '8px' }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>Suggested Replacements:</div>
                                                            {ui.replacements.map((rep: any) => (
                                                                <div key={rep._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <img src={rep.image || '/placeholder.png'} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                                                                        <span>{rep.name}</span>
                                                                    </div>
                                                                    <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem', minHeight: 'unset', height: '24px' }}
                                                                        onClick={() => {
                                                                            removeFromCart(ui.productId);
                                                                            addToCart({ productId: rep._id, name: rep.name, price: rep.price, quantity: ui.quantity, image: rep.image, shopId: '' });
                                                                        }}>
                                                                        Add
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Shop Groups */}
                                    {cartAnalysis.shopGroups?.map((group: any, idx: number) => (
                                        <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        🏪 {group.shopName || 'Local Shop'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        Delivery in ~{group.deliveryEstimateMins} mins
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {group.items.map((item: any) => (
                                                    <div key={item.productId} className="cart-item" style={{ border: 'none', padding: 0, margin: 0, background: 'transparent' }}>
                                                        <div className="cart-item-img" style={{ width: 56, height: 56 }}>
                                                            {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '📦'}
                                                        </div>
                                                        <div className="cart-item-info">
                                                            <div className="cart-item-name" style={{ fontSize: '0.9rem' }}>{item.name}</div>
                                                            <div className="cart-item-price" style={{ fontSize: '0.85rem' }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                                                            <div className="qty-control" style={{ marginTop: 8 }}>
                                                                <button className="qty-btn" onClick={() => updateQty(item.productId, -1)}>−</button>
                                                                <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                                                                <button className="qty-btn" onClick={() => updateQty(item.productId, 1)}>+</button>
                                                            </div>
                                                        </div>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(item.productId)} style={{ color: 'var(--text-muted)', alignSelf: 'flex-start' }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Cross Sell Intelligence */}
                                    {cartAnalysis.crossSells?.length > 0 && (
                                        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                                            <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-primary)' }}>People also bought</h4>
                                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                                                {cartAnalysis.crossSells.map((cs: any) => (
                                                    <div key={cs._id} style={{ minWidth: '120px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                                        <img src={cs.image || '/placeholder.png'} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, marginBottom: '8px' }} />
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.2, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cs.name}</div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '8px' }}>₹{cs.price}</div>
                                                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', fontSize: '0.75rem', padding: '4px' }}
                                                            onClick={() => addToCart({ productId: cs._id, name: cs.name, price: cs.price, quantity: 1, image: cs.image, shopId: '' })}>
                                                            + Add
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {cart.length > 0 && cartAnalysis && (
                            <div className="cart-footer" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Subtotal</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>₹{displaySubtotals.subtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Platform Fee</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>₹{displaySubtotals.platformFee.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Delivery</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: displaySubtotals.deliveryFee === 0 ? 'var(--accent)' : 'inherit' }}>
                                        {displaySubtotals.deliveryFee === 0 ? 'FREE' : `₹${displaySubtotals.deliveryFee.toFixed(2)}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                                    <span style={{ fontWeight: 700 }}>To Pay</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{displaySubtotals.grandTotal.toFixed(2)}</span>
                                </div>
                                <button className="btn btn-primary w-full btn-lg" onClick={() => {
                                    if (!user?.location?.address || (user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0)) {
                                        toast('Please select a delivery address in the top bar before checking out.', 'error');
                                        return;
                                    }
                                    setStep('payment');
                                }} style={{ boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)' }}>
                                    Proceed to Checkout →
                                </button>
                            </div>
                        )}
                    </>
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
                                <span style={{ fontWeight: 600 }}>₹{displaySubtotals.subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span className="text-muted">Delivery</span>
                                <span style={{ fontWeight: 600, color: displaySubtotals.deliveryFee === 0 ? 'var(--accent)' : 'inherit' }}>
                                    {displaySubtotals.deliveryFee === 0 ? 'FREE' : `₹${displaySubtotals.deliveryFee.toFixed(2)}`}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontWeight: 700 }}>Total To Pay</span>
                                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{displaySubtotals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => { setStep('cart'); }} style={{ flex: 1 }} disabled={paying}>Back</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCheckout}
                                disabled={paying || (paymentMethod === 'card' && (!cardReady || !!cardError))}
                                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {paying
                                    ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing...</>
                                    : paymentMethod === 'cod' ? '🛵 Place Order (COD)' : `💳 Pay ₹${displaySubtotals.grandTotal.toFixed(2)}`
                                }
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
                                📍 {user?.location?.address?.slice(0, 30)}{user?.location?.address && user.location.address.length > 30 ? '...' : ''}
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ marginTop: '32px' }} onClick={resetAndClose}>
                            Continue Shopping
                        </button>
                    </div>
                )}

                </div>
            </aside>
        </>
    );
}
