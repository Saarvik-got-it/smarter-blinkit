const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const google = require('googlethis');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function checkImageValid(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(5000)
        });
        const ct = response.headers.get('content-type') || '';
        if (response.ok && ct.startsWith('image/')) return true;
        return false;
    } catch (e) {
        return false;
    }
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const products = await Product.find({});
        console.log(`Deep scanning ${products.length} products to verify HTTP 200 image health...`);

        let fixedCount = 0;

        for (const p of products) {
            let isBroken = false;

            if (!p.image || p.image.trim() === '' || p.image.includes('defaultImage')) {
                isBroken = true;
            } else if (p.image.startsWith('http')) {
                // Test for HTTP valid response
                const isValid = await checkImageValid(p.image);
                if (!isValid) {
                    isBroken = true;
                }
            }

            if (isBroken) {
                console.log(`\n[Broken Image Detcted] ${p.name}`);
                console.log(`Attempting to securely fetch a new, verified URL for ${p.name}...`);

                try {
                    const query = p.name + " grocery packaging India";
                    const images = await google.image(query, { safe: false });

                    if (images && images.length > 0) {
                        for (let img of images) {
                            if (img.url && !img.url.includes('svg') && !img.url.includes('base64')) {
                                const isValid = await checkImageValid(img.url);
                                if (isValid) {
                                    p.image = img.url;
                                    await p.save();
                                    fixedCount++;
                                    console.log(` ✅ Replaced with active URL: ${img.url.substring(0, 60)}...`);
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) { }
                await delay(1000);
            }
        }

        console.log(`\nScan complete. Healed ${fixedCount} broken products in the database!`);
        process.exit(0);
    } catch (err) {
        console.error("Critical Failure:", err);
        process.exit(1);
    }
}

run();
