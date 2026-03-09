/**
 * AI Model Priority List
 * ─────────────────────────────────────────────
 * Models are tried in order from FIRST to LAST.
 * If a model hits a rate limit, quota error, or is unavailable,
 * the system automatically falls through to the next model.
 *
 * Edit this file to change the fallback order or add / remove models.
 */
const AI_MODELS = [
    'gemini-3.1-flash-lite',      // 1st — Primary
    'gemini-3.0-flash',      // 2nd — Fallback
    'gemini-2.5-flash', // 3rd — Lighter fallback
    'gemini-2.5-flash-lite',      // 4th — Older stable
];

module.exports = { AI_MODELS };
