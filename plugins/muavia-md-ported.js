// MR Muavia Mini Bot — Ported commands from MR MUAVIA MD BOT
// Simple API/text commands only. Complex ones (botData/scheduler) skipped.
// Ported: 2026-10-19

const { cmd } = require('../inconnuboy');
const axios = require('axios');

// ============ ADVICE ============
cmd({
    pattern: "advice",
    desc: "Random life advice",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://api.adviceslip.com/advice', { timeout: 15000 });
        await reply(`💡 *Advice:*\n\n"${r.data.slip.advice}"`);
    } catch (e) {
        await reply('❌ Advice nahi mili, dobara try karo.');
    }
});

// ============ BORED ============
cmd({
    pattern: "bored",
    desc: "Random activity idea when bored",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://bored-api.appbrewery.com/random', { timeout: 15000 });
        await reply(`🎯 *Bored? Try this:*\n\n${r.data.activity}\n\n👥 Participants: ${r.data.participants} | 📁 Type: ${r.data.type}`);
    } catch (e) {
        await reply('❌ Idea nahi mila, dobara try karo.');
    }
});

// ============ CATFACT ============
cmd({
    pattern: "catfact",
    desc: "Random cat fact",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://catfact.ninja/fact', { timeout: 15000 });
        await reply(`🐱 *Cat Fact:*\n\n${r.data.fact}`);
    } catch (e) {
        await reply('❌ Cat fact nahi mil saka, dobara try karo.');
    }
});

// ============ CHUCKNORRIS ============
cmd({
    pattern: "chucknorris",
    alias: ["chuck"],
    desc: "Random Chuck Norris joke",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: 15000 });
        await reply(`💪 *Chuck Norris:*\n\n${r.data.value}`);
    } catch (e) {
        await reply('❌ Joke nahi mil saka, dobara try karo.');
    }
});

// ============ CALC ============
cmd({
    pattern: "calc",
    desc: "Calculator - .calc 2 + 2 * 5",
    category: "utility",
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    const expr = (args.join(' ') || '').trim();
    if (!expr) {
        return await reply('❌ Usage: .calc <expression>\nExample: .calc 2 + 2 * 5');
    }
    if (!/^[0-9+\-*/().%^\s]+$/.test(expr)) {
        return await reply('❌ Only numbers and +  -  *  /  (  )  %  ^ allowed.');
    }
    try {
        const safe = expr.replace(/\^/g, '**');
        const result = Function('"use strict"; return (' + safe + ')')();
        if (typeof result !== 'number' || !isFinite(result)) throw new Error('bad result');
        const pretty = Math.round(result * 1e10) / 1e10;
        await reply(`🧮 *Calculator*\n\n📝 Expression: \`${expr}\`\n✅ Result: *${pretty}*`);
    } catch (e) {
        await reply('❌ Invalid expression!');
    }
});

// ============ CURRENCY ============
cmd({
    pattern: "currency",
    alias: ["curr", "fx"],
    desc: "Currency converter - .currency 100 USD to PKR",
    category: "utility",
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    const raw = (args.join(' ') || '').trim().toUpperCase();
    const mt = raw.match(/^([\d.]+)?\s*([A-Z]{3})(?:\s+TO\s+([A-Z]{3}))?$/);
    if (!mt) {
        return await reply('❌ Aise likho:\n.currency 100 USD to PKR\n.currency USD');
    }
    const amount = parseFloat(mt[1] || '1');
    const fromCur = mt[2], toCur = mt[3] || null;
    try {
        const r = await axios.get('https://open.er-api.com/v6/latest/' + fromCur, { timeout: 15000 });
        const rates = r.data.rates;
        if (toCur) {
            if (!rates[toCur]) throw new Error('currency nahi mili');
            const val = (amount * rates[toCur]).toFixed(2);
            await reply(`💱 *${amount} ${fromCur} = ${val} ${toCur}*\n\n1 ${fromCur} = ${rates[toCur]} ${toCur}`);
        } else {
            const picks = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'].filter(c => c !== fromCur && rates[c]);
            const lines = picks.map(c => `1 ${fromCur} = ${rates[c]} ${c}`);
            await reply(`💱 *${fromCur} rates:*\n\n${lines.join('\n')}`);
        }
    } catch (e) {
        await reply('❌ Rate nahi mil saka. Currency code check karo (jaise USD, PKR).');
    }
});

// ============ DEFINE ============
cmd({
    pattern: "define",
    alias: ["dict", "meaning"],
    desc: "Dictionary - .define serendipity",
    category: "utility",
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    const word = (args.join(' ') || '').trim().split(/\s+/)[0];
    if (!word) {
        return await reply('❌ Usage: .define <word>\nExample: .define serendipity');
    }
    try {
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 25000 });
        const entry = res.data && res.data[0];
        if (!entry) throw new Error('no entry');
        const lines = [`📖 *Dictionary*\n\n*${entry.word}*`];
        if (entry.phonetic) lines.push(`🔊 ${entry.phonetic}`);
        let shown = 0;
        for (const meaning of (entry.meanings || []).slice(0, 3)) {
            const def = meaning.definitions && meaning.definitions[0];
            if (!def) continue;
            lines.push(`\n*${meaning.partOfSpeech || '—'}:* ${def.definition}`);
            if (def.example) lines.push(`💬 _"${def.example}"_`);
            if (++shown >= 3) break;
        }
        await reply(lines.join('\n'));
    } catch (e) {
        await reply(`❌ No definition found for "${word}".`);
    }
});

// ============ JOKE ============
cmd({
    pattern: "joke",
    alias: ["dadjoke"],
    desc: "Random dad joke",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const response = await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json' },
            timeout: 15000
        });
        await reply(response.data.joke);
    } catch (e) {
        await reply('❌ Joke nahi mil saka, dobara try karo.');
    }
});

// ============ FACT ============
cmd({
    pattern: "fact",
    desc: "Random interesting fact",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: 15000 });
        await reply(`💡 *Did you know?*\n\n${r.data.text}`);
    } catch (e) {
        await reply('❌ Fact nahi mil saka, dobara try karo.');
    }
});

// ============ QUOTE ============
cmd({
    pattern: "quote",
    desc: "Random inspirational quote",
    category: "fun",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const r = await axios.get('https://dummyjson.com/quotes/random', { timeout: 15000 });
        await reply(`💬 "${r.data.quote}"\n\n— *${r.data.author}*`);
    } catch (e) {
        await reply('❌ Quote nahi mil saka, dobara try karo.');
    }
});
