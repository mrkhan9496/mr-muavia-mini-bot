// 💞 REACTIONS (waifu.pics) + 🎌 ANIME commands
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { getJson, getText, getBuffer, gifToMp4, tryEach, pick } = require('../lib/util');

const REACTIONS = {
    bully: ['😈', 'ne bully kiya'], cuddle: ['🤗', 'ko cuddle kiya'], cry: ['😭', 'ro raha hai'], hug: ['🫂', 'ko hug kiya'],
    awoo: ['🐺', 'awoo kar raha hai'], kiss: ['😘', 'ko kiss kiya'], lick: ['👅', 'ne lick kiya'], pat: ['👋', 'ko pat kiya'],
    smug: ['😏', 'smug ho raha hai'], bonk: ['🔨', 'ko bonk kiya'], yeet: ['🚀', 'ne yeet kar diya'], blush: ['😊', 'sharma gaya'],
    smile: ['😁', 'muskura raha hai'], wave: ['👋', 'hello bol raha hai'], highfive: ['🙌', 'ne highfive diya'], handhold: ['🤝', 'ka haath pakda'],
    nom: ['😋', 'nom nom kar raha hai'], bite: ['🦷', 'ne bite kiya'], glomp: ['🤗', 'se lipat gaya'], slap: ['🖐️', 'ko thappar mara'],
    kill: ['🔪', 'ne maar diya'], wink: ['😉', 'ne aankh mari'], poke: ['👉', 'ko poke kiya'],
    dance: ['💃', 'dance kar raha hai'], cringe: ['😬', 'cringe ho gaya'],
};

async function sendGif(conn, from, url, caption, mentions, quoted) {
    try {
        const raw = await getBuffer(url);
        if (/\.gif($|\?)/i.test(url)) {
            const mp4 = await gifToMp4(raw);
            return await conn.sendMessage(from, { video: mp4, gifPlayback: true, caption, mentions }, { quoted });
        }
        return await conn.sendMessage(from, { image: raw, caption, mentions }, { quoted });
    } catch (_) {
        return conn.sendMessage(from, { image: { url }, caption, mentions }, { quoted });
    }
}

for (const [name, [emoji, verb]] of Object.entries(REACTIONS)) {
    cmd({ pattern: name, desc: `${name} reaction gif`, category: 'reaction', react: emoji, filename: __filename },
        async (conn, mek, m, { from, sender, pushname, isGroup }) => {
            const ci = (m.msg && m.msg.contextInfo) || {};
            const target = (ci.mentionedJid && ci.mentionedJid[0]) || (m.quoted && m.quoted.sender) || null;
            const d = await getJson(`https://api.waifu.pics/sfw/${name}`);
            if (!d || !d.url) throw new Error('Gif nahi mili');
            const me = '@' + sender.split('@')[0];
            const caption = target
                ? `${emoji} ${me} ne @${target.split('@')[0]} ${verb}!`
                : `${emoji} ${me} ${isGroup ? '' : ''}${verb}!`;
            await sendGif(conn, from, d.url, caption + `\n\n> ${config.BOT_FOOTER}`, [sender, target].filter(Boolean), mek);
        });
}

