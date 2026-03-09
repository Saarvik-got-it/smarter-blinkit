/**
 * AI Router — Multi-model fallback system for Google Gemini
 * ──────────────────────────────────────────────────────────
 * Tries models from the priority list in order.
 * Automatically switches to the next model on rate-limit,
 * quota exhaustion, or any recoverable API failure.
 *
 * Caches the last successful model so future requests skip
 * straight to the model that worked most recently.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AI_MODELS } = require('../config/aiModels');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Module-level cache: last model that succeeded ─────────
let lastSuccessfulModel = null;

/**
 * Returns true for errors where retrying with a different model
 * makes sense (rate-limit, quota, unavailable, model not found).
 * Returns false for errors that would affect every model equally
 * (invalid API key, malformed request, etc.).
 */
function isRecoverableError(err) {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status ?? err?.statusCode ?? err?.code;

    // Explicit recoverable HTTP codes
    if (status === 429 || status === 503 || status === 404 || status === 502) return true;

    // Message-based detection (Gemini SDK packs the code in the message)
    return (
        msg.includes('429')              ||
        msg.includes('quota')            ||
        msg.includes('rate limit')       ||
        msg.includes('too many requests') ||
        msg.includes('resource_exhausted') ||
        msg.includes('overloaded')       ||
        msg.includes('service unavailable') ||
        msg.includes('not found')        ||
        msg.includes('not supported')    ||
        msg.includes('model')            // catches "model not found", "model not available"
    );
}

/**
 * Builds the ordered list of models to try.
 * Puts the last successful model first to reduce unnecessary fallbacks.
 */
function buildModelOrder() {
    if (lastSuccessfulModel && AI_MODELS.includes(lastSuccessfulModel)) {
        const rest = AI_MODELS.filter(m => m !== lastSuccessfulModel);
        return [lastSuccessfulModel, ...rest];
    }
    return [...AI_MODELS];
}

/**
 * Generate text with automatic multi-model fallback.
 *
 * @param {string | string[] | Array} parts  — content passed to generateContent()
 * @returns {Promise<{ text: string, modelUsed: string }>}
 * @throws  the last error if every model in the list fails
 */
async function generateText(parts) {
    const modelsToTry = buildModelOrder();
    let lastError = null;

    for (const modelName of modelsToTry) {
        console.log(`[AI Router] Attempting model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(parts);
            const text = result.response.text();

            // ── Cache this as the preferred model ────────────────
            if (lastSuccessfulModel !== modelName) {
                console.log(`[AI Router] Using fallback model: ${modelName} — caching as preferred`);
                lastSuccessfulModel = modelName;
            }

            return { text, modelUsed: modelName };
        } catch (err) {
            lastError = err;

            if (isRecoverableError(err)) {
                console.warn(
                    `[AI Router] Rate limit hit → switching model. Failed: ${modelName} | ` +
                    `Reason: ${err.message?.slice(0, 100)}`
                );
                // Clear the cache if it was the cached model that just failed
                if (lastSuccessfulModel === modelName) {
                    lastSuccessfulModel = null;
                }
                continue; // try next model
            }

            // Non-recoverable (bad API key, malformed prompt, etc.) — bail immediately
            console.error(`[AI Router] Non-recoverable error on ${modelName}: ${err.message?.slice(0, 100)}`);
            throw err;
        }
    }

    console.error('[AI Router] All models exhausted. Last error:', lastError?.message?.slice(0, 120));
    throw lastError || new Error('All AI models failed');
}

module.exports = { generateText };
