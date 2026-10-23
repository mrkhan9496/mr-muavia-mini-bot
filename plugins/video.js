//---------------------------------------------------------------------------
//           Queen MD - YOUTUBE VIDEO DOWNLOADER
//---------------------------------------------------------------------------
//  🚀 Engine: lib/ytVideo.js (2026-10-23 upgrade)
//  Search: YOUTUBE_API_KEY ho to official YouTube Data API v3 (cached),
//  warna yt-dlp search. Download: yt-dlp se asal MP4 file (audio+video),
//  size cap + verify ke baad. Random community APIs (Jawad-Tech) KHATAM —
//  download na ho to wajah + YouTube link jata hai, jhooti kamyabi nahi.
//---------------------------------------------------------------------------

const { cmd } = require("../inconnuboy");
const fs = require("fs");
const ytVideo = require("../lib/ytVideo");

ytVideo.probeYtDlp().catch(() => {});

cmd(
  {
    pattern: "video",
    alias: ["ytmp4", "vdl"],
    react: "🎥",
    desc: "Search and download videos from YouTube (yt-dlp engine).",
    category: "download",
    filename: __filename,
  },
  async (conn, mek, m, { from, q, reply, prefix, command }) => {
    let dl = null;
    try {
      if (!q) return reply(`🎥 *Video Downloader*\n\nUsage: \`${prefix + command} <name or link>\`\nExample: \`${prefix + command} perfect ed sheeran\``);

      await conn.sendMessage(from, { react: { text: "🔍", key: mek.key } });

      // Step 1: Pehchan — seedha link ya naam se search
      const id = ytVideo.parseYouTubeId(q);
      const meta = id ? await ytVideo.getVideoMeta(id) : await ytVideo.searchTopVideo(q);

      // Step 2: Info card
      const infoText =
        `\n🎥 *YT VIDEO DOWNLOADER* 🎥\n\n` +
        `📌 *Title:* ${meta.title}\n` +
        (meta.channel ? `🎬 *Channel:* ${meta.channel}\n` : '') +
        `⏱️ *Duration:* ${meta.durationText}\n` +
        (meta.views ? `👁️ *Views:* ${Number(meta.views).toLocaleString()}\n` : '') +
        `\n_📥 Processing your video file, please wait..._\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ QUEEN MD 👑`;
      await conn.sendMessage(from, { image: { url: meta.thumbnail }, caption: infoText }, { quoted: mek });
      await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

      // Step 3: Live stream download nahi hoti
      if (meta.isLive) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        return reply(`🔴 Ye video LIVE hai — live stream download nahi hoti.\nYahan dekho: ${meta.url}`);
      }

      // Step 4: Asal file download + verify, phir bhejo
      dl = await ytVideo.downloadToFile(meta.id);
      const buf = fs.readFileSync(dl.path);
      await conn.sendMessage(
        from,
        {
          video: buf,
          mimetype: "video/mp4",
          caption: `✅ *${meta.title}*\n\n*🚀 Powered by QUEEN MD 👑*`,
          contextInfo: {
            externalAdReply: {
              title: "YT VIDEO DOWNLOADER",
              body: meta.title,
              thumbnailUrl: meta.thumbnail,
              sourceUrl: meta.url,
              mediaType: 2,
              renderLargerThumbnail: false
            }
          }
        },
        { quoted: mek }
      );

      await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("Video DL Error:", e && e.code, e && e.message);
      await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
      if (e instanceof ytVideo.YtError) {
        const id = ytVideo.parseYouTubeId(q || '');
        return reply(`❌ ${e.message}` + (id ? `\n\n🔗 YouTube par dekho: https://www.youtube.com/watch?v=${id}` : ''));
      }
      reply(`⚠️ *Error:* ${e.message || "Something went wrong."}`);
    } finally {
      if (dl) ytVideo.cleanupDownload(dl);
    }
  }
);
