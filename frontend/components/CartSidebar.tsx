'use client';
import { useApp } from '@/lib/context';

export default function CartSidebar() {
    const { cart, cartOpen, setCartOpen, removeFromCart, updateQty, cartTotal, user, api, toast, clearCart } = useApp();

    const handleCheckout = async () => {
        if (!user) return;
        try {
            // Create mock payment intent
            const { data: intent } = await api.post('/payments/mock-intent', { amount: cartTotal });
            // Simulate brief delay
            await new Promise(r => setTimeout(r, 800));
            // Verify and place order
            await api.post('/payments/mock-verify', { paymentId: intent.paymentId });
            await api.post('/orders', {
                items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
                deliveryAddress: 'Current Location',
                paymentId: intent.paymentId,
            });
            clearCart();
            setCartOpen(false);
            toast('Order placed successfully! 🎉', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Checkout failed', 'error');
        }
    };

    return (
        <>
            {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }} />}
            <aside className={`cart-sidebar ${cartOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h3>🛒 My Cart <span className="badge badge-green" style={{ fontSize: '0.75rem', marginLeft: 6 }}>{cart.length} items</span></h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCartOpen(false)}>✕</button>
                </div>
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
                        <button className="btn btn-primary w-full btn-lg" onClick={handleCheckout}>
                            Pay ₹{cartTotal.toFixed(2)} (Mock)
                        </button>
                        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            🔒 Simulated payment — no real charges
                        </p>
                    </div>
                )}
            </aside>
        </>
    );
}
