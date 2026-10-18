// 📥 DOWNLOADERS: facebook, fb2, tiktok, tt2, tiks, insta, twitter, mediafire, apk, apk2, img, pins, pinterest, gdrive, ssweb
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { getJson, getText, getBuffer, tryEach, isUrl, axios, UA } = require('../lib/util');
const { genericDl, sendAuto, mediaUrls } = require('../lib/dl');

const enc = encodeURIComponent;
const FOOT = `\n\n> ${config.BOT_FOOTER}`;
const need = (reply, what, ex) => reply(`❌ ${what} do.\nExample: *${ex}*`);

/* ---------------- Facebook ---------------- */
const FB_APIS = [
    'https://api.vreden.my.id/api/fbdl?url=',
    'https://api.siputzx.my.id/api/d/facebook?url=',
    'https://api.agatz.xyz/api/facebook?url=',
    (u) => `https://api.giftedtech.my.id/api/download/facebook?apikey=gifted&url=${enc(u)}`,
];
async function fbFlow(conn, mek, from, q, reply, apis) {
    if (!isUrl(q) || !/facebook\.com|fb\.watch|fb\.com/i.test(q)) return reply('❌ Sahi Facebook video link do.');
    let r;
    try { r = await genericDl(q, apis); }
    catch (_) {
        const rs = require('ruhend-scraper');
        const d = rs.fbdl ? await rs.fbdl(q) : null;
        const urls = d ? mediaUrls(d) : [];
        if (!urls.length) throw new Error('Facebook video download nahi ho saki');
        r = { url: urls[0] };
    }
    await sendAuto(conn, from, r.url, `📘 *Facebook Video*${FOOT}`, mek);
}
cmd({ pattern: 'facebook', alias: ['fb', 'fbdl'], desc: 'Facebook video download', category: 'download', react: '📘', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Facebook video ka link', `${prefix}fb https://fb.watch/xxxx`);
        await fbFlow(conn, mek, from, q.trim(), reply, FB_APIS);
    });
cmd({ pattern: 'fb2', alias: ['facebook2'], desc: 'Facebook video download (dusra server)', category: 'download', react: '📘', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Facebook video ka link', `${prefix}fb2 https://fb.watch/xxxx`);
        await fbFlow(conn, mek, from, q.trim(), reply, [...FB_APIS].reverse());
    });

/* ---------------- TikTok ---------------- */
async function tikwm(url, hd) {
    const d = await getJson(`https://www.tikwm.com/api/?url=${enc(url)}&hd=1`);
    if (!d || d.code !== 0 || !d.data) throw new Error(d && d.msg ? d.msg : 'tikwm fail');
    const link = hd ? (d.data.hdplay || d.data.play) : d.data.play;
    return { url: link.startsWith('http') ? link : 'https://www.tikwm.com' + link, title: d.data.title, author: d.data.author && d.data.author.nickname };
}
async function ttFlow(conn, mek, from, q, reply, hd) {
    if (!/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(q)) return reply('❌ Sahi TikTok video link do.');
    const r = await tryEach([
        () => tikwm(q, hd),
        async () => { const g = await genericDl(q, ['https://api.vreden.my.id/api/tiktok?url=', 'https://api.siputzx.my.id/api/d/tiktok?url=']); return { url: g.url }; },
    ]);
    await sendAuto(conn, from, r.url, `🎵 *TikTok*${r.title ? '\n📝 ' + r.title : ''}${r.author ? '\n👤 ' + r.author : ''}${FOOT}`, mek);
}
cmd({ pattern: 'tiktok', alias: ['tt', 'ttdl', 'tiktokdl'], desc: 'TikTok video (no watermark)', category: 'download', react: '🎵', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'TikTok link', `${prefix}tiktok https://vm.tiktok.com/xxxx`);
        await ttFlow(conn, mek, from, q.trim(), reply, false);
    });
cmd({ pattern: 'tt2', alias: ['tiktok2', 'tikhd'], desc: 'TikTok video HD', category: 'download', react: '🎵', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'TikTok link', `${prefix}tt2 https://vm.tiktok.com/xxxx`);
        await ttFlow(conn, mek, from, q.trim(), reply, true);
    });
