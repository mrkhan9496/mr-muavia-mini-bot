const { cmd, commands } = require('../inconnuboy');
const config = require('../config');
const { setSetting } = require('../lib/botSettings');

// --- HELPER FUNCTIONS ---

// Function to check if user is admin (with LID support)
async function isUserAdmin(conn, chatId, userId) {
    try {
        const metadata = await conn.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const normalizeId = (id) => {
            if (!id) return '';
            return id.replace(/:[0-9]+/g, '').replace(/@(lid|s\.whatsapp\.net|c\.us|g\.us)/g, '').replace(/[^\d]/g, '');
        };
        const normalizedUserId = normalizeId(userId);
        for (let p of participants) {
            const participantIds = [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean);
            for (let pid of participantIds) {
                if (normalizeId(pid) === normalizedUserId) {
                    return p.admin === "admin" || p.admin === "superadmin";
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

// Function to check if bot is admin (with LID support)
async function isBotAdmin(conn, chatId) {
    try {
        const metadata = await conn.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const botId = conn.user?.id || '';
        const botLid = conn.user?.lid || '';
        const normalizeId = (id) => {
            if (!id) return '';
            return id.replace(/:[0-9]+/g, '').replace(/@(lid|s\.whatsapp\.net|c\.us|g\.us)/g, '').replace(/[^\d]/g, '');
        };
        const normalizedBotId = normalizeId(botId);
        const normalizedBotLid = normalizeId(botLid);
        for (let p of participants) {
            if (p.admin === "admin" || p.admin === "superadmin") {
                const participantIds = [p.id, p.lid, p.phoneNumber].filter(Boolean);
                for (let pid of participantIds) {
                    const normalizedPid = normalizeId(pid);
                    if (normalizedPid === normalizedBotId || normalizedPid === normalizedBotLid) {
                        return true;
                    }
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

// --- COMMAND: ANTI-LINK ON/OFF ---

cmd({
    pattern: "antilink",
    desc: "Anti-link system ko on ya off karein.",
    category: "admin",
    use: ".antilink on/off",
    filename: __filename
}, async (conn, m, store, { from, args, reply, isGroup, sender, number }) => {
    try {
        if (!isGroup) return reply("❌ Ye command sirf groups mein use kiya ja sakta hai.");
        
        const senderIsAdmin = await isUserAdmin(conn, from, sender);
        if (!senderIsAdmin) return reply("❌ Sirf group admins hi ise ON/OFF kar sakte hain.");

        if (!args[0]) return reply("Usage: `.antilink on` ya `.antilink off`.");

        if (args[0].toLowerCase() === 'on') {
            config.ANTI_LINK = 'true';
            // 2026-10-23 fix: setting DB mein bhi save karo (pehle sirf memory
            // mein rehti thi, restart par khatam + handler ab merged config
            // parhta hai)
            if (number) await setSetting(number, 'ANTI_LINK', 'true').catch(() => {});
            return reply("✅ *Anti-link Protection active ho gayi hai.*");
        } else if (args[0].toLowerCase() === 'off') {
            config.ANTI_LINK = 'false';
            if (number) await setSetting(number, 'ANTI_LINK', 'false').catch(() => {});
            return reply("❌ *Anti-link Protection band kar di gayi hai.*");
        } else {
            return reply("Invalid option! Use 'on' or 'off'.");
        }
    } catch (e) {
        console.error(e);
    }
});

// --- DETECTION LOGIC: ANTI-LINK ---

cmd({
    'on': "body"
}, async (conn, m, store, {
    from,
    body,
    sender,
    isGroup,
    reply,
    userConfig,
    isOwner
}) => {
    try {
        // 2026-10-23 fix: enable/action ab session ki merged settings se
        // (pehle static config tha — zz-settings wala .antilink is tak
        // kabhi pohanchta hi nahi tha)
        const uc = userConfig || {};
        if (String(uc.ANTI_LINK) !== 'true') {
            return;
        }

        if (!isGroup) return;
        if (isOwner) return;

        // Clean body to catch sneaky links
        let cleanBody = body.replace(/[\s\u200b-\u200d\uFEFF]/g, '').toLowerCase();
        const urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|org|net|co|pk|biz|id|info|xyz|online|site|website|tech|shop|store|blog|app|dev|io|ai|gov|edu|mil|me)(?:\/[^\s]*)?|whatsapp\.com\/channel\/|wa\.me\//gi;
        
        if (urlRegex.test(cleanBody)) {
            // Admins exempt — jab tak ADMIN_ACTION on na ho
            const senderIsAdmin = await isUserAdmin(conn, from, sender);
            if (senderIsAdmin && String(uc.ADMIN_ACTION) !== 'true') return;

            const userNumber = sender.split('@')[0] || 'User';
            const kickMode = String(uc.ANTI_LINK_KICK) === 'true';
            const deleteMode = kickMode || String(uc.DELETE_LINK) === 'true';

            // Delete/kick ke liye bot ka admin hona zaroori hai
            if (deleteMode) {
                const botIsAdmin = await isBotAdmin(conn, from);
                if (!botIsAdmin) return;
                try {
                    await conn.sendMessage(from, { 'delete': m.key });
                } catch (e) { console.error("Delete failed", e); }
            }

            console.log(`⚠️ Link detected from ${sender} in ${from}`);

            if (kickMode) {
                await conn.sendMessage(from, {
                    'text': `🚫 *ANTI-LINK PROTECTION*\n\n@${userNumber} ko link bhejne ki wajah se remove kar diya gaya hai.`,
                    'mentions': [sender]
                });
                await conn.groupParticipantsUpdate(from, [sender], "remove");
            } else if (deleteMode) {
                await conn.sendMessage(from, {
                    'text': `🚫 *ANTI-LINK*\n\n@${userNumber} is group mein links allowed nahi hain — message delete kar diya gaya hai.`,
                    'mentions': [sender]
                });
            } else {
                await conn.sendMessage(from, {
                    'text': `⚠️ @${userNumber} is group mein links allowed nahi hain.`,
                    'mentions': [sender]
                });
            }
        }
    } catch (error) {
        console.error("Anti-link system error:", error);
    }
});
    
