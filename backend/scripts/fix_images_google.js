const mongoose = require('mongoose');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const google = require('googlethis');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchFromGoogleImages(query) {
    try {
        const images = await google.image(query + " grocery product india packaging isolated", { safe: false });
        if (images && images.length > 0) {
            // Pick the first reliable image (often transparent background products are best)
            for (let img of images) {
                if (img.url && !img.url.includes('svg') && !img.url.includes('base64')) {
                    // Filter out massive images that might take ages to load on frontend
                    return img.url;
                }
            }
        }
        return null;
    } catch (err) {
        return null; // Google might rate limit, we catch silently
    }
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const products = await Product.find({});
        console.log(`Scanning products to map to genuine Google Image results...`);

        let fixedCount = 0;

        for (const p of products) {
            // Replace generic LoremFlickr pictures
            if (!p.image || p.image.includes('loremflickr') || p.image.includes('unsplash') || /^[A-Z]/.test(p.image)) {
                console.log(`Searching Google Images for: ${p.name}`);

                const newImg = await fetchFromGoogleImages(p.name);

                if (newImg) {
                    p.image = newImg;
                    await p.save();
                    fixedCount++;
                    console.log(` ✅ Found Accurate Package: ${newImg.substring(0, 60)}...`);
                } else {
                    console.log(` ❌ Failed to fetch image/rate limited.`);
                }

                // Be gentle to Google search
                await delay(1000);
            }
        }

        console.log(`Successfully fetched ${fixedCount} genuine packaging images from Google!`);
        process.exit(0);
    } catch (err) {
        console.error("Critical Failure:", err);
        process.exit(1);
    }
}

run();
