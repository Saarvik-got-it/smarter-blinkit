const express = require('express');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/shops/nearby?lat=&lng=&radius=10000
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10000 } = req.query;
        if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });
        const shops = await Shop.find({
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: Number(radius),
                },
            },
            isOpen: true,
        }).limit(20);
        res.json({ success: true, count: shops.length, shops });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/shops/storeboard — live top sellers & top shops
router.get('/storeboard', async (req, res) => {
    try {
        const topProducts = await Product.find({ isAvailable: true })
            .sort({ salesCount: -1 })
            .limit(10)
            .populate('shopId', 'name');

        const topShops = await Shop.find({ isOpen: true })
            .sort({ totalOrders: -1, rating: -1 })
            .limit(10);

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('buyerId', 'name');

        res.json({ success: true, topProducts, topShops, recentOrders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/shops/money-map — neighbourhood purchase heatmap
router.get('/money-map', async (req, res) => {
    try {
        const heatmapData = await Order.aggregate([
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'items.shopId',
                    foreignField: '_id',
                    as: 'shop',
                },
            },
            { $unwind: '$shop' },
            {
                $group: {
                    _id: '$shop._id',
                    shopName: { $first: '$shop.name' },
                    coordinates: { $first: '$shop.location.coordinates' },
                    address: { $first: '$shop.location.address' },
                    totalSales: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                },
            },
            { $sort: { totalRevenue: -1 } },
        ]);
        res.json({ success: true, heatmapData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/shops/my — get seller's shop
router.get('/my', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.json({ success: true, shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/shops — create a shop for the logged-in seller (if they didn't set one up at registration)
router.post('/', protect, requireRole('seller'), async (req, res) => {
    try {
        const existing = await Shop.findOne({ ownerId: req.user._id });
        if (existing) return res.status(409).json({ success: false, message: 'You already have a shop. Use PUT /api/shops/my to update it.' });

        const { name, address, phone } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Shop name is required' });

        const shop = await Shop.create({
            name,
            ownerId: req.user._id,
            phone: phone || '',
            location: { type: 'Point', coordinates: [0, 0], address: address || '' },
        });
        res.status(201).json({ success: true, shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// PUT /api/shops/my — update seller's shop
router.put('/my', protect, requireRole('seller'), async (req, res) => {
    try {
        const { name, phone } = req.body;
        const address = req.body['location.address'] ?? req.body.address;

        const updateFields = {};
        if (name) updateFields.name = name;
        if (phone !== undefined) updateFields.phone = phone;
        if (address !== undefined) updateFields['location.address'] = address;

        const shop = await Shop.findOneAndUpdate(
            { ownerId: req.user._id },
            { $set: updateFields },
            { new: true, runValidators: false }
        );
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.json({ success: true, shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/shops/:id
router.get('/:id', async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id).populate('ownerId', 'name phone');
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.json({ success: true, shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
