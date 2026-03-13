const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const { protect, requireRole } = require('../middleware/auth');
const neo4jService = require('../services/neo4j');
const { HfInference } = require('@huggingface/inference');

const hf = process.env.HF_TOKEN ? new HfInference(process.env.HF_TOKEN) : null;

const aiRouter = require('../services/aiRouter');

const router = express.Router();
// Kept for embeddings only — text generation goes through aiRouter
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const INTENT_SEMANTIC_LIMIT = 12;
const INTENT_SEMANTIC_MIN_SCORE = 0.78;
const RECIPE_SEMANTIC_LIMIT = 8;
const RECIPE_SEMANTIC_MIN_SCORE = 0.78;

// ─────────────────────────────────────────────
// Shared helper: generate Gemini text-embedding-004
// ─────────────────────────────────────────────
async function generateEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (err) {
        console.warn('Gemini generateEmbedding failed. Falling back to Hugging Face...');
        console.warn('Gemini generateEmbedding failed. Cannot use Hugging Face for vectors without dimension mismatch. Returning null for Regex fallback...');
        return null;
    }
}

// ─────────────────────────────────────────────
// Shared helper: regex search for a single keyword across product fields
// Uses regex (not $text) so partial/multi-word terms like "ginger tea" work correctly
// ─────────────────────────────────────────────
async function searchByKeyword(kw, limit = 6, filters = {}) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');

    let query = {
        $or: [{ name: rx }, { description: rx }, { category: rx }, { barcode: rx }],
        isAvailable: true,
        stock: { $gt: 0 },
    };

    // Support comma-separated shopId values
    if (filters.shopId) {
        const ids = filters.shopId.split(',').map(s => s.trim()).filter(Boolean);
        const { Types } = require('mongoose');
        if (ids.length === 1) {
            query.shopId = ids[0];
        } else if (ids.length > 1) {
            query.shopId = { $in: ids.map(id => new Types.ObjectId(id)) };
        }
    }
    if (filters.lat && filters.lng && filters.nearbyOnly) {
        query.location = {
            $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(filters.lng), parseFloat(filters.lat)] },
                $maxDistance: 50000
            }
        };
    }

    return Product.find(query)
        .populate('shopId', 'name location rating')
        .sort({ salesCount: -1 })
        .limit(limit);
}

