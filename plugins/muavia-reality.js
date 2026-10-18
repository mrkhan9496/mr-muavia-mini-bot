// MR Muavia Mini Bot — REALITY commands (.mard, .sad, .baap)
// Migrated from old muavia-mini-bot. Sends random video from assets folders.
const { cmd } = require('../inconnuboy');
const fs = require('fs');
const path = require('path');

function getVideos(subdir) {
    try {
        const dir = path.join(__dirname, '..', 'assets', subdir);
        return fs.readdirSync(dir)
            .filter(f => /\.(mp4|mov|mkv|webm)$/i.test(f))
            .map(f => path.join(dir, f));
    } catch { return []; }
}

async function sendRandomVideo(conn, mek, from, subdir, caption) {
    const videos = getVideos(subdir);
    if (!videos.length) {
        return await conn.sendMessage(from, { text: '😅 Abhi koi video nahi hai!' }, { quoted: mek });
    }
    const pick = videos[Math.floor(Math.random() * videos.length)];
    await conn.sendMessage(from, {
        video: fs.readFileSync(pick),
        caption: caption
    }, { quoted: mek });
}

cmd({ pattern: "mard", desc: "Random MARD video", category: "reality", react: "🔥" },
async (conn, mek, m, { from }) => {
    await sendRandomVideo(conn, mek, from, 'mard', '🔥 *MARD* 🔥\n> © Powered by MR Muavia Mini Bot');
});

cmd({ pattern: "sad", desc: "Random SAD video", category: "reality", react: "🥀" },
async (conn, mek, m, { from }) => {
    await sendRandomVideo(conn, mek, from, 'sad', '🥀 *SAD* 🥀\n> © Powered by MR Muavia Mini Bot');
});

cmd({ pattern: "baap", desc: "Random BAAP video", category: "reality", react: "👑" },
async (conn, mek, m, { from }) => {
    await sendRandomVideo(conn, mek, from, 'baap', '👑 *BAAP* 👑\n> © Powered by MR Muavia Mini Bot');
});
