/**
 * follow-channel.js — Queen MD  [.follow]
 *
 * OWNER-ONLY, HIDDEN command (menu mein nahi aata — dontAddCommandList).
 *
 * Istemal:
 *   .follow https://whatsapp.com/channel/<INVITE_CODE>
 *   .follow https://whatsapp.com/channel/<INVITE_CODE> 🔥   (apni pasand ka reaction)
 *
 * Kaam:
 *   - Link validate karke invite code nikalta hai.
 *   - Bot ki HAR connected session se channel follow karwata hai
 *     (Baileys newsletterFollow — wahi method jo auto-follow use karta hai).
 *   - Phir channel ki LATEST post par selected reaction lagata hai
 *     (newsletterFetchMessages + newsletterReactMessage) — jahan supported ho.
 *   - Har session alag try/catch mein: ek fail ho to baqi nahi rukte.
 *   - Aakhir mein per-session report bhejta hai.
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

const digits = (v) => String(v || '').replace(/[^0-9]/g, '');

function extractInviteCode(text) {
    const m = String(text || '').match(/whatsapp\.com\/channel\/([A-Za-z0-9]{10,})/i);
    return m ? m[1] : null;
}

// Fetch ki gayi post se server id ke tamam known shapes try karo
function postServerId(item) {
    if (!item || typeof item !== 'object') return null;
    const cand = item.server_id ?? item.serverId ?? item.id ?? item.messageId ?? null;
    if (cand === null || cand === undefined || cand === '') return null;
    return String(cand);
}

async function followOnSession(sess, code, emoji) {
    const label = sess.number;
    if (!sess.connected) return { label, status: 'skip', note: 'session disconnected hai' };
    const conn = sess.conn;
    if (typeof conn.newsletterFollow !== 'function' || typeof conn.newsletterMetadata !== 'function') {
        return { label, status: 'error', note: 'is session par channel methods supported nahi' };
    }
    try {
        const meta = await conn.newsletterMetadata('invite', code);
        const jid = meta?.id;
        if (!jid) return { label, status: 'error', note: 'channel resolve nahi hua (invalid ya band channel?)' };

        await conn.newsletterFollow(jid);

        // Latest post par reaction — supported ho to; na ho to note ke saath aage
        let reactionNote = 'reaction skip (latest post nahi mili)';
        if (typeof conn.newsletterFetchMessages === 'function' && typeof conn.newsletterReactMessage === 'function') {
            try {
                const posts = await conn.newsletterFetchMessages(jid, 5, 0, 0);
                const arr = Array.isArray(posts) ? posts : (Array.isArray(posts?.messages) ? posts.messages : []);
                // Latest = sab se bari server id wali post (fetch order par bharosa nahi)
                let latest = null, latestId = null;
                for (const p of arr) {
                    const sid = postServerId(p);
                    if (sid && (latestId === null || Number(sid) > Number(latestId))) { latest = p; latestId = sid; }
                }
                if (latestId) {
                    await conn.newsletterReactMessage(jid, latestId, emoji);
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

    // ── Owner gate: SIRF global bot owner (config.OWNER_NUMBER) ──
    // Session ke apne user (isMe) ko is cross-session command ki ijazat NAHI.
    if (!OWNER_NUMBERS.includes(digits(senderNumber))) {
        return reply('⛔ Ye command sirf bot owner ke liye hai.');
    }

    const text = String(q || '').trim();
    if (!text) {
        return reply(
            '📢 *Istemaal:*\n' +
            '.follow https://whatsapp.com/channel/CHANNEL_ID\n' +
            '.follow https://whatsapp.com/channel/CHANNEL_ID 🔥  (apni pasand ka reaction)\n\n' +
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

    // Reaction: doosra token emoji ho to wahi, warna default (CHANNEL_REACT_EMOJI ya ❤️)
    const tokens = text.split(/\s+/);
    let emoji = getReactEmoji();
    const maybeEmoji = tokens.find(t => !/whatsapp\.com/i.test(t) && t.length <= 8 && /[^\x00-\x7F]/.test(t));
    if (maybeEmoji) emoji = maybeEmoji;

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

module.exports = { extractInviteCode, postServerId, followOnSession, OWNER_NUMBERS };
