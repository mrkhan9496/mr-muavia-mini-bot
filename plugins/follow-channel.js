/**
 * follow-channel.js — Queen MD  [.follow]
 *
 * OWNER-ONLY, HIDDEN command (menu mein nahi aata — dontAddCommandList).
 *
 * Istemal:
 *   .follow https://whatsapp.com/channel/<INVITE_CODE>
 *   .follow https://whatsapp.com/channel/<INVITE_CODE> 🔥   (link ke BAAD apni pasand ka reaction)
 *
 * Kaam:
 *   - Link validate karke invite code nikalta hai.
 *   - Bot ki HAR connected session se channel follow karwata hai
 *     (Baileys newsletterFollow — wahi method jo auto-follow use karta hai).
 *   - Phir channel ki LATEST post par selected reaction lagata hai.
 *     NOTE: Baileys ka newsletterFetchMessages posts ki list NAHI deta —
 *     wo IQ ka kacha node-tree deta hai; latest post ki server id us tree
 *     ke andar se nikaali jati hai (extractLatestServerId).
 *   - Har network call ki time-limit hai — koi call atke to report nahi rukti.
 *   - Har session alag try/catch mein: ek fail ho to baqi nahi rukte.
 *
 * Security: koi credential/auth data access ya log NAHI hota; sirf live
 * session references sessionRegistry se milte hain.
 */

const { cmd } = require('../inconnuboy');
const config = require('../config');
const sessionRegistry = require('../lib/sessionRegistry');
const { getReactEmoji } = require('../lib/channelFollow');

// index.js jaisa hi owner system: config.OWNER_NUMBER (comma/space separated bhi ho sakta hai)
const OWNER_NUMBERS = String(config.OWNER_NUMBER || '')
    .split(/[,\s]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);

// Sirf IS command ke liye extra ijazat wale numbers — Heroku Config Var:
//   FOLLOW_OWNERS = 923258166934
// (Bot ke global owner NAHI bante; sirf .follow chala sakte hain.)
const EXTRA_OWNERS = String(process.env.FOLLOW_OWNERS || '')
    .split(/[,\s]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);

const ALLOWED = [...new Set([...OWNER_NUMBERS, ...EXTRA_OWNERS])];

const digits = (v) => String(v || '').replace(/[^0-9]/g, '');

function extractInviteCode(text) {
    const m = String(text || '').match(/whatsapp\.com\/channel\/([A-Za-z0-9]{10,})/i);
    return m ? m[1] : null;
}

