// Per-user extra settings (prefix, botname, mode, autoreact ...) PostgreSQL me
// save hoti hain (bot_settings table, settings JSONB). API pehle wali hi hai.
const pg = require('./pg');
const { getUserConfigFromMongoDB } = require('./database');

const cache = new Map();
const TTL = 8000;
const digits = (v) => String(v || '').replace(/[^0-9]/g, '');

async function getExtra(number) {
    const n = digits(number);
    try {
        const r = await pg.query('SELECT settings FROM bot_settings WHERE number = $1', [n]);
        return (r.rows.length && r.rows[0].settings) || {};
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
    const cur = await getExtra(n);
    cur[key] = val;
    await pg.query(
        `INSERT INTO bot_settings (number, settings, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (number) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`,
        [n, JSON.stringify(cur)]
    );
    cache.delete(n);
}

async function unsetSetting(number, key) {
    const n = digits(number);
    const cur = await getExtra(n);
    if (!(key in cur)) { cache.delete(n); return; }
    delete cur[key];
    await pg.query(
        'UPDATE bot_settings SET settings = $2, updated_at = now() WHERE number = $1',
        [n, JSON.stringify(cur)]
    );
    cache.delete(n);
}

const dropCache = (number) => cache.delete(digits(number));

module.exports = { getMerged, setSetting, unsetSetting, dropCache, getExtra };