// POST /api/ai/recipe-agent — "Make pizza for 4 people" → cart items
router.post('/recipe-agent', protect, requireRole('buyer'), async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'Prompt is required' });

        let ingredients = [];
        let usedFallback = false;
        let modelUsed = null;

        // --- Try Gemini via multi-model router (auto-fallback across models) ---
        try {
            const systemPrompt = `You are a smart grocery shopping assistant. 
The user will describe a meal, recipe, or need in natural language.
Extract a list of grocery items with quantities needed.
Respond ONLY with a valid JSON array (no markdown, no explanation) in this exact format:
[
  { "item": "flour", "packsToBuy": 1, "amountText": "2 kg", "searchQuery": "wheat flour" },
  { "item": "cheese", "packsToBuy": 1, "amountText": "200 g", "searchQuery": "mozzarella cheese" }
]
Rules:
- Keep searchQuery simple (1-3 words) for product catalog search
- packsToBuy must be an integer (how many standard retail packages to add to cart)
- amountText should be the textual quantity required (e.g. "500g", "2 pieces")
- If the request is not food/grocery related, return an empty array []`;

            const { text, modelUsed: m } = await aiRouter.generateText([systemPrompt, `User request: ${prompt}`]);
            modelUsed = m;
            const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
            ingredients = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch (aiErr) {
            // ALL Gemini models exhausted — fallback to HF then regex
            const isRateLimit = aiErr.message?.includes('429') || aiErr.message?.includes('quota') || aiErr.message?.includes('Too Many Requests');
            console.warn(`AI recipe-agent fallback (${isRateLimit ? 'rate-limit' : 'error'}):`, aiErr.message?.slice(0, 80));
            usedFallback = true;

            if (hf) {
                try {
                    console.log('Using Hugging Face fallback for Recipe Agent...');
                    const result = await hf.chatCompletion({
                        model: 'Qwen/Qwen2.5-72B-Instruct',
                        messages: [
                            { role: 'system', content: 'You extract grocery ingredients from user meal requests. Reply ONLY with a valid JSON array of objects. Example: [{"item":"flour","packsToBuy":1,"amountText":"1kg","searchQuery":"flour"}]. No markdown.' },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 200,
                    });
                    const text = result.choices[0].message.content.trim();
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) ingredients = JSON.parse(jsonMatch[0]);
                } catch (hfErr) {
                    console.error('Hugging Face fallback failed:', hfErr.message);
                }
            }

            if (!ingredients || !ingredients.length) {
                // Extract meaningful words from prompt as search queries
                const stopWords = new Set(['make', 'for', 'people', 'i', 'a', 'the', 'and', 'with', 'some', 'need', 'want', 'prepare', 'cook', 'please', 'me', 'us', 'my', 'have', 'get', 'find', 'give', 'some', 'how']);
                const words = prompt.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
                ingredients = words.slice(0, 6).map(w => ({ item: w, packsToBuy: 1, amountText: '1 pack', searchQuery: w }));
            }
        }

        if (!ingredients.length) {
            return res.json({ success: true, ingredients: [], cartItems: [], notFound: [], fallback: usedFallback });
        }

        // Find matching products for each ingredient
        const cartItems = [];
        const notFound = [];

        for (const ingredient of ingredients) {
            // ✅ Use regex search FIRST for exact ingredient matches (prevents weird semantic substitutions)
            let products = await searchByKeyword(ingredient.searchQuery, 3, req.body);

            // Fallback to highly-confident semantic vector search if no exact text match exists
            if (!products.length) {
                const queryVector = await generateEmbedding(ingredient.searchQuery);
                if (queryVector) {
                    const semanticResults = await neo4jService.semanticSearch(queryVector, RECIPE_SEMANTIC_LIMIT, RECIPE_SEMANTIC_MIN_SCORE);
                    console.log(`[AI Recipe] ingredient="${ingredient.searchQuery}" semanticHits=${semanticResults.length} threshold=${RECIPE_SEMANTIC_MIN_SCORE}`);
                    const productIds = semanticResults.map(r => r.id);
                    let q = {
                        _id: { $in: productIds },
                        isAvailable: true,
                        stock: { $gt: 0 }
                    };
                    // Support comma-separated shopIds
                    if (req.body.shopId) {
                        const mongoose = require('mongoose');
                        const ids = req.body.shopId.split(',').map(s => s.trim()).filter(Boolean);
                        q.shopId = ids.length === 1 ? ids[0] : { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
                    }
                    if (req.body.lat && req.body.lng && req.body.nearbyOnly === true) {
                        q.location = {
                            $near: {
                                $geometry: { type: 'Point', coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)] },
                                $maxDistance: 50000
                            }
                        };
                    }
                    products = await Product.find(q).populate('shopId', 'name location rating');

                    // Sort to match the Neo4j semantic similarity score order
                    products.sort((a, b) => productIds.indexOf(a._id.toString()) - productIds.indexOf(b._id.toString()));
                }
            }

            if (products.length) {
                cartItems.push({
                    ingredient,
                    bestMatch: products[0],
                    alternatives: products.slice(1),
                    suggestedQuantity: ingredient.packsToBuy,
                    addToCart: true,
                });
            } else {
                notFound.push(ingredient);
            }
        }

        res.json({ success: true, prompt, ingredients, cartItems, notFound, fallback: usedFallback, modelUsed });
    } catch (err) {
        console.error('Critical AI recipe agent error:', err);
        // Guarantee no 500 error toast on the frontend
        res.json({ success: true, prompt: req.body.prompt, ingredients: [], cartItems: [], notFound: [], fallback: true });
    }
});

