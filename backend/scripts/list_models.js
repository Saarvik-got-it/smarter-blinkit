require('dotenv').config({ path: __dirname + '/../.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const embeddingModels = data.models.filter(m => m.supportedGenerationMethods.includes('embedContent'));
        console.log('Available Embedding Models:');
        embeddingModels.forEach(m => console.log(m.name));
    } catch (err) {
        console.error(err);
    }
}
listModels();
