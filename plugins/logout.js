// plugins/logout.js — Queen MD (2026-10-27)
// HIDDEN owner-only command: .logout N
//
// - Kisi bhi menu/help/command list/category mein NAHI aata
//   (dontAddCommandList: true — plugins/menu.js is entry ko skip karta hai,
//   aur main-menu.js ki static text mein ye naam kabhi add nahi hua).
// - Owner check maujooda system se hota hai: dispatch ka isOwner
//   (config.OWNER_NUMBER / env se bana OWNER_NUMBERS — Muavia + koi bhi
//   doosra authorized owner). Koi number yahan hardcode NAHI.
// - Number = connected sessions ki list mein position (number ke hisab se
//   sorted, taake restart ke baad bhi wahi order rahe). Bina/invalid number
//   par usage + maujooda sessions ki masked list milti hai.
// - Logout = target session ke conn.logout() (Baileys: WhatsApp ko
//   remove-companion-device + close reason loggedOut). index.js ka maujooda
//   close handler phir us session ka socket + DB record saaf karta hai aur
//   reconnect NAHI karta. Baaki sessions, unka auth aur DB ko haath nahi.
// - Reply PEHLE bheja jata hai, phir logout — taake agar command wahi
//   session se aaya ho jo logout ho raha hai, confirmation phir bhi jaye.
const { cmd } = require('../inconnuboy');
const sessionRegistry = require('../lib/sessionRegistry');

function maskNumber(n) {
    const s = String(n || '');
    if (s.length <= 6) return s;
    return s.slice(0, 4) + '***' + s.slice(-2);
}

// Sirf connected sessions, number ke hisab se sorted (deterministic order).
function connectedSorted() {
    return sessionRegistry.list()
        .filter((s) => s && s.connected && s.conn)
        .sort((a, b) => String(a.number).localeCompare(String(b.number)));
}

function usageText(list) {
    if (!list.length) {
        return '*🔒 Logout*\n\nKoi connected session nahi hai.\nUsage: *.logout <number>*';
    }
    const lines = list.map((s, i) => `${i + 1}. ${maskNumber(s.number)}`);
    return `*🔒 Logout*\n\nConnected sessions:\n${lines.join('\n')}\n\nUsage: *.logout <number>*`;
}

cmd({
    pattern: 'logout',
    desc: 'Disconnect a connected session by number (owner only, hidden)',
    dontAddCommandList: true,
}, async (conn, mek, m, { args, reply, isOwner }) => {
    if (!isOwner) return reply('*❌ Owner only command.*');

    const list = connectedSorted();
    const raw = ((args && args[0]) || '').trim();
    if (!/^\d+$/.test(raw)) return reply(usageText(list));
    const n = parseInt(raw, 10);
    if (n < 1 || n > list.length) return reply(usageText(list));

    const target = list[n - 1];
    if (typeof target.conn.logout !== 'function') {
        return reply('*❌ Is session par logout available nahi.*');
    }

    await reply(`*🔒 Logging out session ${n} (${maskNumber(target.number)})...*`);
    try {
        await target.conn.logout();
    } catch (e) {
        return reply(`*❌ Logout fail hua:* ${(e && e.message) || e}`);
    }
    // Close handler (loggedOut) session ko sessions map + DB se saaf karta
    // hai aur reconnect nahi karta. Confirmation current session se bhejo
    // (agar target wahi session tha to ye fail ho sakta hai — ignore).
    try { await reply(`*🔒 Session ${n} (${maskNumber(target.number)}) logged out ✅*`); } catch (_) {}
});