cmd({ pattern: 'tiks', alias: ['tiktoksearch', 'ttsearch'], desc: 'TikTok videos search', category: 'search', react: '🔎', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Search ka naam', `${prefix}tiks funny cats`);
        const d = await getJson(`https://www.tikwm.com/api/feed/search?keywords=${enc(q)}&count=5&cursor=0&hd=1`);
        const vids = d && d.data && d.data.videos;
        if (!vids || !vids.length) return reply('❌ Kuch nahi mila.');
        for (const v of vids.slice(0, 3)) {
            const link = v.play.startsWith('http') ? v.play : 'https://www.tikwm.com' + v.play;
            await sendAuto(conn, from, link, `🎵 *${(v.title || '').slice(0, 100)}*\n👤 ${v.author && v.author.nickname}${FOOT}`, mek).catch(() => {});
        }
    });

/* ---------------- Instagram ---------------- */
async function igFlow(conn, mek, from, q, reply, apis) {
    if (!/instagram\.com/i.test(q)) return reply('❌ Sahi Instagram link do (post/reel).');
    let r;
    try { r = await genericDl(q, apis); }
    catch (_) {
        const rs = require('ruhend-scraper');
        const d = rs.igdl ? await rs.igdl(q) : null;
        const urls = d ? mediaUrls(d) : [];
        if (!urls.length) throw new Error('Instagram download nahi ho saka (post private to nahi?)');
        r = { urls, url: urls[0] };
    }
    for (const u of [...new Set(r.urls || [r.url])].slice(0, 4)) await sendAuto(conn, from, u, `📸 *Instagram*${FOOT}`, mek);
}
const IG_APIS = ['https://api.vreden.my.id/api/igdownload?url=', 'https://api.siputzx.my.id/api/d/igdl?url=', 'https://api.agatz.xyz/api/instagram?url='];
cmd({ pattern: 'insta', alias: ['instagram', 'ig', 'igdl'], desc: 'Instagram reel/post download', category: 'download', react: '📸', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Instagram link', `${prefix}insta https://instagram.com/reel/xxxx`);
        await igFlow(conn, mek, from, q.trim(), reply, IG_APIS);
    });
cmd({ pattern: 'insta2', alias: ['instagram2', 'ig2', 'igdl2'], desc: 'Instagram download (dusra server)', category: 'download', react: '📸', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Instagram link', `${prefix}insta2 https://instagram.com/reel/xxxx`);
        await igFlow(conn, mek, from, q.trim(), reply, [...IG_APIS].reverse());
    });

/* ---------------- Twitter / X ---------------- */
cmd({ pattern: 'twitter', alias: ['x', 'twdl', 'xdl'], desc: 'Twitter/X video download', category: 'download', react: '🐦', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Twitter/X link', `${prefix}twitter https://x.com/user/status/123`);
        const link = q.trim();
        const mt = link.match(/(?:twitter|x)\.com\/([^/]+\/status\/\d+)/i);
        if (!mt) return reply('❌ Sahi Twitter/X post link do.');
        const r = await tryEach([
            async () => {
                const d = await getJson(`https://api.vxtwitter.com/${mt[1]}`);
                const med = (d.media_extended || []).find((x) => x.type === 'video' || x.type === 'gif') || (d.media_extended || [])[0];
                return med ? { url: med.url, text: d.text } : null;
            },
            () => genericDl(link, ['https://api.vreden.my.id/api/twitter?url=', 'https://api.siputzx.my.id/api/d/twitter?url=']),
        ]);
        await sendAuto(conn, from, r.url, `🐦 *Twitter/X*${r.text ? '\n' + r.text.slice(0, 200) : ''}${FOOT}`, mek);
    });

