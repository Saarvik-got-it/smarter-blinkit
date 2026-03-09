const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Shop = require('../models/Shop');
require('dotenv').config({ path: __dirname + '/../.env' });

async function geocode(city, state, pincode) {
    const q = `${city || ''} ${state || ''} ${pincode || ''}`.trim();
    if (!q) return null;
    try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
            headers: { 'User-Agent': 'SmarterBlinkit-Migration/1.0' }
        });
        if (res.data && res.data.length > 0) {
            return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon), display_name: res.data[0].display_name };
        }
    } catch (e) {
        console.error('Geocode error:', e.message);
    }
    return null;
}

async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({});
    for (const u of users) {
        if (u.location && u.location.coordinates && u.location.coordinates[0] === 0 && u.location.coordinates[1] === 0) {
            console.log(`Migrating user ${u.name}... (${u.location.city})`);
            const loc = await geocode(u.location.city, u.location.state, u.location.pincode);
            if (loc) {
                u.location.coordinates = [loc.lon, loc.lat];
                if (!u.location.address) u.location.address = loc.display_name;
                await u.save();
                console.log(`   -> Set coords: [${loc.lon}, ${loc.lat}] Address: ${u.location.address.substring(0, 30)}...`);
            }
            await new Promise(r => setTimeout(r, 1000));
        } else {
             console.log(`Skipping user ${u.name} - already has valid coordinates`);
        }
    }

    const shops = await Shop.find({});
    for (const s of shops) {
        if (s.location && s.location.coordinates && s.location.coordinates[0] === 0 && s.location.coordinates[1] === 0) {
            console.log(`Migrating shop ${s.name}...`);
            const loc = await geocode(s.location.city, s.location.state, s.location.pincode);
            if (loc) {
                s.location.coordinates = [loc.lon, loc.lat];
                if (!s.location.address) s.location.address = loc.display_name;
                await s.save();
                console.log(`   -> Set coords: [${loc.lon}, ${loc.lat}]`);
            }
            await new Promise(r => setTimeout(r, 1000));
        } else {
             console.log(`Skipping shop ${s.name} - already has valid coordinates`);
        }
    }

    console.log('Migration complete');
    process.exit(0);
}

migrate();