// POST /api/ai/intent-search — semantic "I have a cold" → relevant products
router.post('/intent-search', async (req, res) => {
    try {
        const { query, lat, lng, nearbyOnly, shopId } = req.body;
        if (!query) return res.status(400).json({ success: false, message: 'Query required' });

        let keywords = [];
        let usedFallback = false;
        let modelUsed = null;

        // --- Try Gemini via multi-model router (auto-fallback across models) ---
        try {
            const searchPrompt = `You are a smart search assistant for a grocery/pharmacy/daily needs marketplace.
Expand the following user query into specific product keywords to search for.
Respond ONLY with a valid JSON array of strings (max 8 keywords), no markdown:
["keyword1", "keyword2", ...]

Examples:
"I have a cold" → ["honey", "ginger tea", "lemon", "vitamin c", "cough syrup", "tulsi tea"]
"movie night" → ["popcorn", "chips", "cola", "nachos", "chocolate"]
"healthy breakfast" → ["oats", "granola", "milk", "banana", "eggs", "whole wheat bread"]

User query: "${query}"`;
            const { text, modelUsed: m } = await aiRouter.generateText(searchPrompt);
            modelUsed = m;
            const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
            keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [query];
        } catch (aiErr) {
            // ALL Gemini models exhausted — fallback to HF then regex
            console.warn('AI Router: all models exhausted for intent-search:', aiErr.message?.slice(0, 80));
            usedFallback = true;

            if (hf) {
                try {
                    console.log('Using Hugging Face fallback for Intent Search...');
                    const result = await hf.chatCompletion({
                        model: 'Qwen/Qwen2.5-72B-Instruct',
                        messages: [
                            { role: 'system', content: 'Expand user query into specific grocery items. Reply ONLY with a valid JSON array of strings, max 8. Example: ["honey", "ginger tea"]. NO markdown formatting, NO backticks. NO explanations.' },
                            { role: 'user', content: query }
                        ],
                        max_tokens: 150,
                    });

                    let textResult = result.choices[0].message.content.trim();
                    // Clean up potential markdown formatting the LLM might hallucinate
                    textResult = textResult.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

                    const jsonMatch = textResult.match(/\[[\s\S]*\]/);
                    if (jsonMatch) keywords = JSON.parse(jsonMatch[0]);
                } catch (hfErr) {
                    console.error('Hugging Face fallback failed:', hfErr.message);
                }
            }

            if (!keywords || !keywords.length) {
                keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            }
            if (!keywords || !keywords.length) keywords = [query];
        }

        const productMatchMap = new Map();

        // 1. Try vector search
        const queryVector = await generateEmbedding(query);
        if (queryVector) {
            const semanticResults = await neo4jService.semanticSearch(queryVector, INTENT_SEMANTIC_LIMIT, INTENT_SEMANTIC_MIN_SCORE);
            const productIds = semanticResults.map(r => r.id);
            const semanticMetaById = new Map(semanticResults.map((r, index) => [r.id, { score: Number(r.score), rank: index }]));
            console.log(`[AI Intent] query="${query}" semanticHits=${semanticResults.length} threshold=${INTENT_SEMANTIC_MIN_SCORE}`);

            let queryObj = { _id: { $in: productIds }, isAvailable: true, stock: { $gt: 0 } };

            // Apply filters — support comma-separated shopIds
            if (shopId) {
                const mongoose = require('mongoose');
                const ids = shopId.split(',').map(s => s.trim()).filter(Boolean);
                queryObj.shopId = ids.length === 1 ? ids[0] : { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
            }
            if (lat && lng && nearbyOnly === true) {
                queryObj.location = {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                        $maxDistance: 50000 // 50km for AI intent
                    }
                };
            }

            const products = await Product.find(queryObj).populate('shopId', 'name location rating');

            for (const p of products) {
                const id = p._id.toString();
                const meta = semanticMetaById.get(id);
                const semanticBoost = meta ? Math.max(1, 3 - Math.floor(meta.rank / 4)) : 1; // ranks 1-4 => 3, 5-8 => 2, 9-12 => 1
                productMatchMap.set(id, {
                    product: p,
                    matchedKeyword: 'Semantic Match',
                    count: semanticBoost,
                    semanticScore: meta ? meta.score : 0,
                });
            }
        }

        // 2. keyword boosts — intentionally excludes `description` to avoid false positives
        // from ingredient lists/nutritional text in product descriptions (e.g. "ginger" matching
        // a chutney sauce when searching "I have a cold").
        for (const kw of keywords) {
            let kwQuery = {
                $or: [{ name: new RegExp(kw, 'i') }, { category: new RegExp(kw, 'i') }],
                isAvailable: true,
                stock: { $gt: 0 }
            };

            if (shopId) {
                const mongoose = require('mongoose');
                const ids = shopId.split(',').map(s => s.trim()).filter(Boolean);
                kwQuery.shopId = ids.length === 1 ? ids[0] : { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
            }
            if (lat && lng && nearbyOnly === true) {
                kwQuery.location = {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                        $maxDistance: 50000
                    }
                };
            }

            const products = await Product.find(kwQuery).populate('shopId', 'name location rating').limit(20);
            for (const p of products) {
                const id = p._id.toString();
                if (productMatchMap.has(id)) {
                    productMatchMap.get(id).count++;
                } else {
                    productMatchMap.set(id, { product: p, matchedKeyword: kw, count: 1 });
                }
            }
        }

        const results = Array.from(productMatchMap.values())
            .sort((a, b) => b.count - a.count || (b.semanticScore || 0) - (a.semanticScore || 0) || (b.product.salesCount || 0) - (a.product.salesCount || 0));

        res.json({ success: true, query, expandedKeywords: keywords, count: results.length, results, fallback: usedFallback, modelUsed: modelUsed || null });
    } catch (err) {
        console.error('Critical intent search error:', err);
        res.json({ success: true, query: req.body.query, expandedKeywords: [], count: 0, results: [], fallback: true });
    }
});

module.exports = router;
