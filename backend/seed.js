/**
 * Seed Script — Smarter BlinkIt
 * Populates MongoDB with mock users, shops, and products
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Shop = require('./models/Shop');
const Product = require('./models/Product');
const neo4jService = require('./services/neo4j');

// ── Mock Data ──────────────────────────────────────────────────
const SELLERS = [
    {
        user: { name: 'Ramesh Agarwal', email: 'ramesh@shop.com', password: 'password123', role: 'seller', phone: '+91-9876543210' },
        shop: { name: 'Ramesh General Store', address: '12, MG Road, Bengaluru', city: 'Bengaluru', pincode: '560001', coordinates: [77.5946, 12.9716] },
    },
    {
        user: { name: 'Priya Mehta', email: 'priya@shop.com', password: 'password123', role: 'seller', phone: '+91-9123456789' },
        shop: { name: "Priya's Pharmacy & Fresh", address: '45, Indiranagar, Bengaluru', city: 'Bengaluru', pincode: '560038', coordinates: [77.6413, 12.9784] },
    },
];

const BUYER = { name: 'Aryan Sharma', email: 'aryan@buyer.com', password: 'password123', role: 'buyer', phone: '+91-9988776655' };

// Products keyed by [shopIndex, category]
// shopIndex 0 = Ramesh General Store, 1 = Priya's Pharmacy & Fresh
const PRODUCTS = [
    // ── Groceries (Shop 0) ─────────────────────────────────
    { name: 'Aashirvaad Atta (Wheat Flour)', category: 'Groceries', price: 249, stock: 80, unit: 'kg', barcode: '8901030592104', description: 'Premium whole wheat flour, 5kg pack', tags: ['flour', 'wheat', 'atta', 'baking', 'pizza', 'bread', 'roti'], shopIdx: 0 },
    { name: 'India Gate Basmati Rice', category: 'Groceries', price: 320, stock: 60, unit: 'kg', barcode: '8906073340012', description: 'Premium aged basmati rice, 5kg', tags: ['rice', 'basmati', 'biryani', 'pulao'], shopIdx: 0 },
    { name: 'Tata Salt', category: 'Groceries', price: 22, stock: 150, unit: 'pack', barcode: '8901030432321', description: 'Iodised salt, 1kg pack', tags: ['salt', 'iodised'], shopIdx: 0 },
    { name: 'Fortune Sunflower Oil', category: 'Groceries', price: 180, stock: 45, unit: 'litre', barcode: '8904001630082', description: 'Refined sunflower oil, 1 litre', tags: ['oil', 'cooking oil', 'sunflower', 'frying'], shopIdx: 0 },
    { name: 'MDH Biryani Masala', category: 'Groceries', price: 85, stock: 70, unit: 'pack', barcode: '8904001630094', description: 'Special biryani spice mix, 100g', tags: ['masala', 'biryani', 'spice', 'seasoning'], shopIdx: 0 },
    { name: 'Sugar', category: 'Groceries', price: 45, stock: 100, unit: 'kg', barcode: '8900000000001', description: 'Refined white sugar, 1kg', tags: ['sugar', 'sweet', 'baking'], shopIdx: 0 },
    { name: 'Toor Dal', category: 'Groceries', price: 140, stock: 55, unit: 'kg', barcode: '8900000000002', description: 'Yellow split pigeon peas, 1kg', tags: ['dal', 'lentil', 'protein', 'toor', 'yellow dal'], shopIdx: 0 },
    { name: 'Moong Dal', category: 'Groceries', price: 130, stock: 50, unit: 'kg', barcode: '8900000000003', description: 'Green split gram, 1kg', tags: ['dal', 'moong', 'lentil', 'green'], shopIdx: 0 },
    // ── Dairy (Shop 0) ────────────────────────────────────
    { name: 'Amul Full Cream Milk', category: 'Dairy', price: 68, stock: 120, unit: 'litre', barcode: '8901103025015', description: 'Full cream pasteurised milk, 1 litre', tags: ['milk', 'dairy', 'calcium', 'full cream'], shopIdx: 0 },
    { name: 'Amul Butter', category: 'Dairy', price: 58, stock: 90, unit: 'piece', barcode: '8901103012671', description: 'Pasteurised butter, 100g', tags: ['butter', 'dairy', 'baking', 'toast', 'pizza'], shopIdx: 0 },
    { name: 'Amul Mozzarella Cheese', category: 'Dairy', price: 120, stock: 60, unit: 'piece', barcode: '8901103034017', description: 'Mozzarella block cheese, 200g', tags: ['cheese', 'mozzarella', 'pizza', 'pasta', 'dairy'], shopIdx: 0 },
    { name: 'Amul Cheddar Cheese Slices', category: 'Dairy', price: 95, stock: 40, unit: 'piece', barcode: '8901103034024', description: 'Cheddar processed cheese slices, 200g', tags: ['cheese', 'cheddar', 'sandwich', 'burger', 'dairy'], shopIdx: 0 },
    { name: 'Mother Dairy Curd', category: 'Dairy', price: 46, stock: 75, unit: 'piece', barcode: '8904046000013', description: 'Dahi / yogurt, 400g', tags: ['curd', 'dahi', 'yogurt', 'dairy', 'biryani', 'raita'], shopIdx: 0 },
    { name: 'Amul Cream', category: 'Dairy', price: 45, stock: 50, unit: 'piece', barcode: '8901103002314', description: 'Fresh cream, 200ml', tags: ['cream', 'dairy', 'pasta', 'butter chicken', 'cooking'], shopIdx: 0 },
    // ── Fresh Produce (Shop 0) ────────────────────────────
    { name: 'Tomatoes', category: 'Fresh', price: 30, stock: 100, unit: 'kg', barcode: '0000000000001', description: 'Fresh red tomatoes, 1kg', tags: ['tomato', 'vegetable', 'fresh', 'pizza sauce', 'pasta sauce'], shopIdx: 0 },
    { name: 'Onions', category: 'Fresh', price: 40, stock: 100, unit: 'kg', barcode: '0000000000002', description: 'Fresh onions, 1kg', tags: ['onion', 'vegetable', 'fresh', 'cooking', 'biryani'], shopIdx: 0 },
    { name: 'Garlic', category: 'Fresh', price: 60, stock: 80, unit: 'piece', barcode: '0000000000003', description: 'Fresh garlic bulb', tags: ['garlic', 'spice', 'fresh', 'cooking', 'pasta'], shopIdx: 0 },
    { name: 'Lemon', category: 'Fresh', price: 10, stock: 200, unit: 'piece', barcode: '0000000000004', description: 'Fresh lemon', tags: ['lemon', 'citrus', 'vitamin c', 'fresh', 'juice'], shopIdx: 0 },
    { name: 'Bananas', category: 'Fresh', price: 40, stock: 100, unit: 'dozen', barcode: '0000000000005', description: 'Fresh bananas, 1 dozen', tags: ['banana', 'fruit', 'fresh', 'breakfast', 'healthy'], shopIdx: 0 },
    { name: 'Eggs', category: 'Fresh', price: 90, stock: 150, unit: 'dozen', barcode: '0000000000006', description: 'Farm fresh eggs, 1 dozen', tags: ['egg', 'protein', 'breakfast', 'omelette', 'baking'], shopIdx: 0 },
    // ── Snacks (Shop 0) ──────────────────────────────────
    { name: 'Lays Classic Salted Chips', category: 'Snacks', price: 20, stock: 100, unit: 'piece', barcode: '8901088016670', description: 'Potato chips, 26g', tags: ['chips', 'snack', 'lays', 'popcorn', 'movie', 'party'], shopIdx: 0 },
    { name: 'Act II Microwave Popcorn', category: 'Snacks', price: 75, stock: 60, unit: 'piece', barcode: '8906085000031', description: 'Butter popcorn, microwave ready', tags: ['popcorn', 'snack', 'movie', 'buttered', 'corn'], shopIdx: 0 },
    { name: 'Haldirams Namkeen Mix', category: 'Snacks', price: 50, stock: 80, unit: 'piece', barcode: '8906001000051', description: 'Assorted namkeen mix, 200g', tags: ['namkeen', 'snack', 'haldirams', 'fried', 'party'], shopIdx: 0 },
    { name: 'Dairy Milk Chocolate', category: 'Snacks', price: 40, stock: 90, unit: 'piece', barcode: '8901072001001', description: 'Cadbury Dairy Milk, 45g', tags: ['chocolate', 'sweet', 'cadbury', 'dairy milk', 'dessert'], shopIdx: 0 },
    // ── Beverages (Shop 0) ────────────────────────────────
    { name: 'Coca-Cola', category: 'Beverages', price: 40, stock: 80, unit: 'piece', barcode: '5449000000996', description: 'Coca-Cola soft drink, 750ml', tags: ['cola', 'coke', 'drink', 'soda', 'cold drink', 'movie', 'party'], shopIdx: 0 },
    { name: 'Bisleri Water 1L', category: 'Beverages', price: 20, stock: 200, unit: 'piece', barcode: '8901499012123', description: 'Packaged drinking water, 1 litre', tags: ['water', 'mineral water', 'bisleri', 'hydrate'], shopIdx: 0 },
    { name: 'Red Bull Energy Drink', category: 'Beverages', price: 125, stock: 40, unit: 'piece', barcode: '9002490100031', description: 'Energy drink, 250ml', tags: ['energy drink', 'red bull', 'energy', 'caffeine'], shopIdx: 0 },
    // ── Pharmacy / Health (Shop 1) ────────────────────────
    { name: 'Dabur Honey', category: 'Pharmacy', price: 199, stock: 70, unit: 'piece', barcode: '8901207000169', description: 'Pure natural honey, 500g', tags: ['honey', 'cold', 'cough', 'sore throat', 'immunity', 'health', 'natural remedy'], shopIdx: 1 },
    { name: 'Ginger Tea Bags', category: 'Pharmacy', price: 120, stock: 60, unit: 'piece', barcode: '8906005000056', description: 'Adrak ginger herbal tea, 25 bags', tags: ['ginger tea', 'tea', 'cold', 'cough', 'immunity', 'health', 'herbal'], shopIdx: 1 },
    { name: 'Tulsi Green Tea', category: 'Pharmacy', price: 95, stock: 50, unit: 'piece', barcode: '8906005000078', description: 'Holy basil tulsi green tea, 25 bags', tags: ['tulsi', 'tea', 'immunity', 'cold', 'herbal', 'ayurvedic'], shopIdx: 1 },
    { name: 'Limcee Vitamin C 500mg', category: 'Pharmacy', price: 35, stock: 120, unit: 'piece', barcode: '8901426001001', description: 'Vitamin C chewable tablets, 15 tabs', tags: ['vitamin c', 'immunity', 'cold', 'supplement', 'health'], shopIdx: 1 },
    { name: 'Vicks VapoRub', category: 'Pharmacy', price: 65, stock: 80, unit: 'piece', barcode: '8901396003085', description: 'Mentholated ointment for cold relief, 50ml', tags: ['vicks', 'cold', 'cough', 'nasal', 'chest', 'relief', 'blocked nose'], shopIdx: 1 },
    { name: 'Strepsils Throat Lozenges', category: 'Pharmacy', price: 55, stock: 60, unit: 'piece', barcode: '8901396088110', description: 'Menthol throat lozenges, 24 count', tags: ['strepsils', 'throat', 'sore throat', 'cold', 'cough', 'lozenges'], shopIdx: 1 },
    { name: 'Crocin Fever Tablets', category: 'Pharmacy', price: 32, stock: 100, unit: 'piece', barcode: '8901396032122', description: 'Paracetamol 500mg fever & pain relief, 15 tabs', tags: ['crocin', 'paracetamol', 'fever', 'headache', 'pain relief', 'medicine'], shopIdx: 1 },
    { name: 'Amla Juice', category: 'Pharmacy', price: 149, stock: 45, unit: 'piece', barcode: '8901207900012', description: 'Pure amla (gooseberry) juice, 500ml', tags: ['amla', 'immunity', 'vitamin c', 'health', 'juice', 'ayurvedic'], shopIdx: 1 },
    // ── Fresh Produce (Shop 1) ────────────────────────────
    { name: 'Whole Grain Oats', category: 'Groceries', price: 180, stock: 55, unit: 'piece', barcode: '8906040210012', description: 'Quaker oats, 500g', tags: ['oats', 'breakfast', 'healthy', 'fibre', 'whole grain'], shopIdx: 1 },
    { name: 'Whole Wheat Bread', category: 'Groceries', price: 45, stock: 80, unit: 'piece', barcode: '8906040210034', description: 'Britannia whole wheat bread, 400g', tags: ['bread', 'wheat', 'breakfast', 'sandwich', 'healthy', 'toast'], shopIdx: 1 },
    { name: 'Granola Bar (Mixed Nuts)', category: 'Snacks', price: 40, stock: 60, unit: 'piece', barcode: '8906040210056', description: 'Nutri-bar crunchy granola, 40g', tags: ['granola', 'healthy', 'snack', 'nuts', 'breakfast', 'energy bar'], shopIdx: 1 },
    // ── Sauce/Condiments (Shop 1) ──────────────────────────
    { name: 'Hunt\'s Tomato Sauce (Pasta Sauce)', category: 'Groceries', price: 95, stock: 40, unit: 'piece', barcode: '0024000162780', description: 'Tomato paste & sauce, 250g', tags: ['pasta sauce', 'tomato sauce', 'pasta', 'pizza', 'italian'], shopIdx: 1 },
    { name: 'Oregano & Herbs Mix', category: 'Groceries', price: 55, stock: 50, unit: 'piece', barcode: '8906040200099', description: 'Italian herb mix for pizza & pasta, 50g', tags: ['oregano', 'herbs', 'italian', 'pizza', 'pasta', 'seasoning'], shopIdx: 1 },
    { name: 'Nachos with Cheese Dip', category: 'Snacks', price: 120, stock: 45, unit: 'piece', barcode: '8906001000061', description: 'Tortilla chips with salsa cheese dip, 200g', tags: ['nachos', 'chips', 'cheese dip', 'movie', 'party', 'snack'], shopIdx: 1 },
    { name: 'Maggi 2-Minute Noodles', category: 'Groceries', price: 14, stock: 200, unit: 'piece', barcode: '8901058001530', description: 'Masala instant noodles, 70g', tags: ['maggi', 'noodles', 'instant', 'quick', 'snack', 'masala'], shopIdx: 1 },
];

// ── Seed Function ───────────────────────────────────────────────
async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected');

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Shop.deleteMany({}),
            Product.deleteMany({}),
        ]);
        console.log('🗑  Cleared existing data');

        // Create buyer
        const buyer = await User.create(BUYER);
        console.log(`👤 Created buyer: ${buyer.email}`);

        // Create sellers + shops
        const shops = [];
        for (const s of SELLERS) {
            const seller = await User.create(s.user);
            const shop = await Shop.create({
                name: s.shop.name,
                ownerId: seller._id,
                location: {
                    type: 'Point',
                    coordinates: s.shop.coordinates,
                    address: s.shop.address,
                    city: s.shop.city,
                    pincode: s.shop.pincode,
                },
                isOpen: true,
                rating: (Math.random() * 1.5 + 3.5).toFixed(1),
                isVerified: true,
            });
            shops.push(shop);
            console.log(`🏪 Created shop: ${shop.name} (seller: ${seller.email})`);
        }

        // Create products
        let created = 0;
        for (const p of PRODUCTS) {
            const shop = shops[p.shopIdx];
            const product = await Product.create({
                name: p.name,
                description: p.description,
                price: p.price,
                stock: p.stock,
                unit: p.unit,
                category: p.category,
                barcode: p.barcode,
                tags: p.tags,
                shopId: shop._id,
                isAvailable: true,
                salesCount: Math.floor(Math.random() * 200),
                rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            });

            // Sync to Neo4j
            try {
                await neo4jService.upsertProduct(product._id.toString(), product.name, product.category);
            } catch {
                // Neo4j errors are non-fatal for seeding
            }
            created++;
        }
        console.log(`📦 Created ${created} products`);

        // Seed similar relationships in Neo4j by category
        try {
            const allProducts = await Product.find({});
            await neo4jService.seedSimilarByCategory(allProducts);
            console.log('🔗 Neo4j SIMILAR_TO relationships seeded');
        } catch (err) {
            console.warn('⚠️  Neo4j seeding skipped:', err.message);
        }

        console.log('\n✅ SEED COMPLETE\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🛒 Buyer login:');
        console.log('   Email:    aryan@buyer.com');
        console.log('   Password: password123');
        console.log('');
        console.log('🏪 Seller 1 login:');
        console.log('   Email:    ramesh@shop.com');
        console.log('   Password: password123');
        console.log('   Shop:     Ramesh General Store');
        console.log('');
        console.log('🏪 Seller 2 login:');
        console.log('   Email:    priya@shop.com');
        console.log('   Password: password123');
        console.log("   Shop:     Priya's Pharmacy & Fresh");
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('💡 Try these searches:');
        console.log('   "pizza" → flour, cheese, tomato sauce, oregano');
        console.log('   "I have a cold" (AI Intent) → honey, ginger tea, vitamin C');
        console.log('   "biryani" → rice, curd, spices, onions');
        console.log('   "movie night" (AI Intent) → popcorn, chips, cola, nachos');
        console.log('');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
}

seed();
