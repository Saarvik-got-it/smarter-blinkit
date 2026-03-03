const neo4j = require('neo4j-driver');
require('dotenv').config();

let driver;

const getDriver = () => {
    if (!driver) {
        driver = neo4j.driver(
            process.env.NEO4J_URI,
            neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
        );
    }
    return driver;
};

// Create or update a product node
async function upsertProduct(productId, name, category) {
    const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
    try {
        await session.run(
            `MERGE (p:Product {id: $productId})
       SET p.name = $name, p.category = $category`,
            { productId, name, category }
        );
    } catch (err) {
        console.error('Neo4j upsertProduct error:', err.message);
    } finally {
        await session.close();
    }
}

// Record BOUGHT_WITH relationships from a single order
async function recordBoughtTogether(productIds) {
    if (productIds.length < 2) return;
    const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
    try {
        // Ensure all product nodes exist
        for (const id of productIds) {
            await session.run(`MERGE (p:Product {id: $id})`, { id });
        }
        // Create BOUGHT_WITH relationships between all pairs
        for (let i = 0; i < productIds.length; i++) {
            for (let j = i + 1; j < productIds.length; j++) {
                await session.run(
                    `MATCH (a:Product {id: $a}), (b:Product {id: $b})
           MERGE (a)-[r:BOUGHT_WITH]-(b)
           ON CREATE SET r.count = 1
           ON MATCH SET r.count = r.count + 1`,
                    { a: productIds[i], b: productIds[j] }
                );
            }
        }
    } catch (err) {
        console.error('Neo4j recordBoughtTogether error:', err.message);
    } finally {
        await session.close();
    }
}

// Create SIMILAR_TO relationship
async function createSimilarRelationship(productIdA, productIdB) {
    const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
    try {
        await session.run(
            `MATCH (a:Product {id: $a}), (b:Product {id: $b})
       MERGE (a)-[:SIMILAR_TO]-(b)`,
            { a: productIdA, b: productIdB }
        );
    } catch (err) {
        console.error('Neo4j createSimilarRelationship error:', err.message);
    } finally {
        await session.close();
    }
}

// Get suggestions for a product (SIMILAR_TO + BOUGHT_WITH)
async function getSuggestions(productId) {
    const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
    try {
        const result = await session.run(
            `MATCH (p:Product {id: $productId})-[r:BOUGHT_WITH|SIMILAR_TO]-(suggested:Product)
       WITH suggested, type(r) as relType, COALESCE(r.count, 1) as weight
       RETURN suggested.id as id, suggested.name as name,
              relType, weight
       ORDER BY weight DESC
       LIMIT 10`,
            { productId }
        );
        return result.records.map((r) => ({
            id: r.get('id'),
            name: r.get('name'),
            relationship: r.get('relType'),
            weight: r.get('weight').toNumber ? r.get('weight').toNumber() : r.get('weight'),
        }));
    } catch (err) {
        console.error('Neo4j getSuggestions error:', err.message);
        return [];
    } finally {
        await session.close();
    }
}

// Seed similar products by category
async function seedSimilarByCategory(products) {
    const byCategory = {};
    for (const p of products) {
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p._id.toString());
        await upsertProduct(p._id.toString(), p.name, p.category);
    }
    for (const [, ids] of Object.entries(byCategory)) {
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length && j < i + 4; j++) {
                await createSimilarRelationship(ids[i], ids[j]);
            }
        }
    }
}

async function closeDriver() {
    if (driver) { await driver.close(); driver = null; }
}

module.exports = { upsertProduct, recordBoughtTogether, getSuggestions, seedSimilarByCategory, closeDriver };
