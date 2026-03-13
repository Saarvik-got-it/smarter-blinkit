require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const neo4j = require('neo4j-driver');
const neo4jService = require('../services/neo4j');

async function graphDiagnostics(driver) {
    const session = driver.session();
    try {
        const countProducts = await session.run('MATCH (p:Product) RETURN count(p) AS c');
        const countRels = await session.run('MATCH (:Product)-[r]->(:Product) RETURN type(r) AS t, count(r) AS c ORDER BY c DESC');
        const missingProps = await session.run('MATCH (p:Product) WHERE p.id IS NULL OR p.name IS NULL OR p.category IS NULL RETURN count(p) AS c');

        return {
            productCount: Number(countProducts.records[0].get('c')),
            relationshipCounts: countRels.records.map((r) => ({ type: r.get('t'), count: Number(r.get('c')) })),
            missingCorePropsCount: Number(missingProps.records[0].get('c')),
        };
    } finally {
        await session.close();
    }
}

async function main() {
    let driver;
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        driver = neo4j.driver(
            process.env.NEO4J_URI,
            neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
        );

        const products = await Product.find({})
            .select('_id name category embedding price salesCount isAvailable stock')
            .lean();

        console.log(`Mongo products to process: ${products.length}`);

        const before = await graphDiagnostics(driver);
        console.log('Graph BEFORE repair:', before);

        let upserted = 0;
        let similarLinked = 0;

        for (const [index, product] of products.entries()) {
            await neo4jService.upsertProduct(
                String(product._id),
                product.name,
                product.category,
                product.embedding,
                {
                    price: product.price,
                    salesCount: product.salesCount || 0,
                }
            );
            upserted += 1;

            if (product.isAvailable && product.stock > 0) {
                const rel = await neo4jService.refreshSimilarRelationships(String(product._id), {
                    limit: 10,
                    minSimilarity: 0.42,
                });
                similarLinked += rel.linked || 0;
            }

            if ((index + 1) % 50 === 0) {
                console.log(`Processed ${index + 1}/${products.length} products...`);
            }
        }

        const after = await graphDiagnostics(driver);
        console.log('Graph AFTER repair:', after);
        console.log('Repair summary:', {
            upserted,
            similarLinksRefreshed: similarLinked,
        });
    } catch (err) {
        console.error('repair_recommendation_graph failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        await neo4jService.closeDriver();
        if (driver) await driver.close();
    }
}

main();
