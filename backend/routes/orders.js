const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');
const cartSplitter = require('../services/cartSplitter');

const router = express.Router();

// POST /api/orders — place an order
router.post('/', protect, requireRole('buyer'), async (req, res) => {
    try {
        const { items, deliveryAddress, deliveryLocation, paymentId, notes } = req.body;
        if (!items?.length) return res.status(400).json({ success: false, message: 'No items in cart' });

        // Fetch products with shop info
        const productIds = items.map((i) => i.productId);
        const products = await Product.find({ _id: { $in: productIds } }).populate('shopId');

        const enrichedItems = items.map((item) => {
            const p = products.find((pr) => pr._id.toString() === item.productId);
            if (!p) throw new Error(`Product ${item.productId} not found`);
            if (p.stock < item.quantity) throw new Error(`Insufficient stock for ${p.name}`);
            return {
                productId: p._id, shopId: p.shopId._id,
                name: p.name, price: p.price, quantity: item.quantity, image: p.image,
            };
        });

        const shopGroups = cartSplitter(enrichedItems);
        const totalAmount = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const order = await Order.create({
            buyerId: req.user._id,
            items: enrichedItems,
            shopGroups,
            totalAmount,
            deliveryAddress,
            deliveryLocation,
            paymentId: paymentId || `mock_${Date.now()}`,
            paymentStatus: 'paid',
            paymentMode: 'mock',
            status: 'confirmed',
            notes,
            estimatedDelivery: new Date(Date.now() + 30 * 60 * 1000),
        });

        // Deduct stock & increment sales count
        for (const item of enrichedItems) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity, salesCount: item.quantity },
            });
            await Shop.findByIdAndUpdate(item.shopId, { $inc: { totalOrders: 1 } });
        }

        // Update Neo4j BOUGHT_WITH relationships
        const boughtProductIds = enrichedItems.map((i) => i.productId.toString());
        await neo4jService.recordBoughtTogether(boughtProductIds);

        // Emit to live storeboard
        req.io.emit('newOrder', { order: order._id, shopGroups, totalAmount, timestamp: new Date() });

        await order.populate('buyerId', 'name email');
        res.status(201).json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/orders/my — buyer's order history
router.get('/my', protect, requireRole('buyer'), async (req, res) => {
    try {
        const orders = await Order.find({ buyerId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('items.productId', 'name image price')
            .populate('items.shopId', 'name');
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/orders/shop — seller sees orders for their shop
router.get('/shop', protect, requireRole('seller'), async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        const orders = await Order.find({ 'shopGroups.shopId': shop._id })
            .sort({ createdAt: -1 })
            .populate('buyerId', 'name phone');
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('buyerId', 'name email phone')
            .populate('items.shopId', 'name location');
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