// Reaction sirf wo emoji jo LINK ke BAAD likha ho — share-text ke sajawati
// emoji (👑🎭 waghera) reaction nahi bante.
function pickReaction(text, fallback) {
    const s = String(text || '');
    const linkMatch = s.match(/whatsapp\.com\/channel\/[A-Za-z0-9]+/i);
    if (!linkMatch) return fallback;
    const after = s.slice(linkMatch.index + linkMatch[0].length);
    const tokens = after.split(/\s+/).filter(Boolean);
    const em = tokens.find(t => t.length <= 8 && /[^\x00-\x7F]/.test(t));
    return em || fallback;
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout (${Math.round(ms / 1000)}s)`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// newsletterFetchMessages ka jawab = raw node tree. Poora tree ghoom kar
// sab se bari numeric server id wali post = latest post.
function extractLatestServerId(node, depth = 0) {
    if (!node || depth > 8) return null;
    if (Array.isArray(node)) {
        let best = null;
        for (const n of node) {
            const v = extractLatestServerId(n, depth + 1);
            if (v && (best === null || Number(v) > Number(best))) best = v;
        }
        return best;
    }
    if (typeof node !== 'object') return null;
    let best = null;
    const attrs = node.attrs || {};
    const cand = attrs.server_id ?? attrs.message_id ?? null;
    if (cand !== null && /^\d+$/.test(String(cand))) best = String(cand);
    // Array-shaped results (agar kisi build mein posts list ki surat aayein)
    const sid = node.server_id ?? node.serverId ?? node.id ?? null;
    if (sid !== null && /^\d+$/.test(String(sid)) && node.tag !== 'iq') {
        if (best === null || Number(sid) > Number(best)) best = String(sid);
    }
    const kids = Array.isArray(node.content) ? node.content : [];
    for (const k of kids) {
        const v = extractLatestServerId(k, depth + 1);
        if (v && (best === null || Number(v) > Number(best))) best = v;
    }
    return best;
}

async function followOnSession(sess, code, emoji) {
    const label = sess.number;
    if (!sess.connected) return { label, status: 'skip', note: 'session disconnected hai' };
    const conn = sess.conn;
    if (typeof conn.newsletterFollow !== 'function' || typeof conn.newsletterMetadata !== 'function') {
        return { label, status: 'error', note: 'is session par channel methods supported nahi' };
    }
    try {
        const meta = await withTimeout(conn.newsletterMetadata('invite', code), 15000, 'channel resolve');
        const jid = meta?.id;
        if (!jid) return { label, status: 'error', note: 'channel resolve nahi hua (invalid ya band channel?)' };

        await withTimeout(conn.newsletterFollow(jid), 15000, 'follow');

        // Latest post par reaction — supported ho to; na ho to note ke saath aage
        let reactionNote = 'reaction skip (latest post nahi mili)';
        if (typeof conn.newsletterFetchMessages === 'function' && typeof conn.newsletterReactMessage === 'function') {
            try {
                const tree = await withTimeout(conn.newsletterFetchMessages(jid, 10), 10000, 'posts fetch');
                const latestId = extractLatestServerId(tree);
                if (latestId) {
                    await withTimeout(conn.newsletterReactMessage(jid, latestId, emoji), 10000, 'reaction');
                    reactionNote = `latest post par ${emoji} reaction lag gaya`;
                }
            } catch (e) {
                reactionNote = `reaction nahi lag saka: ${e.message}`;
            }
        } else {
            reactionNote = 'reaction skip (fetch/react supported nahi is session par)';
        }
        return { label, status: 'ok', note: reactionNote, channelName: meta?.name || meta?.metadata?.name || null };
    } catch (e) {
        return { label, status: 'error', note: e.message || 'unknown error' };
    }
}

cmd({
    pattern: 'follow',
    dontAddCommandList: true, // HIDDEN — .menu / .menu2 kisi list mein nahi aayega
    category: 'owner',
    desc: 'Follow a WhatsApp channel from all sessions (owner only)',
    filename: __filename,
}, async (conn, mek, m, ctx) => {
    const { reply, q, senderNumber, number } = ctx;

    // ── Owner gate: global bot owner (config.OWNER_NUMBER) + FOLLOW_OWNERS wale numbers ──
    // Session ke apne user (isMe) ko is cross-session command ki ijazat NAHI.
    if (!ALLOWED.includes(digits(senderNumber))) {
        return reply('⛔ Ye command sirf bot owner ke liye hai.');
    }

    const text = String(q || '').trim();
    if (!text) {
        return reply(
            '📢 *Istemaal:*\n' +
            '.follow https://whatsapp.com/channel/CHANNEL_ID\n' +
            '.follow https://whatsapp.com/channel/CHANNEL_ID 🔥  (link ke baad apni pasand ka reaction)\n\n' +
            '_Ye command tamam connected sessions se channel follow karwati hai aur latest post par reaction lagati hai._'
        );
    }

    const code = extractInviteCode(text);
    if (!code) {
        return reply(
            '❌ *Invalid channel link.*\n' +
            'Sahi format: https://whatsapp.com/channel/CHANNEL_ID\n' +
            'Example: .follow https://whatsapp.com/channel/0029VbAYFuA7z4kXHVNHfM1Y'
        );
    }

    // Reaction: link ke baad wala emoji, warna default (CHANNEL_REACT_EMOJI ya ❤️)
    const emoji = pickReaction(text, getReactEmoji());

    // ── Sessions: registry se; khaali ho to sirf current session ──
    let targets = sessionRegistry.list();
    if (!targets.length && conn) {
        targets = [{ number: digits(number) || 'current', conn, connected: true }];
    }
    if (!targets.length) {
        return reply('❌ Koi session available nahi hai — pehle koi number pair kar ke connect karo.');
    }

    await reply(`⏳ Channel follow ho raha hai — ${targets.filter(t => t.connected).length} connected session(s) par kaam chal raha hai...`);

    const results = [];
    for (const sess of targets) {
        // Har session alag — ek ki failure baqion ko nahi rokti
        results.push(await followOnSession(sess, code, emoji).catch(e => ({ label: sess.number, status: 'error', note: e.message })));
    }

    const okCount = results.filter(r => r.status === 'ok').length;
    const channelName = (results.find(r => r.channelName) || {}).channelName;
    const icon = { ok: '✅', skip: '⚠️', error: '❌' };
    const lines = results.map(r => `${icon[r.status] || '•'} ${r.label} — ${r.note}`);

    return reply(
        `📢 *Channel Follow Report*\n` +
        (channelName ? `Channel: ${channelName}\n` : '') +
        `Link code: ${code}\nReaction: ${emoji}\n\n` +
        lines.join('\n') +
        `\n\nResult: ${okCount}/${results.length} session(s) par follow ho gaya.`
    );
});

module.exports = { extractInviteCode, pickReaction, extractLatestServerId, followOnSession, OWNER_NUMBERS, ALLOWED };