/* ---------------- ANIME ---------------- */
function animeImage(pattern, alias, kind, emoji, label) {
    cmd({ pattern, alias, desc: `${label} anime image`, category: 'anime', react: emoji, filename: __filename },
        async (conn, mek, m, { from }) => {
            const url = await tryEach([
                async () => (await getJson(`https://api.waifu.pics/sfw/${kind}`)).url,
                async () => (await getJson(`https://nekos.life/api/v2/img/${kind}`)).url,
            ]);
            await conn.sendMessage(from, { image: { url }, caption: `${emoji} *${label}*\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
        });
}
animeImage('waifu', [], 'waifu', '💖', 'Waifu');
animeImage('neko', [], 'neko', '🐱', 'Neko');
animeImage('megnumin', ['megumin'], 'megumin', '💥', 'Megumin');
animeImage('animegirl', ['garl', 'animegirl1'], 'waifu', '👧', 'Anime Girl');

cmd({ pattern: 'foxgirl', alias: ['fox_girl'], desc: 'Fox girl anime image', category: 'anime', react: '🦊', filename: __filename },
    async (conn, mek, m, { from }) => {
        const url = await tryEach([
            async () => (await getJson('https://nekos.life/api/v2/img/fox_girl')).url,
            async () => (await getJson('https://api.waifu.im/search?included_tags=waifu')).images[0].url,
            async () => (await getJson('https://api.waifu.pics/sfw/neko')).url,
        ]);
        await conn.sendMessage(from, { image: { url }, caption: `🦊 *Fox Girl*\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
    });

cmd({ pattern: 'maid', desc: 'Maid anime image', category: 'anime', react: '🎀', filename: __filename },
    async (conn, mek, m, { from }) => {
        const url = await tryEach([
            async () => (await getJson('https://api.waifu.im/search?included_tags=maid')).images[0].url,
            async () => (await getJson('https://api.waifu.pics/sfw/waifu')).url,
        ]);
        await conn.sendMessage(from, { image: { url }, caption: `🎀 *Maid*\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
    });

cmd({ pattern: 'narutoinfo', alias: ['narutoanime'], desc: 'Naruto anime ki info', category: 'anime', react: '🍥', filename: __filename },
    async (conn, mek, m, { from }) => {
        const d = await getJson('https://api.jikan.moe/v4/anime?q=naruto&limit=1&order_by=popularity');
        const a = d.data && d.data[0];
        if (!a) throw new Error('Info nahi mili');
        const text = `🍥 *${a.title}*\n\n⭐ Score: ${a.score}\n📺 Episodes: ${a.episodes}\n📅 Year: ${a.year || '-'}\n🎭 Genres: ${(a.genres || []).map((g) => g.name).join(', ')}\n\n📝 ${(a.synopsis || '').slice(0, 500)}...\n\n> ${config.BOT_FOOTER}`;
        const img = a.images && a.images.jpg && a.images.jpg.large_image_url;
        if (img) await conn.sendMessage(from, { image: { url: img }, caption: text }, { quoted: mek });
        else await conn.sendMessage(from, { text }, { quoted: mek });
    });

cmd({ pattern: 'animenews', alias: ['animenew'], desc: 'Latest anime news', category: 'anime', react: '📰', filename: __filename },
    async (conn, mek, m, { from }) => {
        const xml = await getText('https://www.animenewsnetwork.com/all/rss.xml');
        const items = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].slice(0, 8);
        if (!items.length) throw new Error('News nahi mili');
        const t = `📰 *ANIME NEWS*\n\n${items.map((x, i) => `*${i + 1}.* ${x[1].trim()}\n🔗 ${x[2].trim()}`).join('\n\n')}\n\n> ${config.BOT_FOOTER}`;
        await conn.sendMessage(from, { text: t }, { quoted: mek });
    });

cmd({ pattern: 'dog', alias: ['randomdog'], desc: 'Random kutte ki photo', category: 'anime', react: '🐶', filename: __filename },
    async (conn, mek, m, { from }) => {
        const d = await getJson('https://dog.ceo/api/breeds/image/random');
        await conn.sendMessage(from, { image: { url: d.message }, caption: `🐶 *Random Dog*\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
    });

cmd({ pattern: 'fact', alias: ['fack', 'randomfact'], desc: 'Random fact', category: 'fun', react: '🧠', filename: __filename },
    async (conn, mek, m, { from, reply }) => {
        const d = await tryEach([
            async () => (await getJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en')).text,
            async () => (await getJson('https://nekos.life/api/v2/fact')).fact,
        ]);
        reply(`🧠 *Fact*\n\n${d}\n\n> ${config.BOT_FOOTER}`);
    });

const TRUTHS = ['Aapka sabse bada darr kya hai?', 'Aakhri jhoot kab bola tha?', 'Kisi se chhup ke kya kiya hai jo kisi ko nahi pata?', 'Aapka sabse sharmnaak moment kaunsa tha?', 'Kisko sabse zyada miss karte ho?', 'Aapki sabse ajeeb aadat kya hai?', 'Agar ek din invisible ho jao to kya karoge?', 'Aapka pehla crush kaun tha?', 'Sabse zyada kis baat par gussa aata hai?', 'Aapne aaj tak ki sabse badi galti kya ki?'];
const DARES = ['Apni last selfie group me bhejo.', '1 minute tak murgi ki awaz nikalo.', 'Apne kisi dost ko "I love you" bhejo (mazaak me).', 'Group me ek gaana gaa ke voice note bhejo.', 'Apna naam ulta likh ke bhejo.', '10 push-ups karo aur video bhejo.', 'Apni gallery ki 5th photo bhejo.', 'Kisi ko 3 emojis me apna haal batao.', 'Agle 10 minute sirf emojis me baat karo.', 'Apne phone ka wallpaper screenshot bhejo.'];

cmd({ pattern: 'truth', desc: 'Truth question', category: 'fun', react: '🫢', filename: __filename },
    async (conn, mek, m, { reply }) => reply(`🫢 *TRUTH*\n\n${pick(TRUTHS)}\n\n> ${config.BOT_FOOTER}`));

cmd({ pattern: 'dare', desc: 'Dare challenge', category: 'fun', react: '😈', filename: __filename },
    async (conn, mek, m, { reply }) => reply(`😈 *DARE*\n\n${pick(DARES)}\n\n> ${config.BOT_FOOTER}`));
