/**
 * ytVideo.js — Queen MD — .video command ka engine (2026-10-23)
 * (MD bot ke proven engine ka port — binary manager isi file mein hai)
 *
 * Design (Muavia ki spec ke mutabiq):
 * - SEARCH: agar YOUTUBE_API_KEY env maujood ho to OFFICIAL YouTube Data
 *   API v3 (search.list = rozana ~100 searches ki quota; is liye cache).
 *   Key na ho to yt-dlp ka apna search (ytsearch) — koi random API nahi.
 * - METADATA: title / channel / duration / thumbnail / live status.
 * - DOWNLOAD: yt-dlp se asal FILE (progressive formats — audio+video ek
 *   saath, ffmpeg merge ki zaroorat nahi), size cap ke saath (default 50MB,
 *   env VIDEO_MAX_MB). File bhejne se pehle verify hoti hai (MP4 signature
 *   + ffprobe ho to audio/video streams) — HTML ya khaali file kabhi video
 *   bana kar NAHI bheji jati.
 * - Har nakami ki WAJAH type ke saath milti hai (LIVE / AGE / UNAVAILABLE /
 *   TOO_BIG / QUOTA / TIMEOUT / EXTRACT) taake command link-fallback de sake.
 * - API key KABHI log nahi hoti.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
/* --- yt-dlp binary manager (MD bot ke lib/ytdlp.js se proven code) --- */
const https = require('https');
const YTDLP_VERSION = '2026.10.21';
const YTDLP_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux`;
const YTDLP_PATH = path.join(os.tmpdir(), 'yt-dlp');
let _ready = null;
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode}`)); }
            res.pipe(file);
            file.on('finish', () => { file.close(); try { fs.chmodSync(dest, 0o755); } catch {} resolve(); });
        }).on('error', reject);
    });
}
async function ensureYtDlp() {
    if (_ready) return _ready;
    _ready = (async () => {
        try { await execFileAsync(YTDLP_PATH, ['--version'], { timeout: 10000 }); return YTDLP_PATH; } catch {}
        console.log('[ytVideo] yt-dlp binary download ho raha hai...');
        try {
            await downloadFile(YTDLP_URL, YTDLP_PATH);
            let verErr = null;
            for (let i = 0; i < 4; i++) {
                try { await execFileAsync(YTDLP_PATH, ['--version'], { timeout: 10000 }); verErr = null; break; }
                catch (e) { verErr = e; await new Promise(r => setTimeout(r, 400)); }
            }
            if (verErr) throw verErr;
            console.log('[ytVideo] yt-dlp binary ready');
            return YTDLP_PATH;
        } catch (e) { _ready = null; throw e; }
    })();
    return _ready;
}
async function runYtDlp(args, { timeout = 60000, maxBuffer = 32 * 1024 * 1024 } = {}) {
    if (!_potPromise) ensurePotProvider();
    const bin = await ensureYtDlp();
    try {
        const { stdout, stderr } = await execFileAsync(bin, args, { timeout, maxBuffer });
        return { stdout, stderr };
    } catch (e) {
        e.stderr = e.stderr || '';
        if (e.killed || e.signal === 'SIGTERM') e.code = 'YTDLP_TIMEOUT';
        throw e;
    }
}

