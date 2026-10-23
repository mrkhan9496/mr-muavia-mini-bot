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

// ── Auto reply: insani tarz ke jawab ──
// Har qisam ke salaam/mulaqat par mukhtalif natural jawabon ka pool hai —
// har dafa ek hi robotic jumla NAHI jata. Ek chat mein jawab ke baad
// 5 minute ka waqfa (insaan har "hi" par bar bar jawab nahi deta).
const REPLY_POOLS = {
    salam: {
        triggers: ['salam', 'assalamualaikum', 'assalam o alaikum', 'asalamualaikum', 'assalam alaikum', 'aoa', 'salaam'],
        replies: ['Walaikum Assalam 😊', 'Walaikum Assalam! Kaise hain aap?', 'Waalaikum Assalam 🌸 Aap sunain, kya haal chaal hain?', 'Walaikum Assalam janab 😊 Sab khairiyat?'],
    },
    hi: {
        triggers: ['hi', 'hii', 'hiii', 'hello', 'hey', 'hlo', 'hy', 'hola'],
        replies: ['Hi! Kaise ho? 😊', 'Hello! Kya haal hai?', 'Hey 😊 Farmaiye, kya kaam hai?', 'Hi janab! Sab khairiyat?'],
    },
    halchaal: {
        triggers: ['kaise ho', 'kese ho', 'kya haal hai', 'kya hal hai', 'kya haal', 'kaise hain', 'kese hain', 'how are you', 'aur sunao'],
        replies: ['Alhamdulillah, main theek hun 😊 Aap sunao?', 'Bilkul theek thaak! Aap kaise ho?', 'Shukar hai, sab acha 😊 Tum sunao, kya chal raha hai?'],
    },
    subah: {
        triggers: ['good morning', 'subah bakhair', 'subha bakhair', 'morning'],
        replies: ['Subah bakhair ☀️', 'Good morning! Aap ka din acha guzre 😊'],
    },
    shab: {
        triggers: ['good night', 'shab bakhair', 'good evening'],
        replies: ['Shab bakhair 🌙 Allah Hafiz', 'Good night! Khayal rakhiye ga 😊'],
    },
    bye: {
        triggers: ['bye', 'allah hafiz', 'allahafiz', 'ok bye'],
        replies: ['Allah Hafiz 😊', 'Bye bye! Phir milenge 👋'],
    },
    thanks: {
        triggers: ['thanks', 'thank you', 'shukriya', 'shukria', 'thankyou'],
        replies: ['Koi baat nahi 😊', 'Khushi hui madad karke! Aur kuch ho to bataiye ga', 'Welcome janab 😊'],
    },
    bot: {
        triggers: ['bot', 'queen', 'queen md'],
        replies: ['Ji, main yahin hun 😊', 'Ji janab, hukam karein?'],
    },
};
const REPLY_TRIGGER_MAP = new Map();
for (const pool of Object.values(REPLY_POOLS)) {
    for (const t of pool.triggers) REPLY_TRIGGER_MAP.set(t, pool.replies);
}
const GREETINGS = [...REPLY_TRIGGER_MAP.keys()];
const REPLY_COOLDOWN_MS = 5 * 60 * 1000;
const lastReplyByChat = new Map(); // jid -> { at, text }

function pickHumanReply(replies, chatKey, now) {
    let text = replies[Math.floor(Math.random() * replies.length)];
    const prev = lastReplyByChat.get(chatKey);
    if (replies.length > 1 && prev && prev.text === text) {
        text = replies[(replies.indexOf(text) + 1) % replies.length];
    }
    return text;
}
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

    // ---------- AUTO REPLY (sirf inbox: insani tarz ka jawab) ----------
    if (uc.AUTO_REPLY === 'true' && !o.isGroup && o.body) {
        try {
            const now = (deps.now || Date.now)();
            const t = o.body.trim().toLowerCase().replace(/[!.,?~]+/g, '').replace(/\s+/g, ' ').trim();
            const pool = REPLY_TRIGGER_MAP.get(t);
            if (pool) {
                const prev = lastReplyByChat.get(from);
                if (!prev || now - prev.at >= REPLY_COOLDOWN_MS) {
                    const text = uc.AUTO_REPLY_MSG || pickHumanReply(pool, from, now);
                    await conn.sendMessage(from, { text }, { quoted: mek });
                    lastReplyByChat.set(from, { at: now, text });
                    if (lastReplyByChat.size > 500) lastReplyByChat.delete(lastReplyByChat.keys().next().value);
                    res.replied = true;
                }
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

module.exports = { runAutoBehaviors, GREETINGS, REPLY_POOLS, REPLY_COOLDOWN_MS, BAD_WORDS, DEFAULT_REACT };