/* ---------------- MediaFire ---------------- */
cmd({ pattern: 'mediafire', alias: ['mf', 'mfire'], desc: 'MediaFire file download', category: 'download', react: '🔥', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q || !/mediafire\.com/i.test(q)) return need(reply, 'MediaFire link', `${prefix}mediafire https://www.mediafire.com/file/xxxx`);
        const link = q.trim();
        const r = await tryEach([
            async () => {
                const html = await getText(link);
                const dl = (html.match(/https:\/\/download[0-9]*\.mediafire\.com\/[^"'\s]+/) || [])[0];
                if (!dl) return null;
                const name = decodeURIComponent((dl.split('/').pop() || 'file').split('?')[0]);
                const size = (html.match(/Download \(([^)]+)\)/) || [])[1];
                return { url: dl, name, size };
            },
            async () => {
                const d = await getJson(`https://api.vreden.my.id/api/mediafiredl?url=${enc(link)}`);
                const u = mediaUrls(d)[0];
                return u ? { url: u, name: (d.result && d.result[0] && d.result[0].nama) || 'file' } : null;
            },
        ]);
        await reply(`🔥 *MediaFire*\n📄 ${r.name}${r.size ? '\n📦 ' + r.size : ''}\n\n⏳ File bhej raha hun...`);
        await conn.sendMessage(from, { document: { url: r.url }, fileName: r.name, mimetype: 'application/octet-stream', caption: FOOT.trim() }, { quoted: mek });
    });

/* ---------------- Google Drive ---------------- */
cmd({ pattern: 'gdrive', alias: ['gdl', 'drive'], desc: 'Google Drive file download', category: 'download', react: '📁', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        const id = (q || '').match(/(?:\/d\/|id=)([A-Za-z0-9_-]{20,})/);
        if (!id) return need(reply, 'Google Drive link', `${prefix}gdrive https://drive.google.com/file/d/xxxx/view`);
        const direct = `https://drive.usercontent.google.com/download?id=${id[1]}&export=download&confirm=t`;
        let name = 'drive_file';
        try {
            const head = await axios.get(direct, { timeout: 30000, headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, validateStatus: () => true });
            const cd = head.headers['content-disposition'] || '';
            const n = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
            if (n) name = decodeURIComponent(n[1]);
            if (/text\/html/i.test(head.headers['content-type'] || '')) return reply('❌ Ye file public nahi hai ya bohat badi hai. Sharing: "Anyone with the link" karo.');
        } catch (_) {}
        await reply(`📁 *Google Drive*\n📄 ${name}\n\n⏳ File bhej raha hun...`);
        await conn.sendMessage(from, { document: { url: direct }, fileName: name, mimetype: 'application/octet-stream', caption: FOOT.trim() }, { quoted: mek });
    });

/* ---------------- APK (Aptoide) ---------------- */
async function aptoide(q, limit = 1) {
    const d = await getJson(`https://ws75.aptoide.com/api/7/apps/search?query=${enc(q)}&limit=${limit}`);
    const list = (d && d.datalist && d.datalist.list) || [];
    return list;
}
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
cmd({ pattern: 'apk', alias: ['app', 'apkdl'], desc: 'Android app (APK) download', category: 'download', react: '📦', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'App ka naam', `${prefix}apk whatsapp`);
        const [a] = await aptoide(q, 1);
        if (!a) return reply('❌ Ye app nahi mili.');
        const url = a.file && a.file.path;
        const size = a.file && a.file.filesize;
        if (!url) return reply('❌ Is app ka download link nahi mila.');
        if (size && size > 95 * 1048576) return reply(`❌ *${a.name}* bohat badi hai (${mb(size)}). WhatsApp limit ki wajah se nahi bhej sakta.\n🔗 ${url}`);
        const caption = `📦 *${a.name}*\n🆔 ${a.package}\n📌 Version: ${a.file && a.file.vername}\n📏 Size: ${size ? mb(size) : '-'}${FOOT}`;
        if (a.icon) await conn.sendMessage(from, { image: { url: a.icon }, caption }, { quoted: mek }).catch(() => {});
        await conn.sendMessage(from, { document: { url }, fileName: `${a.name}.apk`, mimetype: 'application/vnd.android.package-archive' }, { quoted: mek });
    });
cmd({ pattern: 'apk2', alias: ['apksearch', 'apks'], desc: 'APK search (list)', category: 'download', react: '📦', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'App ka naam', `${prefix}apk2 telegram`);
        const list = await aptoide(q, 6);
        if (!list.length) return reply('❌ Koi app nahi mili.');
        const t = list.map((a, i) => `*${i + 1}. ${a.name}*\n🆔 ${a.package}\n📏 ${a.file && a.file.filesize ? mb(a.file.filesize) : '-'}  📌 ${(a.file && a.file.vername) || '-'}`).join('\n\n');
        reply(`📦 *APK Results*\n\n${t}\n\nDownload ke liye: *${prefix}apk <package id>*${FOOT}`);
    });

