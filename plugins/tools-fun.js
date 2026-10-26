// 🔄 CONVERT / 🧰 TOOLS / 🎉 FUN extras
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { getJson, getText, tryEach, pick, getMediaBuffer, toMp3, uploadCatbox, fmtNum, sleep } = require('../lib/util');

const enc = encodeURIComponent;
const FOOT = `\n\n> ${config.BOT_FOOTER}`;

/* ---------------- fancy text ---------------- */
function mapChars(text, upper, lower, digits) {
    const A = [...upper], a = [...lower], d = digits ? [...digits] : null;
    return [...text].map((ch) => {
        if (/[A-Z]/.test(ch)) return A[ch.charCodeAt(0) - 65] || ch;
        if (/[a-z]/.test(ch)) return a[ch.charCodeAt(0) - 97] || ch;
        if (d && /[0-9]/.test(ch)) return d[+ch] || ch;
        return ch;
    }).join('');
}
const STYLES = [
    ['Bold', (t) => mapChars(t, '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭', '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇', '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵')],
    ['Italic', (t) => mapChars(t, '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡', '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻')],
    ['Bold Italic', (t) => mapChars(t, '𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕', '𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯')],
    ['Mono', (t) => mapChars(t, '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿')],
    ['Script', (t) => mapChars(t, '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩', '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃')],
    ['Gothic', (t) => mapChars(t, '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅', '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟')],
    ['Double', (t) => mapChars(t, '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ', '𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫', '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡')],
    ['Circled', (t) => mapChars(t, 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ', '⓪①②③④⑤⑥⑦⑧⑨')],
    ['Small Caps', (t) => mapChars(t, 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ', 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ')],
    ['Squares', (t) => mapChars(t, '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉', '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉')],
    ['Flip', (t) => [...t.toLowerCase()].reverse().map((c) => ({ a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z' }[c] || c)).join('')],
];
cmd({ pattern: 'fancy', alias: ['fonts', 'style'], desc: 'Text ko stylish fonts me badlo', category: 'convert', react: '✨', filename: __filename },
    async (conn, mek, m, { reply, q, prefix }) => {
        const text = q || (m.quoted && m.quoted.text);
        if (!text) return reply(`✨ Text likho.\nExample: *${prefix}fancy Queen MD*`);
        reply(`✨ *FANCY TEXT*\n\n${STYLES.map(([n, f]) => `*${n}:*\n${f(text)}`).join('\n\n')}${FOOT}`);
    });

/* ---------------- tomp3 ---------------- */
cmd({ pattern: 'tomp3', alias: ['mp3', 'toaudio'], desc: 'Video/voice ko mp3 banao', category: 'convert', react: '🎵', filename: __filename },
    async (conn, mek, m, { from, reply }) => {
        const media = await getMediaBuffer(m, ['video', 'audio']);
        if (!media) return reply('⚠️ Kisi *video* ya *audio* ko reply karke *.tomp3* likho.');
        await reply('⏳ Convert ho raha hai...');
        const out = await toMp3(media.buffer, media.type === 'video' ? 'mp4' : 'ogg');
        await conn.sendMessage(from, { audio: out, mimetype: 'audio/mpeg' }, { quoted: mek });
    });

/* ---------------- translate ---------------- */
cmd({ pattern: 'trt', alias: ['translate', 'tr'], desc: 'Translate: .trt ur hello  (ya reply karke .trt en)', category: 'convert', react: '🌐', filename: __filename },
    async (conn, mek, m, { reply, args, prefix }) => {
        const lang = (args[0] || '').toLowerCase();
        const text = args.slice(1).join(' ') || (m.quoted && m.quoted.text);
        if (!/^[a-z]{2}(-[a-z]{2})?$/.test(lang) || !text) {
            return reply(`🌐 Use: *${prefix}trt <lang> <text>*\nExample: *${prefix}trt ur How are you*\nYa kisi msg ko reply karke: *${prefix}trt en*\n\nLangs: en, ur, hi, ar, fr, es, de, tr, ru ...`);
        }
        const d = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${enc(text)}`);
        const out = (d[0] || []).map((x) => x[0]).join('');
        reply(`🌐 *Translate → ${lang}*\n\n${out}\n\n_(from: ${d[2]})_${FOOT}`);
    });

/* ---------------- tinyurl / url ---------------- */
cmd({ pattern: 'tinyurl', alias: ['shorturl', 'short'], desc: 'Link chhota karo', category: 'convert', react: '🔗', filename: __filename },
    async (conn, mek, m, { reply, q, prefix }) => {
        if (!/^https?:\/\//i.test(q || '')) return reply(`🔗 Link do.\nExample: *${prefix}tinyurl https://example.com/very/long/link*`);
        const r = await getText(`https://tinyurl.com/api-create.php?url=${enc(q.trim())}`);
        reply(`🔗 *Short Link*\n${r}${FOOT}`);
    });

cmd({ pattern: 'url', alias: ['upload', 'tourl', 'catbox'], desc: 'Media ko link banao (upload)', category: 'convert', react: '📤', filename: __filename },
    async (conn, mek, m, { reply }) => {
        const media = await getMediaBuffer(m);
        if (!media) return reply('⚠️ Kisi image/video/audio/file ko reply karke *.url* likho.');
        const ext = (media.mimetype.split('/')[1] || 'bin').split(';')[0];
        const link = await uploadCatbox(media.buffer, `file.${ext}`);
        reply(`📤 *Upload ho gaya*\n${link}${FOOT}`);
    });

/* ---------------- repeat / readmore ---------------- */
cmd({ pattern: 'repeat', alias: ['spam', 'rep'], desc: 'Text repeat: .repeat 3 hello', category: 'convert', react: '🔁', filename: __filename },
    async (conn, mek, m, { from, args, reply, prefix, isGroup, isAdmins, isOwner }) => {
        // 2026-10-26: group spam fix — group mein sirf admin/owner repeat chala sakta hai.
        // Warna koi bhi member .spam 10 <text> se poora group bhar deta hai (Ayesha ki duniya case).
        if (isGroup && !isAdmins && !isOwner) return reply('❌ *Queen MD:* Group mein repeat/spam sirf admin chala sakta hai.');
        const n = parseInt(args[0], 10);
        const text = args.slice(1).join(' ');
        if (!n || n < 1 || !text) return reply(`🔁 Use: *${prefix}repeat 3 hello*  (max 10)`);
        for (let i = 0; i < Math.min(n, 10); i++) { await conn.sendMessage(from, { text }); await sleep(700); }
    });

cmd({ pattern: 'readmore', alias: ['rm', 'readmoretext'], desc: 'Read more wala text: .readmore pehla|dusra', category: 'convert', react: '📖', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`📖 Use: *${prefix}readmore Pehli line | Chhupa hua text*`);
        const [a, ...b] = q.split('|');
        await conn.sendMessage(from, { text: `${a.trim()}${'\u200e'.repeat(4001)}${b.join('|').trim() || '...'}` }, { quoted: mek });
    });

/* ---------------- Wikipedia / GitHub ---------------- */
cmd({ pattern: 'wikipedia', alias: ['wiki', 'wikisearch'], desc: 'Wikipedia search', category: 'other', react: '📚', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`📚 Topic likho.\nExample: *${prefix}wikipedia Pakistan*`);
        const s = await getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${enc(q)}&limit=1&format=json`);
        const title = s[1] && s[1][0];
        if (!title) return reply('❌ Wikipedia par kuch nahi mila.');
        const d = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title)}`);
        const text = `📚 *${d.title}*\n\n${d.extract}\n\n🔗 ${d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page}${FOOT}`;
        if (d.thumbnail && d.thumbnail.source) await conn.sendMessage(from, { image: { url: d.thumbnail.source }, caption: text }, { quoted: mek });
        else await conn.sendMessage(from, { text }, { quoted: mek });
    });

cmd({ pattern: 'githubstalk', alias: ['ghstalk', 'github', 'gitstalk'], desc: 'GitHub user ki info', category: 'other', react: '🐙', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`🐙 GitHub username likho.\nExample: *${prefix}githubstalk torvalds*`);
        const d = await getJson(`https://api.github.com/users/${enc(q.trim())}`);
        const text = `🐙 *${d.name || d.login}* (@${d.login})\n\n📝 ${d.bio || '-'}\n🏢 ${d.company || '-'}\n📍 ${d.location || '-'}\n📦 Repos: ${fmtNum(d.public_repos)}\n👥 Followers: ${fmtNum(d.followers)}  Following: ${fmtNum(d.following)}\n📅 Joined: ${new Date(d.created_at).toDateString()}\n🔗 ${d.html_url}${FOOT}`;
        await conn.sendMessage(from, { image: { url: d.avatar_url }, caption: text }, { quoted: mek });
    });

/* ---------------- Fun ---------------- */
const INSULTS = ['Tum itne slow ho ke snail bhi tumhe overtake kar le. 🐌', 'Tumhari WiFi speed aur tumhari akal dono ek barabar hain. 📶', 'Tum wo ho jo "pull" wale darwaze ko push karta hai. 🚪', 'Tumhari planning itni achi hai ke Plan B bhi Plan A se pehle fail ho jata hai. 😂'];
cmd({ pattern: 'insult', alias: ['roast'], desc: 'Mazaakiya roast', category: 'fun', react: '😈', filename: __filename },
    async (conn, mek, m, { from, reply }) => {
        const ci = (m.msg && m.msg.contextInfo) || {};
        const t = (ci.mentionedJid && ci.mentionedJid[0]) || (m.quoted && m.quoted.sender);
        const line = await tryEach([
            async () => (await getJson('https://evilinsult.com/generate_insult.php?lang=en&type=json')).insult,
            async () => pick(INSULTS),
        ]);
        await conn.sendMessage(from, { text: `😈 ${t ? '@' + t.split('@')[0] + ' ' : ''}${line}\n\n_(mazaak hai 😄)_${FOOT}`, mentions: t ? [t] : [] }, { quoted: mek });
    });

const PICKUPS = ['Kya aapke paas map hai? Main aapki aankhon me kho gaya. 🗺️', 'Aap WiFi ho kya? Kyunki main connection mehsoos kar raha hun. 📶', 'Kya aapko pata hai aap meri screen ka wallpaper ban sakti ho? 😄', 'Aapka naam Google hai? Kyunki aap mein wo sab hai jo main dhoondh raha tha. 🔎'];
cmd({ pattern: 'pickup', alias: ['pickupline'], desc: 'Pickup line', category: 'fun', react: '😘', filename: __filename },
    async (conn, mek, m, { reply }) => {
        const line = await tryEach([async () => (await getJson('https://api.popcat.xyz/pickuplines')).pickupline, async () => pick(PICKUPS)]);
        reply(`😘 *Pickup Line*\n\n${line}${FOOT}`);
    });

const JOKES = ['Teacher: Tum late kyun aaye? Student: Sir, sapne me exam de raha tha, paper lamba tha. 😂', 'Doctor: Aapko aaram ki zaroorat hai. Patient: Sir, wo to mere paas bohat hai, bill kam kar do. 🤣', 'Bete ne kaha: Papa main phone chalana seekh gaya. Papa: Shabash, ab charger lagana bhi seekh. 🔌'];
cmd({ pattern: 'joke', alias: ['jokes'], desc: 'Random joke', category: 'fun', react: '😂', filename: __filename },
    async (conn, mek, m, { reply }) => {
        const j = await tryEach([
            async () => {
                const d = await getJson('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
                return d.joke || `${d.setup}\n\n${d.delivery}`;
            },
            async () => pick(JOKES),
        ]);
        reply(`😂 *Joke*\n\n${j}${FOOT}`);
    });

cmd({ pattern: 'character', alias: ['charcheck', 'personality'], desc: 'Kisi ka (mazaakiya) character check', category: 'fun', react: '🔥', filename: __filename },
    async (conn, mek, m, { from, sender }) => {
        const ci = (m.msg && m.msg.contextInfo) || {};
        const t = (ci.mentionedJid && ci.mentionedJid[0]) || (m.quoted && m.quoted.sender) || sender;
        const traits = ['Dayalu', 'Funny', 'Himmat wala', 'Sharmila', 'Zid-di', 'Dilchasp', 'Mehnati', 'Creative', 'Shararti', 'Wafadar', 'Lazy', 'Foodie'];
        const chosen = [...traits].sort(() => 0.5 - Math.random()).slice(0, 5);
        const text = `🔥 *CHARACTER CHECK* 🔥\n\n👤 @${t.split('@')[0]}\n\n${chosen.map((c) => `✅ ${c}: ${50 + Math.floor(Math.random() * 51)}%`).join('\n')}\n\n_(sirf mazaak hai 😄)_${FOOT}`;
        await conn.sendMessage(from, { text, mentions: [t] }, { quoted: mek });
    });

cmd({ pattern: 'hack', alias: ['hacking'], desc: 'Fake hacking animation (mazaak)', category: 'fun', react: '💻', filename: __filename },
    async (conn, mek, m, { from }) => {
        const steps = ['💻 *HACK STARTING...*', '⚙️ Connecting to server... [▓▓░░░░░░░░] 20%', '🔓 Bypassing firewall... [▓▓▓▓░░░░░░] 40%', '📡 Extracting data... [▓▓▓▓▓▓░░░░] 60%', '🔑 Cracking passwords... [▓▓▓▓▓▓▓▓░░] 80%', '✅ *HACK COMPLETE!* [▓▓▓▓▓▓▓▓▓▓] 100%\n\n😂 Ye sirf mazaak tha, kuch hack nahi hua!'];
        const sent = await conn.sendMessage(from, { text: steps[0] }, { quoted: mek });
        for (const s of steps.slice(1)) { await sleep(1500); await conn.sendMessage(from, { text: s, edit: sent.key }); }
    });

function anim(pattern, alias, emoji, frames) {
    cmd({ pattern, alias, desc: `${pattern} animation`, category: 'fun', react: emoji, filename: __filename },
        async (conn, mek, m, { from }) => {
            const sent = await conn.sendMessage(from, { text: frames[0] });
            for (const f of frames.slice(1)) { await sleep(900); await conn.sendMessage(from, { text: f, edit: sent.key }); }
        });
}
anim('hand', ['wavehand'], '👋', ['👋', '🤚', '🖐️', '✋', '🖖', '👋', '🤝']);
anim('hold', ['holdhands'], '🤝', ['🧍‍♂️      🧍‍♀️', '🧍‍♂️    🧍‍♀️', '🧍‍♂️  🧍‍♀️', '🧍‍♂️🧍‍♀️', '🧑‍🤝‍🧑', '💞 *Haath pakad liya!* 💞']);
anim('hifi', ['highfiveanim'], '🙌', ['🙌', '🤚      ✋', '🤚    ✋', '🤚  ✋', '🤚✋', '💥 *HIGH FIVE!* 💥']);

cmd({ pattern: 'live', desc: 'Bot zinda hai ya nahi', category: 'main', react: '🟢', filename: __filename },
    async (conn, mek, m, { reply, userConfig: u }) => {
        reply(`🟢 *${u.botname || config.BOT_NAME}* zinda hai!\n⏱️ Uptime: ${Math.floor(process.uptime() / 60)} min${FOOT}`);
    });
