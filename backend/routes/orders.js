const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');
const cartSplitter = require('../services/cartSplitter');
const axios = require('axios');

const router = express.Router();

function getDistance(coords1, coords2) {
    if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) return Infinity;
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    if (lat1 === 0 && lon1 === 0) return Infinity;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// POST /api/orders — place an order
router.post('/', protect, requireRole('buyer'), async (req, res) => {
    try {
        const { items, deliveryAddress, deliveryLocation, paymentId, paymentMode, notes } = req.body;
        if (!items?.length) return res.status(400).json({ success: false, message: 'No items in cart' });

        // ── Local First Cart Splitting Logic ──
        const productIds = items.map((i) => i.productId);
        const originalProducts = await Product.find({ _id: { $in: productIds } });

        const userCoords = deliveryLocation?.coordinates || req.user.location?.coordinates;
        const enrichedItems = [];

        for (const item of items) {
            const origP = originalProducts.find(p => p._id.toString() === item.productId);
            if (!origP) throw new Error(`Product ${item.productId} not found`);

            // Find all shops with the same product (by barcode or name) and enough stock
            const query = origP.barcode ? { barcode: origP.barcode } : { name: origP.name };
            query.stock = { $gte: item.quantity };

            const alternatives = await Product.find(query).populate('shopId');
            if (alternatives.length === 0) throw new Error(`Insufficient stock for ${origP.name} across all local shops`);

            // Find the closest shop
            if (userCoords && userCoords.length === 2 && userCoords[0] !== 0) {
                alternatives.sort((a, b) => {
                    const dA = getDistance(userCoords, a.shopId?.location?.coordinates);
                    const dB = getDistance(userCoords, b.shopId?.location?.coordinates);
                    return dA - dB;
                });
            }

            const bestProduct = alternatives[0];

            enrichedItems.push({
                productId: bestProduct._id,
                shopId: bestProduct.shopId._id,
                shopLocation: bestProduct.shopId.location?.coordinates || null,
                name: bestProduct.name,
                category: bestProduct.category,
                price: bestProduct.price,
                quantity: item.quantity,
                image: bestProduct.image,
            });
        }

        const shopGroups = cartSplitter(enrichedItems);

        // ── OSRM API Multi-Stop Routing ──
        let optimizedRoute = null;
        if (userCoords && userCoords.length === 2 && userCoords[0] !== 0) {
            const uniqueShops = new Map();
            for (const item of enrichedItems) {
                if (item.shopLocation) uniqueShops.set(item.shopId.toString(), item.shopLocation);
            }

            const coords = Array.from(uniqueShops.values()).filter(Boolean);
            if (coords.length > 0) {
                coords.push(userCoords); // Last coordinate is always the user's home (destination=last)
                const coordString = coords.map(c => `${c[0]},${c[1]}`).join(';');
                try {
                    // source=any lets OSRM find the optimal starting shop (farthest first).
                    // destination=last guarantees the route ends at the customer's home.
                    const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordString}?source=any&destination=last&roundtrip=false`;
                    const { data } = await axios.get(osrmUrl, { timeout: 3000 });
                    if (data.code === 'Ok') {
                        optimizedRoute = data.trips[0];
                    }
                } catch (apiErr) {
                    console.warn('OSRM routing failed/timeout (using fallback):', apiErr.message);
                }
            }
        }

        const totalAmount = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const order = await Order.create({
            buyerId: req.user._id,
            items: enrichedItems,
            shopGroups,
            totalAmount,
            deliveryAddress,
            deliveryLocation,
            optimizedRoute,
            paymentId: paymentId || `mock_${Date.now()}`,
            paymentStatus: paymentMode === 'cod' ? 'pending' : 'paid',
            paymentMode: paymentMode || 'mock',
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
            await neo4jService.incrementProductSales(item.productId.toString(), item.quantity);
        }

        // Update Neo4j BOUGHT_WITH relationships
        const boughtProductIds = enrichedItems.map((i) => i.productId.toString());
        const boughtProductsMeta = enrichedItems.map((i) => ({
            id: i.productId.toString(),
            name: i.name,
            category: i.category,
        }));
        await neo4jService.recordBoughtTogether(boughtProductIds, boughtProductsMeta);

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
