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

async function oceansaver(url, format) {
    const api = 'dfcb6d76f2f6a9894gjkege8a4ab232222';
    const start = await getJson(`https://p.oceansaver.in/ajax/download.php?copyright=0&format=${format}&url=${enc(url)}&api=${api}`);
    if (!start || !start.id) throw new Error('oceansaver start fail');
    for (let i = 0; i < 25; i++) {
        await sleep(2500);
        const p = await getJson(`https://p.oceansaver.in/ajax/progress.php?id=${start.id}`);
        if (p && p.success === 1 && p.download_url) return { url: p.download_url, title: (start.info && start.info.title) || '' };
    }
    throw new Error('oceansaver timeout');
}

// kind: 'mp3' | 'mp4'
async function ytDownload(url, kind = 'mp3') {
    const isAudio = kind === 'mp3';
    return tryEach([
        async () => {
            const d = await getJson(`https://yt-dl.officialhectormanuel.workers.dev/?url=${enc(url)}`);
            const link = isAudio ? d.audio : (d.video || d.video_url);
            return link ? { url: link, title: d.title } : null;
        },
        async () => {
            const d = await getJson(`https://api.siputzx.my.id/api/d/${isAudio ? 'ytmp3' : 'ytmp4'}?url=${enc(url)}`);
            const link = d && d.data && (d.data.dl || d.data.url);
            return link ? { url: link, title: d.data.title } : null;
        },
        async () => {
            const d = await getJson(`https://jawad-tech.vercel.app/download/ytdl?url=${enc(url)}`);
            const r = d.result || d;
            const link = isAudio ? (r.mp3 || r.audio_url || r.audio) : (r.mp4 || r.video_url || r.video);
            return link ? { url: link, title: r.title } : null;
        },
        async () => oceansaver(url, isAudio ? 'mp3' : '720'),
        async () => oceansaver(url, isAudio ? 'mp3' : '360'),
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
