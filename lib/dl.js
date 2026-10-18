// Universal downloader helpers: alag alag APIs ka JSON padh kar media link nikalna
const { getJson, tryEach, getBuffer, axios, UA } = require('./util');
const enc = encodeURIComponent;

const BAD_KEY = /thumb|cover|avatar|icon|profile|poster|preview|logo|music|author/i;
const GOOD_KEY = /hd|play|video|download|dl|url|media|link|src/i;

// JSON me se media URLs nikalo (best pehle)
function mediaUrls(obj, { audio = false } = {}) {
    const found = [];
    const seen = new Set();
    (function walk(v, key, depth) {
        if (depth > 8 || v == null) return;
        if (typeof v === 'string') {
            if (!/^https?:\/\//i.test(v) || seen.has(v)) return;
            const isMedia = /\.(mp4|mkv|webm|mov|m4v|jpg|jpeg|png|webp|gif|mp3|m4a|opus)(\?|$)/i.test(v) || GOOD_KEY.test(key || '');
            if (!isMedia) return;
            seen.add(v);
            let score = 0;
            if (BAD_KEY.test(key || '') && !/video/i.test(key || '')) score -= 5;
            if (/hd/i.test(key || '')) score += 3;
            if (/\.(mp4|m4v|webm|mov)(\?|$)/i.test(v)) score += audio ? 0 : 4;
            if (/\.(mp3|m4a|opus)(\?|$)/i.test(v)) score += audio ? 4 : -2;
            if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(v)) score -= 1;
            if (/video|play|download|dl/i.test(key || '')) score += 2;
            found.push({ url: v, score });
        } else if (Array.isArray(v)) v.forEach((x) => walk(x, key, depth + 1));
        else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k, depth + 1);
    })(obj, '', 0);
    return found.sort((a, b) => b.score - a.score).filter((x) => x.score > -5).map((x) => x.url);
}

// endpoints: ['https://api.../?url=', ...]  (url ko encode karke jod diya jata hai)
async function genericDl(url, endpoints, opts = {}) {
    return tryEach(endpoints.map((ep) => async () => {
        const full = typeof ep === 'function' ? ep(url) : ep + enc(url);
        const data = await getJson(full, { timeout: 40000 });
        const list = mediaUrls(data, opts);
        return list.length ? { urls: list, url: list[0], raw: data } : null;
    }));
}

const isImageUrl = (u) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(u);

async function sendAuto(conn, from, link, caption, quoted) {
    if (isImageUrl(link)) return conn.sendMessage(from, { image: { url: link }, caption }, { quoted });
    try {
        return await conn.sendMessage(from, { video: { url: link }, mimetype: 'video/mp4', caption }, { quoted });
    } catch (_) {
        const buf = await getBuffer(link);
        return conn.sendMessage(from, { video: buf, mimetype: 'video/mp4', caption }, { quoted });
    }
}

module.exports = { mediaUrls, genericDl, sendAuto, isImageUrl };
