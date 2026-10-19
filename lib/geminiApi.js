/**
 * geminiApi.js — Google Gemini API client for MR Muavia Mini Bot
 *
 * Uses REST API: https://generativelanguage.googleapis.com/v1beta
 * Docs: https://ai.google.dev/gemini-api/docs
 *
 * Env vars:
 * - GEMINI_API_KEY (required)
 * - GEMINI_CHAT_MODEL (optional, default: gemini-flash-latest)
 *
 * Features:
 * - Timeouts (30s)
 * - Model fallback chain
 * - Rate limiting (simple in-memory)
 * - Clear errors on missing key (no crash)
 */

const axios = require('axios');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Rate limiting: max 10 requests per minute per chat
const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(chatId) {
    const now = Date.now();
    const entry = rateMap.get(chatId) || { count: 0, resetAt: now + RATE_WINDOW };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + RATE_WINDOW;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;  // rate limited
    }

    entry.count++;
    rateMap.set(chatId, entry);
    return true;
}

function getApiKey() {
    return process.env.GEMINI_API_KEY || '';
}

function getModel() {
    return process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';
}

// Fallback chain if primary model fails
const MODEL_FALLBACKS = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
];

/**
 * Send a chat request to Gemini.
 *
 * @param {string} prompt - User's question
 * @param {string} systemPrompt - System instruction
 * @param {string} chatId - For rate limiting
 * @returns {Promise<string>} AI response text
 */
async function chatText(prompt, systemPrompt = '', chatId = 'global') {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error(
            'GEMINI_API_KEY not set. Get a free key from https://aistudio.google.com/apikey'
        );
    }

    if (!checkRateLimit(chatId)) {
        throw new Error('Rate limit: too many requests. Wait a minute.');
    }

    const models = [getModel(), ...MODEL_FALLBACKS.filter(m => m !== getModel())];
    let lastError = null;

    for (const model of models) {
        try {
            const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

            const contents = [];
            if (systemPrompt) {
                contents.push({ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] });
                contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
            }
            contents.push({ role: 'user', parts: [{ text: prompt.slice(0, 4000) }] });

            const res = await axios.post(url, {
                contents,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                }
            }, {
                timeout: 30000,  // 30s timeout
                headers: { 'Content-Type': 'application/json' }
            });

            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text.trim();

            lastError = new Error('Empty response from Gemini');
        } catch (err) {
            lastError = err;
            // Try next model on 404/400 (model not found)
            if (err.response?.status === 404 || err.response?.status === 400) continue;
            // On other errors, don't retry with different model
            break;
        }
    }

    throw new Error(`Gemini failed: ${lastError?.message || 'unknown'}`);
}

module.exports = { chatText, checkRateLimit, getApiKey };
