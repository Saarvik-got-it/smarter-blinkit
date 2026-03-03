const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { protect } = require('../middleware/auth');

const router = express.Router();

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, phone, shopName, shopAddress, location } = req.body;
        if (!name || !email || !password || !role)
            return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

        const user = await User.create({
            name, email, password, role, phone,
            location: location || { type: 'Point', coordinates: [0, 0], address: '' },
        });

        // Auto-create shop for sellers
        if (role === 'seller' && shopName) {
            await Shop.create({
                name: shopName,
                ownerId: user._id,
                location: {
                    type: 'Point',
                    coordinates: location?.coordinates || [0, 0],
                    address: shopAddress || '',
                },
            });
        }

        const token = signToken(user._id);
        res.status(201).json({ success: true, token, user });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password required' });

        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password)))
            return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const token = signToken(user._id);
        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/face-login (face-api.js descriptor match)
router.post('/face-login', async (req, res) => {
    try {
        const { descriptor } = req.body; // Float32Array as regular array
        if (!descriptor || !Array.isArray(descriptor))
            return res.status(400).json({ success: false, message: 'Face descriptor required' });

        // Find closest face match from all users who have face descriptors
        const users = await User.find({ faceDescriptor: { $exists: true, $not: { $size: 0 } } }).select('+faceDescriptor');
        if (!users.length)
            return res.status(404).json({ success: false, message: 'No face profiles registered' });

        let bestMatch = null;
        let bestDistance = Infinity;

        for (const user of users) {
            if (!user.faceDescriptor?.length) continue;
            const distance = euclideanDistance(descriptor, user.faceDescriptor);
            if (distance < bestDistance) { bestDistance = distance; bestMatch = user; }
        }

        const THRESHOLD = 0.55;
        if (!bestMatch || bestDistance > THRESHOLD)
            return res.status(401).json({ success: false, message: 'Face not recognized', distance: bestDistance });

        const token = signToken(bestMatch._id);
        res.json({ success: true, token, user: bestMatch, distance: bestDistance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/register-face
router.post('/register-face', protect, async (req, res) => {
    try {
        const { descriptor } = req.body;
        if (!descriptor) return res.status(400).json({ success: false, message: 'Descriptor required' });
        await User.findByIdAndUpdate(req.user._id, { faceDescriptor: descriptor });
        res.json({ success: true, message: 'Face registered successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// DELETE /api/auth/delete-account
router.delete('/delete-account', protect, async (req, res) => {
    try {
        const user = req.user;
        // If seller, remove their shop too
        if (user.role === 'seller') {
            await Shop.deleteMany({ ownerId: user._id });
        }
        await User.findByIdAndDelete(user._id);
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

