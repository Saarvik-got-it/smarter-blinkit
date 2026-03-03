const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/mock-intent — simulate payment intent creation
router.post('/mock-intent', protect, async (req, res) => {
    const { amount, currency = 'INR' } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: 'Amount required' });

    // Simulate a 500ms processing delay for realism
    await new Promise((r) => setTimeout(r, 500));

    const paymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    res.json({
        success: true,
        paymentId,
        amount,
        currency,
        status: 'created',
        mode: 'mock',
        message: 'This is a simulated payment. No real transaction occurred.',
    });
});

// POST /api/payments/mock-verify — simulate payment verification
router.post('/mock-verify', protect, async (req, res) => {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ success: false, message: 'Payment ID required' });

    await new Promise((r) => setTimeout(r, 300));

    res.json({
        success: true,
        paymentId,
        status: 'captured',
        verified: true,
        mode: 'mock',
        message: 'Mock payment verified successfully.',
    });
});

module.exports = router;
