/**
 * sessionRegistry.js — Queen MD
 *
 * Live sessions ka halka sa shared registry taake plugins (masalan .follow)
 * tamam connected sessions tak pohnch saken. index.js session bante hi
 * register karta hai, socket destroy hone par unregister.
 *
 * SIRF live references (conn + connected flag + number) rakhe jate hain —
 * koi credential, auth data ya secret is module mein NAHI aata.
 */

const sessions = new Map(); // number -> session object (wahi reference jo index.js rakhta hai)

function register(number, session) {
    if (!number || !session) return;
    sessions.set(String(number), session);
}

function unregister(number) {
    sessions.delete(String(number));
}

/**
 * Tamam sessions ki list: [{ number, conn, connected }]
 * connected flag session object se LIVE parha jata hai (reference shared hai).
 */
function list() {
    const out = [];
    for (const [number, s] of sessions.entries()) {
        if (!s || !s.conn) continue;
        out.push({ number, conn: s.conn, connected: !!s.connected });
    }
    return out;
}

function count() {
    return list().filter(s => s.connected).length;
}

module.exports = { register, unregister, list, count };
