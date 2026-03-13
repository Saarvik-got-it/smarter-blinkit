const mongoose = require('mongoose');

const productRatingStatSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
        seedRating: { type: Number, min: 0, max: 5, default: 0 },
        seedWeight: { type: Number, min: 1, default: 20 },
        userRatingSum: { type: Number, min: 0, default: 0 },
        userReviewCount: { type: Number, min: 0, default: 0 },
        finalRating: { type: Number, min: 0, max: 5, default: 0 },
    },
    { timestamps: true }
);

productRatingStatSchema.index({ shopId: 1, finalRating: -1 });

module.exports = mongoose.model('ProductRatingStat', productRatingStatSchema);
