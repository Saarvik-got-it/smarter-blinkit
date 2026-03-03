const express = require('express');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');

const router = express.Router();

// GET /api/products/search?q=&lat=&lng=&category=&limit=
router.get('/search', async (req, res) => {
    try {
        const { q = '', lat, lng, category, limit = 20 } = req.query;
        let query = { isAvailable: true, stock: { $gt: 0 } };

        if (category) query.category = new RegExp(category, 'i');

        let products;
        if (q) {
            // Text search first
            products = await Product.find({ $text: { $search: q }, ...query })
                .populate('shopId', 'name location rating isOpen')
                .limit(Number(limit));

            // If nearby filter, post-filter by distance
            if (lat && lng && products.length) {
                const nearbyShopIds = await getNearbyShopIds(lat, lng, 10000);
                products = products.filter((p) =>
                    nearbyShopIds.includes(p.shopId?._id?.toString())
                );
            }
        } else if (lat && lng) {
            const nearbyShopIds = await getNearbyShopIds(lat, lng, 10000);
            products = await Product.find({ shopId: { $in: nearbyShopIds }, ...query })
                .populate('shopId', 'name location rating isOpen')
                .sort({ salesCount: -1 })
                .limit(Number(limit));
        } else {
            products = await Product.find(query)
                .populate('shopId', 'name location rating isOpen')
                .sort({ salesCount: -1 })
                .limit(Number(limit));
        }

        res.json({ success: true, count: products.length, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/products/:id/suggestions — similar + bought_with (Neo4j)
router.get('/:id/suggestions', async (req, res) => {
    try {
        const { id } = req.params;
        const suggestions = await neo4jService.getSuggestions(id);
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

        const product = await Product.create({ ...req.body, shopId: shop._id });

        // Sync to Neo4j
        await neo4jService.upsertProduct(product._id.toString(), product.name, product.category);

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
            product = await Product.create({ ...productData, barcode, shopId: shop._id });
            await neo4jService.upsertProduct(product._id.toString(), product.name, product.category);
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
