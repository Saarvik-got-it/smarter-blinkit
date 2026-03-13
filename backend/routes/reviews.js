const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const ProductRatingStat = require('../models/ProductRatingStat');
const { protect } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_SEED_WEIGHT = 20;
const MAX_REVIEW_LENGTH = 600;

function clampRating(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (numeric < 1 || numeric > 5) return null;
    return Math.round(numeric * 10) / 10;
}

function toObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return new mongoose.Types.ObjectId(id);
}

function computeWeightedFinalRating(seedRating, seedWeight, userRatingSum, userReviewCount) {
    // No user reviews yet — return seed rating as-is (acts as the baseline display value)
    if (userReviewCount === 0) {
        return Number.isFinite(seedRating) ? seedRating : 0;
    }
    // No meaningful seed rating (0 or missing) — use pure user average to avoid
    // the Bayesian prior dragging a 5-star review down to ~0.2
    if (!seedRating || seedRating <= 0) {
        const avg = userRatingSum / userReviewCount;
        return Math.min(5, Math.max(1, avg));
    }
    // Bayesian weighted average: seed acts as a dampening prior
    const denominator = seedWeight + userReviewCount;
    if (denominator <= 0) return seedRating;
    const raw = (seedRating * seedWeight + userRatingSum) / denominator;
    return Math.min(5, Math.max(1, raw));
}

async function getOrCreateProductStat(product) {
    let stat = await ProductRatingStat.findOne({ productId: product._id });

    if (!stat) {
        const baseSeedRating = Number.isFinite(product.rating) ? Number(product.rating) : 0;
        const seedWeight = DEFAULT_SEED_WEIGHT;
        const finalRating = computeWeightedFinalRating(baseSeedRating, seedWeight, 0, 0);

        stat = await ProductRatingStat.create({
            productId: product._id,
            shopId: product.shopId,
            seedRating: baseSeedRating,
            seedWeight,
            userRatingSum: 0,
            userReviewCount: 0,
            finalRating,
        });
    }

    return stat;
}