/* ---------------- Images ---------------- */
async function bingImages(q) {
    const html = await getText(`https://www.bing.com/images/search?q=${enc(q)}&form=HDRSC2&first=1&safeSearch=Moderate`);
    const out = [];
    for (const mm of html.matchAll(/murl&quot;:&quot;(https?:[^&]+?)&quot;/g)) {
        if (/\.(jpg|jpeg|png|webp)/i.test(mm[1]) && !out.includes(mm[1])) out.push(mm[1]);
        if (out.length >= 15) break;
    }
    return out;
}
cmd({ pattern: 'img', alias: ['image', 'imgsearch', 'gimage'], desc: 'Images search karo', category: 'search', react: '🖼️', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Search ka naam', `${prefix}img lion`);
        const list = await tryEach([
            () => bingImages(q).then((x) => (x.length ? x : null)),
            async () => { const d = await getJson(`https://api.siputzx.my.id/api/images?query=${enc(q)}`); const u = mediaUrls(d); return u.length ? u : null; },
        ]);
        let sent = 0;
        for (const u of list) {
            if (sent >= 5) break;
            try { await conn.sendMessage(from, { image: { url: u }, caption: sent === 0 ? `🖼️ *${q}*${FOOT}` : '' }, { quoted: mek }); sent++; } catch (_) {}
        }
        if (!sent) reply('❌ Images bhej nahi saka, dobara try karo.');
    });

async function pinSearch(q) {
    const data = JSON.stringify({ options: { query: q, scope: 'pins' }, context: {} });
    const d = await getJson(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${enc('/search/pins/?q=' + q)}&data=${enc(data)}`, { headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
    const res = (d && d.resource_response && d.resource_response.data && d.resource_response.data.results) || [];
    return res.map((r) => r.images && (r.images.orig || r.images['736x'] || {}).url).filter(Boolean);
}
async function pinFlow(conn, mek, from, q, reply) {
    const list = await tryEach([
        () => pinSearch(q).then((x) => (x.length ? x : null)),
        () => bingImages(q + ' pinterest').then((x) => (x.length ? x : null)),
    ]);
    let n = 0;
    for (const u of list) {
        if (n >= 5) break;
        try { await conn.sendMessage(from, { image: { url: u }, caption: n === 0 ? `📌 *${q}*${FOOT}` : '' }, { quoted: mek }); n++; } catch (_) {}
    }
}
cmd({ pattern: 'pins', alias: ['pinsearch'], desc: 'Pinterest images search', category: 'search', react: '📌', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Search ka naam', `${prefix}pins aesthetic wallpaper`);
        await pinFlow(conn, mek, from, q, reply);
    });
cmd({ pattern: 'pinterest', alias: ['pin', 'pindl'], desc: 'Pinterest link download ya search', category: 'download', react: '📌', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Pinterest link ya search naam', `${prefix}pinterest cute cats`);
        if (/pinterest\.|pin\.it/i.test(q)) {
            const r = await genericDl(q.trim(), ['https://api.vreden.my.id/api/pinterest?url=', 'https://api.siputzx.my.id/api/d/pinterest?url=']);
            return sendAuto(conn, from, r.url, `📌 *Pinterest*${FOOT}`, mek);
        }
        await pinFlow(conn, mek, from, q, reply);
    });

/* ---------------- Screenshot ---------------- */
cmd({ pattern: 'ssweb', alias: ['ss', 'screenshot'], desc: 'Website ka screenshot', category: 'tools', react: '📸', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return need(reply, 'Website ka link', `${prefix}ssweb https://google.com`);
        const site = /^https?:\/\//i.test(q.trim()) ? q.trim() : 'https://' + q.trim();
        const buf = await tryEach([
            () => getBuffer(`https://image.thum.io/get/width/1280/crop/900/noanimate/${site}`),
            () => getBuffer(`https://s0.wp.com/mshots/v1/${enc(site)}?w=1280&h=900`),
        ]);
        await conn.sendMessage(from, { image: buf, caption: `📸 *${site}*${FOOT}` }, { quoted: mek });
    });
