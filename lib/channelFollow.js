/**
 * channelFollow.js — MR Muavia Mini Bot
 * Auto-follow WhatsApp channels on connection open.
 * Uses: conn.newsletterMetadata('invite', code) → conn.newsletterFollow(jid)
 */

// Muavia's channels (invite codes from whatsapp.com/channel/<code>)
const CHANNELS = [
    '0029VbDUrr1AojYnZ7f3ny39', // MUAVIA MINI BOT 🎭
    '0029VbEhkSP4yltQOjpNjz1s', // Main
    '0029VbAYFuA7z4kXHVNHfM1Y', // Android & iPhone Tips
    '0029VbDbXlAHbFV4GgoF5N32', // Prompt Gallery
    '0029VbE0YLqCnA7mdEewPx17', // AI Image Prompt ✔️
];

async function autoFollowChannels(conn) {
    // Env se disable kar sakte hain: AUTO_FOLLOW_CHANNELS=false
    if (process.env.AUTO_FOLLOW_CHANNELS === 'false') return;
    for (const code of CHANNELS) {
        try {
            const meta = await conn.newsletterMetadata('invite', code);
            const jid = meta?.id;
            if (!jid) continue;
            await conn.newsletterFollow(jid);
            console.log(`[channel] Followed: ${code}`);
        } catch (e) {
            // Already following ya error — chup chaap continue
        }
    }
}

module.exports = { autoFollowChannels, CHANNELS };
