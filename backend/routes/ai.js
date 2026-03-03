const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/ai/recipe-agent — "Make pizza for 4 people" → cart items
router.post('/recipe-agent', protect, requireRole('buyer'), async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'Prompt is required' });

        let ingredients = [];
        let usedFallback = false;

        // --- Try Gemini first ---
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const systemPrompt = `You are a smart grocery shopping assistant. 
The user will describe a meal, recipe, or need in natural language.
Extract a list of grocery items with quantities needed.
Respond ONLY with a valid JSON array (no markdown, no explanation) in this exact format:
[
  { "item": "flour", "quantity": 2, "unit": "kg", "searchQuery": "wheat flour" },
  { "item": "cheese", "quantity": 200, "unit": "g", "searchQuery": "mozzarella cheese" }
]
Rules:
- Keep searchQuery simple (1-3 words) for product catalog search
- Use common grocery units: kg, g, litre, ml, piece, pack, dozen
- If quantity is unclear, use a reasonable default
- If the request is not food/grocery related, return an empty array []`;

            const result = await model.generateContent([systemPrompt, `User request: ${prompt}`]);
            const text = result.response.text().trim();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            ingredients = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch (aiErr) {
            // 429 rate limit or any Gemini error — fallback to keyword extraction from prompt
            const isRateLimit = aiErr.message?.includes('429') || aiErr.message?.includes('quota') || aiErr.message?.includes('Too Many Requests');
            console.warn(`AI recipe-agent fallback (${isRateLimit ? 'rate-limit' : 'error'}):`, aiErr.message?.slice(0, 80));
            usedFallback = true;

            // Extract meaningful words from prompt as search queries
            const stopWords = new Set(['make', 'for', 'people', 'i', 'a', 'the', 'and', 'with', 'some', 'need', 'want', 'prepare', 'cook', 'please', 'me', 'us', 'my', 'have', 'get', 'find', 'give', 'some', 'how']);
            const words = prompt.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
            ingredients = words.slice(0, 6).map(w => ({ item: w, quantity: 1, unit: 'piece', searchQuery: w }));
        }

        if (!ingredients.length) {
            return res.json({ success: true, ingredients: [], cartItems: [], notFound: [], fallback: usedFallback });
        }

        // Find matching products for each ingredient
        const cartItems = [];
        const notFound = [];

        for (const ingredient of ingredients) {
            const products = await Product.find({
                $text: { $search: ingredient.searchQuery },
                isAvailable: true,
                stock: { $gt: 0 },
            })
                .populate('shopId', 'name location')
                .limit(3);

            if (products.length) {
                cartItems.push({
                    ingredient,
                    bestMatch: products[0],
                    alternatives: products.slice(1),
                    suggestedQuantity: ingredient.quantity,
                    addToCart: true,
                });
            } else {
                notFound.push(ingredient);
            }
        }

        res.json({ success: true, prompt, ingredients, cartItems, notFound, fallback: usedFallback });
    } catch (err) {
        console.error('Critical AI recipe agent error:', err);
        // Guarantee no 500 error toast on the frontend
        res.json({ success: true, prompt: req.body.prompt, ingredients: [], cartItems: [], notFound: [], fallback: true });
    }
});

// POST /api/ai/intent-search — semantic "I have a cold" → relevant products
router.post('/intent-search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ success: false, message: 'Query required' });

        let keywords = [];
        let usedFallback = false;

        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const searchPrompt = `You are a smart search assistant for a grocery/pharmacy/daily needs marketplace.
Expand the following user query into specific product keywords to search for.
Respond ONLY with a valid JSON array of strings (max 8 keywords), no markdown:
["keyword1", "keyword2", ...]

Examples:
"I have a cold" → ["honey", "ginger tea", "lemon", "vitamin c", "cough syrup", "tulsi tea"]
"movie night" → ["popcorn", "chips", "cola", "nachos", "chocolate"]
"healthy breakfast" → ["oats", "granola", "milk", "banana", "eggs", "whole wheat bread"]

User query: "${query}"`;
            const result = await model.generateContent(searchPrompt);
            const text = result.response.text().trim();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [query];
        } catch (aiErr) {
            // Rate-limit or API error — fallback to splitting query words
            console.warn('Gemini intent-search fallback:', aiErr.message?.slice(0, 80));
            usedFallback = true;
            keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (!keywords.length) keywords = [query];
        }

        // Search for each keyword safely
        const productMap = new Map();
        try {
            for (const kw of keywords) {
                const products = await Product.find({
                    $text: { $search: kw },
                    isAvailable: true,
                    stock: { $gt: 0 },
                })
                    .populate('shopId', 'name location rating')
                    .limit(5);
                products.forEach((p) => productMap.set(p._id.toString(), { product: p, matchedKeyword: kw }));
            }
        } catch (dbErr) {
            console.error('DB error during intent search fallback:', dbErr.message);
            // If DB text search fails (e.g. index issue), just return empty instead of 500
        }

        const results = Array.from(productMap.values());
        res.json({ success: true, query, expandedKeywords: keywords, count: results.length, results, fallback: usedFallback });
    } catch (err) {
        console.error('Critical intent search error:', err);
        res.json({ success: true, query: req.body.query, expandedKeywords: [], count: 0, results: [], fallback: true });
    }
});

module.exports = router;