/* --- PO Token provider (bgutil script mode) — MD lib/ytdlp.js se port --- */
const POT_VERSION = '2.0.2';
const POT_DIR = path.join(os.tmpdir(), 'bgutil-pot');
const POT_HOME = path.join(POT_DIR, 'server');
const POT_TARBALL = `https://github.com/Brainicism/bgutil-ytdlp-pot-provider/archive/refs/tags/${POT_VERSION}.tar.gz`;
const POT_PLUGIN_ZIP_URL = `https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${POT_VERSION}/bgutil-ytdlp-pot-provider.zip`;
const POT_PLUGIN_DIR = path.join(path.dirname(YTDLP_PATH), 'yt-dlp-plugins');
let _potReady = false;
let _potPromise = null;
function potDiag(msg) { console.log('[pot] ' + msg); }
function potArgs() {
    return _potReady ? ['--extractor-args', `youtubepot-bgutilscript:server_home=${POT_HOME}`] : [];
}
async function ensurePotProvider() {
    if (_potPromise) return _potPromise;
    _potPromise = (async () => {
        try {
            const major = parseInt(process.versions.node.split('.')[0], 10);
            if (!(major >= 22)) { potDiag(`skip — node ${process.version} (22+ chahiye)`); return false; }
            const built = path.join(POT_HOME, 'build', 'main.js');
            const pluginDest = path.join(POT_PLUGIN_DIR, 'bgutil-ytdlp-pot-provider.zip');
            if (fs.existsSync(built) && fs.existsSync(pluginDest)) { _potReady = true; potDiag('ready (pehle se maujood)'); return true; }
            potDiag('bootstrap shuru (bgutil ' + POT_VERSION + ')...');
            fs.mkdirSync(POT_PLUGIN_DIR, { recursive: true });
            if (!fs.existsSync(pluginDest)) await downloadFile(POT_PLUGIN_ZIP_URL, pluginDest);
            if (!fs.existsSync(built)) {
                const tar = path.join(os.tmpdir(), 'bgutil-pot.tar.gz');
                await downloadFile(POT_TARBALL, tar);
                fs.mkdirSync(POT_DIR, { recursive: true });
                await execFileAsync('tar', ['xzf', tar, '-C', POT_DIR, '--strip-components=1'], { timeout: 60000 });
                await execFileAsync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: POT_HOME, timeout: 420000, maxBuffer: 16 * 1024 * 1024 });
                await execFileAsync('npx', ['tsc'], { cwd: POT_HOME, timeout: 240000, maxBuffer: 16 * 1024 * 1024 });
            }
            if (!fs.existsSync(built)) throw new Error('build output missing');
            _potReady = true;
            potDiag('ready — bgutil script mode tayyar');
            return true;
        } catch (e) {
            potDiag('bootstrap FAILED: ' + String(e && e.message || e).slice(0, 160));
            return false;
        }
    })();
    return _potPromise;
}
const _ytdlpPotArgs = potArgs;
let _probeDone = false;
async function probeYtDlp() {
    if (_probeDone) return;
    _probeDone = true;
    try {
        const bin = await ensureYtDlp();
        const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 15000 });
        console.log(`[ytVideo] yt-dlp probe OK — version ${stdout.trim()}`);
        ensurePotProvider();
    } catch (e) { console.error('[ytVideo] yt-dlp probe FAILED:', e.message); }
}

const execFileAsync = promisify(execFile);

class YtError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

const MAX_MB = Math.max(5, parseInt(process.env.VIDEO_MAX_MB || '50', 10) || 50);
const WATCH = (id) => `https://www.youtube.com/watch?v=${id}`;

/* ---------------- URL / ID ---------------- */

