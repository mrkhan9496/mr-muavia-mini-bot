// 👥 GROUP extra commands
const { cmd } = require('../inconnuboy');
const config = require('../config');

function guard(ctx, needBot = true) {
    const { isGroup, isAdmins, isOwner, isBotAdmins, reply } = ctx;
    if (!isGroup) { reply('❌ Ye command sirf *groups* me chalti hai.'); return false; }
    if (!isAdmins && !isOwner) { reply('❌ Sirf *group admins* ye command use kar sakte hain.'); return false; }
    if (needBot && !isBotAdmins) { reply('❌ Pehle bot ko *group admin* banao.'); return false; }
    return true;
}

function targets(mek, m, args) {
    const ci = (m.msg && m.msg.contextInfo) || {};
    const list = [...(ci.mentionedJid || [])];
    if (!list.length && m.quoted && m.quoted.sender) list.push(m.quoted.sender);
    if (!list.length) {
        const n = (args[0] || '').replace(/[^0-9]/g, '');
        if (n.length >= 8) list.push(n + '@s.whatsapp.net');
    }
    return list;
}

cmd({ pattern: 'grouplink', alias: ['gclink', 'linkgc'], desc: 'Group ka invite link', category: 'group', react: '🔗', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        const code = await conn.groupInviteCode(ctx.from);
        ctx.reply(`🔗 *Group Link*\nhttps://chat.whatsapp.com/${code}`);
    });

cmd({ pattern: 'revoke', alias: ['resetlink', 'revokelink'], desc: 'Group link reset karo', category: 'group', react: '♻️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        await conn.groupRevokeInvite(ctx.from);
        ctx.reply('✅ Group link reset ho gaya. Naya link: *.grouplink*');
    });

cmd({ pattern: 'remove', alias: ['kick'], desc: 'Member ko group se nikalo', category: 'group', react: '🥾', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        const list = targets(mek, m, ctx.args).filter((j) => j.split('@')[0] !== ctx.botNumber);
        if (!list.length) return ctx.reply('⚠️ Jisko nikalna hai usay mention/reply karo.\nExample: *.kick @user*');
        await conn.groupParticipantsUpdate(ctx.from, list, 'remove');
        conn.sendMessage(ctx.from, { text: `🥾 Nikal diya: ${list.map((j) => '@' + j.split('@')[0]).join(' ')}`, mentions: list }, { quoted: mek });
    });

cmd({ pattern: 'promote', alias: ['admin', 'makeadmin'], desc: 'Member ko admin banao', category: 'group', react: '⬆️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        const list = targets(mek, m, ctx.args);
        if (!list.length) return ctx.reply('⚠️ Jisko admin banana hai usay mention/reply karo.');
        await conn.groupParticipantsUpdate(ctx.from, list, 'promote');
        conn.sendMessage(ctx.from, { text: `⬆️ Admin ban gaye: ${list.map((j) => '@' + j.split('@')[0]).join(' ')}`, mentions: list }, { quoted: mek });
    });

cmd({ pattern: 'demote', alias: ['dismiss', 'removeadmin'], desc: 'Admin ko member banao', category: 'group', react: '⬇️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        const list = targets(mek, m, ctx.args);
        if (!list.length) return ctx.reply('⚠️ Jis admin ko hatana hai usay mention/reply karo.');
        await conn.groupParticipantsUpdate(ctx.from, list, 'demote');
        conn.sendMessage(ctx.from, { text: `⬇️ Admin se hata diya: ${list.map((j) => '@' + j.split('@')[0]).join(' ')}`, mentions: list }, { quoted: mek });
    });

cmd({ pattern: 'delete', alias: ['del', 'dlt'], desc: 'Reply kiya hua message delete karo', category: 'group', react: '🗑️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!m.quoted) return ctx.reply('⚠️ Jis message ko delete karna hai usay reply karke *.delete* likho.');
        if (ctx.isGroup && !ctx.isAdmins && !ctx.isOwner) return ctx.reply('❌ Sirf admins.');
        const key = { remoteJid: ctx.from, fromMe: m.quoted.key.fromMe, id: m.quoted.id, participant: m.quoted.key.participant || m.quoted.sender };
        await conn.sendMessage(ctx.from, { delete: key });
        conn.sendMessage(ctx.from, { delete: mek.key }).catch(() => {});
    });

