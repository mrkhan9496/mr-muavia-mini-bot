/**
 * muavia-ai.js — AI commands for QnMD
 * .ai, .ask, .gemini, .summarize, .chatbot
 *
 * Requires GEMINI_API_KEY env var (free from https://aistudio.google.com/apikey)
 */

const { cmd } = require('../inconnuboy');
const { chatText, getApiKey } = require('../lib/geminiApi');

const FOOTER = '\n\n> *© Powered by Queen MD*';

function needKey(reply) {
    if (!getApiKey()) {
        return reply(
            '❌ *GEMINI_API_KEY not set.*\n\n' +
            'Get a free key:\nhttps://aistudio.google.com/apikey\n\n' +
            'Then set it in Heroku Config Vars.' + FOOTER
        );
    }
    return null;
}

// .ai <question> — also .ask as alias
cmd({
    pattern: "ai",
    alias: ["ask"],
    desc: "Ask AI anything",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    const keyErr = needKey(reply);
    if (keyErr) return;

    const question = (q || '').trim();
    if (!question) {
        return await reply('❌ Sawal likho:\n.ai Pakistan ka capital kya hai?' + FOOTER);
    }

    // Instant acknowledgement
    await reply('🤔 Soch raha hun...' + FOOTER);

    try {
        const answer = await chatText(
            question,
            'You are a helpful WhatsApp assistant. Reply briefly (under 80 words) in the same language the user writes in.',
            from
        );
        await reply(`✨ *AI:*\n\n${answer}` + FOOTER);
    } catch (e) {
        await reply(`❌ Error: ${e.message}` + FOOTER);
    }
});

// .gemini <question>
cmd({
    pattern: "gemini",
    desc: "Ask Google Gemini",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    const keyErr = needKey(reply);
    if (keyErr) return;

    const question = (q || '').trim();
    if (!question) {
        return await reply('❌ Sawal likho:\n.gemini Pakistan ka capital kya hai?' + FOOTER);
    }

    await reply('🤔 Gemini se pooch raha hun...' + FOOTER);

    try {
        const answer = await chatText(question, '', from);
        await reply(`✨ *Gemini:*\n\n${answer}` + FOOTER);
    } catch (e) {
        await reply(`❌ Error: ${e.message}` + FOOTER);
    }
});

// .summarize <text>
cmd({
    pattern: "summarize",
    desc: "Summarize text",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    const keyErr = needKey(reply);
    if (keyErr) return;

    const text = (q || '').trim();
    if (!text) {
        return await reply('❌ Text do summarize karne ke liye:\n.summarize <lamba text>' + FOOTER);
    }
    if (text.length < 50) {
        return await reply('❌ Text bohat chhota hai summarize karne ke liye.' + FOOTER);
    }

    await reply('📝 Summarize kar raha hun...' + FOOTER);

    try {
        const summary = await chatText(
            `Summarize this in 3-4 lines:\n\n${text.slice(0, 2000)}`,
            'You are a summarizer. Be concise.',
            from
        );
        await reply(`📝 *Summary:*\n\n${summary}` + FOOTER);
    } catch (e) {
        await reply(`❌ Error: ${e.message}` + FOOTER);
    }
});

// .chatbot on|off|status
cmd({
    pattern: "chatbot",
    desc: "Toggle AI chatbot",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const sub = (q || '').trim().toLowerCase();

    // Use botSettings for persistence (MongoDB)
    const { getSetting, setSetting } = require('../lib/botSettings');

    if (sub === 'on') {
        await setSetting(m.sender, 'chatbot', true);
        await reply('✅ Chatbot ON. Ab har message par AI reply karega.' + FOOTER);
    } else if (sub === 'off') {
        await setSetting(m.sender, 'chatbot', false);
        await reply('✅ Chatbot OFF.' + FOOTER);
    } else if (sub === 'status' || !sub) {
        const status = await getSetting(m.sender, 'chatbot');
        await reply(`🤖 Chatbot: ${status ? 'ON ✅' : 'OFF ❌'}` + FOOTER);
    } else {
        await reply('❌ Usage: .chatbot on|off|status' + FOOTER);
    }
});
