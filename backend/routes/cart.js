const express = require('express');
const { protect } = require('../middleware/auth');
const smartCartService = require('../services/smartCartService');
const cartIntelligenceService = require('../services/cartIntelligenceService');

const router = express.Router();

// POST /api/cart/analyze
// Receives the raw cart items and returns the fully grouped and enriched structure
router.post('/analyze', protect, async (req, res) => {
    try {
        const { items, location } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: 'Invalid cart format' });
        }

        const userCoords = location?.coordinates || req.user?.location?.coordinates;

        // 1. Analyze and group cart
        const cartAnalysis = await smartCartService.analyzeCart(items, userCoords);

        // 2. Add intelligence (cross sells & replacements)
        // Extract product IDs currently in groups
        const activeProductIds = [];
        for (const group of cartAnalysis.shopGroups) {
            for (const item of group.items) {
                activeProductIds.push(item.productId.toString());
            }
        }

        // Get cross sells
        const crossSells = await cartIntelligenceService.getCrossSells(activeProductIds);
        cartAnalysis.crossSells = crossSells;

        // Get replacements for unavailable items
        for (let i = 0; i < cartAnalysis.unavailableItems.length; i++) {
            const unItem = cartAnalysis.unavailableItems[i];
            const replacements = await cartIntelligenceService.getReplacements(unItem.productId);
            unItem.replacements = replacements;
        }

        res.json({ success: true, cartData: cartAnalysis });

    } catch (err) {
        console.error('Cart analysis error:', err);
        res.status(500).json({ success: false, message: 'Failed to analyze cart' });
    }
});

module.exports = router;
