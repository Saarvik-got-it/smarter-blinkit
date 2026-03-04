const express = require('express');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to dynamically generate and sync embeddings
const delay = ms => new Promise(res => setTimeout(res, ms));

async function generateAndSyncEmbedding(product) {
    try {
        await delay(2000); // 2s Rate limit throttle to protect Gemini Free Tier
        const textToEmbed = `${product.name} ${product.category} ${product.description || ''}`.trim();

        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(textToEmbed);
        const embedding = result.embedding.values;

        product.embedding = embedding;
        await product.save();
        await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, embedding);
    } catch (err) {
        console.error('Failed to generate/sync embedding for product:', product.name, err.message);
        // Fallback to text-only sync if embedding fails
        await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, []);
    }
}

// GET /api/products/categories — get all unique categories currently in DB
router.get('/categories', async (req, res) => {
    try {
        const categories = await Product.distinct('category');
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/products/search?q=&lat=&lng=&category=&shopId=&limit=&nearbyOnly=
router.get('/search', async (req, res) => {
    try {
        const { q = '', lat, lng, category, shopId, limit = 40, nearbyOnly } = req.query;
        let pipeline = [];

        // 1. Proximity Aggregation (if lat/lng provided)
        if (lat && lng) {
            pipeline.push({
                $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: 'distance',
                    spherical: true,
                    // Convert meters to km in the pipeline later or here
                    distanceMultiplier: 0.001,
                    query: { isAvailable: true, stock: { $gt: 0 } },
                }
            });
        } else {
            pipeline.push({ $match: { isAvailable: true, stock: { $gt: 0 } } });
        }

        // 2. Filters
        if (category) {
            pipeline.push({ $match: { category: new RegExp(category, 'i') } });
        }
        if (shopId) {
            pipeline.push({ $match: { shopId: new mongoose.Types.ObjectId(shopId) } });
        }

        // 3. Text Search
        if (q.trim()) {
            const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const textRegex = new RegExp(term, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { name: textRegex },
                        { description: textRegex },
                        { category: textRegex },
                    ]
                }
            });
        }

        // 4. Nearby Only constraint (e.g. 50km)
        if (nearbyOnly === 'true' && lat && lng) {
            pipeline.push({ $match: { distance: { $lte: 50 } } });
        }

        // 5. Populate and Limit
        pipeline.push({ $limit: 500 }); // High limit to ensure far shops (like Ramesh) don't get truncated by closer shops
        pipeline.push({
            $lookup: {
                from: 'shops',
                localField: 'shopId',
                foreignField: '_id',
                as: 'shopId'
            }
        });
        pipeline.push({ $unwind: '$shopId' });

        // 6. Project and Sort
        // If distance exists, sort by it. Otherwise sort by sales or just return.
        if (lat && lng) {
            pipeline.push({ $sort: { distance: 1 } });
        } else {
            pipeline.push({ $sort: { salesCount: -1 } });
        }

        const products = await Product.aggregate(pipeline);

        res.json({ success: true, count: products.length, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/products/:id/suggestions — similar + bought_with (Neo4j)
router.get('/:id/suggestions', async (req, res) => {
    try {
        const { id } = req.params;
        let suggestions = await neo4jService.getSuggestions(id);

        // --- Smart Product Pairing: Fallback to NLP Semantic Search ---
        if (suggestions.length < 4) {
            const product = await Product.findById(id).select('embedding');
            if (product && product.embedding && product.embedding.length > 0) {
                const semanticResults = await neo4jService.semanticSearch(product.embedding, 6, 0.50);

                // Deduplicate and append semantic matches disguised as "SIMILAR_TO"
                const existingIds = new Set([id, ...suggestions.map(s => s.id.toString())]);

                for (const s of semanticResults) {
                    if (!existingIds.has(s.id.toString())) {
                        suggestions.push({
                            id: s.id,
                            name: s.name,
                            relationship: 'SIMILAR_TO',
                            weight: s.score,
                            isSemantic: true
                        });
                        existingIds.add(s.id.toString());
                        if (suggestions.length >= 6) break;
                    }
                }
            }
        }

        // --- Tier 3: MongoDB Category Fallback (Last Resort) ---
        if (suggestions.length < 2) {
            const product = await Product.findById(id);
            if (product) {
                const categoryMatches = await Product.find({
                    category: product.category,
                    _id: { $ne: id }
                }).limit(6).select('name _id');

                for (const m of categoryMatches) {
                    if (![id, ...suggestions.map(s => s.id.toString())].includes(m._id.toString())) {
                        suggestions.push({
                            id: m._id,
                            name: m.name,
                            relationship: 'SIMILAR_TO',
                            weight: 0.1,
                            isFallback: true
                        });
                        if (suggestions.length >= 6) break;
                    }
                }
            }
        }

        res.json({ success: true, suggestions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('shopId', 'name location rating isOpen phone');
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/products/shop/:shopId — all products for a shop
router.get('/shop/:shopId', async (req, res) => {
    try {
        const products = await Product.find({ shopId: req.params.shopId }).sort({ category: 1, name: 1 });
        res.json({ success: true, count: products.length, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/products — seller creates a product
router.post('/', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found. Register a shop first.' });

        const product = await Product.create({
            ...req.body,
            shopId: shop._id,
            location: shop.location // Inherit shop coordinates [lng, lat]
        });

        // Generate embedding and sync to Mongo/Neo4j
        await generateAndSyncEmbedding(product);

        res.status(201).json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/products/:id — seller updates product
router.put('/:id', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, shopId: shop._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!product) return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });

        // Re-generate embedding in case name/category/desc changed
        await generateAndSyncEmbedding(product);

        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/products/barcode/lookup — look up by barcode
router.post('/barcode/lookup', protect, requireRole('seller'), async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) return res.status(400).json({ success: false, message: 'Barcode required' });
        const shop = await Shop.findOne({ ownerId: req.user._id });
        const product = await Product.findOne({ barcode, shopId: shop._id });
        res.json({ success: true, found: !!product, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/products/barcode/update — update stock via barcode
router.post('/barcode/update', protect, requireRole('seller'), async (req, res) => {
    try {
        const { barcode, stockDelta, newStock, productData } = req.body;
        if (!barcode) return res.status(400).json({ success: false, message: 'Barcode required' });
        const shop = await Shop.findOne({ ownerId: req.user._id });

        let product = await Product.findOne({ barcode, shopId: shop._id });
        if (product) {
            if (newStock !== undefined) product.stock = newStock;
            else if (stockDelta !== undefined) product.stock = Math.max(0, product.stock + stockDelta);
            await product.save();
        } else if (productData) {
            product = await Product.create({
                ...productData,
                barcode,
                shopId: shop._id,
                location: shop.location
            });
            await generateAndSyncEmbedding(product);
        } else {
            return res.status(404).json({ success: false, message: 'Product not found. Provide productData to create.' });
        }
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

async function getNearbyShopIds(lat, lng, maxDistMeters = 10000) {
    const shops = await Shop.find({
        location: {
            $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                $maxDistance: maxDistMeters,
            },
        },
        isOpen: true,
    }).select('_id');
    return shops.map((s) => s._id.toString());
}

module.exports = router;
