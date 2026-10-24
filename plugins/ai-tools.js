// 🤖 AI commands (free APIs, ek fail ho to dusri khud try hoti hai)
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { getText, getBuffer, tryEach } = require('../lib/util');
const { chatText, getApiKey } = require('../lib/geminiApi');

const enc = encodeURIComponent;
const SYSTEM = 'You are Queen MD MINI, a friendly WhatsApp assistant. Reply in the same language as the user (Roman Urdu if they write Roman Urdu). Keep answers clear and concise.';

// AI chain — 2026-10-24 fix (users ki complaints par):
// - Pollinations ke sirf 'openai' model ne jawab diya (VM test); baqi models
//   (openai-large, mistral, llama, qwen-coder, searchgpt) HTTP 402 dete hain,
//   is liye per-command model naam ab bekaar hai — sab 'openai' par jate hain.
// - siputzx metaai (503) aur giftedtech (DNS/host dead — users ko ENOTFOUND
//   nazar aata tha) chain se HATA diye.
// - Fallback: Gemini (lib/geminiApi) — sirf jab GEMINI_API_KEY set ho, warna
//   khamoshi se skip (koi key error user ko nahi dikhaya jata).
// - Sab fail hon to raw error (DNS waghera) user ko kabhi nahi jata — chat()
//   handler saaf message bhejta hai.
async function askAI(prompt, model = 'openai', system = SYSTEM) {
    return tryEach([
        async () => getText(`https://text.pollinations.ai/${enc(prompt)}?model=openai&system=${enc(system)}`),
        async () => {
            if (!getApiKey()) return null;
            return chatText(prompt, system, 'global');
        },
    ]);
}

function chat(pattern, alias, model, emoji, label, system) {
    cmd({ pattern, alias, desc: `${label} se sawal pucho`, category: 'ai', react: emoji, filename: __filename },
        async (conn, mek, m, { from, q, reply, prefix, command }) => {
            const text = q || (m.quoted && m.quoted.text);
            if (!text) return reply(`${emoji} *${label}*\nSawal likho.\nExample: *${prefix}${command} Pakistan ka capital kya hai?*`);
            await conn.sendPresenceUpdate('composing', from).catch(() => {});
            let ans;
            try {
                ans = await askAI(text, model, system);
            } catch (e) {
                // Raw provider error (DNS/402/503) user ko kabhi nahi dikhana
                console.log(`[ai] ${pattern} failed:`, e.message);
                return reply(`❌ *${label}* abhi jawab nahi de raha (free service ki limit ya provider down hai).\nThori dair baad dobara try karein.`);
            }
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

// Tests ke liye (plugins side effect se load hote hain, export se koi farq nahi)
module.exports = { askAI };
