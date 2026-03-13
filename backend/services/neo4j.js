const neo4j = require('neo4j-driver');
require('dotenv').config();

let driver;
const EMBEDDING_DIMENSION = 3072;
let productIdConstraintAttempted = false;

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

async function ensureProductIdConstraint(session) {
    if (productIdConstraintAttempted) return;

    try {
        await session.run(
            `CREATE CONSTRAINT product_id_unique IF NOT EXISTS
             FOR (p:Product)
             REQUIRE p.id IS UNIQUE`
        );
    } catch (err) {
        // Non-fatal: recommendation reads/writes can still continue.
        console.warn('Neo4j ensureProductIdConstraint warning:', err.message);
    } finally {
        productIdConstraintAttempted = true;
    }
}

function normalizeTokens(text = '') {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1);
}

function jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    if (!setA.size || !setB.size) return 0;

    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection += 1;
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

function weightedSimilarity(signals) {
    let numerator = 0;
    let denominator = 0;

    for (const signal of signals) {
        if (typeof signal.value === 'number' && Number.isFinite(signal.value)) {
            numerator += signal.value * signal.weight;
            denominator += signal.weight;
        }
    }

    return denominator > 0 ? numerator / denominator : 0;
}

// Create or update a product node with optional vector embedding
async function upsertProduct(productId, name, category, embedding = null, metadata = {}) {
    const session = getDriver().session();
    try {
        await ensureProductIdConstraint(session);
        const hasValidEmbedding = isValidEmbedding(embedding);

        if (embedding && !hasValidEmbedding) {
            console.warn(
                `Neo4j upsertProduct: invalid embedding for ${productId}. Expected ${EMBEDDING_DIMENSION}, got ${Array.isArray(embedding) ? embedding.length : 'non-array'}.`
            );
        }

        if (hasValidEmbedding) {
            await session.run(
                `MERGE (p:Product {id: $productId})
                 SET p.name = $name,
                     p.category = $category,
                     p.embedding = $embedding,
                     p.updatedAt = datetime(),
                     p.price = CASE WHEN $price IS NULL THEN p.price ELSE $price END,
                     p.salesCount = CASE WHEN $salesCount IS NULL THEN COALESCE(p.salesCount, 0) ELSE $salesCount END`,
                {
                    productId,
                    name,
                    category,
                    embedding,
                    price: Number.isFinite(metadata.price) ? Number(metadata.price) : null,
                    salesCount: Number.isFinite(metadata.salesCount) ? Number(metadata.salesCount) : null,
                }
            );
        } else {
            // Fallback for non-vectorized inserts
            await session.run(
                `MERGE (p:Product {id: $productId})
                 SET p.name = $name,
                     p.category = $category,
                     p.updatedAt = datetime(),
                     p.price = CASE WHEN $price IS NULL THEN p.price ELSE $price END,
                     p.salesCount = CASE WHEN $salesCount IS NULL THEN COALESCE(p.salesCount, 0) ELSE $salesCount END`,
                {
                    productId,
                    name,
                    category,
                    price: Number.isFinite(metadata.price) ? Number(metadata.price) : null,
                    salesCount: Number.isFinite(metadata.salesCount) ? Number(metadata.salesCount) : null,
                }
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
        await ensureProductIdConstraint(session);
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
        await ensureProductIdConstraint(session);
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
        await ensureProductIdConstraint(session);
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
async function recordBoughtTogether(productIds, productsMeta = []) {
    const uniqueProductIds = [...new Set((productIds || []).map((id) => String(id)).filter(Boolean))];
    if (uniqueProductIds.length < 2) return;

    const session = getDriver().session();
    try {
        await ensureProductIdConstraint(session);
        const metaById = new Map((productsMeta || []).map((p) => [String(p.id), p]));

        // Ensure all product nodes exist
        for (const id of uniqueProductIds) {
            const meta = metaById.get(id) || {};
            await session.run(
                `MERGE (p:Product {id: $id})
                 SET p.name = CASE WHEN $name IS NULL OR $name = '' THEN p.name ELSE $name END,
                     p.category = CASE WHEN $category IS NULL OR $category = '' THEN p.category ELSE $category END,
                     p.updatedAt = datetime(),
                     p.salesCount = COALESCE(p.salesCount, 0)`,
                {
                    id,
                    name: meta.name || null,
                    category: meta.category || null,
                }
            );
        }

        // Create BOUGHT_WITH relationships between all pairs
        for (let i = 0; i < uniqueProductIds.length; i++) {
            for (let j = i + 1; j < uniqueProductIds.length; j++) {
                await session.run(
                    `MATCH (a:Product {id: $a}), (b:Product {id: $b})
           MERGE (a)-[r:BOUGHT_WITH]-(b)
           ON CREATE SET r.count = 1, r.weight = 1.0, r.createdAt = datetime(), r.updatedAt = datetime()
           ON MATCH SET r.count = COALESCE(r.count, 0) + 1,
                        r.weight = toFloat(COALESCE(r.count, 0) + 1),
                        r.updatedAt = datetime()`,
                    { a: uniqueProductIds[i], b: uniqueProductIds[j] }
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
async function createSimilarRelationship(productIdA, productIdB, similarity = {}) {
    if (!productIdA || !productIdB || String(productIdA) === String(productIdB)) return;

    const session = getDriver().session();
    try {
        await ensureProductIdConstraint(session);
        await session.run(
            `MATCH (a:Product {id: $a}), (b:Product {id: $b})
       MERGE (a)-[r:SIMILAR_TO]-(b)
       ON CREATE SET r.createdAt = datetime()
       SET r.updatedAt = datetime(),
           r.score = $score,
           r.categoryScore = $categoryScore,
           r.nameScore = $nameScore,
           r.embeddingScore = $embeddingScore`,
            {
                a: String(productIdA),
                b: String(productIdB),
                score: Number.isFinite(similarity.score) ? Number(similarity.score) : 0,
                categoryScore: Number.isFinite(similarity.categoryScore) ? Number(similarity.categoryScore) : 0,
                nameScore: Number.isFinite(similarity.nameScore) ? Number(similarity.nameScore) : 0,
                embeddingScore: Number.isFinite(similarity.embeddingScore) ? Number(similarity.embeddingScore) : 0,
            }
        );
    } catch (err) {
        console.error('Neo4j createSimilarRelationship error:', err.message);
    } finally {
        await session.close();
    }
}

async function refreshSimilarRelationships(productId, options = {}) {
    const Product = require('../models/Product');
    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 10;
    const minSimilarity = Number.isFinite(options.minSimilarity) ? Number(options.minSimilarity) : 0.42;

    const target = await Product.findById(productId)
        .select('_id name category embedding isAvailable stock price salesCount')
        .lean();

    if (!target) return { ok: false, reason: 'target-not-found', linked: 0 };

    const targetTokens = normalizeTokens(target.name);
    const keyword = targetTokens.find((t) => t.length >= 3) || null;
    const candidateFilter = {
        _id: { $ne: target._id },
        isAvailable: true,
        stock: { $gt: 0 },
        $or: [
            { category: target.category },
            ...(keyword ? [{ name: { $regex: keyword, $options: 'i' } }] : []),
        ],
    };

    const candidates = await Product.find(candidateFilter)
        .select('_id name category embedding salesCount price')
        .limit(180)
        .lean();

    const scored = [];
    for (const candidate of candidates) {
        const categoryScore = candidate.category === target.category ? 1 : 0;
        const nameScore = jaccardSimilarity(targetTokens, normalizeTokens(candidate.name));
        const embeddingScore =
            isValidEmbedding(target.embedding) && isValidEmbedding(candidate.embedding)
                ? cosineSimilarity(target.embedding, candidate.embedding)
                : null;

        const score = weightedSimilarity([
            { value: embeddingScore, weight: 0.56 },
            { value: categoryScore, weight: 0.24 },
            { value: nameScore, weight: 0.20 },
        ]);

        if (score >= minSimilarity) {
            scored.push({
                id: String(candidate._id),
                score,
                categoryScore,
                nameScore,
                embeddingScore: embeddingScore === null ? 0 : embeddingScore,
            });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, limit);

    for (const item of selected) {
        await createSimilarRelationship(String(target._id), item.id, item);
    }

    return { ok: true, linked: selected.length };
}

async function incrementProductSales(productId, incrementBy = 1) {
    const session = getDriver().session();
    try {
        await ensureProductIdConstraint(session);
        await session.run(
            `MERGE (p:Product {id: $productId})
             ON CREATE SET p.salesCount = 0, p.createdAt = datetime(), p.updatedAt = datetime()
             SET p.salesCount = COALESCE(p.salesCount, 0) + $incrementBy,
                 p.updatedAt = datetime()`,
            {
                productId: String(productId),
                incrementBy: Number.isFinite(incrementBy) ? Number(incrementBy) : 1,
            }
        );
    } catch (err) {
        console.warn('Neo4j incrementProductSales error (non-fatal):', err.message);
    } finally {
        await session.close();
    }
}

// Get suggestions for a product (SIMILAR_TO + BOUGHT_WITH)
async function getSuggestions(productId) {
    const session = getDriver().session();
    try {
        await ensureProductIdConstraint(session);
        const result = await session.run(
            `MATCH (p:Product {id: $productId})
             OPTIONAL MATCH (p)-[bw:BOUGHT_WITH]-(bwRec:Product)
             WITH p, collect({
               id: bwRec.id,
               name: bwRec.name,
               bw: toFloat(COALESCE(bw.weight, bw.count, 0)),
               sim: 0.0,
               sales: toFloat(COALESCE(bwRec.salesCount, 0))
             }) AS rows
             OPTIONAL MATCH (p)-[sim:SIMILAR_TO]-(simRec:Product)
                         WITH rows, collect({
               id: simRec.id,
               name: simRec.name,
               bw: 0.0,
               sim: toFloat(COALESCE(sim.score, sim.embeddingScore, sim.nameScore, sim.categoryScore, 0)),
               sales: toFloat(COALESCE(simRec.salesCount, 0))
                         }) AS simRows
                         WITH rows + simRows AS allRows
             UNWIND allRows AS row
             WITH row
             WHERE row.id IS NOT NULL AND row.id <> $productId
             WITH row.id AS id,
                  max(row.name) AS name,
                  sum(row.bw) AS boughtWithWeight,
                  max(row.sim) AS similarWeight,
                  max(row.sales) AS salesCount
             WITH id, name, boughtWithWeight, similarWeight, salesCount,
                  (boughtWithWeight * 1.45) + (similarWeight * 3.20) + (log10(salesCount + 1.0) * 0.45) AS totalScore
             RETURN id,
                    name,
                    boughtWithWeight,
                    similarWeight,
                    salesCount,
                    totalScore
             ORDER BY totalScore DESC
                  LIMIT toInteger($limit)`,
            { productId: String(productId), limit: 12 }
        );
        return result.records.map((r) => ({
            id: r.get('id'),
            name: r.get('name'),
            relationship: Number(r.get('boughtWithWeight')) > 0 ? 'BOUGHT_WITH' : 'SIMILAR_TO',
            weight: Number(r.get('totalScore')),
            boughtWithWeight: Number(r.get('boughtWithWeight')),
            similarWeight: Number(r.get('similarWeight')),
            salesCount: Number(r.get('salesCount')),
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
                await createSimilarRelationship(ids[i], ids[j], { score: 0.6, categoryScore: 1, nameScore: 0, embeddingScore: 0 });
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

module.exports = {
    upsertProduct,
    deleteProduct,
    recordBoughtTogether,
    getSuggestions,
    seedSimilarByCategory,
    closeDriver,
    initVectorIndex,
    semanticSearch,
    createSimilarRelationship,
    refreshSimilarRelationships,
    incrementProductSales,
    isValidEmbedding,
    getProductEmbeddingSize,
    EMBEDDING_DIMENSION,
};
