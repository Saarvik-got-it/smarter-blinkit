require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const neo4jService = require('../services/neo4j');
const Product = require('../models/Product');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

async function generateEmbedding(text) {
    try {
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (err) {
        console.error('Error generating embedding:', err);
        return null;
    }
}

async function syncEmbeddings() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        console.log('Initializing Neo4j Vector Index...');
        await neo4jService.initVectorIndex();

        const products = await Product.find({});
        console.log(`Found ${products.length} products to process.`);

        let successCount = 0;
        let failCount = 0;

        for (const [index, product] of products.entries()) {
            console.log(`[${index + 1}/${products.length}] Processing: ${product.name}`);

            const textToEmbed = `${product.name} ${product.category} ${product.description || ''}`.trim();

            const embedding = await generateEmbedding(textToEmbed);
            if (!embedding) {
                console.warn(`Failed to generate embedding for: ${product.name}`);
                failCount++;
                continue;
            }

            // Save to Mongo
            product.embedding = embedding;
            await product.save();

            // Sync to Neo4j
            await neo4jService.upsertProduct(product._id.toString(), product.name, product.category, embedding);
            successCount++;

            // Simple rate limit protection (optional, Gemini is fast but just in case)
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n--- Sync Complete ---');
        console.log(`Successfully synced vectors for ${successCount} products.`);
        if (failCount > 0) console.log(`Failed to sync ${failCount} products.`);

    } catch (err) {
        console.error('Sync error:', err);
    } finally {
        await mongoose.disconnect();
        await neo4jService.closeDriver();
        console.log('Disconnected services.');
        process.exit(0);
    }
}

syncEmbeddings();
