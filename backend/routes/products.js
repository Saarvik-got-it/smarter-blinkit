const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to dynamically generate and sync embeddings
const delay = ms => new Promise(res => setTimeout(res, ms));
const EMBEDDING_RETRIES = 2;

async function generateAndSyncEmbedding(product) {
    const textToEmbed = `${product.name} ${product.category} ${product.description || ''}`.trim();

    try {
        if (!textToEmbed) {
            console.warn(`[EmbeddingPipeline] Empty embedding input for product=${product._id}. Falling back to text-only Neo4j upsert.`);
            await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, []);
            return { status: 'text-only', embeddingLength: 0 };
        }

        let embedding;
        for (let attempt = 1; attempt <= EMBEDDING_RETRIES; attempt++) {
            try {
                await delay(2000); // Rate limit throttle to protect Gemini Free Tier
                const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
                const result = await model.embedContent(textToEmbed);
                embedding = result.embedding.values;

                if (!neo4jService.isValidEmbedding(embedding)) {
                    throw new Error(`Embedding dimension mismatch. Expected ${neo4jService.EMBEDDING_DIMENSION}, got ${Array.isArray(embedding) ? embedding.length : 'non-array'}`);
                }
                break;
            } catch (attemptErr) {
                console.warn(`[EmbeddingPipeline] Attempt ${attempt}/${EMBEDDING_RETRIES} failed for product=${product._id}: ${attemptErr.message}`);
                if (attempt === EMBEDDING_RETRIES) throw attemptErr;
            }
        }

        product.embedding = embedding;
        await product.save();

        const upsertResult = await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, embedding);
        const neo4jEmbeddingSize = await neo4jService.getProductEmbeddingSize(product._id.toString());
        console.log(
            `[EmbeddingPipeline] product=${product._id} mongoEmbeddingLength=${embedding.length} neo4jEmbeddingLength=${neo4jEmbeddingSize ?? 0} neo4jUpsertOk=${upsertResult?.ok === true}`
        );

        return { status: 'vector-synced', embeddingLength: embedding.length, neo4jEmbeddingLength: neo4jEmbeddingSize ?? 0 };
    } catch (err) {
        console.error(`[EmbeddingPipeline] Failed for product=${product._id} name="${product.name}":`, err.message);
        // Fallback to text-only sync if embedding fails
        const upsertResult = await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, []);
        const neo4jEmbeddingSize = await neo4jService.getProductEmbeddingSize(product._id.toString());
        console.warn(
            `[EmbeddingPipeline] Text-only fallback for product=${product._id}. neo4jEmbeddingLength=${neo4jEmbeddingSize ?? 0} neo4jUpsertOk=${upsertResult?.ok === true}`
        );
        return { status: 'text-only', embeddingLength: 0, neo4jEmbeddingLength: neo4jEmbeddingSize ?? 0 };
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
                    distanceMultiplier: 0.001,
                    query: { isAvailable: true, stock: { $gt: 0 } },
                }
            });
        } else {
            pipeline.push({ $match: { isAvailable: true, stock: { $gt: 0 } } });
        }

        // 2. Filters — support comma-separated multi-values
        if (category) {
            const cats = category.split(',').map(c => c.trim()).filter(Boolean);
            if (cats.length === 1) {
                pipeline.push({ $match: { category: new RegExp(cats[0], 'i') } });
            } else if (cats.length > 1) {
                pipeline.push({ $match: { category: { $in: cats.map(c => new RegExp(c, 'i')) } } });
            }
        }
        if (shopId) {
            const shopIds = shopId.split(',').map(s => s.trim()).filter(Boolean);
            if (shopIds.length === 1) {
                pipeline.push({ $match: { shopId: new mongoose.Types.ObjectId(shopIds[0]) } });
            } else if (shopIds.length > 1) {
                pipeline.push({ $match: { shopId: { $in: shopIds.map(s => new mongoose.Types.ObjectId(s)) } } });
            }
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

// GET /api/products/low-stock — low stock items for a shop
router.get('/low-stock', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

        const products = await Product.find({ shopId: shop._id, stock: { $lt: 5 } }).sort({ stock: 1 });
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

        // Generate embedding and sync to Mongo/Neo4j first so node exists before relationship linking
        const embeddingSyncMeta = await generateAndSyncEmbedding(product);

        // Add SIMILAR_TO relationships via category in Neo4j
        try {
            const similarProducts = await Product.find({
                category: product.category,
                _id: { $ne: product._id }
            }).limit(3).select('_id');
            for (const sim of similarProducts) {
                await neo4jService.createSimilarRelationship(product._id.toString(), sim._id.toString());
            }
            console.log(`[EmbeddingPipeline] Created ${similarProducts.length} SIMILAR_TO links for product=${product._id}`);
        } catch (simErr) {
            console.warn('Failed to add SIMILAR_TO relationships:', simErr.message);
        }

        res.status(201).json({ success: true, product, embeddingSyncMeta });
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

// DELETE /api/products/:id — seller deletes their own product
router.delete('/:id', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        const product = await Product.findOneAndDelete({ _id: req.params.id, shopId: shop._id });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
        // Clean up Neo4j node + all relationships (BOUGHT_WITH, SIMILAR_TO, vector index entry)
        await neo4jService.deleteProduct(req.params.id);
        res.json({ success: true, message: 'Product deleted' });
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

        if (product) {
            return res.json({ success: true, found: true, external: false, product });
        }

        // External API Lookup Fallback (OpenFoodFacts)
        try {
            const { data } = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, { timeout: 4000 });
            if (data && data.status === 1 && data.product) {
                const extProduct = {
                    name: data.product.product_name || '',
                    category: data.product.categories?.split(',')[0] || '',
                    brand: data.product.brands || '',
                    image: data.product.image_url || ''
                };
                return res.json({ success: true, found: false, external: true, productData: extProduct });
            }
        } catch (apiErr) {
            console.warn('External barcode lookup failed:', apiErr.message);
        }

        res.json({ success: true, found: false, external: false, product: null });
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
