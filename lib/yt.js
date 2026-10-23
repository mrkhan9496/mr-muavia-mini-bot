// YouTube download: kai APIs ek ke baad ek try hoti hain (jo chale usi se file mil jati hai)
const yts = require('yt-search');
const { getJson, tryEach, sleep, getBuffer, axios } = require('./util');

const enc = encodeURIComponent;
const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

function videoIdOf(text) {
    const m = String(text || '').match(YT_RE);
    return m ? m[1] : null;
}

// Naam ya link se video info
async function findVideo(query) {
    const id = videoIdOf(query);
    if (id) {
        const v = await yts({ videoId: id });
        if (v && v.title) return v;
        return { videoId: id, url: `https://youtu.be/${id}`, title: 'YouTube Video' };
    }
    const r = await yts(query);
    if (!r || !r.videos || !r.videos.length) return null;
    return r.videos[0];
}


// kind: 'mp3' | 'mp4'
async function ytDownload(url, kind = 'mp3') {
    const isAudio = kind === 'mp3';
    return tryEach([
        async () => {
            const d = await getJson(`https://yt-dl.officialhectormanuel.workers.dev/?url=${enc(url)}`);
            // 2026-10-23 fix: Hector mp4 mein 'videos' map deta hai
            // ({144: url, 360: url, ...}) — purana code d.video parhta tha
            // jo kabhi aata hi nahi tha, is liye mp4 hamesha fail tha.
            let link = null;
            if (isAudio) link = d.audio;
            else if (d.videos && typeof d.videos === 'object') {
                const keys = Object.keys(d.videos).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
                const pick = keys.filter((k) => k <= 720).pop() || keys.pop();
                if (pick) link = d.videos[pick];
            }
            if (!link && !isAudio) link = d.video || d.video_url;
            return link ? { url: link, title: d.title } : null;
        },
        // siputzx ytmp3/ytmp4 REMOVED 2026-10-23: route hi khatam (404)
        // jawad-tech REMOVED 2026-10-23: DEAD (HTTP 500 har URL par)
        // oceansaver REMOVED 2026-10-23: DEAD (server connection band kar deta hai)
        async () => {
            // ruhend-scraper (agar function maujood ho)
            const rs = require('ruhend-scraper');
            const fn = isAudio ? rs.ytmp3 : rs.ytmp4;
            if (typeof fn !== 'function') return null;
            const r = await fn(url);
            const link = r && (r.audio || r.video || r.url || r.download);
            return link ? { url: link, title: r.title } : null;
        },
        async () => {
            // Aakhri koshish: seedha ytdl-core
            const ytdl = require('ytdl-core');
            const info = await ytdl.getInfo(url);
            const fmt = ytdl.chooseFormat(info.formats, isAudio ? { quality: 'highestaudio', filter: 'audioonly' } : { quality: '18' });
            return fmt && fmt.url ? { url: fmt.url, title: info.videoDetails.title } : null;
        },
    ]);
}

// WhatsApp ko URL se media dena (fail ho to buffer download karke bhejna)
async function sendRemote(conn, from, type, url, extra, quoted) {
    try {
        return await conn.sendMessage(from, { [type]: { url }, ...extra }, { quoted });
    } catch (_) {
        const buffer = await getBuffer(url);
        return conn.sendMessage(from, { [type]: buffer, ...extra }, { quoted });
    }
}

module.exports = { yts, findVideo, videoIdOf, ytDownload, sendRemote };
