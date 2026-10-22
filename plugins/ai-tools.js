// 🤖 AI commands (free APIs, ek fail ho to dusri khud try hoti hai)
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { getText, getJson, getBuffer, tryEach } = require('../lib/util');

const enc = encodeURIComponent;
const SYSTEM = 'You are Queen MD MINI, a friendly WhatsApp assistant. Reply in the same language as the user (Roman Urdu if they write Roman Urdu). Keep answers clear and concise.';

async function askAI(prompt, model = 'openai', system = SYSTEM) {
    return tryEach([
        async () => getText(`https://text.pollinations.ai/${enc(prompt)}?model=${model}&system=${enc(system)}`),
        async () => getText(`https://text.pollinations.ai/${enc(prompt)}?model=mistral&system=${enc(system)}`),
        async () => {
            const d = await getJson(`https://api.siputzx.my.id/api/ai/metaai?query=${enc(prompt)}`);
            return d && (d.data || d.result);
        },
        async () => {
            const d = await getJson(`https://api.giftedtech.my.id/api/ai/gpt4o?apikey=gifted&q=${enc(prompt)}`);
            return d && (d.result || d.message);
        },
    ]);
}

function chat(pattern, alias, model, emoji, label, system) {
    cmd({ pattern, alias, desc: `${label} se sawal pucho`, category: 'ai', react: emoji, filename: __filename },
        async (conn, mek, m, { from, q, reply, prefix, command }) => {
            const text = q || (m.quoted && m.quoted.text);
            if (!text) return reply(`${emoji} *${label}*\nSawal likho.\nExample: *${prefix}${command} Pakistan ka capital kya hai?*`);
            await conn.sendPresenceUpdate('composing', from).catch(() => {});
            const ans = await askAI(text, model, system);
            await conn.sendMessage(from, { text: `${emoji} *${label}*\n\n${String(ans).trim()}\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
        });
}

chat('ai', ['ask', 'chatgpt'], 'openai', '🤖', 'AI');
chat('gpt', [], 'openai-large', '🧠', 'GPT');
chat('gpt2', [], 'mistral', '🧠', 'GPT-2');
chat('gpt3', [], 'openai', '🧠', 'GPT-3');
chat('gpt4', ['gpt4o'], 'openai-large', '🧠', 'GPT-4');
chat('gptmini', ['gpt4mini', 'minigpt'], 'openai', '🧠', 'GPT Mini');
chat('meta', ['llama', 'metaai'], 'llama', '🦙', 'Meta AI');
chat('blackbox', ['bbox', 'code'], 'qwen-coder', '💻', 'Blackbox (Code AI)', 'You are an expert programmer. Give correct, short code with a brief explanation.');
chat('bing', ['search-ai'], 'searchgpt', '🔎', 'Bing AI');
chat('copilot', ['cp'], 'openai-large', '🛩️', 'Copilot', 'You are Copilot, a helpful assistant. Be concise and friendly.');
chat('dj', ['djai', 'music-ai'], 'openai', '🎧', 'DJ AI', 'You are a music expert DJ. Suggest songs, artists and playlists based on the user mood. Keep it short.');

async function makeImage(conn, mek, from, prompt, model, label, reply, extra = '') {
    await reply(`🎨 *${label}* bana raha hun... (10-30 sec)`);
    const seed = Math.floor(Math.random() * 1e6);
    const url = `https://image.pollinations.ai/prompt/${enc(prompt + extra)}?width=1024&height=1024&nologo=true&seed=${seed}&model=${model}`;
    const buf = await tryEach([
        () => getBuffer(url, { timeout: 90000 }),
        () => getBuffer(`https://image.pollinations.ai/prompt/${enc(prompt)}?nologo=true&seed=${seed + 1}`, { timeout: 90000 }),
    ]);
    await conn.sendMessage(from, { image: buf, caption: `🎨 *${label}*\n📝 ${prompt}\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
}

cmd({ pattern: 'imagine', alias: ['aiimage', 'text2img', 'flux'], desc: 'Text se AI image banao', category: 'ai', react: '🎨', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`🎨 Image ka description likho.\nExample: *${prefix}imagine a lion wearing a crown*`);
        await makeImage(conn, mek, from, q, 'flux', 'Imagine', reply);
    });

cmd({ pattern: 'imagine2', alias: ['aiimage2', 'turbo'], desc: 'Text se AI image (dusra model)', category: 'ai', react: '🖌️', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`🖌️ Image ka description likho.\nExample: *${prefix}imagine2 sunset over mountains*`);
        await makeImage(conn, mek, from, q, 'turbo', 'Imagine 2', reply);
    });

cmd({ pattern: 'luma', alias: ['dream', 'cinematic'], desc: 'Cinematic AI image', category: 'ai', react: '🎬', filename: __filename },
    async (conn, mek, m, { from, q, reply, prefix }) => {
        if (!q) return reply(`🎬 Scene ka description likho.\nExample: *${prefix}luma a lonely astronaut on mars*`);
        await makeImage(conn, mek, from, q, 'flux', 'Luma (Cinematic)', reply, ', cinematic lighting, ultra detailed, 8k, movie still');
    });
