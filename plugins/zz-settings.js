// ⚙️ SETTINGS (on/off + value commands) + GUARDS (antilink, antibad, antibot, autoreply ...)
// Sab settings bot ke apne number ki hoti hain (MongoDB me), sirf owner/self-chat se chalti hain.
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { setSetting, unsetSetting } = require('../lib/botSettings');
const { makeSticker } = require('../lib/sticker');
const { uploadCatbox, pick, getMediaBuffer } = require('../lib/util');
const converter = require('../lib/converter');

const ownerOnly = (reply) => reply('❌ Ye command sirf *owner* ke liye hai.');

/* ---------------- ON / OFF commands ---------------- */
function toggle(pattern, alias, key, label, emoji, desc) {
    cmd({ pattern, alias, desc: desc || `${label} on/off`, category: 'settings', react: emoji, filename: __filename },
        async (conn, mek, m, ctx) => {
            const { reply, args, isOwner, number, userConfig, prefix, command } = ctx;
            if (!isOwner) return ownerOnly(reply);
            const a = (args[0] || '').toLowerCase();
            const cur = String(userConfig[key]) === 'true';
            if (!['on', 'off'].includes(a)) {
                return reply(`${emoji} *${label}*\nAbhi: ${cur ? 'ON ✅' : 'OFF ❌'}\n\nUse: *${prefix}${command} on* ya *${prefix}${command} off*`);
            }
            await setSetting(number, key, String(a === 'on'));
            reply(`${emoji} *${label}:* ${a === 'on' ? 'ON ✅' : 'OFF ❌'}`);
        });
}

toggle('autoreact', ['autoreaction'], 'AUTO_REACT', 'Auto React', '😍', 'Har message par auto react');
toggle('creact', ['customreact'], 'CUSTOM_REACT', 'Custom React (cemojis wale)', '🎭');
toggle('autoreply', ['autoresponse'], 'AUTO_REPLY', 'Auto Reply', '💬', 'Hi/Salam jaise msgs ka auto jawab');
toggle('autosticker', ['autostick'], 'AUTO_STICKER', 'Auto Sticker', '🖼️', 'Inbox me image/video ko khud sticker banana');
toggle('autotyping', ['autotype'], 'AUTO_TYPING', 'Auto Typing', '⌨️');
toggle('autorecording', ['autorecoding', 'autorecord', 'recording'], 'AUTO_RECORDING', 'Auto Recording', '🎙️');
toggle('autostatusview', ['autoviewstatus', 'autoview', 'autostatus'], 'AUTO_VIEW_STATUS', 'Auto Status View', '👁️');
toggle('autostatusreact', ['autolikestatus', 'statusreact'], 'AUTO_LIKE_STATUS', 'Auto Status React', '❤️');
toggle('autostatusreply', ['statusreply'], 'AUTO_STATUS_REPLY', 'Auto Status Reply', '📩');
toggle('alwaysonline', ['online'], 'ALWAYS_ONLINE', 'Always Online', '🟢');
toggle('welcome', ['welcomemsg'], 'WELCOME_ENABLE', 'Welcome Message', '👋', 'Group me naye member ka welcome');
toggle('goodbye', ['goodbyemsg', 'bye'], 'GOODBYE_ENABLE', 'Goodbye Message', '😔', 'Member ke jane par goodbye');
toggle('antilink', ['antilinks'], 'ANTI_LINK', 'Anti Link', '🔗', 'Group me links rokna (bot admin ho)');
toggle('antilinkkick', ['linkkick'], 'ANTI_LINK_KICK', 'Anti Link Kick', '🥾', 'Link bhejne wale ko remove karna');
toggle('deletelink', ['dellink'], 'DELETE_LINK', 'Delete Link', '🗑️', 'Link wale msgs delete karna');
toggle('antibad', ['antibadword', 'antiswear'], 'ANTI_BAD', 'Anti Bad Words', '🤬', 'Gaali wale msgs delete');
toggle('antibot', ['antibots'], 'ANTI_BOT', 'Anti Bot', '🤖', 'Group me dusre bots ko hatana');
toggle('anticall', ['antical', 'blockcall'], 'ANTI_CALL', 'Anti Call', '📵');
toggle('read-message', ['readmessage', 'autoread', 'bluetick'], 'READ_MESSAGE', 'Read Messages (blue tick)', '✅');
toggle('mention-reply', ['mentionreply'], 'MENTION_REPLY', 'Mention Reply', '📣', 'Bot ko mention karne par voice reply');
toggle('admin-action', ['adminaction'], 'ADMIN_ACTION', 'Admin Action', '🛡️', 'ON ho to antilink/antibad group admins par bhi lagu');