router.post('/create', protect, async (req, res) => {
    try {
        const { productId, rating, reviewText = '' } = req.body;
        const parsedProductId = toObjectId(productId);
        const parsedRating = clampRating(rating);
        const cleanText = String(reviewText || '').trim();

        if (!parsedProductId) {
            return res.status(400).json({ success: false, message: 'Invalid productId' });
        }
        if (parsedRating === null) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }
        if (cleanText.length > MAX_REVIEW_LENGTH) {
            return res.status(400).json({ success: false, message: `Review text must be at most ${MAX_REVIEW_LENGTH} characters` });
        }

        const product = await Product.findById(parsedProductId).select('_id shopId rating');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existing = await Review.findOne({ productId: parsedProductId, userId: req.user._id }).select('_id');
        if (existing) {
            return res.status(409).json({ success: false, message: 'You have already reviewed this product' });
        }

        const review = await Review.create({
            productId: parsedProductId,
            shopId: product.shopId,
            userId: req.user._id,
            rating: parsedRating,
            reviewText: cleanText,
        });

        let stat = await getOrCreateProductStat(product);
        stat.userRatingSum += parsedRating;
        stat.userReviewCount += 1;
        stat.finalRating = computeWeightedFinalRating(stat.seedRating, stat.seedWeight, stat.userRatingSum, stat.userReviewCount);
        await stat.save();

        const populated = await Review.findById(review._id).populate('userId', 'name');

        return res.status(201).json({
            success: true,
            review: {
                id: populated._id,
                productId: populated.productId,
                shopId: populated.shopId,
                userId: populated.userId?._id,
                userName: populated.userId?.name || 'Anonymous',
                rating: populated.rating,
                reviewText: populated.reviewText,
                createdAt: populated.createdAt,
            },
            ratingSummary: {
                seedRating: stat.seedRating,
                seedWeight: stat.seedWeight,
                userReviewCount: stat.userReviewCount,
                averageUserRating: stat.userReviewCount > 0 ? stat.userRatingSum / stat.userReviewCount : 0,
                finalProductRating: stat.finalRating,
                totalEffectiveCount: stat.seedWeight + stat.userReviewCount,
            },
        });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ success: false, message: 'You have already reviewed this product' });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/product/:productId', async (req, res) => {
    try {
        const parsedProductId = toObjectId(req.params.productId);
        if (!parsedProductId) {
            return res.status(400).json({ success: false, message: 'Invalid productId' });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
        const sortBy = String(req.query.sortBy || 'newest');

        let sort = { createdAt: -1 };
        if (sortBy === 'highest') sort = { rating: -1, createdAt: -1 };
        if (sortBy === 'lowest') sort = { rating: 1, createdAt: -1 };

        const product = await Product.findById(parsedProductId).select('_id shopId rating');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const stat = await ProductRatingStat.findOne({ productId: parsedProductId });
        const seedRating = stat ? stat.seedRating : Number(product.rating || 0);
        const seedWeight = stat ? stat.seedWeight : DEFAULT_SEED_WEIGHT;
        const userReviewCount = stat ? stat.userReviewCount : 0;
        const userRatingSum = stat ? stat.userRatingSum : 0;
        const finalProductRating = stat
            ? stat.finalRating
            : computeWeightedFinalRating(seedRating, seedWeight, userRatingSum, userReviewCount);

        const [totalReviews, reviews] = await Promise.all([
            Review.countDocuments({ productId: parsedProductId }),
            Review.find({ productId: parsedProductId })
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('userId', 'name')
                .lean(),
        ]);

        return res.json({
            success: true,
            productId: parsedProductId,
            ratingSummary: {
                seedRating,
                seedWeight,
                userReviewCount,
                averageUserRating: userReviewCount > 0 ? userRatingSum / userReviewCount : 0,
                finalProductRating,
                totalEffectiveCount: seedWeight + userReviewCount,
            },
            reviews: reviews.map((r) => ({
                id: r._id,
                userId: r.userId?._id,
                userName: r.userId?.name || 'Anonymous',
                rating: r.rating,
                reviewText: r.reviewText,
                createdAt: r.createdAt,
            })),
            pagination: {
                page,
                limit,
                totalReviews,
                hasMore: page * limit < totalReviews,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/shop/:shopId', async (req, res) => {
    try {
        const parsedShopId = toObjectId(req.params.shopId);
        if (!parsedShopId) {
            return res.status(400).json({ success: false, message: 'Invalid shopId' });
        }

        const products = await Product.find({ shopId: parsedShopId }).select('_id rating name').lean();
        if (!products.length) {
            return res.json({
                success: true,
                shopId: parsedShopId,
                shopRating: 0,
                weightedReviewCount: 0,
                userReviewCount: 0,
                productCount: 0,
                products: [],
            });
        }

        const productIds = products.map((p) => p._id);
        const stats = await ProductRatingStat.find({ productId: { $in: productIds } }).lean();
        const statByProduct = new Map(stats.map((s) => [String(s.productId), s]));

        let weightedNumerator = 0;
        let weightedDenominator = 0;
        let totalUserReviews = 0;

        const productRows = products.map((product) => {
            const stat = statByProduct.get(String(product._id));
            const seedRating = stat ? stat.seedRating : Number(product.rating || 0);
            const seedWeight = stat ? stat.seedWeight : DEFAULT_SEED_WEIGHT;
            const userReviewCount = stat ? stat.userReviewCount : 0;
            const userRatingSum = stat ? stat.userRatingSum : 0;
            const finalRating = stat
                ? stat.finalRating
                : computeWeightedFinalRating(seedRating, seedWeight, userRatingSum, userReviewCount);

            // Only weight by actual user review count so that unreviewed products
            // (with seedRating=0) do not drag the shop average down to 0
            if (userReviewCount > 0) {
                weightedNumerator += finalRating * userReviewCount;
                weightedDenominator += userReviewCount;
            }
            totalUserReviews += userReviewCount;

            return {
                productId: product._id,
                productName: product.name,
                finalRating,
                userReviewCount,
                weightedCount: userReviewCount,
            };
        });

        // Return null when no products have been reviewed yet so the frontend
        // can show "No ratings yet" instead of "0.0"
        const shopRating = weightedDenominator > 0 ? weightedNumerator / weightedDenominator : null;

        return res.json({
            success: true,
            shopId: parsedShopId,
            shopRating,
            weightedReviewCount: weightedDenominator,
            userReviewCount: totalUserReviews,
            productCount: products.length,
            products: productRows,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
