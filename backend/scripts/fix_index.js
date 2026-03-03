require('dotenv').config({ path: __dirname + '/../.env' });
const neo4jService = require('../services/neo4j');

async function fixIndex() {
    console.log('Re-initializing Neo4j Vector Index with 3072 dimensions...');
    await neo4jService.initVectorIndex();
    await neo4jService.closeDriver();
    console.log('Done.');
}

fixIndex();
