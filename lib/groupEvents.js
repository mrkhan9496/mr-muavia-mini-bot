const config = require('../config');

/**
 * Create Context Info for Newsletter + DP Card
 */
const getContextInfo = (jid, dpUrl, title, body) => {
    return {
        mentionedJid: [jid],
        forwardingScore: 999,
        isForwarded: true,
        externalAdReply: {
            title: title,
            body: body,
            thumbnailUrl: dpUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: true,
            sourceUrl: config.CHANNEL_LINK
        }
    };
};

/**
 * Group Welcome / Goodbye Handler
 */
async function groupEvents(conn, update, sessionNumber) {
    try {
        const metadata = await conn.groupMetadata(update.id);
        const groupName = metadata.subject;

        // 2026-10-23 fix: welcome/goodbye ab session ki MERGED settings se
        // parho (pehle static config parhta tha jo toggle kabhi badalta hi
        // nahi tha) + .setwelcome/.setgoodbye ka custom text bhi lagu karo.
        let settings = {};
        try { if (sessionNumber) settings = await require('./botSettings').getMerged(sessionNumber); } catch (_) {}
        const welcomeOn = String(settings.WELCOME_ENABLE ?? config.WELCOME_ENABLE) === 'true';
        const goodbyeOn = String(settings.GOODBYE_ENABLE ?? config.GOODBYE_ENABLE) === 'true';

        for (const jid of update.participants) {

            const number = jid.split('@')[0];
            const mentionTag = `@${number}`;

            // ✅ Fetch DP
            let dpUrl;
            try {
                dpUrl = await conn.profilePictureUrl(jid, 'image');
            } catch {
                dpUrl = 'https://i.ibb.co/3Fh9V6p/user.png';
            }

            // ✅ Fetch Real Name
            let userName = number;
            try {
                const contact = metadata.participants.find(p => p.id === jid);
                if (contact && contact.name) userName = contact.name;
            } catch {}

            // ================= WELCOME =================
            if (update.action === 'add' && welcomeOn) {

                if (settings.WELCOME_MSG) {
                    const custom = String(settings.WELCOME_MSG)
                        .replace(/\{user\}/g, mentionTag).replace(/\{name\}/g, userName).replace(/\{group\}/g, groupName);
                    await conn.sendMessage(update.id, { text: custom, mentions: [jid] });
                    continue;
                }

                const text = `╭───〔 *WELCOME* 〕───⬣
❀ Hey ${mentionTag}

🏷️ *Name:* ${userName}
🏰 *Group:* ${groupName}

⚠️ Please read group rules!
╰────────────────⬣`;

                await conn.sendMessage(update.id, {
                    text: text,
                    contextInfo: getContextInfo(
                        jid,
                        dpUrl,
                        userName,
                        "New Member Joined The Group"
                    )
                });
            }

            // ================= GOODBYE =================
            if (update.action === 'remove' && goodbyeOn) {

                if (settings.GOODBYE_MSG) {
                    const custom = String(settings.GOODBYE_MSG)
                        .replace(/\{user\}/g, mentionTag).replace(/\{name\}/g, userName).replace(/\{group\}/g, groupName);
                    await conn.sendMessage(update.id, { text: custom, mentions: [jid] });
                    continue;
                }

                const text = `╭───〔 *GOODBYE* 〕───⬣
😔 ${mentionTag} left the group

🏷️ *Name:* ${userName}
📢 Hope to see you again!
╰────────────────⬣`;

                await conn.sendMessage(update.id, {
                    text: text,
                    contextInfo: getContextInfo(
                        jid,
                        dpUrl,
                        userName,
                        "Member Left The Group"
                    )
                });
            }
        }

    } catch (err) {
        console.log("GroupEvents Error:", err);
    }
}

module.exports = { groupEvents };
                  
