const neo4jService = require('./neo4j');
const Product = require('../models/Product');

/**
 * Get product replacements for an unavailable item
 * Uses Neo4j SIMILAR_TO relationships or fallback.
 */
async function getReplacements(productId) {
    if (!productId) return [];
    
    try {
        const query = `
            MATCH (p:Product {id: $productId})-[:SIMILAR_TO]->(similar:Product)
            RETURN similar.id AS similarId
            LIMIT 3
        `;
        const result = await neo4jService.read(query, { productId: productId.toString() });
        const objIds = result.map(record => record.get('similarId'));
        
        if (objIds.length === 0) return [];
        
        return await Product.find({ _id: { $in: objIds }, stock: {$gt: 0}, isAvailable: true }).select('name price image');
    } catch (err) {
        console.error('CartIntelligence getReplacements error:', err);
        return [];
    }
}

/**
 * Get cross-sell suggestions based on items in cart
 * Uses Neo4j BOUGHT_WITH relationships.
 */
async function getCrossSells(productIdsArray) {
    if (!productIdsArray || productIdsArray.length === 0) return [];
    
    try {
        const query = `
            MATCH (p:Product)-[r:BOUGHT_WITH]->(rec:Product)
            WHERE p.id IN $productIds AND NOT rec.id IN $productIds
            RETURN rec.id AS recommendedId, SUM(r.weight) AS score
            ORDER BY score DESC
            LIMIT 5
        `;
        const result = await neo4jService.read(query, { productIds: productIdsArray.map(id => id.toString()) });
        
        const recIds = result.map(record => record.get('recommendedId'));
        if (recIds.length === 0) return [];

        return await Product.find({ _id: { $in: recIds }, stock: {$gt: 0}, isAvailable: true }).select('name price image category');
    } catch (err) {
        console.error('CartIntelligence getCrossSells error:', err);
        return [];
    }
}

module.exports = {
    getReplacements,
    getCrossSells
};
