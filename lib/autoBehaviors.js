// lib/autoBehaviors.js — Settings toggles ke ASAL behaviors (2026-10-23).
//
// Masla ye tha: zz-settings ke toggles sirf botSettings mein 'true' likh
// dete thay, lekin in flags par amal karne wala code ya to tha hi nahi
// (AUTO_REACT / AUTO_STICKER / AUTO_REPLY / ANTI_BAD / ANTI_BOT) ya doosri
// config parhta tha. Ye module index.js ke processMessage se har incoming
// message par chalta hai aur merged userConfig ke mutabiq amal karta hai.
//
// Har behavior apne try/catch jaisi hifazat ke saath hai — aik ki nakami
// baqiyon ko nahi rokti, aur koi bhi nakami message processing nahi torti.

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { makeSticker } = require('./sticker');

const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'salam', 'assalamualaikum', 'assalam o alaikum', 'aoa', 'hlo', 'hy'];
const BAD_WORDS = /\b(fuck|bitch|bastard|madarchod|behenchod|bhosdi\w*|chutiy\w*|bsdk|gandu|haramzad\w*|randi|porn|xxx)\b/i;
const DEFAULT_REACT = ['❤️', '😍', '🔥', '😂', '👍'];
const MAX_STICKER_BYTES = 25 * 1024 * 1024;

/**
 * @param {Object} conn - Baileys socket
 * @param {Object} o - { userConfig, mek, from, isGroup, isAdmins, isOwner, body, deps }
 * @returns {Promise<{reacted:boolean, sticker:boolean, replied:boolean, deleted:string|null}>}
 */
async function runAutoBehaviors(conn, o) {
    const res = { reacted: false, sticker: false, replied: false, deleted: null };
    const uc = o.userConfig || {};
    const mek = o.mek;
    if (!mek || !mek.key || mek.key.fromMe) return res;
    const from = o.from;
    const deps = o.deps || {};
    const dl = deps.downloadContentFromMessage || downloadContentFromMessage;
    const mkSticker = deps.makeSticker || makeSticker;

    // ---------- AUTO REACT ----------
    if (uc.AUTO_REACT === 'true') {
        try {
            const pool = (uc.CUSTOM_REACT === 'true' && Array.isArray(uc.CUSTOM_EMOJIS) && uc.CUSTOM_EMOJIS.length)
                ? uc.CUSTOM_EMOJIS
                : DEFAULT_REACT;
            const emoji = pool[Math.floor(Math.random() * pool.length)];
            await conn.sendMessage(from, { react: { text: emoji, key: mek.key } });
            res.reacted = true;
        } catch (_) {}
    }

    // ---------- AUTO STICKER (sirf inbox: image/video -> sticker) ----------
    if (uc.AUTO_STICKER === 'true' && !o.isGroup) {
        try {
            const img = mek.message && mek.message.imageMessage;
            const vid = mek.message && mek.message.videoMessage;
            const node = img || vid;
            if (node) {
                const stream = await dl(node, img ? 'image' : 'video');
                let buf = Buffer.from([]);
                let tooBig = false;
                for await (const chunk of stream) {
                    buf = Buffer.concat([buf, chunk]);
                    if (buf.length > MAX_STICKER_BYTES) { tooBig = true; break; }
                }
                if (!tooBig && buf.length) {
                    const webp = await mkSticker(buf, { ext: img ? 'jpg' : 'mp4' });
                    await conn.sendMessage(from, { sticker: webp }, { quoted: mek });
                    res.sticker = true;
                }
            }
        } catch (_) {}
    }

    // ---------- AUTO REPLY (sirf inbox: salam/hi ka jawab) ----------
    if (uc.AUTO_REPLY === 'true' && !o.isGroup && o.body) {
        try {
            const t = o.body.trim().toLowerCase().replace(/[!.,?]+$/, '');
            if (GREETINGS.includes(t)) {
                await conn.sendMessage(from, {
                    text: uc.AUTO_REPLY_MSG || '👋 *Salam!* Main *Queen MD* hun.\nCommands dekhne ke liye *.menu* likho.'
                }, { quoted: mek });
                res.replied = true;
            }
        } catch (_) {}
    }

    // ---------- GROUP GUARDS: ANTI BAD / ANTI BOT ----------
    if (o.isGroup && !o.isOwner) {
        const exempt = uc.ADMIN_ACTION !== 'true' && o.isAdmins;
        if (!exempt && uc.ANTI_BAD === 'true' && o.body && BAD_WORDS.test(o.body)) {
            try {
                await conn.sendMessage(from, { delete: mek.key });
                res.deleted = 'antibad';
            } catch (_) {}
        } else if (!exempt && uc.ANTI_BOT === 'true' && String(mek.key.id || '').startsWith('BAE5')) {
            // BAE5 se shuru hone wale IDs Baileys bots ke bheje hue hote hain
            try {
                await conn.sendMessage(from, { delete: mek.key });
                res.deleted = 'antibot';
            } catch (_) {}
        }
    }

    return res;
}

module.exports = { runAutoBehaviors, GREETINGS, BAD_WORDS, DEFAULT_REACT };
