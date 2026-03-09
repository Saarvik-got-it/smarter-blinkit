const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Shop = require('../models/Shop');
const Product = require('../models/Product');
const neo4jService = require('../services/neo4j');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarter-blinkit';

const indianGroceries = [
    { name: "Aashirvaad Whole Wheat Atta 5kg", category: "Staples", price: 210, image: "https://m.media-amazon.com/images/I/61yB+0Yn6+L._SL1500_.jpg", description: "100% pure whole wheat grain atta.", unit: "pack", stock: 50 },
    { name: "India Gate Basmati Rice", category: "Staples", price: 350, image: "https://m.media-amazon.com/images/I/81kQ3nDbGzL._SL1500_.jpg", description: "Premium quality long grain basmati rice.", unit: "pack", stock: 30 },
    { name: "Tata Salt 1kg", category: "Staples", price: 25, image: "https://m.media-amazon.com/images/I/51AIt2G+a+L._SL1000_.jpg", description: "Vacuum evaporated iodized salt.", unit: "pack", stock: 100 },
    { name: "Amul Pure Ghee 1L", category: "Dairy", price: 530, image: "https://m.media-amazon.com/images/I/61Kvv-x2n4L._SL1500_.jpg", description: "Pure cow ghee, rich in taste.", unit: "pack", stock: 20 },
    { name: "MDH Garam Masala 100g", category: "Spices", price: 85, image: "https://m.media-amazon.com/images/I/718y0YQ3rAL._SL1500_.jpg", description: "Blend of highly aromatic spices.", unit: "pack", stock: 40 },
    { name: "Everest Turmeric Powder (Haldi) 200g", category: "Spices", price: 60, image: "https://m.media-amazon.com/images/I/61mNnN5h4dL._SL1000_.jpg", description: "100% natural turmeric powder.", unit: "pack", stock: 60 },
    { name: "Maggi 2-Minute Noodles", category: "Snacks", price: 56, image: "https://m.media-amazon.com/images/I/81bH62FpeqL._SL1500_.jpg", description: "Classic masala maggi noodles pack of 4.", unit: "pack", stock: 80 },
    { name: "Mother Dairy Paneer 200g", category: "Dairy", price: 85, image: "https://m.media-amazon.com/images/I/41E92P1Q8xL.jpg", description: "Fresh and soft malai paneer.", unit: "pack", stock: 15 },
    { name: "Fresh Red Tomatoes 1kg", category: "Vegetables", price: 40, image: "https://m.media-amazon.com/images/I/71OQnQ8gG5L._SL1500_.jpg", description: "Freshly picked red tomatoes.", unit: "kg", stock: 30 },
    { name: "Fresh Potatoes 1kg", category: "Vegetables", price: 30, image: "https://m.media-amazon.com/images/I/313dtY-LOpL.jpg", description: "Farm fresh potatoes.", unit: "kg", stock: 50 },
    { name: "Fresh Red Onions 1kg", category: "Vegetables", price: 35, image: "https://m.media-amazon.com/images/I/71yG+y6x8BL._SL1500_.jpg", description: "Fresh red onions.", unit: "kg", stock: 40 },
    { name: "Brooke Bond Red Label Tea 500g", category: "Beverages", price: 150, image: "https://m.media-amazon.com/images/I/61oZ9013P7L._SL1000_.jpg", description: "Strong and flavourful Indian tea.", unit: "pack", stock: 35 },
    { name: "Fortune Sunflower Oil 1L", category: "Staples", price: 160, image: "https://m.media-amazon.com/images/I/612aGzG6gVL._SL1000_.jpg", description: "Light and healthy sunflower oil.", unit: "litre", stock: 25 },
    { name: "Surf Excel Easy Wash Detergent 1kg", category: "Household", price: 110, image: "https://m.media-amazon.com/images/I/61WfB3W1jKL._SL1000_.jpg", description: "Stain removal laundry powder.", unit: "pack", stock: 40 },
    { name: "Dettol Liquid Handwash 200ml", category: "Personal Care", price: 99, image: "https://m.media-amazon.com/images/I/61S-rBfVjML._SL1500_.jpg", description: "Antibacterial formulation for germ protection.", unit: "pack", stock: 30 },
    { name: "Tata Sampann Toor Dal 1kg", category: "Staples", price: 165, image: "https://m.media-amazon.com/images/I/81R5gHHR3fL._SL1500_.jpg", description: "Unpolished, premium yellow toor dal.", unit: "pack", stock: 20 },
    { name: "Madhur Sugar 1kg", category: "Staples", price: 55, image: "https://m.media-amazon.com/images/I/61w1p++Q5UL._SL1000_.jpg", description: "Pure and hygienic white sugar.", unit: "pack", stock: 50 },
    { name: "Amul Butter 100g", category: "Dairy", price: 58, image: "https://m.media-amazon.com/images/I/71xZc+p9W+L._SL1500_.jpg", description: "Deliciously salted Amul butter.", unit: "pack", stock: 25 },
    { name: "Britannia Marie Gold Biscuits", category: "Snacks", price: 30, image: "https://m.media-amazon.com/images/I/71YtW0Vz7KL._SL1500_.jpg", description: "Crisp and light tea-time biscuits.", unit: "pack", stock: 60 },
    { name: "Haldiram's Bhujia Sev", category: "Snacks", price: 110, image: "https://m.media-amazon.com/images/I/7161O4M+zLL._SL1500_.jpg", description: "Crispy and spicy gram flour noodles.", unit: "pack", stock: 35 },
    { name: "Himalaya Purifying Neem Face Wash", category: "Personal Care", price: 140, image: "https://m.media-amazon.com/images/I/51wXk-wItvL._SL1000_.jpg", description: "Prevents pimples and purifies skin.", unit: "pack", stock: 20 },
    { name: "Everest Chhole Masala 100g", category: "Spices", price: 70, image: "https://m.media-amazon.com/images/I/71d3XoVn+HL._SL1500_.jpg", description: "Perfect blend for authentic Chhole.", unit: "pack", stock: 25 },
    { name: "Gits Gulab Jamun Mix", category: "Desserts", price: 120, image: "https://m.media-amazon.com/images/I/71K2gCg246L._SL1500_.jpg", description: "Instant gulab jamun dessert mix.", unit: "pack", stock: 15 },
    { name: "Fresh Garlic 250g", category: "Vegetables", price: 50, image: "https://m.media-amazon.com/images/I/619ePZZN2eL._SL1500_.jpg", description: "Aromatic fresh garlic pods.", unit: "pack", stock: 20 },
    { name: "Fresh Ginger 250g", category: "Vegetables", price: 40, image: "https://m.media-amazon.com/images/I/71h2G+QvLIL._SL1500_.jpg", description: "Fresh and strong ginger root.", unit: "pack", stock: 20 },
];

