// Per-user extra settings (prefix, botname, mode, autoreact ...) MongoDB me save hoti hain.
// Mongoose schema ki limit se bachne ke liye alag collection use hoti hai.
const mongoose = require('mongoose');
const { getUserConfigFromMongoDB } = require('./database');

const COLLECTION = 'bot_settings';
const cache = new Map();
const TTL = 8000;
const digits = (v) => String(v || '').replace(/[^0-9]/g, '');

async function getExtra(number) {
    const n = digits(number);
    try {
        const doc = await mongoose.connection.collection(COLLECTION).findOne({ number: n });
        return (doc && doc.settings) || {};
    } catch (_) { return {}; }
}

// DB config + extra settings merge (cache ke saath)
async function getMerged(number) {
    const n = digits(number);
    const hit = cache.get(n);
    if (hit && Date.now() - hit.at < TTL) return hit.value;
    let base = {};
    try { base = (await getUserConfigFromMongoDB(n)) || {}; } catch (_) {}
    if (base && typeof base.toObject === 'function') base = base.toObject();
    const value = { ...base, ...(await getExtra(n)) };
    cache.set(n, { at: Date.now(), value });
    return value;
}

async function setSetting(number, key, val) {
    const n = digits(number);
    await mongoose.connection.collection(COLLECTION).updateOne(
        { number: n },
        { $set: { number: n, [`settings.${key}`]: val, updatedAt: new Date() } },
        { upsert: true }
    );
    cache.delete(n);
}

async function unsetSetting(number, key) {
    const n = digits(number);
    await mongoose.connection.collection(COLLECTION).updateOne({ number: n }, { $unset: { [`settings.${key}`]: '' } });
    cache.delete(n);
}

const dropCache = (number) => cache.delete(digits(number));

module.exports = { getMerged, setSetting, unsetSetting, dropCache, getExtra };
