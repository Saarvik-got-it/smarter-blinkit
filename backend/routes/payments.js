const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── Stripe Integration (Test Mode) ──
const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

// POST /api/payments/create-intent — Create a Stripe PaymentIntent
router.post('/create-intent', protect, async (req, res) => {
    try {
        const { amount, currency = 'inr' } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });

        if (stripe && process.env.PAYMENT_MODE === 'stripe') {
            // Stripe expects amount in smallest currency unit (paise for INR)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency: currency.toLowerCase(),
                metadata: {
                    userId: req.user._id.toString(),
                    userEmail: req.user.email,
                },
                automatic_payment_methods: { enabled: true },
            });

            return res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount,
                currency,
                mode: 'stripe',
            });
        }

        // Mock fallback (when Stripe is not configured)
        await new Promise((r) => setTimeout(r, 500));
        const paymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        return res.json({
            success: true,
            clientSecret: null,
            paymentIntentId: paymentId,
            amount,
            currency,
            mode: 'mock',
            message: 'Mock payment — no real transaction.',
        });
    } catch (err) {
        console.error('Payment intent creation failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/payments/verify — Verify a Stripe PaymentIntent status
router.post('/verify', protect, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId) return res.status(400).json({ success: false, message: 'Payment Intent ID required' });

        // Mock payment IDs start with "mock_" or "cod_"
        if (paymentIntentId.startsWith('mock_') || paymentIntentId.startsWith('cod_')) {
            return res.json({
                success: true,
                paymentIntentId,
                status: 'succeeded',
                verified: true,
                mode: 'mock',
            });
        }

        if (stripe) {
            const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
            return res.json({
                success: true,
                paymentIntentId: intent.id,
                status: intent.status,
                verified: intent.status === 'succeeded',
                mode: 'stripe',
                amount: intent.amount / 100,
            });
        }

        return res.status(400).json({ success: false, message: 'Stripe not configured' });
    } catch (err) {
        console.error('Payment verification failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Legacy Mock Routes (kept for backward compatibility) ──

// POST /api/payments/mock-intent
router.post('/mock-intent', protect, async (req, res) => {
    const { amount, currency = 'INR' } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: 'Amount required' });
    await new Promise((r) => setTimeout(r, 500));
    const paymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    res.json({ success: true, paymentId, amount, currency, status: 'created', mode: 'mock' });
});

// POST /api/payments/mock-verify
router.post('/mock-verify', protect, async (req, res) => {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ success: false, message: 'Payment ID required' });
    await new Promise((r) => setTimeout(r, 300));
    res.json({ success: true, paymentId, status: 'captured', verified: true, mode: 'mock' });
});

module.exports = router;
