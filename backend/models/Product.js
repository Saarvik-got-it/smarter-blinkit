const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        price: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, min: 0 },
        stock: { type: Number, required: true, min: 0, default: 0 },
        unit: { type: String, default: 'piece' }, // kg, litre, piece, pack
        category: { type: String, required: true, trim: true },
        subCategory: { type: String, default: '' },
        barcode: { type: String, default: '', index: true },
        image: { type: String, default: '' },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },
        tags: [{ type: String }], // For intent search
        embedding: [{ type: Number }], // Gemini embedding for semantic search
        isAvailable: { type: Boolean, default: true },
        salesCount: { type: Number, default: 0 },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        reviewCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ shopId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Product', productSchema);
