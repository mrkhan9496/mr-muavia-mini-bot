//---------------------------------------------------------------------------
//           Queen MD - DRAMA / EPISODE DOWNLOADER
//---------------------------------------------------------------------------
//  🚀 Engine: lib/ytVideo.js (2026-10-23) — wahi jo .video ka hai.
//  Pehle ye command sirf Jawad-Tech API par tha jo DEAD hai (HTTP 500);
//  ab asal file yt-dlp/cobalt engine se aati hai, document bana kar.
//---------------------------------------------------------------------------

const { cmd } = require('../inconnuboy');
const fs = require('fs');
const ytVideo = require('../lib/ytVideo');

cmd({
    pattern: "drama",
    alias: ["ep", "episode", "darama"],
    desc: "Download drama episodes / YouTube videos as document.",
    category: "download",
    react: "📺",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, command }) => {
    let dl = null;
    try {
        if (!q) return reply(`📺 *Drama Downloader*\n\nUsage: \`${prefix + command} <name or link>\`\nExample: \`${prefix + command} kabhi main kabhi tum ep5\``);

        await conn.sendMessage(from, { react: { text: "🔍", key: mek.key } });

        const id = ytVideo.parseYouTubeId(q);
        const meta = id ? await ytVideo.getVideoMeta(id) : await ytVideo.searchTopVideo(q);

        const infoText =
            `\n📺 *DRAMA DOWNLOADER* 📺\n\n` +
            `🎞️ *Title:* ${meta.title}\n` +
            (meta.channel ? `📺 *Channel:* ${meta.channel}\n` : '') +
            `⏱️ *Duration:* ${meta.durationText}\n` +
            `\n_📥 Episode file tayyar ho rahi hai..._\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ QUEEN MD 👑`;
        await conn.sendMessage(from, { image: { url: meta.thumbnail }, caption: infoText }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        if (meta.isLive) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`🔴 Ye LIVE hai — live stream download nahi hoti.\nYahan dekho: ${meta.url}`);
        }

        dl = await ytVideo.downloadToFile(meta.id);
        const buf = fs.readFileSync(dl.path);
        const safeName = String(meta.title || 'drama').replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'drama';
        await conn.sendMessage(from, {
            document: buf,
            fileName: `${safeName}.mp4`,
            mimetype: 'video/mp4',
            caption: `🎬 *${meta.title}*\n\n*© ᴘᴏᴡᴇʀᴇᴅ ʙʏ QUEEN MD 👑`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (e) {
        console.error("Drama DL Error:", e && e.code, e && e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        if (e instanceof ytVideo.YtError) {
            const vid = ytVideo.parseYouTubeId(q || '');
            return reply(`❌ ${e.message}` + (vid ? `\n\n🔗 YouTube par dekho: https://www.youtube.com/watch?v=${vid}` : ''));
        }
        reply(`⚠️ *Error:* ${e.message || "Something went wrong."}`);
    } finally {
        if (dl) ytVideo.cleanupDownload(dl);
    }
});