cmd({ pattern: 'getpic', alias: ['gpp', 'grouppp'], desc: 'Group ki DP', category: 'group', react: '🖼️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!ctx.isGroup) return ctx.reply('❌ Ye command sirf groups me chalti hai.');
        let url;
        try { url = await conn.profilePictureUrl(ctx.from, 'image'); } catch (_) {}
        if (!url) return ctx.reply('❌ Is group ki koi DP nahi hai.');
        await conn.sendMessage(ctx.from, { image: { url }, caption: `🖼️ *${ctx.groupName}*\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
    });

cmd({ pattern: 'ginfo', alias: ['groupinfo', 'gcinfo'], desc: 'Group ki info', category: 'group', react: 'ℹ️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!ctx.isGroup) return ctx.reply('❌ Ye command sirf groups me chalti hai.');
        const md = ctx.groupMetadata || (await conn.groupMetadata(ctx.from));
        const admins = ctx.groupAdmins.length ? md.participants.filter((p) => p.admin).length : 0;
        const text =
`ℹ️ *GROUP INFO*

📛 *Name:* ${md.subject}
🆔 *ID:* ${md.id}
👥 *Members:* ${md.participants.length}
👑 *Admins:* ${admins}
📅 *Created:* ${md.creation ? new Date(md.creation * 1000).toLocaleDateString() : '-'}
🔒 *Only admins send:* ${md.announce ? 'Yes' : 'No'}
📝 *Description:*
${md.desc || '-'}

> ${config.BOT_FOOTER}`;
        await conn.sendMessage(ctx.from, { text }, { quoted: mek });
    });

cmd({ pattern: 'updategname', alias: ['setgname', 'gname'], desc: 'Group ka naam badlo', category: 'group', react: '✏️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        if (!ctx.q) return ctx.reply('⚠️ Naya naam likho.\nExample: *.updategname My Group*');
        await conn.groupUpdateSubject(ctx.from, ctx.q.slice(0, 100));
        ctx.reply('✅ Group ka naam badal gaya.');
    });

cmd({ pattern: 'updategdesc', alias: ['setgdesc', 'gdesc'], desc: 'Group ki description badlo', category: 'group', react: '📝', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        if (!ctx.q) return ctx.reply('⚠️ Nayi description likho.\nExample: *.updategdesc Welcome everyone*');
        await conn.groupUpdateDescription(ctx.from, ctx.q);
        ctx.reply('✅ Group description badal gayi.');
    });

cmd({ pattern: 'lockgc', desc: 'Group lock (sirf admins msg karen)', category: 'group', react: '🔒', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        await conn.groupSettingUpdate(ctx.from, 'announcement');
        ctx.reply('🔒 Group lock ho gaya — ab sirf admins msg kar sakte hain.');
    });

cmd({ pattern: 'unlockgc', desc: 'Group unlock (sab msg karen)', category: 'group', react: '🔓', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        await conn.groupSettingUpdate(ctx.from, 'not_announcement');
        ctx.reply('🔓 Group unlock ho gaya — ab sab msg kar sakte hain.');
    });

cmd({ pattern: 'tagadmins', alias: ['admins', 'listadmins'], desc: 'Saare admins ko tag karo', category: 'group', react: '👑', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!ctx.isGroup) return ctx.reply('❌ Ye command sirf groups me chalti hai.');
        const md = ctx.groupMetadata || (await conn.groupMetadata(ctx.from));
        const admins = md.participants.filter((p) => p.admin).map((p) => p.phoneNumber || p.jid || p.id);
        if (!admins.length) return ctx.reply('❌ Koi admin nahi mila.');
        const text = `👑 *GROUP ADMINS*\n\n${ctx.q ? ctx.q + '\n\n' : ''}${admins.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n')}`;
        await conn.sendMessage(ctx.from, { text, mentions: admins }, { quoted: mek });
    });

cmd({ pattern: 'kickall3', desc: 'Saare non-admin members nikalo', category: 'group', react: '☠️', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!guard(ctx)) return;
        const md = ctx.groupMetadata || (await conn.groupMetadata(ctx.from));
        const list = md.participants.filter((p) => !p.admin).map((p) => p.id);
        if (!list.length) return ctx.reply('❌ Koi non-admin member nahi hai.');
        await ctx.reply(`☠️ ${list.length} members nikaale ja rahe hain...`);
        for (let i = 0; i < list.length; i += 5) {
            await conn.groupParticipantsUpdate(ctx.from, list.slice(i, i + 5), 'remove').catch(() => {});
            await new Promise((r) => setTimeout(r, 1500));
        }
        ctx.reply('✅ Kaam ho gaya.');
    });

cmd({ pattern: 'senddm', alias: ['dm', 'pm'], desc: 'Kisi ko DM bhejo: .senddm 92300xxx|message', category: 'group', react: '📨', filename: __filename },
    async (conn, mek, m, ctx) => {
        if (!ctx.isOwner) return ctx.reply('❌ Ye command sirf owner ke liye hai.');
        const ci = (m.msg && m.msg.contextInfo) || {};
        let jid = ci.mentionedJid && ci.mentionedJid[0];
        let text = ctx.q;
        if (!jid) {
            const [num, ...rest] = ctx.q.split('|');
            const n = (num || '').replace(/[^0-9]/g, '');
            if (n.length < 8) return ctx.reply('⚠️ Use: *.senddm 923001234567|Hello*');
            jid = n + '@s.whatsapp.net';
            text = rest.join('|').trim();
        } else text = ctx.q.replace(/@\d+/g, '').trim();
        if (!text) return ctx.reply('⚠️ Message bhi likho.');
        await conn.sendMessage(jid, { text });
        ctx.reply('✅ Message bhej diya.');
    });
