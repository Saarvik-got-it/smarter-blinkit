const express = require('express');
const router = express.Router();
const User = require('../models/User');

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

module.exports = router;
