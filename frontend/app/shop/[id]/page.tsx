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
    const [ratingSummary, setRatingSummary] = useState<any>(null);
    const [shopRating, setShopRating] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewSortBy, setReviewSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewPagination, setReviewPagination] = useState({ page: 1, limit: 6, totalReviews: 0, hasMore: false });
    const [selectedRating, setSelectedRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

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

    useEffect(() => {
        if (!id) return;
        setReviewPage(1);
    }, [id, reviewSortBy]);

    useEffect(() => {
        if (!id) return;
        setReviewsLoading(true);
        api.get(`/reviews/product/${id}`, { params: { sortBy: reviewSortBy, page: reviewPage, limit: 6 } })
            .then((res: any) => {
                setRatingSummary(res.data.ratingSummary || null);
                setReviews(res.data.reviews || []);
                setReviewPagination(res.data.pagination || { page: 1, limit: 6, totalReviews: 0, hasMore: false });
            })
            .catch(() => {
                setReviews([]);
            })
            .finally(() => setReviewsLoading(false));
    }, [id, reviewSortBy, reviewPage, api]);

    useEffect(() => {
        if (!product?.shopId?._id) return;
        api.get(`/reviews/shop/${product.shopId._id}`)
            .then((res: any) => setShopRating(res.data))
            .catch(() => setShopRating(null));
    }, [product?.shopId?._id, api]);

    const handleAddToCart = () => {
        if (!product) return;
        if (!user) { toast('Please login to add to cart', 'error'); return; }
        addToCart({ productId: product._id, name: product.name, price: product.price, quantity: qty, image: product.image, shopId: product.shopId?._id, shopName: product.shopId?.name });
    };

    const refreshReviews = async () => {
        const res = await api.get(`/reviews/product/${id}`, { params: { sortBy: reviewSortBy, page: reviewPage, limit: 6 } });
        setRatingSummary(res.data.ratingSummary || null);
        setReviews(res.data.reviews || []);
        setReviewPagination(res.data.pagination || { page: 1, limit: 6, totalReviews: 0, hasMore: false });
        if (product?.shopId?._id) {
            const shopRes = await api.get(`/reviews/shop/${product.shopId._id}`);
            setShopRating(shopRes.data);
        }
    };

    const submitReview = async () => {
        if (!user) {
            toast('Please login to submit a review', 'error');
            return;
        }
        if (selectedRating < 1 || selectedRating > 5) {
            toast('Please select a star rating between 1 and 5', 'error');
            return;
        }
        if (reviewText.trim().length > 600) {
            toast('Review text must be at most 600 characters', 'error');
            return;
        }

        try {
            setSubmittingReview(true);
            await api.post('/reviews/create', {
                productId: id,
                rating: selectedRating,
                reviewText: reviewText.trim(),
            });
            toast('Review submitted successfully', 'success');
            setReviewText('');
            setSelectedRating(0);
            setHoverRating(0);
            setReviewPage(1);
            await refreshReviews();
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to submit review', 'error');
        } finally {
            setSubmittingReview(false);
        }
    };

    const displayedProductRating = ratingSummary?.finalProductRating ?? product?.rating ?? 0;
    const displayedReviewCount = ratingSummary?.userReviewCount ?? 0;

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
                                <span>
                                    {shopRating
                                        ? (shopRating.userReviewCount > 0
                                            ? `⭐ ${Number(shopRating.shopRating).toFixed(1)}`
                                            : '⭐ No ratings yet')
                                        : `⭐ ${Number(product.shopId?.rating ?? 0).toFixed(1)}`}
                                </span>
                                {product.stock < 10 && product.stock > 0 && <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>Only {product.stock} left!</span>}
                                {product.stock === 0 && <span className="badge badge-red">Out of Stock</span>}
                            </div>

                            <div className="review-summary-banner" style={{ marginBottom: 20 }}>
                                <div className="review-summary-score">⭐ {Number(displayedProductRating).toFixed(1)} / 5</div>
                                <div className="review-summary-count">
                                    {displayedReviewCount === 0
                                        ? '(No reviews yet)'
                                        : `(${displayedReviewCount} review${displayedReviewCount === 1 ? '' : 's'})`}
                                </div>
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

                    <section className="review-section" style={{ marginTop: 36 }}>
                        <div className="review-header-row">
                            <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Product Reviews</h2>
                            <div className="review-sort-wrap">
                                <label htmlFor="review-sort" className="text-muted" style={{ fontSize: '0.8rem' }}>Sort</label>
                                <select
                                    id="review-sort"
                                    className="review-sort-select"
                                    value={reviewSortBy}
                                    onChange={(e) => setReviewSortBy(e.target.value as 'newest' | 'highest' | 'lowest')}
                                >
                                    <option value="newest">Newest first</option>
                                    <option value="highest">Highest rating</option>
                                    <option value="lowest">Lowest rating</option>
                                </select>
                            </div>
                        </div>

                        <div className="review-form-card">
                            <div className="review-stars-input">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        className={`star-btn ${(hoverRating || selectedRating) >= star ? 'active' : ''}`}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setSelectedRating(star)}
                                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="text-muted" style={{ fontSize: '0.85rem', marginLeft: 8 }}>
                                    {selectedRating > 0 ? `${selectedRating} / 5 selected` : 'Select your rating'}
                                </span>
                            </div>
                            <textarea
                                className="review-textarea"
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value.slice(0, 600))}
                                placeholder="Share your honest review (optional)..."
                                rows={4}
                            />
                            <div className="review-form-footer">
                                <span className="text-muted" style={{ fontSize: '0.78rem' }}>{reviewText.length}/600</span>
                                <button
                                    className="btn btn-primary"
                                    onClick={submitReview}
                                    disabled={!user || submittingReview}
                                >
                                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                                </button>
                            </div>
                            {!user && <div className="text-muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>Login required to post a review.</div>}
                        </div>

                        <div className="review-list-wrap">
                            {reviewsLoading && <div className="text-muted">Loading reviews...</div>}
                            {!reviewsLoading && reviews.length === 0 && (
                                <div className="review-empty-card">No reviews yet. Be the first to review this product.</div>
                            )}
                            {!reviewsLoading && reviews.map((review) => (
                                <article key={review.id} className="review-card">
                                    <div className="review-card-top">
                                        <strong>{review.userName}</strong>
                                        <span className="review-stars-static">{'★'.repeat(Math.round(review.rating))}{'☆'.repeat(5 - Math.round(review.rating))}</span>
                                    </div>
                                    {review.reviewText ? <p className="review-text">{review.reviewText}</p> : <p className="review-text muted">No written comment.</p>}
                                    <div className="review-date">{new Date(review.createdAt).toLocaleDateString()}</div>
                                </article>
                            ))}
                        </div>

                        {reviewPagination.totalReviews > 0 && (
                            <div className="review-pagination-row">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={reviewPagination.page <= 1}
                                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </button>
                                <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                                    Page {reviewPagination.page}
                                </span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={!reviewPagination.hasMore}
                                    onClick={() => setReviewPage((p) => p + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
