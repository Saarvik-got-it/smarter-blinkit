/**
 * Cart Splitter Service
 * Groups cart items by shop and calculates per-shop subtotals
 * for the Smart Cart Splitting feature (Stage 3)
 */

function cartSplitter(items) {
    const shopMap = {};

    for (const item of items) {
        const shopId = item.shopId.toString();
        if (!shopMap[shopId]) {
            shopMap[shopId] = {
                shopId: item.shopId,
                shopName: item.shopName || '',
                items: [],
                subtotal: 0,
                status: 'pending',
            };
        }
        shopMap[shopId].items.push(item);
        shopMap[shopId].subtotal += item.price * item.quantity;
    }

    return Object.values(shopMap);
}

module.exports = cartSplitter;
