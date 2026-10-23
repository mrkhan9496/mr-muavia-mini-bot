const config = require('../config');
const { cmd, commands } = require('../inconnuboy');
const axios = require('axios');

// Local format (03xx...) ko international (92xx...) mein badlo.
// Baghair is ke server ghalat number ka code bana deta tha aur phone par
// "Couldnt link device" aata tha (live case: 03258166934, 2026-10-23).
function normalizeNumber(raw) {
    let n = String(raw || '').replace(/[^0-9]/g, '');
    if (n.startsWith('00')) n = n.slice(2);
    if (n.startsWith('0')) n = '92' + n.slice(1);
    else if (n.length === 10 && n.startsWith('3')) n = '92' + n;
    return n;
}

cmd({
    pattern: "pair",
    alias: ["getpair", "clonebot", "pair2", "pair3"],
    react: "✅",
    desc: "Get pairing code for Queen MD bot",
    category: "download",
    use: ".pair 923195068XXX",
    filename: __filename
}, async (conn, mek, m, {
    from,
    quoted,
    body,
    isCmd,
    command,
    args,
    q,
    isGroup,
    senderNumber,
    reply
}) => {
    try {
        // Get phone number
        const phoneNumber = normalizeNumber(q ? q.trim() : senderNumber);

        // Validate number
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return await reply(
                "❌ Please provide a valid phone number (country code ke saath)\n\nExample:\n.pair 923195068XXX"
            );
        }

        const base = (config.APP_URL || 'http://localhost:' + (process.env.PORT || 8000)).replace(/\/+$/, '');
        await reply("⏳ Pair code ban raha hai, thora wait karo...");

        // /code ab start-or-poll hai (2026-10-22 server rework): pehli call par
        // 202 'generating' milta hai aur code background mein banta hai.
        // Purani command ek hi GET karke fail ho jati thi — ab poll karo
        // jab tak code na mile (max ~90s, har 3s par).
        let pairingCode = null;
        let lastError = null;
        for (let i = 0; i < 30 && !pairingCode; i++) {
            let data = null;
            try {
                const response = await axios.get(`${base}/code?number=${encodeURIComponent(phoneNumber)}`, { timeout: 15000 });
                data = response.data;
            } catch (e) {
                data = (e.response && e.response.data) || null;
                if (!data) { lastError = 'Server se rabta nahi ho saka.'; break; }
            }
            if (data.code) { pairingCode = data.code; break; }
            if (data.status === 'already_connected') {
                return await reply("✅ Ye number pehle se Queen MD se connected hai — dobara pair karne ki zaroorat nahi.");
            }
            if (data.status === 'error') { lastError = data.message || 'Server error'; break; }
            // 'generating' — thora ruk kar dobara poochho
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!pairingCode) {
            return await reply(`❌ Pair code nahi ban saka. ${lastError || 'Thori der baad dobara try karo.'}`);
        }

        await reply(
`Queen MD

✅ Pairing Completed

🔑 Your Pair Code:
*${pairingCode}*`
        );

        await new Promise(resolve => setTimeout(resolve, 2000));

        await reply(`🔑 Pair Code: *${pairingCode}*`);

    } catch (error) {
        console.error("Pair command error:", error);
        await reply("❌ An error occurred while getting the pairing code.\nPlease try again later.");
    }
});
