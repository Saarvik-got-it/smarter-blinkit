const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true }, // [lng, lat]
            address: { type: String, required: true },
            city: { type: String, default: '' },
            pincode: { type: String, default: '' },
        },
        category: { type: String, default: 'General' },
        image: { type: String, default: '' },
        phone: { type: String, default: '' },
        openingHours: { type: String, default: '9AM - 9PM' },
        isOpen: { type: Boolean, default: true },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        totalOrders: { type: Number, default: 0 },
        isVerified: { type: Boolean, default: false },
    },
    { timestamps: true }
);

shopSchema.index({ location: '2dsphere' });
shopSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Shop', shopSchema);
