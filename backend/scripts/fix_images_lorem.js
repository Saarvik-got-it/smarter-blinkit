const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const https = require('https');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

function fetchImage(keyword) {
    return new Promise((resolve) => {
        // Break down product name into 1-2 generic english keywords (e.g. "Tata Salt" -> "Salt")
        // Remove brand names for better LoremFlickr accuracy
        let cleanWord = keyword.toLowerCase()
            .replace(/(tata|aashirvaad|fortune|amul|mother dairy|maggi|britannia|everest|saffola|chings|mdh|patanjali)/gi, '')
            .replace(/[^a-z0-9]/g, ' ')
            .split(' ')
            .filter(w => w.length > 3)[0] || 'grocery';

        let altWord = keyword.toLowerCase().split(' ').filter(w => w.length > 3).pop() || 'food';

        const terms = encodeURIComponent(`${cleanWord},${altWord}`);

        https.get(`https://loremflickr.com/json/400/400/${terms}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.file);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const products = await Product.find({});
        console.log(`Scanning ${products.length} products to replace identical Amazon links with dynamic LoremFlickr photos...`);

        let fixedCount = 0;

        for (const p of products) {
            // Only fix products that have the identical hardcoded Amazon images from the expansion script
            if (p.image && p.image.includes('m.media-amazon.com')) {
                console.log(`Fixing duplicate image for: ${p.name}`);

                const newImg = await fetchImage(p.name);
                if (newImg) {
                    p.image = newImg;
                    await p.save();
                    fixedCount++;
                    console.log(` ✅ Assigned unique semantic image: ${newImg}`);
                }

                // Be polite to the free API
                await delay(500);
            }
        }

        console.log(`Successfully assigned ${fixedCount} new unique images!`);
        process.exit(0);
    } catch (err) {
        console.error("Failed to fix images:", err);
        process.exit(1);
    }
}

run();
