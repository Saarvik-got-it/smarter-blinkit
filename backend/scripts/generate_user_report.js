/**
 * Standalone script to generate the users_report.xlsx.
 *
 * Usage:
 *   cd backend
 *   node scripts/generate_user_report.js
 *   — or —
 *   npm run generate-report
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { generateUserReport } = require('../services/userReportService');

async function main() {
    try {
        console.log('🔌 Connecting to MongoDB…');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
        });
        console.log('✅ Connected');

        const filePath = await generateUserReport();
        console.log(`✅ Report saved to: ${filePath}`);
    } catch (err) {
        console.error('❌ Error generating report:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main();
