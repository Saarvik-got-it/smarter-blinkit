const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        reviewText: { type: String, trim: true, maxlength: 600, default: '' },
    },
    { timestamps: true }
);

reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ shopId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