/* ---------------- VALUE commands ---------------- */
cmd({ pattern: 'prefix', desc: 'Bot ka prefix badlo', category: 'settings', react: '🔣', filename: __filename },
    async (conn, mek, m, { reply, args, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        const v = (args[0] || '').trim();
        if (!v) return reply(`🔣 Abhi prefix: *${prefix}*\n\nUse: *${prefix}prefix !*  (reset: *${prefix}prefix reset*)`);
        if (v.toLowerCase() === 'reset') { await unsetSetting(number, 'prefix'); return reply(`✅ Prefix reset: *${config.PREFIX}*`); }
        if (v.length > 3) return reply('❌ Prefix 3 characters se chhota rakho.');
        await setSetting(number, 'prefix', v);
        reply(`✅ Naya prefix: *${v}*\nAb commands aise chalengi: *${v}menu*`);
    });

cmd({ pattern: 'botname', desc: 'Bot ka naam badlo', category: 'settings', react: '✏️', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        if (!q) return reply(`✏️ Use: *${prefix}botname Mera Bot*  (reset: *${prefix}botname reset*)`);
        if (q.toLowerCase() === 'reset') { await unsetSetting(number, 'botname'); return reply('✅ Bot name reset.'); }
        await setSetting(number, 'botname', q.slice(0, 60));
        reply(`✅ Bot name: *${q.slice(0, 60)}*`);
    });

cmd({ pattern: 'ownername', desc: 'Owner ka naam badlo', category: 'settings', react: '👑', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        if (!q) return reply(`👑 Use: *${prefix}ownername Ali*  (reset: *${prefix}ownername reset*)`);
        if (q.toLowerCase() === 'reset') { await unsetSetting(number, 'ownername'); return reply('✅ Owner name reset.'); }
        await setSetting(number, 'ownername', q.slice(0, 60));
        reply(`✅ Owner name: *${q.slice(0, 60)}*`);
    });

cmd({ pattern: 'botimage', alias: ['setbotimage'], desc: 'Menu/alive ki image badlo (link ya image reply)', category: 'settings', react: '🖼️', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        let url = /^https?:\/\//i.test(q || '') ? q.trim() : null;
        if (!url) {
            const media = await getMediaBuffer(m, ['image']);
            if (!media) return reply(`🖼️ Image ka link do ya kisi *image* ko reply karo.\nReset: *${prefix}botimage reset*`);
            url = await uploadCatbox(media.buffer, 'botimage.jpg');
        }
        if ((q || '').toLowerCase() === 'reset') { await unsetSetting(number, 'botimage'); return reply('✅ Bot image reset.'); }
        await setSetting(number, 'botimage', url);
        reply(`✅ Bot image set ho gayi:\n${url}`);
    });

cmd({ pattern: 'mode', alias: ['worktype'], desc: 'Bot mode: public/private/group/inbox', category: 'settings', react: '🛠️', filename: __filename },
    async (conn, mek, m, { reply, args, isOwner, number, userConfig, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        const v = (args[0] || '').toLowerCase();
        const cur = userConfig.WORK_TYPE || config.WORK_TYPE || 'public';
        if (!['public', 'private', 'group', 'inbox'].includes(v)) {
            return reply(`🛠️ Abhi mode: *${cur}*\n\n*public* = sab\n*private* = sirf owner\n*group* = sirf groups\n*inbox* = sirf inbox\n\nUse: *${prefix}mode private*`);
        }
        await setSetting(number, 'WORK_TYPE', v);
        reply(`✅ Mode ab: *${v}*`);
    });

cmd({ pattern: 'cemojis', alias: ['customemojis'], desc: 'Auto react ke emojis set karo', category: 'settings', react: '😀', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        if (!q) return reply(`😀 Emojis space se alag karke likho.\nExample: *${prefix}cemojis ❤️ 🔥 😎 👑*\nReset: *${prefix}cemojis reset*`);
        if (q.toLowerCase() === 'reset') { await unsetSetting(number, 'CUSTOM_EMOJIS'); return reply('✅ Emojis reset.'); }
        const list = q.split(/\s+/).filter(Boolean).slice(0, 30);
        await setSetting(number, 'CUSTOM_EMOJIS', list);
        reply(`✅ Custom emojis: ${list.join(' ')}\n(Auto react ya creact ON karo)`);
    });

cmd({ pattern: 'setwelcome', desc: 'Welcome message set karo ({user} {name} {group})', category: 'settings', react: '👋', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        if (!q) return reply(`Use: *${prefix}setwelcome Welcome {user} to {group}!*  (reset: *${prefix}setwelcome reset*)`);
        if (q.toLowerCase() === 'reset') { await unsetSetting(number, 'WELCOME_MSG'); return reply('✅ Welcome message reset.'); }
        await setSetting(number, 'WELCOME_MSG', q);
        reply('✅ Welcome message set ho gaya.');
    });

cmd({ pattern: 'setgoodbye', desc: 'Goodbye message set karo ({user} {name} {group})', category: 'settings', react: '😔', filename: __filename },
    async (conn, mek, m, { reply, q, isOwner, number, prefix }) => {
        if (!isOwner) return ownerOnly(reply);
        if (!q) return reply(`Use: *${prefix}setgoodbye Bye {user}!*  (reset: *${prefix}setgoodbye reset*)`);
        if (q.toLowerCase() === 'reset') { await unsetSetting(number, 'GOODBYE_MSG'); return reply('✅ Goodbye message reset.'); }
        await setSetting(number, 'GOODBYE_MSG', q);
        reply('✅ Goodbye message set ho gaya.');
    });

cmd({ pattern: 'settings', alias: ['setting', 'config'], desc: 'Saari settings ka status', category: 'settings', react: '⚙️', filename: __filename },
    async (conn, mek, m, { reply, userConfig: u, prefix, isOwner }) => {
        if (!isOwner) return ownerOnly(reply);
        const on = (k) => (String(u[k]) === 'true' ? '✅' : '❌');
        reply(
`⚙️ *SETTINGS*

🔣 Prefix: *${prefix}*
🛠️ Mode: *${u.WORK_TYPE || config.WORK_TYPE}*
${on('AUTO_REACT')} autoreact   ${on('CUSTOM_REACT')} creact
${on('AUTO_REPLY')} autoreply   ${on('AUTO_STICKER')} autosticker
${on('AUTO_TYPING')} autotyping   ${on('AUTO_RECORDING')} autorecording
${on('AUTO_VIEW_STATUS')} autostatusview   ${on('AUTO_LIKE_STATUS')} autostatusreact
${on('AUTO_STATUS_REPLY')} autostatusreply   ${on('ALWAYS_ONLINE')} alwaysonline
${on('WELCOME_ENABLE')} welcome   ${on('GOODBYE_ENABLE')} goodbye
${on('ANTI_LINK')} antilink   ${on('ANTI_LINK_KICK')} antilinkkick   ${on('DELETE_LINK')} deletelink
${on('ANTI_BAD')} antibad   ${on('ANTI_BOT')} antibot   ${on('ANTI_CALL')} anticall
${on('READ_MESSAGE')} read-message   ${on('MENTION_REPLY')} mention-reply   ${on('ADMIN_ACTION')} admin-action

> ${config.BOT_FOOTER}`);
    });

/* ---------------- GUARDS (har message par chalte hain) ---------------- */
const LINK_RE = /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|[a-z0-9-]+\.(com|net|org|xyz|pk|in|io|me|co|info|online|site|link|app)\b)/i;
const BAD_WORDS = ['fuck', 'bitch', 'asshole', 'bastard', 'pussy', 'slut', 'madarchod', 'behenchod', 'bhenchod', 'chutiya', 'gandu', 'harami', 'randi', 'lund', 'kutti', 'kanjar'];
const BAD_RE = new RegExp(`(^|[^a-z])(${BAD_WORDS.join('|')})([^a-z]|$)`, 'i');
const GREETINGS = {
    salam: 'Walaikum Assalam! 🌸 Kaise hain aap?',
    assalam: 'Walaikum Assalam! 🌸 Kaise hain aap?',
    hi: 'Hello! 👋 Main bot hun, *.menu* likho commands ke liye.',
    hello: 'Hi! 👋 Main bot hun, *.menu* likho commands ke liye.',
    bot: 'Ji, main yahan hun! 🤖 *.menu* likho.',
};
const MENTION_CLIPS = [
    'https://files.catbox.moe/pw4yuu.mp3', 'https://files.catbox.moe/tuueyw.mp3',
    'https://files.catbox.moe/q56rza.mp3', 'https://files.catbox.moe/ldrebe.mp3',
];

cmd({ on: 'body' }, async (conn, mek, m, ctx) => {
    const { from, body, isGroup, isOwner, isAdmins, isBotAdmins, userConfig: u, sender, botNumber2 } = ctx;
    if (mek.key.fromMe) return;

    // ---- Group guards ----
    if (isGroup && !isOwner) {
        const exempt = isAdmins && String(u.ADMIN_ACTION) !== 'true';
        const del = () => conn.sendMessage(from, { delete: mek.key }).catch(() => {});
        const tag = sender.split('@')[0];

        if (!exempt && isBotAdmins) {
            if (String(u.ANTI_BOT) === 'true' && /^BAE5/.test(mek.key.id || '')) {
                await del();
                await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                return;
            }
            if (String(u.ANTI_LINK) === 'true' && LINK_RE.test(body.replace(/[\s\u200b-\u200d\uFEFF]/g, ''))) {
                if (String(u.DELETE_LINK) !== 'false') await del();
                await conn.sendMessage(from, { text: `🚫 *ANTI-LINK*\n@${tag} links bhejna mana hai!`, mentions: [sender] });
                if (String(u.ANTI_LINK_KICK) === 'true') await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                return;
            }
            if (String(u.ANTI_BAD) === 'true' && BAD_RE.test(body)) {
                await del();
                await conn.sendMessage(from, { text: `🚫 *ANTI-BAD WORDS*\n@${tag} gaali dena mana hai!`, mentions: [sender] });
                return;
            }
        }

        // ---- Mention reply ----
        if (String(u.MENTION_REPLY) === 'true') {
            const bot = botNumber2.split('@')[0];
            const mentioned = (mek.mentionedJid || []).some((j) => j.split('@')[0].split(':')[0] === bot);
            if (mentioned) {
                try {
                    await conn.sendPresenceUpdate('recording', from);
                    const { getBuffer } = require('../lib/util');
                    const audio = await getBuffer(pick(MENTION_CLIPS));
                    const ptt = await converter.toPTT(audio, 'mp3');
                    await conn.sendMessage(from, { audio: ptt, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: mek });
                } catch (_) {}
            }
        }
        return;
    }

    // ---- Inbox: auto reply ----
    if (!isGroup && String(u.AUTO_REPLY) === 'true') {
        const word = body.trim().toLowerCase().replace(/[^a-z ]/g, '');
        if (GREETINGS[word]) await conn.sendMessage(from, { text: GREETINGS[word] }, { quoted: mek });
    }
});

// ---- Auto sticker (inbox me image/video aate hi sticker) ----
for (const kind of ['image', 'video']) {
    cmd({ on: kind }, async (conn, mek, m, { from, isGroup, userConfig: u, body, prefix }) => {
        if (isGroup || String(u.AUTO_STICKER) !== 'true') return;
        if (body && body.startsWith(prefix)) return;
        const media = await getMediaBuffer(m, [kind]);
        if (!media) return;
        const buf = await makeSticker(media.buffer, {
            pack: u.botname || 'QnMD MINI', author: u.ownername || 'QnMD Mini', ext: kind === 'video' ? 'mp4' : 'jpg',
        });
        await conn.sendMessage(from, { sticker: buf }, { quoted: mek });
    });
}
