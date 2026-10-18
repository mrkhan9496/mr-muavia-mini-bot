/**
 * muavia-oldmini-ported.js — MR Muavia Mini Bot
 * Old Mini Bot (muavia-mini-bot) se ported commands.
 * Source: mrkhan9496/muavia-mini-bot (Old Mini Bot ONLY - NOT MD Bot)
 */

const { cmd } = require('../inconnuboy');
const axios = require('axios');

// ============ QR Code ============
cmd({
    pattern: "qr",
    desc: "Text/link ka QR code banao",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { from, reply, args, q }) => {
    const text = (q || '').trim();
    if (!text) {
        return await reply('❌ Usage:\n.qr <text ya link>\nExample: .qr https://google.com');
    }
    if (text.length > 500) {
        return await reply('❌ Text 500 characters se kam ho.');
    }
    try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        await conn.sendMessage(from, {
            image: Buffer.from(res.data),
            caption: `🔳 *QR Code:*\n${text.slice(0, 200)}\n\n> *© Powered by Muavia Mini Bot*`
        }, { quoted: mek });
    } catch (e) {
        await reply('❌ QR banane mein error: ' + e.message);
    }
});

// ============ Poll ============
cmd({
    pattern: "poll",
    desc: "Group mein poll banao",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { from, reply, args, q, isGroup }) => {
    if (!isGroup) return await reply('❌ Ye command sirf group mein kaam karti hai.');
    const parts = (q || '').split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
        return await reply('❌ Usage:\n.poll <sawal> | <option1> | <option2> | ...\nExample: .poll Best color? | Red | Blue | Green');
    }
    const [question, ...options] = parts;
    try {
        await conn.sendMessage(from, {
            poll: { name: question, values: options.slice(0, 12), selectableCount: 1 }
        }, { quoted: mek });
    } catch (e) {
        await reply('❌ Poll banane mein error: ' + e.message);
    }
});

// ============ Feedback ============
cmd({
    pattern: "feedback",
    desc: "Owner ko feedback bhejo",
    category: "utility",
    filename: __filename
},
async (conn, mek, m, { from, reply, q, sender }) => {
    const text = (q || '').trim();
    if (!text) {
        return await reply('❌ Usage:\n.feedback <tumhara message>\nExample: .feedback Bot bohat acha hai!');
    }
    const OWNER = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    if (!OWNER) {
        return await reply('❌ Owner number configure nahi hai.');
    }
    try {
        await conn.sendMessage(OWNER + '@s.whatsapp.net', {
            text: `📩 *New Feedback*\n\n👤 From: ${sender}\n💬 ${text.slice(0, 500)}\n\n> *© Powered by Muavia Mini Bot*`
        });
        await reply('✅ Feedback bhej diya gaya! Shukriya. 🙏');
    } catch (e) {
        await reply('❌ Feedback nahi bheja ja saka: ' + e.message);
    }
});
