// 👑 OWNER commands: owner, block, unblock, fullpp, setpp, restart, shutdown, updatecmd
const { cmd, commands } = require('../inconnuboy');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { getMediaBuffer } = require('../lib/util');

const onlyOwner = (reply) => reply('❌ Ye command sirf *owner* ke liye hai.');

cmd({ pattern: 'owner', alias: ['creator', 'dev'], desc: 'Owner ka contact', category: 'owner', react: '👑', filename: __filename },
    async (conn, mek, m, { from, botNumber, userConfig: u }) => {
        const name = u.ownername || config.OWNER_NAME;
        const num = String(config.OWNER_NUMBER || '').split(',')[0].replace(/[^0-9]/g, '') || botNumber;
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${u.botname || config.BOT_NAME};\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`;
        await conn.sendMessage(from, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: mek });
        await conn.sendMessage(from, { text: `👑 *Owner:* ${name}\n📞 wa.me/${num}\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
    });

async function targetJid(mek, m, args, from, isGroup) {
    const ctxInfo = (m.msg && m.msg.contextInfo) || {};
    if (ctxInfo.mentionedJid && ctxInfo.mentionedJid[0]) return ctxInfo.mentionedJid[0];
    if (m.quoted && m.quoted.sender) return m.quoted.sender;
    const n = (args[0] || '').replace(/[^0-9]/g, '');
    if (n.length >= 8) return n + '@s.whatsapp.net';
    if (!isGroup) return from;
    return null;
}

cmd({ pattern: 'block', desc: 'User ko block karo', category: 'owner', react: '🚫', filename: __filename },
    async (conn, mek, m, { from, args, reply, isOwner, isGroup }) => {
        if (!isOwner) return onlyOwner(reply);
        const jid = await targetJid(mek, m, args, from, isGroup);
        if (!jid) return reply('⚠️ Kisi ko mention/reply karo ya number likho.\nExample: *.block 923001234567*');
        await conn.updateBlockStatus(jid, 'block');
        reply(`🚫 Block ho gaya: @${jid.split('@')[0]}`);
    });

cmd({ pattern: 'unblock', desc: 'User ko unblock karo', category: 'owner', react: '✅', filename: __filename },
    async (conn, mek, m, { from, args, reply, isOwner, isGroup }) => {
        if (!isOwner) return onlyOwner(reply);
        const jid = await targetJid(mek, m, args, from, isGroup);
        if (!jid) return reply('⚠️ Kisi ko mention/reply karo ya number likho.\nExample: *.unblock 923001234567*');
        await conn.updateBlockStatus(jid, 'unblock');
        reply(`✅ Unblock ho gaya: @${jid.split('@')[0]}`);
    });

async function squarePad(buffer) {
    try {
        const sharp = require('sharp');
        return await sharp(buffer).resize(640, 640, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).jpeg().toBuffer();
    } catch (_) { return buffer; }
}

cmd({ pattern: 'fullpp', desc: 'Image reply karke poori DP lagao (crop ke bina)', category: 'owner', react: '🖼️', filename: __filename },
    async (conn, mek, m, { reply, isOwner, botNumber2 }) => {
        if (!isOwner) return onlyOwner(reply);
        const media = await getMediaBuffer(m, ['image']);
        if (!media) return reply('⚠️ Kisi *image* ko reply karke *.fullpp* likho.');
        await conn.updateProfilePicture(botNumber2, await squarePad(media.buffer));
        reply('✅ Profile picture (full) set ho gayi!');
    });

cmd({ pattern: 'setpp', alias: ['setdp'], desc: 'Image reply karke DP lagao', category: 'owner', react: '🖼️', filename: __filename },
    async (conn, mek, m, { reply, isOwner, botNumber2 }) => {
        if (!isOwner) return onlyOwner(reply);
        const media = await getMediaBuffer(m, ['image']);
        if (!media) return reply('⚠️ Kisi *image* ko reply karke *.setpp* likho.');
        await conn.updateProfilePicture(botNumber2, media.buffer);
        reply('✅ Profile picture set ho gayi!');
    });

cmd({ pattern: 'restart', alias: ['reboot'], desc: 'Bot restart (sab sessions khud wapas aayengi)', category: 'owner', react: '♻️', filename: __filename },
    async (conn, mek, m, { reply, isOwner }) => {
        if (!isOwner) return onlyOwner(reply);
        await reply('♻️ Bot restart ho raha hai... 10-20 second me wapas online ✅');
        global.queenApi && global.queenApi.restartProcess();
    });

cmd({ pattern: 'shutdown', alias: ['poweroff', 'stopbot'], desc: 'Apna bot band karo', category: 'owner', react: '🔌', filename: __filename },
    async (conn, mek, m, { reply, isOwner, number }) => {
        if (!isOwner) return onlyOwner(reply);
        await reply('🔌 Bot band ho raha hai.\nDobara chalane ke liye pair page par apna number daalo.');
        setTimeout(() => global.queenApi && global.queenApi.stopSession(number), 1500);
    });

cmd({ pattern: 'updatecmd', alias: ['reloadcmd', 'update'], desc: 'Plugins dobara load karo', category: 'owner', react: '🔄', filename: __filename },
    async (conn, mek, m, { reply, isOwner }) => {
        if (!isOwner) return onlyOwner(reply);
        const dir = __dirname;
        const keep = commands.slice();
        try {
            commands.length = 0;
            for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
                const p = path.join(dir, f);
                delete require.cache[require.resolve(p)];
                require(p);
            }
            reply(`✅ Plugins reload ho gaye.\n📚 Total commands: *${commands.length}*`);
        } catch (e) {
            commands.length = 0; keep.forEach((c) => commands.push(c));
            reply('❌ Reload fail, purani commands wapas laga di: ' + e.message);
        }
    });
