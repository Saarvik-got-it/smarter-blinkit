const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const https = require('https');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

async function fetchImageFromDuckDuckGo(query) {
    return new Promise((resolve) => {
        const queryTerm = encodeURIComponent(query + " grocery product packaging India");
        const options = {
            hostname: 'html.duckduckgo.com',
            path: `/html/?q=${queryTerm}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        };

        const req = https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // DuckDuckGo stores external hotlink images in: <img class="result__image" src="//external-content.duckduckgo.com/iu/?u=URL_ENCODED
                const match = data.match(/src="(\/\/external-content\.duckduckgo\.com\/iu\/\?u=[^"]+)"/);
                if (match && match[1]) {
                    // Extract the u= parameter and decode it
                    try {
                        const urlMatch = match[1].match(/u=([^&]+)/);
                        if (urlMatch && urlMatch[1]) {
                            resolve(decodeURIComponent(urlMatch[1]));
                            return;
                        }
                    } catch (e) { }
                    resolve("https:" + match[1]);
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => { req.abort(); resolve(null); });
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGODB_URI);

        const products = await Product.find({});
        console.log(`Checking ${products.length} products...`);

        let fixedCount = 0;

        // Let's filter products whose image is a generic Unsplash one OR Amazon one
        // Because Amazon links are throwing 403 hotlink protection for the user
        const targetProducts = products.filter(p =>
            p.image && (p.image.includes('amazon') || p.image.includes('unsplash') || /^[A-Z]/.test(p.image))
        );

        console.log(`Found ${targetProducts.length} items to re-fetch real packaging for...`);

        for (const p of targetProducts) {
            console.log(`\nFetching real image for: ${p.name}`);

            // Wait 2 seconds to not get rate limited by DDG
            await delay(2000);

            let imgUrl = await fetchImageFromDuckDuckGo(p.name);

            if (imgUrl) {
                console.log(` ✅ Found: ${imgUrl.slice(0, 80)}...`);
                p.image = imgUrl;
                await p.save();
                fixedCount++;
            } else {
                console.log(` ❌ Could not scrape image.`);
            }
        }

        console.log(`\nDone! Successfully updated ${fixedCount} products with genuine packaging images.`);
        process.exit(0);
    } catch (e) {
        console.error("Script failed:", e);
        process.exit(1);
    }
}

run();
