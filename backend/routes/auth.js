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
        const { name, email, password, role, phone, shopName, address, city, state, pincode, country, location } = req.body;
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
                    address: address || location?.address || 'Address not provided',
                    city: city || '',
                    state: state || '',
                    pincode: pincode || '',
                    country: country || 'India'
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

// PUT /api/auth/me
router.put('/me', protect, async (req, res) => {
    try {
        const { name, phone, address, location } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (name) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) {
            user.location.address = address;
        }
        if (location) {
            user.location = location;
        }

        await user.save();
        res.json({ success: true, user, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/addresses - Add a new saved address
router.post('/addresses', protect, async (req, res) => {
    try {
        const { tag, address, city, state, pincode, coordinates } = req.body;
        const user = await User.findById(req.user._id);
        
        user.savedAddresses.push({
            tag: tag || 'Other',
            address: address || '',
            city: city || '',
            state: state || '',
            pincode: pincode || '',
            coordinates: coordinates || [0, 0]
        });

        // If this is their first address or main location is empty/unset, set it as default
        if (user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0) {
            const newAddr = user.savedAddresses[user.savedAddresses.length - 1];
            user.location = { ...newAddr.toObject() };
        }

        await user.save();
        res.json({ success: true, user, message: 'Address saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/auth/addresses/active - Set a saved address as active
router.put('/addresses/active', protect, async (req, res) => {
    try {
        const { addressId } = req.body;
        const user = await User.findById(req.user._id);
        
        const addr = user.savedAddresses.id(addressId);
        if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

        user.location = { ...addr.toObject() };
        delete user.location._id; // Remove subdocument id
        
        await user.save();
        res.json({ success: true, user, message: 'Active delivery address updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/auth/addresses/:id - Delete a saved address
router.delete('/addresses/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        const addr = user.savedAddresses.id(req.params.id);
        if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

        user.savedAddresses.pull(addr._id);
        await user.save();
        
        res.json({ success: true, user, message: 'Address removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/reset-password-request (Mock)
router.post('/reset-password-request', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // In a real app, send email with token. Here we just return success.
        res.json({ success: true, message: 'Password reset instructions sent to your email (Mocked)' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/reset-password (Mock)
router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.password = newPassword; // Pre-save hook will hash it automatically
        await user.save();

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
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

// Helper: Calculate Euclidean Distance between two feature vectors
function euclideanDistance(arr1, arr2) {
    if (arr1.length !== arr2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        sum += Math.pow(arr1[i] - arr2[i], 2);
    }
    return Math.sqrt(sum);
}

