// 🎨 LOGO MAKER (31 styles) — text se logo/PNG banata hai
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { STYLES, makeLogo } = require('../lib/logo');

for (const name of Object.keys(STYLES)) {
    cmd({ pattern: name, desc: `${name} style logo`, category: 'logo', react: '🎨', filename: __filename },
        async (conn, mek, m, { from, q, reply, prefix }) => {
            if (!q) return reply(`🎨 Logo ke liye text likho.\nExample: *${prefix}${name} QnMD*`);
            const png = await makeLogo(name, q.trim());
            await conn.sendMessage(from, { image: png, caption: `🎨 *${name.toUpperCase()} LOGO*\n📝 ${q.trim().slice(0, 24)}\n\n> ${config.BOT_FOOTER}` }, { quoted: mek });
        });
}
