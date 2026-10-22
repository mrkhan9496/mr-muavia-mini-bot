const { cmd, commands } = require('../inconnuboy');
const config = require('../config');

cmd({
    pattern: "repo",
    alias: ["sc", "script", "source"],
    desc: "Get bot source code and repository link",
    category: "main",
    react: "📁",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let repoText = `*╭────⬡ ${config.BOT_NAME} ⬡────⭓*
*├▢ 📂 Repository:* QnMD
*├▢ 👨‍💻 Owner:* ${config.OWNER_NAME}
*├▢ 🏷️ Version:* 1.0
*╰─────────────────⭓*

*╭────⬡ LINK ⬡────*
*├▢ 🌐 Web:* ${config.APP_URL || ''}
*╰────────────────*

> *© Powered by Queen MD*`;

        await conn.sendMessage(from, {
            image: { url: config.MENU_IMAGE_URL || 'https://up6.cc/2026/06/178265938722861.jpg' },
            caption: repoText,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
            }
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`❌ Error: ${e.message}`);
    }
});