function parseYouTubeId(text) {
    const s = String(text || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|live\/|embed\/|v\/|music\.youtube\.com\/watch\?[^#]*v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/i)
        || s.match(/youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i);
    return m ? m[1] : null;
}

function isYouTubeUrl(text) {
    return /(?:youtube\.com|youtu\.be)/i.test(String(text || ''));
}

function formatDuration(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '-';
    sec = Math.floor(Number(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function parseIsoDuration(iso) {
    if (!iso) return null;
    const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

/* ---------------- deps (tests ke liye) ---------------- */
let _deps = null;
function _setDeps(d) { _deps = d; }
function deps() {
    return _deps || { runYtDlp, potArgs: (typeof _ytdlpPotArgs === 'function') ? _ytdlpPotArgs : (() => []), http: axios, apiKey: process.env.YOUTUBE_API_KEY || '', now: Date.now };
}

// PO token args (provider tayyar ho to) — token-wali deewaar ke liye.
function potArgs() {
    try { const d = deps(); return (d && typeof d.potArgs === 'function') ? (d.potArgs() || []) : []; }
    catch { return []; }
}

/* ---------------- search cache ---------------- */
const searchCache = new Map(); // key -> { at, meta }
const SEARCH_TTL = 6 * 60 * 60 * 1000;
const SEARCH_CAP = 500;
function cacheGet(key) {
    const e = searchCache.get(key);
    if (!e) return null;
    if (deps().now() - e.at > SEARCH_TTL) { searchCache.delete(key); return null; }
    return e.meta;
}
function cacheSet(key, meta) {
    searchCache.set(key, { at: deps().now(), meta });
    if (searchCache.size > SEARCH_CAP) searchCache.delete(searchCache.keys().next().value);
}

/* ---------------- meta shapes ---------------- */
function metaFromApiVideo(v, searchSnippet) {
    const sn = (v && v.snippet) || searchSnippet || {};
    const durationSec = v && v.contentDetails ? parseIsoDuration(v.contentDetails.duration) : null;
    const live = (sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none') || durationSec === 0;
    return {
        id: (v && v.id) || (searchSnippet && searchSnippet._id) || '',
        title: sn.title || 'YouTube Video',
        channel: sn.channelTitle || '',
        durationSec,
        durationText: live && !durationSec ? 'LIVE' : formatDuration(durationSec),
        thumbnail: `https://i.ytimg.com/vi/${(v && v.id) || (searchSnippet && searchSnippet._id)}/hqdefault.jpg`,
        url: WATCH((v && v.id) || (searchSnippet && searchSnippet._id)),
        views: v && v.statistics ? Number(v.statistics.viewCount || 0) : null,
        isLive: !!live,
    };
}

function metaFromYtDlpJson(j) {
    if (!j || !j.id) return null;
    const live = !!(j.is_live || j.live_status === 'is_live' || j.live_status === 'is_upcoming');
    return {
        id: j.id,
        title: j.title || 'YouTube Video',
        channel: j.channel || j.uploader || '',
        durationSec: typeof j.duration === 'number' ? j.duration : null,
        durationText: live && !j.duration ? 'LIVE' : formatDuration(j.duration),
        thumbnail: `https://i.ytimg.com/vi/${j.id}/hqdefault.jpg`,
        url: j.webpage_url || WATCH(j.id),
        views: typeof j.view_count === 'number' ? j.view_count : null,
        isLive: live,
    };
}

/* ---------------- official API ---------------- */
async function apiGet(urlPath, params) {
    const { http, apiKey } = deps();
    try {
        const res = await http.get(`https://www.googleapis.com/youtube/v3/${urlPath}`, {
            params: { ...params, key: apiKey },
            timeout: 20000,
        });
        return res.data;
    } catch (e) {
        const status = e.response && e.response.status;
        const reason = e.response && e.response.data && e.response.data.error && e.response.data.error.errors
            && e.response.data.error.errors[0] && e.response.data.error.errors[0].reason;
        if (status === 403 && /quota|dailyLimit/i.test(String(reason || ''))) {
            throw new YtError('QUOTA', 'YouTube API ki rozana quota khatam ho gayi hai (search limit). Kal dobara try karein.');
        }
        if (status === 400 && /API key not valid|keyInvalid/i.test(JSON.stringify(e.response && e.response.data || ''))) {
            throw new YtError('APIKEY', 'YOUTUBE_API_KEY durust nahi hai.');
        }
        throw new YtError('API', `YouTube API error (HTTP ${status || '?'})`);
    }
}

async function apiSearchTop(query) {
    const data = await apiGet('search', { part: 'snippet', type: 'video', maxResults: 1, q: query });
    const item = data && data.items && data.items[0];
    if (!item || !item.id || !item.id.videoId) return null;
    const meta = await apiMeta(item.id.videoId);
    return meta;
}

async function apiMeta(id) {
    const data = await apiGet('videos', { part: 'snippet,contentDetails,statistics', id });
    const v = data && data.items && data.items[0];
    if (!v) throw new YtError('UNAVAILABLE', 'Ye video available nahi hai (private ya delete ho chuki hai).');
    return metaFromApiVideo(v);
}

/* ---------------- yt-dlp side ---------------- */
// YouTube ki bot-deewaar / format-missing par doosra player client try
// karna aam hal hai — variants tartib se try hote hain.
// NOTE (2026-10-23 research, yt-dlp PO Token Guide): android,ios,web sab
// se zyada token-mangne wale clients hain. Baghair token chalne wale:
// android_vr (token nahi chahiye) + web_safari (HLS par GVS token nahi).
const BOT_ARGS = ['--extractor-args', 'youtube:player_client=android_vr,web_safari,mweb'];
const YT_VARIANTS = [
    ['--js-runtimes', 'node'],
    ['--js-runtimes', 'node', ...BOT_ARGS],
    [...BOT_ARGS],
];
function isRetryableWall(e) {
    const low = String((e && e.stderr) || '').toLowerCase();
    return /not a bot|sign in|format is not available|no supported javascript|requested format|unable to download|http error 403|http error 429/.test(low) || (e && e.code === 'YTDLP_TIMEOUT');
}

async function ytdlpFirstJson(args, timeout) {
    const { runYtDlp: run } = deps();
    const pa = potArgs();
    const variants = pa.length
        ? [YT_VARIANTS[0], [...YT_VARIANTS[1], ...pa], YT_VARIANTS[2]]
        : YT_VARIANTS;
    let lastErr = null;
    for (const variant of variants) {
        let out;
        try {
            out = await run([...variant, ...args], { timeout });
        } catch (e) {
            lastErr = e;
            if (isRetryableWall(e)) continue;
            throw mapYtDlpError(e);
        }
        const line = (out.stdout || '').split('\n').find(l => l.trim().startsWith('{'));
        if (line) {
            try { return JSON.parse(line); } catch { throw new YtError('EXTRACT', 'yt-dlp ka jawab samajh nahi aaya.'); }
        }
        lastErr = new Error('empty yt-dlp output');
    }
    throw mapYtDlpError(lastErr || new Error('yt-dlp failed'));
}

async function ytdlpSearchTop(query) {
    const j = await ytdlpFirstJson(['--dump-json', '--no-playlist', '--no-warnings', `ytsearch1:${query}`], 60000);
    return metaFromYtDlpJson(j);
}

async function ytdlpMeta(id) {
    const j = await ytdlpFirstJson(['--dump-json', '--no-playlist', '--no-warnings', WATCH(id)], 60000);
    const meta = metaFromYtDlpJson(j);
    if (!meta) throw new YtError('UNAVAILABLE', 'Ye video available nahi hai.');
    return meta;
}

// Bot-deewaar par halki surat: --flat-playlist search watch-page extract
// NAHI karta (results data se id/title/channel/duration milta hai) —
// Heroku ke walled IP par bhi chalta hai (2026-10-23 par parkha gaya).
async function ytdlpFlatSearchTop(query) {
    const { runYtDlp: run } = deps();
    const argSets = [
        [...BOT_ARGS, '--flat-playlist', '--dump-json', '--no-warnings', `ytsearch1:${query}`],
        ['--flat-playlist', '--dump-json', '--no-warnings', `ytsearch1:${query}`],
    ];
    let lastErr = null;
    for (const args of argSets) {
        try {
            const out = await run(args, { timeout: 60000 });
            const line = (out.stdout || '').split('\n').find(l => l.trim().startsWith('{'));
            if (line) return metaFromYtDlpJson(JSON.parse(line));
        } catch (e) { lastErr = e; }
    }
    throw mapYtDlpError(lastErr || new Error('flat search failed'));
}

// Seedhe link ki maloomat ke liye YouTube ka resmi oEmbed — koi key nahi,
// bot-deewaar is halki endpoint par nahi lagti. Duration/views nahi milte.
async function oembedMeta(id) {
    const { http } = deps();
    let res;
    try {
        res = await http.get('https://www.youtube.com/oembed', {
            params: { url: WATCH(id), format: 'json' },
            timeout: 20000,
            validateStatus: s => s < 500,
        });
    } catch (e) {
        throw new YtError('EXTRACT', 'Video ki maloomat nahi mil sakin (oEmbed band).');
    }
    if (!res || res.status === 404 || res.status === 401 || !res.data || !res.data.title) {
        throw new YtError('UNAVAILABLE', 'Ye video available nahi hai (private, removed ya ghalat link).');
    }
    return {
        id,
        title: res.data.title,
        channel: res.data.author_name || '',
        durationSec: null,
        durationText: formatDuration(null),
        thumbnail: (res.data.thumbnail_url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: WATCH(id),
        views: null,
        isLive: false,
    };
}

/* ---------------- public: search / meta ---------------- */
async function searchTopVideo(query) {
    const key = 'q:' + String(query).trim().toLowerCase();
    const hit = cacheGet(key);
    if (hit) return hit;
    const { apiKey } = deps();
    let meta;
    if (apiKey) {
        meta = await apiSearchTop(query);
        if (!meta) throw new YtError('SEARCH_NONE', 'Is naam ki koi video nahi mili.');
    } else {
        try {
            meta = await ytdlpSearchTop(query);
        } catch (e) {
            // Deewaar lage to flat search — results data se meta mil jata hai
            if (e && (e.code === 'BOTCHECK' || e.code === 'EXTRACT')) meta = await ytdlpFlatSearchTop(query);
            else throw e;
        }
        if (!meta) throw new YtError('SEARCH_NONE', 'Is naam ki koi video nahi mili.');
    }
    cacheSet(key, meta);
    return meta;
}

async function getVideoMeta(id) {
    const key = 'v:' + id;
    const hit = cacheGet(key);
    if (hit) return hit;
    const { apiKey } = deps();
    let meta;
    if (apiKey) {
        meta = await apiMeta(id);
    } else {
        try {
            meta = await ytdlpMeta(id);
        } catch (e) {
            if (e && (e.code === 'BOTCHECK' || e.code === 'EXTRACT')) meta = await oembedMeta(id);
            else throw e;
        }
    }
    cacheSet(key, meta);
    return meta;
}

/* ---------------- download ---------------- */
function mapYtDlpError(e) {
    if (e instanceof YtError) return e;
    // SIRF stderr dekho — execFile ki error.message mein poori command line
    // (jis mein '--max-filesize' bhi hota hai) echo hoti hai; us se ghalat
    // TOO_BIG pehchan banti thi (2026-10-23 live test mein pakra gaya).
    const low = String((e && e.stderr) || '').toLowerCase();
    if ((e && e.code === 'YTDLP_TIMEOUT') || (e && e.killed)) return new YtError('TIMEOUT', 'Download time par mukammal nahi hua.');
    if (/sign in to confirm your age|age-restricted|inappropriate for some users/.test(low)) return new YtError('AGE', 'Ye video age-restricted hai — baghair sign-in download nahi ho sakti.');
    if (/private video|video unavailable|no longer available|not available in your country|has been removed/.test(low)) return new YtError('UNAVAILABLE', 'Ye video available nahi hai (private, removed ya region-blocked).');
    if (/live event|is live|premieres? (in|on)|live stream/.test(low)) return new YtError('LIVE', 'Ye ek live stream hai — live video download nahi hoti.');
    if (/max-filesize|larger than max/.test(low)) return new YtError('TOO_BIG', `Video size limit (${MAX_MB}MB) se bara hai.`);
    if (/http error 403/.test(low)) return new YtError('EXTRACT', 'YouTube ne is waqt download rok diya (403). Thori der baad try karein.');
    if (/not a bot|confirm you.re not a bot|sign in to confirm|please sign in/.test(low)) {
        const be = new YtError('BOTCHECK', 'YouTube ne server ko bot samajh kar rok diya hai.');
        be.excerpt = String((e && e.stderr) || '').slice(0, 220);
        return be;
    }
    if (/certificate|ssl|unable to download api page|network is unreachable|name or service not known/.test(low)) return new YtError('EXTRACT', 'Server se YouTube tak rasai nahi ho saki (network/SSL masla).');
    const ge = new YtError('EXTRACT', 'Video extract nahi ho saki.');
    ge.excerpt = String((e && e.stderr) || '').slice(0, 220);
    return ge;
}

const LADDER = 'best[height<=480][vcodec!=none][acodec!=none][ext=mp4]/18/best[height<=720][vcodec!=none][acodec!=none][ext=mp4]/22/best[vcodec!=none][acodec!=none][height<=720]/best[vcodec!=none][acodec!=none]';

/* ---------------- cobalt backup route ----------------
 * Cobalt apne server se YouTube extract karta hai — hamare dyno ka
 * walled IP beech mein nahi aata. lib/cobalt.js wali hi instances
 * (COBALT_INSTANCES env, warna default community instance). */
function cobaltInstances() {
    const fromEnv = (process.env.COBALT_INSTANCES || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    return fromEnv.length ? fromEnv : ['https://rue-cobalt.xenon.zone'];
}

async function streamToFile(http, url, filePath, cap) {
    const res = await http.get(url, { responseType: 'stream', timeout: 240000, maxRedirects: 5 });
    return await new Promise((resolve, reject) => {
        let bytes = 0;
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };
        const fail = (e) => { if (!settled) { settled = true; reject(e); } };
        const ws = fs.createWriteStream(filePath);
        res.data.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > cap) {
                try { res.data.destroy(); } catch {}
                try { ws.end(); } catch {}
                done('TOO_BIG');
            }
        });
        res.data.on('error', fail);
        ws.on('error', fail);
        ws.on('finish', () => done('OK'));
        res.data.pipe(ws);
    });
}

async function downloadViaCobalt(id, dir, maxMB) {
    const { http } = deps();
    const cap = maxMB * 1024 * 1024;
    let lastErr = null;
    for (const base of cobaltInstances()) {
        for (const q of ['480', '360']) {
            let mediaUrl = null;
            try {
                const res = await http.post(base, { url: WATCH(id), videoQuality: q, filenameStyle: 'basic' },
                    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 30000, validateStatus: () => true });
                const d = res && res.data;
                if (d && (d.status === 'tunnel' || d.status === 'redirect') && d.url) mediaUrl = d.url;
                else if (d && d.status === 'picker' && Array.isArray(d.picker) && d.picker.length) {
                    const v = d.picker.find(p => p && p.url && p.type === 'video') || d.picker[0];
                    if (v && v.url) mediaUrl = v.url;
                }
            } catch (e) { /* agla quality/instance */ }
            if (!mediaUrl) { lastErr = new YtError('EXTRACT', 'Backup server (cobalt) se media link nahi mila.'); continue; }
            const filePath = path.join(dir, 'video.mp4');
            try {
                const got = await streamToFile(http, mediaUrl, filePath, cap);
                if (got === 'TOO_BIG') { lastErr = new YtError('TOO_BIG', `Video size limit (${maxMB}MB) se bara hai.`); continue; }
                return filePath;
            } catch (e) {
                lastErr = new YtError('EXTRACT', 'Backup server (cobalt) se video download nahi ho saki.');
            }
        }
    }
    throw lastErr || new YtError('EXTRACT', 'Backup download nahi ho saka.');
}

async function downloadToFile(id, opts = {}) {
    const maxMB = opts.maxMB || MAX_MB;
    const { runYtDlp: run } = deps();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytv-'));
    const outTpl = path.join(dir, 'video.%(ext)s');
    const SMALL = '18/best[vcodec!=none][acodec!=none]';
    const attempts = [
        { variant: YT_VARIANTS[0], fmt: LADDER },
        { variant: YT_VARIANTS[1], fmt: LADDER, pot: true },
        { cobalt: true },
        { variant: YT_VARIANTS[1], fmt: SMALL, pot: true },
        { variant: YT_VARIANTS[2], fmt: SMALL },
    ];
    let lastErr = null;
    try {
        for (const att of attempts) {
            // purani koshish ki adhoori files saaf
            for (const f of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
            if (att.cobalt) {
                try {
                    const fp = await downloadViaCobalt(id, dir, maxMB);
                    const size = fs.statSync(fp).size;
                    if (size < 50 * 1024) { lastErr = new YtError('EXTRACT', 'Backup se na-mukammal file aayi.'); continue; }
                    const check = await verifyMediaFile(fp);
                    if (!check.ok) throw new YtError('NOT_MP4', 'Download shudah file asal video nahi nikli — bhejna rok diya gaya.');
                    return { path: fp, dir, size, title: null };
                } catch (e) {
                    lastErr = (e instanceof YtError) ? e : new YtError('EXTRACT', 'Backup download fail.');
                    if (lastErr.code === 'NOT_MP4') throw lastErr;
                    continue;
                }
            }
            try {
                const vArgs = att.pot ? [...att.variant, ...potArgs()] : att.variant;
                await run([...vArgs, '-f', att.fmt, '--max-filesize', `${maxMB}M`, '--no-playlist', '--no-warnings',
                    '--socket-timeout', '20', '--retries', '3', '-o', outTpl, WATCH(id)], { timeout: 240000 });
            } catch (e) {
                lastErr = mapYtDlpError(e);
                // Deewaar/size par agla variant ya chhota format; baqi wajahen pakki
                if (['TOO_BIG', 'BOTCHECK', 'EXTRACT', 'TIMEOUT'].includes(lastErr.code)) continue;
                throw lastErr;
            }
            const files = fs.readdirSync(dir).filter(f => !f.endsWith('.part') && !f.endsWith('.ytdl'));
            if (!files.length) { lastErr = new YtError('TOO_BIG', `Video size limit (${maxMB}MB) se bara hai.`); continue; }
            const filePath = path.join(dir, files[0]);
            const size = fs.statSync(filePath).size;
            if (size < 50 * 1024) { lastErr = new YtError('EXTRACT', 'Download shudah file na-mukammal hai.'); continue; }
            const check = await verifyMediaFile(filePath);
            if (!check.ok) { try { fs.unlinkSync(filePath); } catch {} throw new YtError('NOT_MP4', 'Download shudah file asal video nahi nikli — bhejna rok diya gaya.'); }
            return { path: filePath, dir, size, title: null };
        }
        throw lastErr || new YtError('EXTRACT', 'Download nahi ho saka.');
    } catch (e) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
        throw e;
    }
}

/** File asal MP4 hai? (ftyp signature; ffprobe ho to audio+video streams bhi) */
async function verifyMediaFile(file) {
    try {
        const buf = Buffer.alloc(16);
        const fd = fs.openSync(file, 'r');
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        const isMp4 = buf.toString('latin1', 4, 8) === 'ftyp';
        if (!isMp4) return { ok: false, via: 'signature' };
    } catch { return { ok: false, via: 'signature' }; }
    try {
        const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file], { timeout: 20000 });
        const types = stdout.split(/\s+/).filter(Boolean);
        return { ok: types.includes('video') && types.includes('audio'), via: 'ffprobe', hasVideo: types.includes('video'), hasAudio: types.includes('audio') };
    } catch {
        return { ok: true, via: 'signature-only' }; // ffprobe na ho to signature par iktifa
    }
}

function cleanupDownload(dl) {
    if (dl && dl.dir) { try { fs.rmSync(dl.dir, { recursive: true, force: true }); } catch {} }
}

module.exports = {
    YtError, parseYouTubeId, isYouTubeUrl, formatDuration, parseIsoDuration,
    searchTopVideo, getVideoMeta, downloadToFile, verifyMediaFile, cleanupDownload,
    metaFromApiVideo, metaFromYtDlpJson, mapYtDlpError, MAX_MB, _setDeps, probeYtDlp, runYtDlp, ensureYtDlp, ensurePotProvider,
};
