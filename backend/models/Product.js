const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        price: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, min: 0 },
        stock: { type: Number, required: true, min: 0, default: 0 },
        unit: { type: String, default: 'piece' }, // kg, litre, piece, pack
        weight: { type: String }, // e.g., "250g", "1L" - distinct from physical piece stock
        category: { type: String, required: true, trim: true },
        subCategory: { type: String, default: '' },
        barcode: { type: String, default: '', index: true },
        image: { type: String }, // Stores image URL or base64
        expiryDate: { type: Date }, // Optional for all products now
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

const google = require('googlethis');

productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ shopId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ location: '2dsphere' });

// --- SMART AUTO-IMAGE FETCHER HOOK ---
// If a seller creates a product but leaves the image blank,
// trigger an asynchronous background fetch and validating it.
async function checkImageValid(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(5000)
        });
        const ct = response.headers.get('content-type') || '';
        if (response.ok && ct.startsWith('image/')) return true;
        return false;
    } catch (e) {
        return false;
    }
}

productSchema.post('save', function (doc) {
    // We only trigger this if the image field is empty.
    // If the seller provided an image manually, we leave it alone.
    if (!doc.image || doc.image.trim() === '') {
        console.log(`[Smart-Fetch] Background fetching image for new product: ${doc.name}`);

        (async () => {
            try {
                const query = doc.name + " grocery packaging India";
                const images = await google.image(query, { safe: false });

                if (images && images.length > 0) {
                    for (let img of images) {
                        if (img.url && !img.url.includes('svg') && !img.url.includes('base64')) {
                            const isValid = await checkImageValid(img.url);
                            if (isValid) {
                                console.log(`[Smart-Fetch] Found valid image for ${doc.name}, updating...`);
                                await mongoose.model('Product').updateOne(
                                    { _id: doc._id },
                                    { $set: { image: img.url } }
                                );
                                break; // Once a working image is set, stop the loop.
                            } else {
                                console.log(`[Smart-Fetch] Image URL broken/invalid, trying next one...`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`[Smart-Fetch] Failed to background fetch image for ${doc.name}:`, err.message);
            }
        })();
    }
});

module.exports = mongoose.model('Product', productSchema);
