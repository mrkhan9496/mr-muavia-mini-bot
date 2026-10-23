//---------------------------------------------------------------------------
//           Queen MD - FACEBOOK VIDEO DOWNLOADER
//---------------------------------------------------------------------------
//  🚀 HIGH-SPEED FB VIDEO DOWNLOADS (LID & NEWSLETTER SUPPORT)
//---------------------------------------------------------------------------

const { cmd } = require('../inconnuboy');
const axios = require('axios');
const { genericDl, mediaUrls } = require('../lib/dl');
const config = require('../config');

// Newsletter Context for professional look
const newsletterContext = {
    forwardingScore: 999,
    isForwarded: true,
};

/**
 * Facebook provider — 2026-10-23: fsaver.net scrape khatam ho gaya tha
 * (302 redirect); ab siputzx API + ruhend-scraper fallback.
 */
const FSaver = {

    download: async (videoUrl) => {
        // 2026-10-23: fsaver.net ka scrape contract khatam (ab 302 redirect
        // deta hai) — asal providers: siputzx (zinda, verified) phir
        // ruhend-scraper fallback.
        try {
            const r = await genericDl(videoUrl, ['https://api.siputzx.my.id/api/d/facebook?url=']);
            if (r && r.url) return r.url;
        } catch (_) {}
        try {
            const rs = require('ruhend-scraper');
            const d = rs.fbdl ? await rs.fbdl(videoUrl) : null;
            const urls = d ? mediaUrls(d) : [];
            if (urls.length) return urls[0];
        } catch (_) {}
        return null;
    }
};

// --- COMMAND: FACEBOOK ---

cmd({
    pattern: "fb",
    alias: ["facebook", "fbdl"],
    desc: "Download videos from Facebook.",
    category: "download",
    react: "🎬",
    filename: __filename,
}, async (conn, mek, m, { from, text, reply }) => {
    if (!text) return reply("🎬 *Facebook Downloader*\n\nUsage: `.fb <video link>`\nExample: `.fb https://www.facebook.com/watch/?v=123...` ");

    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // 1. Scraping the video link
        const videoUrl = await FSaver.download(text);

        if (!videoUrl) {
            return reply("❌ Video not found. Please make sure the link is public and correct.");
        }

        const caption = `╭──〔 *🎬 FACEBOOK DOWNLOAD* 〕  
├─ 🔗 *Source:* Facebook
├─ 📂 *Format:* MP4 (HD/SD)
╰───────────────────🚀

*🚀 Powered by QUEEN MD 👑*`;

        // 2. Sending Video with Newsletter Context
        await conn.sendMessage(from, { 
            video: { url: videoUrl }, 
            caption: caption,
            contextInfo: newsletterContext
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("FB Command Error:", e);
        reply("❌ An error occurred while processing your request.");
    }
});
