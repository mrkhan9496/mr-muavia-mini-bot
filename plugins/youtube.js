// YouTube + Spotify commands: song, video, play2, yts, drama, spotify
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { findVideo, ytDownload, sendRemote, yts } = require('../lib/yt');
const { getJson } = require('../lib/util');

const footer = config.BOT_FOOTER;

async function infoCard(conn, from, mek, v, label) {
    const caption =
        `╭━━〔 ${label} 〕━━━╮\n` +
        `┃ 🎧 *Title:* ${v.title}\n` +
        `┃ ⏱️ *Duration:* ${v.timestamp || '-'}\n` +
        `┃ 👁️ *Views:* ${(v.views || 0).toLocaleString()}\n` +
        `┃ 🔗 ${v.url}\n╰━━━━━━━━━━━━━━━╯\n\n_⏳ Download ho raha hai..._\n\n> ${footer}`;
    const thumb = v.thumbnail || v.image;
    if (thumb) await conn.sendMessage(from, { image: { url: thumb }, caption }, { quoted: mek }).catch(() => conn.sendMessage(from, { text: caption }, { quoted: mek }));
    else await conn.sendMessage(from, { text: caption }, { quoted: mek });
}

async function audioFlow(conn, mek, from, q, reply, label = '🎵 MUSIC FOUND') {
    const v = await findVideo(q);
    if (!v) return reply('❌ Kuch nahi mila. Naam ya link check karo.');
    await infoCard(conn, from, mek, v, label);
    const d = await ytDownload(v.url, 'mp3');
    await sendRemote(conn, from, 'audio', d.url, { mimetype: 'audio/mpeg', fileName: `${v.title}.mp3` }, mek);
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
}

async function videoFlow(conn, mek, from, q, reply, label = '🎬 VIDEO FOUND') {
    const v = await findVideo(q);
    if (!v) return reply('❌ Kuch nahi mila. Naam ya link check karo.');
    await infoCard(conn, from, mek, v, label);
    const d = await ytDownload(v.url, 'mp4');
    await sendRemote(conn, from, 'video', d.url, { mimetype: 'video/mp4', caption: `✅ *${v.title}*\n\n> ${footer}` }, mek);
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
}

cmd({ pattern: 'song', alias: ['play', 'ytmp3', 'audio'], desc: 'YouTube se gana download', category: 'download', react: '🎧', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix, command }) => {
        if (!q) return reply(`❌ Gane ka naam ya YouTube link do.\nExample: *${prefix}${command} tum hi ho*`);
        try { await audioFlow(conn, mek, from, q, reply); }
        catch (e) { reply('❌ Audio download nahi ho saka (sab APIs fail). Thori der baad try karo.\n' + e.message); }
    });

cmd({ pattern: 'video', alias: ['ytmp4', 'vdl', 'ytv', 'video2'], desc: 'YouTube se video download', category: 'download', react: '🎬', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix, command }) => {
        if (!q) return reply(`❌ Video ka naam ya YouTube link do.\nExample: *${prefix}${command} perfect ed sheeran*`);
        try { await videoFlow(conn, mek, from, q, reply); }
        catch (e) { reply('❌ Video download nahi ho saka (sab APIs fail). Thori der baad try karo.\n' + e.message); }
    });

cmd({ pattern: 'play2', desc: 'YouTube se video play', category: 'download', react: '▶️', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`❌ Naam ya link do.\nExample: *${prefix}play2 ya ali*`);
        try { await videoFlow(conn, mek, from, q, reply, '▶️ PLAY'); }
        catch (e) { reply('❌ Download fail: ' + e.message); }
    });

cmd({ pattern: 'drama', alias: ['ep', 'episode', 'darama'], desc: 'Drama episode download (YouTube)', category: 'download', react: '🎭', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`❌ Drama ka naam likho.\nExample: *${prefix}drama kabhi main kabhi tum episode 1*`);
        try { await videoFlow(conn, mek, from, q, reply, '🎭 DRAMA DOWNLOADER'); }
        catch (e) { reply('❌ Drama download fail: ' + e.message); }
    });

cmd({ pattern: 'yts', alias: ['ytsearch'], desc: 'YouTube search', category: 'search', react: '🔎', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`❌ Search ka naam likho.\nExample: *${prefix}yts arijit singh*`);
        try {
            const r = await yts(q);
            const list = (r.videos || []).slice(0, 10);
            if (!list.length) return reply('❌ Kuch nahi mila.');
            let t = `🔎 *YouTube Search:* ${q}\n\n`;
            list.forEach((v, i) => { t += `*${i + 1}. ${v.title}*\n⏱️ ${v.timestamp}  👁️ ${(v.views || 0).toLocaleString()}\n🔗 ${v.url}\n\n`; });
            t += `> ${footer}`;
            await conn.sendMessage(from, { text: t }, { quoted: mek });
        } catch (e) { reply('❌ Error: ' + e.message); }
    });

cmd({ pattern: 'spotify', alias: ['spotifydl'], desc: 'Spotify gana (link ya naam)', category: 'download', react: '🟢', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`❌ Spotify link ya gane ka naam do.\nExample: *${prefix}spotify blinding lights*`);
        try {
            let query = q;
            if (/open\.spotify\.com/i.test(q)) {
                const o = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(q)}`);
                if (o && o.title) query = o.title;
            }
            await audioFlow(conn, mek, from, query, reply, '🟢 SPOTIFY');
        } catch (e) { reply('❌ Spotify gana nahi mila: ' + e.message); }
    });
