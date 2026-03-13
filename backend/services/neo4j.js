const neo4j = require('neo4j-driver');
require('dotenv').config();

let driver;
const EMBEDDING_DIMENSION = 3072;

function isValidEmbedding(embedding) {
    return Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSION && embedding.every((v) => Number.isFinite(v));
}

const getDriver = () => {
    if (!driver) {
        driver = neo4j.driver(
            process.env.NEO4J_URI,
            neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
            { connectionTimeout: 3000, maxConnectionLifetime: 30000 }
        );
    }
    return driver;
};

// Create or update a product node with optional vector embedding
async function upsertProduct(productId, name, category, embedding = null) {
    const session = getDriver().session();
    try {
        const hasValidEmbedding = isValidEmbedding(embedding);

        if (embedding && !hasValidEmbedding) {
            console.warn(
                `Neo4j upsertProduct: invalid embedding for ${productId}. Expected ${EMBEDDING_DIMENSION}, got ${Array.isArray(embedding) ? embedding.length : 'non-array'}.`
            );
        }

        if (hasValidEmbedding) {
            await session.run(
                `MERGE (p:Product {id: $productId})
                 SET p.name = $name, p.category = $category, p.embedding = $embedding`,
                { productId, name, category, embedding }
            );
        } else {
            // Fallback for non-vectorized inserts
            await session.run(
                `MERGE (p:Product {id: $productId})
                 SET p.name = $name, p.category = $category`,
                { productId, name, category }
            );
        }
        return { ok: true, hasEmbedding: hasValidEmbedding };
    } catch (err) {
        console.error('Neo4j upsertProduct error:', err.message);
        return { ok: false, hasEmbedding: false, error: err.message };
    } finally {
        await session.close();
    }
}

async function getProductEmbeddingSize(productId) {
    const session = getDriver().session();
    try {
        const result = await session.run(
            `MATCH (p:Product {id: $productId})
             RETURN CASE WHEN p.embedding IS NULL THEN 0 ELSE size(p.embedding) END AS embeddingSize`,
            { productId }
        );
        if (!result.records.length) return null;
        return Number(result.records[0].get('embeddingSize'));
    } catch (err) {
        console.error('Neo4j getProductEmbeddingSize error:', err.message);
        return null;
    } finally {
        await session.close();
    }
}

// Initialize Vector Index for Semantic Search (3072 dimensions for gemini-embedding-001)
async function initVectorIndex() {
    const session = getDriver().session();
    try {
        // Drop index if it exists in case we change dimension sizes (ignoring error if it doesn't)
        try { await session.run(`DROP INDEX product_embeddings IF EXISTS`); } catch (e) { }

        // Create the vector index on Product.embedding
        await session.run(`
            CREATE VECTOR INDEX product_embeddings IF NOT EXISTS
            FOR (p:Product)
            ON (p.embedding)
            OPTIONS {indexConfig: {
                \`vector.dimensions\`: 3072,
                \`vector.similarity_function\`: 'cosine'
            }}
        `);
        console.log('Neo4j vector index initialized successfully.');
    } catch (err) {
        console.error('Neo4j initVectorIndex error:', err.message);
    } finally {
        await session.close();
    }
}

// Fallback: Compute cosine similarity in memory if Neo4j is deeply asleep or unreachable
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function fallbackSemanticSearch(queryVector, limit = 5, minScore = 0.55) {
    try {
        const Product = require('../models/Product');
        const products = await Product.find({ 'embedding.0': { $exists: true } }).select('_id name embedding').lean();

        let results = [];
        for (const p of products) {
            if (!p.embedding || p.embedding.length === 0) continue;
            const score = cosineSimilarity(queryVector, p.embedding);
            if (score >= minScore) {
                results.push({ id: p._id.toString(), name: p.name, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    } catch (e) {
        console.error('Fallback semantic search failed:', e.message);
        return [];
    }
}

// Perform Semantic Search via nearest neighbors (Cosine Similarity)
async function semanticSearch(queryVector, limit = 5, minScore = 0.55) {
    const session = getDriver().session();
    try {
        const result = await session.run(
            `CALL db.index.vector.queryNodes('product_embeddings', $limit, $queryVector)
             YIELD node, score
             WHERE score >= $minScore
             RETURN node.id AS id, node.name AS name, score
             ORDER BY score DESC`,
            { queryVector, limit: Number(limit), minScore: Number(minScore) }
        );

        return result.records.map((r) => ({
            id: r.get('id'),
            name: r.get('name'),
            score: r.get('score'),
        }));
    } catch (err) {
        console.warn('Neo4j semanticSearch unavailable. Falling back to in-memory cosine similarity:', err.message);
        return await fallbackSemanticSearch(queryVector, limit, minScore);
    } finally {
        await session.close();
    }
}

// Record BOUGHT_WITH relationships from a single order
async function recordBoughtTogether(productIds) {
    if (productIds.length < 2) return;
    const session = getDriver().session();
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
    const session = getDriver().session();
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
    const session = getDriver().session();
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

// Delete a product node and all its relationships from Neo4j
async function deleteProduct(productId) {
    const session = getDriver().session();
    try {
        await session.run(
            `MATCH (p:Product {id: $productId}) DETACH DELETE p`,
            { productId }
        );
    } catch (err) {
        console.warn('Neo4j deleteProduct error (non-fatal):', err.message);
    } finally {
        await session.close();
    }
}

async function closeDriver() {
    if (driver) { await driver.close(); driver = null; }
}

module.exports = { upsertProduct, deleteProduct, recordBoughtTogether, getSuggestions, seedSimilarByCategory, closeDriver, initVectorIndex, semanticSearch, createSimilarRelationship, isValidEmbedding, getProductEmbeddingSize, EMBEDDING_DIMENSION };
