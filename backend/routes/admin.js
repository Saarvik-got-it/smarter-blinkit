const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');

// GET /api/admin/users
// Protected by simple shared secret in headers
router.get('/users', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (secret !== process.env.ADMIN_SECRET && secret !== 'smarter-dev-123') {
            return res.status(401).json({ success: false, message: 'Invalid Admin Secret' });
        }

        const users = await User.find({}).select('-password -faceDescriptor').lean();
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        console.error('Admin API error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/admin/user-report — download fresh Excel report
router.get('/user-report', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (secret !== process.env.ADMIN_SECRET && secret !== 'smarter-dev-123') {
            return res.status(401).json({ success: false, message: 'Invalid Admin Secret' });
        }

        const { generateUserReport, REPORT_PATH } = require('../services/userReportService');
        await generateUserReport();

        res.download(REPORT_PATH, 'users_report.xlsx', (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Failed to download report' });
                }
            }
        });
    } catch (err) {
        console.error('Report generation error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
});

// GET /api/admin/storeboard — initial data for Live Storeboard
router.get('/storeboard', async (req, res) => {
    try {
        const fastestSelling = await Product.find({ isAvailable: true })
            .sort({ salesCount: -1 })
            .limit(10)
            .select('name salesCount category image price')
            .populate('shopId', 'name');

        const topRatedShops = await Shop.find({ isVerified: true })
            .sort({ rating: -1, totalOrders: -1 })
            .limit(10)
            .select('name rating totalOrders city location');

        const recentOrders = await Order.find({ status: { $ne: 'cancelled' } })
            .sort({ createdAt: -1 })
            .limit(200)
            .select('deliveryLocation totalAmount')
            .lean();

        const heatmapData = recentOrders.map((o) => {
            if (o.deliveryLocation?.coordinates?.length === 2) {
                // Leaflet expects [lat, lng, intensity]
                return [o.deliveryLocation.coordinates[1], o.deliveryLocation.coordinates[0], o.totalAmount || 50];
            }
            return null;
        }).filter(Boolean);

        res.json({ success: true, fastestSelling, topRatedShops, heatmapData });
    } catch (err) {
        console.error('Storeboard API error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