const genericImages = {
    'Staples': 'https://m.media-amazon.com/images/I/71qV0k8DmwL._SL1500_.jpg',
    'Dairy': 'https://m.media-amazon.com/images/I/61Kvv-x2n4L._SL1500_.jpg',
    'Snacks': 'https://m.media-amazon.com/images/I/71YtW0Vz7KL._SL1500_.jpg',
    'Vegetables': 'https://m.media-amazon.com/images/I/71OQnQ8gG5L._SL1500_.jpg',
    'Medical': 'https://plus.unsplash.com/premium_photo-1661771746244-118bd402ef76?q=80&w=400',
    'Electronics': 'https://images.unsplash.com/photo-1550005973-58ceea3f4ca6?w=400'
};

const placeholderImg = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400"; // Generic grocery aisle

async function seed() {
    try {
        console.log("Connecting to MongoDB:", MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log("Connected.");

        const shops = await Shop.find({});
        if (!shops.length) {
            console.log("No shops found. Please create a shop first.");
            process.exit(0);
        }

        console.log(`Found ${shops.length} shops. Distributing ${indianGroceries.length} realistic groceries...`);
        let addedCount = 0;

        for (let i = 0; i < indianGroceries.length; i++) {
            const data = indianGroceries[i];

            // Assign sequentially to spread them evenly
            const shop = shops[i % shops.length];

            const existing = await Product.findOne({ name: data.name, shopId: shop._id });
            if (existing) {
                console.log(`Skip: ${data.name} already exists in ${shop.name}`);
                continue;
            }

            const p = await Product.create({
                ...data,
                shopId: shop._id,
                location: shop.location
            });

            // Graph Sync: Feed the database to Neo4j to generate the exact organic intelligence the user asked about
            await neo4jService.upsertProduct(p._id.toString(), p.name, p.category, []);
            addedCount++;
            console.log(`Added: ${data.name} -> ${shop.name}`);
        }

        console.log(`\nSuccessfully seeded ${addedCount} new Indian groceries!`);

        // Fixing existing empty products without deleting them
        console.log("\nLooking for existing products with broken/empty images...");
        const oldProducts = await Product.find({ $or: [{ image: null }, { image: '' }] });

        for (const op of oldProducts) {
            op.image = genericImages[op.category] || placeholderImg;
            await op.save();
            console.log(`Fixed missing image on: ${op.name}`);
        }

        console.log("Done upgrading catalog images!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding Error:", err);
        process.exit(1);
    }
}

seed();
