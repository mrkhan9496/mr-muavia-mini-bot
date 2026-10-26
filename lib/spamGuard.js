// spamGuard.js — Queen MD spam kill-switch (2026-10-26).
//
// Masla: 'Queen MD' exact text baar-baar group mein aa raha hai, aur uska
// trigger confirm nahi ho saka — .repeat command remove karne ke BAAD bhi
// spam aaya (2026-10-26 raat). Is liye send layer par hi rok lagayi:
// bot ke CODE se exact bot-name text kabhi na jaye, chahe koi bhi
// command/feature/plugin use kare.
//
// Sirf EXACT match (trim ke baad) roka jata hai — baqi sab pehle jaisa
// jayega (alive caption, menu, footer wale msgs, .nikal 'Queen MD🗿' bhi,
// kyunki wo exact nahi hai).
//
// HADD: ye sirf code se hone wale sends rokta hai. Agar koi insan apne
// phone se bot number par khud type kar raha ho to ye use nahi rok sakta —
// us case ka pata sender number se chalta hai, aur rok group se us number
// ko nikalne se hoti hai.

function exactNameText(content, botName) {
    if (!content || !botName) return false;
    const t =
        (typeof content.text === 'string' && content.text) ||
        '';
    return t.trim() === botName;
}

function relayNameText(message, botName) {
    if (!message || !botName) return false;
    const t =
        (typeof message.conversation === 'string' && message.conversation) ||
        (message.extendedTextMessage && typeof message.extendedTextMessage.text === 'string' && message.extendedTextMessage.text) ||
        '';
    return t.trim() === botName;
}

function installSpamGuard(conn, botName) {
    if (!conn || typeof conn.sendMessage !== 'function' || conn.__spamGuardInstalled) return conn;
    const origSend = conn.sendMessage.bind(conn);
    conn.sendMessage = async (jid, content, options) => {
        if (exactNameText(content, botName)) {
            console.log(`[spam-guard] Blocked exact '${botName}' send to ${jid}`);
            return { key: { remoteJid: jid, fromMe: true, id: 'blocked-' + Date.now() } };
        }
        return origSend(jid, content, options);
    };
    if (typeof conn.relayMessage === 'function') {
        const origRelay = conn.relayMessage.bind(conn);
        conn.relayMessage = async (jid, message, options) => {
            if (relayNameText(message, botName)) {
                console.log(`[spam-guard] Blocked exact '${botName}' relay to ${jid}`);
                return { key: { remoteJid: jid, fromMe: true, id: 'blocked-' + Date.now() } };
            }
            return origRelay(jid, message, options);
        };
    }
    conn.__spamGuardInstalled = true;
    return conn;
}

module.exports = { installSpamGuard };
