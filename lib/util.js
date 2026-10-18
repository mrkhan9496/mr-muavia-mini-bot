// Saari nayi plugins ke liye common helpers
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

let ffmpegPath = 'ffmpeg';
try { const p = require('@ffmpeg-installer/ffmpeg').path; if (typeof p === 'string' && p) ffmpegPath = p; } catch (_) {}
process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegPath;

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

async function getJson(url, opts = {}) {
    const r = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': UA }, ...opts });
    return r.data;
}

async function getText(url, opts = {}) {
    const r = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': UA }, responseType: 'text', transformResponse: (d) => d, ...opts });
    return r.data;
}

async function getBuffer(url, opts = {}) {
    const r = await axios.get(url, {
        timeout: 60000, responseType: 'arraybuffer', maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': UA }, ...opts,
    });
    return Buffer.from(r.data);
}

// Functions ki list: pehli jo chal jaye uska result do. Sab fail to aakhri error throw.
async function tryEach(fns) {
    let lastErr;
    for (const fn of fns) {
        try {
            const r = await fn();
            if (r) return r;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Koi API jawab nahi de rahi');
}

const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(String(s || '').trim());
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ffmpeg se buffer convert (unique temp files)
function ffmpeg(buffer, inExt, outExt, args = [], timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomBytes(6).toString('hex');
        const dir = path.join(os.tmpdir());
        const inp = path.join(dir, `in_${id}.${inExt}`);
        const out = path.join(dir, `out_${id}.${outExt}`);
        fs.writeFileSync(inp, buffer);
        const p = spawn(ffmpegPath, ['-y', '-i', inp, ...args, out]);
        let err = '';
        const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} }, timeoutMs);
        p.stderr.on('data', (d) => (err += d.toString()));
        p.on('error', (e) => { clearTimeout(timer); cleanup(); reject(e); });
        p.on('close', (code) => {
            clearTimeout(timer);
            try {
                if (code !== 0 || !fs.existsSync(out)) throw new Error('ffmpeg fail: ' + err.split('\n').slice(-3).join(' '));
                const data = fs.readFileSync(out);
                cleanup();
                resolve(data);
            } catch (e) { cleanup(); reject(e); }
        });
        function cleanup() { for (const f of [inp, out]) { try { fs.unlinkSync(f); } catch (_) {} } }
    });
}

const gifToMp4 = (buf) => ffmpeg(buf, 'gif', 'mp4', ['-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2']);
const toMp3 = (buf, inExt = 'mp4') => ffmpeg(buf, inExt, 'mp3', ['-vn', '-ac', '2', '-b:a', '128k', '-ar', '44100']);
const toWebp = (buf, inExt = 'jpg') => ffmpeg(buf, inExt, 'webp', [
    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15',
    '-vcodec', 'libwebp', '-lossless', '0', '-q:v', '50', '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', '-t', '8',
]);

// Reply wale media ka buffer (ya apna media). null agar media na ho
async function getMediaBuffer(m, kinds = ['image', 'video', 'sticker', 'audio', 'document']) {
    const target = m.quoted ? m.quoted : m;
    const mt = (target.mtype || '').replace('Message', '');
    if (!kinds.includes(mt)) return null;
    const buffer = await target.download();
    return { buffer, type: mt, mimetype: (target.msg && target.msg.mimetype) || target.mimetype || '' };
}

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

module.exports = {
    axios, UA, getJson, getText, getBuffer, tryEach, isUrl, pick, sleep,
    ffmpeg, gifToMp4, toMp3, toWebp, getMediaBuffer, fmtNum, ffmpegPath,
};

// Catbox par file upload (public link wapas)
async function uploadCatbox(buffer, filename = 'file.bin') {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename });
    const r = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders(), timeout: 60000, maxBodyLength: Infinity });
    if (!/^https?:\/\//.test(String(r.data))) throw new Error('Upload fail: ' + r.data);
    return String(r.data).trim();
}
module.exports.uploadCatbox = uploadCatbox;
