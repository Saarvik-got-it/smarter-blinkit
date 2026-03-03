const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/ai/recipe-agent — "Make pizza for 4 people" → cart items
router.post('/recipe-agent', protect, requireRole('buyer'), async (req, res) => {
    try {
        const { prompt, lat, lng } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'Prompt is required' });

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

        let ingredients;
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            ingredients = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            return res.status(500).json({ success: false, message: 'AI could not parse the request', raw: text });
        }

        if (!ingredients.length) {
            return res.json({ success: true, ingredients: [], products: [], cartItems: [] });
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

        res.json({ success: true, prompt, ingredients, cartItems, notFound });
    } catch (err) {
        console.error('AI recipe agent error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/ai/intent-search — semantic "I have a cold" → relevant products
router.post('/intent-search', async (req, res) => {
    try {
        const { query, lat, lng } = req.body;
        if (!query) return res.status(400).json({ success: false, message: 'Query required' });

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

        let keywords;
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [query];
        } catch {
            keywords = [query];
        }

        // Search for each keyword
        const productMap = new Map();
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

        const results = Array.from(productMap.values());
        res.json({ success: true, query, expandedKeywords: keywords, count: results.length, results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
