const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: String,
    price: Number,
    quantity: Number,
    image: String,
});

const orderSchema = new mongoose.Schema(
    {
        buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        items: [orderItemSchema],
        shopGroups: [
            {
                shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
                shopName: String,
                items: [orderItemSchema],
                subtotal: Number,
                status: {
                    type: String,
                    enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'],
                    default: 'pending',
                },
            },
        ],
        totalAmount: { type: Number, required: true },
        deliveryAddress: { type: String, required: true },
        deliveryLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number],
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
            default: 'pending',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },
        paymentId: { type: String, default: '' },
        paymentMode: { type: String, default: 'mock' },
        estimatedDelivery: { type: Date },
        optimizedRoute: { type: mongoose.Schema.Types.Mixed },
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

// ── Auto-update Excel report on order creation/update ──────────────
const path = require('path');
let _reportTimer = null;
orderSchema.post('save', function () {
    console.log('📋 Order saved — scheduling report regeneration…');
    if (_reportTimer) clearTimeout(_reportTimer);
    _reportTimer = setTimeout(async () => {
        try {
            const servicePath = path.join(__dirname, '..', 'services', 'userReportService');
            const { generateUserReport } = require(servicePath);
            await generateUserReport();
            console.log('✅ Auto-report regeneration complete (from Order update)');
        } catch (err) {
            console.error('⚠️ Auto-report generation failed:', err.message);
        }
    }, 2000);
});

module.exports = mongoose.model('Order', orderSchema);
