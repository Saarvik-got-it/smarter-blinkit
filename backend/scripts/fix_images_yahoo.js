const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const axios = require('axios');
const cheerio = require('cheerio');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchFromYahooImages(query) {
    try {
        const url = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const $ = cheerio.load(data);

        let targetImg = null;

        // Yahoo places images in #sres
        $('#sres li.ld a img').each((i, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src');
            if (src && src.startsWith('http')) {
                if (!targetImg) targetImg = src;
            }
        });

        return targetImg;
    } catch (err) {
        return null;
    }
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const products = await Product.find({});
        console.log(`Scanning ${products.length} products to map to real Yahoo Image search results...`);

        let fixedCount = 0;

        for (const p of products) {
            // We want to replace placeholder Unsplash, m.media-amazon, or loremflickr images
            if (!p.image || p.image.includes('unsplash') || p.image.includes('loremflickr') || p.image.includes('m.media-amazon.com')) {
                console.log(`\nSearching Yahoo Images for: ${p.name}`);

                // Add 'packaging' or 'grocery India' to ensure better hits
                const query = `${p.name} grocery product India`;
                const newImg = await fetchFromYahooImages(query);

                if (newImg) {
                    p.image = newImg;
                    await p.save();
                    fixedCount++;
                    console.log(` ✅ Found Real Image: ${newImg.substring(0, 60)}...`);
                } else {
                    console.log(` ❌ Failed to scrape.`);
                }

                // Be polite to Yahoo
                await delay(1500);
            }
        }

        console.log(`Successfully fetched ${fixedCount} new genuine images from Yahoo!`);
        process.exit(0);
    } catch (err) {
        console.error("Failed to fix images:", err);
        process.exit(1);
    }
}

run();
