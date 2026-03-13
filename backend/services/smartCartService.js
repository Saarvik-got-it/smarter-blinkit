const Product = require('../models/Product');
const neo4jService = require('./neo4j');
const cartSplitter = require('./cartSplitter');

function getDistance(coords1, coords2) {
    if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) return Infinity;
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    if (lat1 === 0 && lon1 === 0) return Infinity;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * @param {Array} rawCartItems - Array of {productId, quantity}
 * @param {Array} userCoords - [lon, lat]
 */
async function analyzeCart(rawCartItems, userCoords) {
    // We get original products to find alternatives
    const productIds = rawCartItems.map((i) => i.productId);
    const originalProducts = await Product.find({ _id: { $in: productIds } });

    const enrichedItems = [];
    const unavailableItems = [];

    for (const item of rawCartItems) {
        const origP = originalProducts.find(p => p._id.toString() === item.productId);
        if (!origP) {
            unavailableItems.push({ ...item, reason: 'Not found' });
            continue;
        }

        // Find alternatives by barcode or name
        const query = origP.barcode ? { barcode: origP.barcode } : { name: origP.name };
        query.stock = { $gte: item.quantity };
        query.isAvailable = true;

        const alternatives = await Product.find(query).populate('shopId');
        
        if (alternatives.length === 0) {
            unavailableItems.push({
                productId: origP._id.toString(),
                name: origP.name,
                image: origP.image,
                quantity: item.quantity,
                reason: 'Out of stock locally'
            });
            continue;
        }

        // Feature 2: Optimal Shop Selection
        // distance -> availability -> rating -> price
        let bestDistance = Infinity;
        let bestProduct = null;

        if (userCoords && userCoords.length === 2 && userCoords[0] !== 0) {
            // Sort by criteria
            alternatives.sort((a, b) => {
                const dA = getDistance(userCoords, a.shopId?.location?.coordinates);
                const dB = getDistance(userCoords, b.shopId?.location?.coordinates);
                
                // Compare distance
                // If diff > 2km, distance wins
                if (Math.abs(dA - dB) > 2) {
                    return dA - dB;
                }

                // If distance is similar, check rating
                const rA = a.shopId?.rating || 0;
                const rB = b.shopId?.rating || 0;
                if (rB !== rA) {
                    return rB - rA; // Higher rating first
                }

                // Then price
                return a.price - b.price;
            });
            bestProduct = alternatives[0];
            bestDistance = getDistance(userCoords, bestProduct.shopId?.location?.coordinates);
        } else {
            // Fallback if no user coord
            alternatives.sort((a, b) => {
                const rA = a.shopId?.rating || 0;
                const rB = b.shopId?.rating || 0;
                if (rB !== rA) return rB - rA;
                return a.price - b.price;
            });
            bestProduct = alternatives[0];
        }

        // Calculate delivery estimate based on distance 
        // 5 mins prep + (distance * 3 mins/km)
        let deliveryMins = 30; // default 
        if (bestDistance !== Infinity) {
            deliveryMins = 5 + Math.round(bestDistance * 3);
        }

        enrichedItems.push({
            productId: bestProduct._id.toString(),
            shopId: bestProduct.shopId._id.toString(),
            shopName: bestProduct.shopId.name,
            shopRating: bestProduct.shopId.rating,
            shopCoordinates: bestProduct.shopId.location?.coordinates || null,
            shopAddress: bestProduct.shopId.location?.address || '',
            name: bestProduct.name,
            price: bestProduct.price,
            quantity: item.quantity,
            image: bestProduct.image,
            deliveryMins
        });
    }

    // Build shop location lookup from enriched items (for route visualization)
    const shopLocMap = {};
    for (const item of enrichedItems) {
        if (item.shopCoordinates && !shopLocMap[item.shopId.toString()]) {
            shopLocMap[item.shopId.toString()] = {
                coordinates: item.shopCoordinates,
                address: item.shopAddress || ''
            };
        }
    }

    // Split using existing logic
    const shopGroups = cartSplitter(enrichedItems);
    
    // Add delivery estimate and shop location to groups
    for (const group of shopGroups) {
        let maxTime = 0;
        for(let item of group.items) {
           if (item.deliveryMins > maxTime) maxTime = item.deliveryMins;
        }
        group.deliveryEstimateMins = maxTime || 30;
        group.shopLocation = shopLocMap[group.shopId.toString()] || null;
    }

    // Subtotal and Fee Logic
    const subtotal = enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const platformFee = subtotal > 0 ? 5 : 0;
    // Basic delivery fee: maybe 29 per shop
    const deliveryFee = subtotal > 500 ? 0 : 29 * shopGroups.length; 
    const grandTotal = subtotal + platformFee + deliveryFee;

    // Feature 7/8: Cart Intelligence (Replacements / CrossSells)
    // We will do this via cartIntelligenceService
    
    return {
        shopGroups,
        unavailableItems, // those not added to any group
        totals: {
            subtotal,
            platformFee,
            deliveryFee,
            grandTotal
        }
    };
}

module.exports = {
    analyzeCart,
    getDistance
};
