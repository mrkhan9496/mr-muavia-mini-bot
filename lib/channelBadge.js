/**
 * WhatsApp Channel (newsletter) badge helper — Queen MD
 * MD bot (lib/channel.js) ke proven tareeqe ki port: channel ka JID/naam kabhi
 * hardcode nahi hota; Baileys newsletterMetadata('invite', code) se runtime
 * par resolve hokar memory me cache hota hai. Lookup fail ho to {} milta hai
 * taake caller baghair badge ke aaram se aage barh jaye (menu kabhi nahi rukta).
 */
const config = require('../config');

const channelCache = new Map(); // inviteCode -> { jid, name } (sirf kamyab)
const failedAtMap = new Map();  // inviteCode -> aakhri nakami ka waqt
const inFlightMap = new Map();  // inviteCode -> promise

const RESOLVE_COOLDOWN_MS = 5 * 60 * 1000; // nakami ke baad 5 min se pehle dobara koshish nahi

function extractInviteCode(url) {
    if (!url) return null;
    const match = String(url).match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/i);
    return match ? match[1] : null;
}

async function resolveChannel(sock, url) {
    const targetUrl = url || config.CHANNEL_LINK;
    const inviteCode = extractInviteCode(targetUrl);
    if (!inviteCode) {
        console.warn('[Channel] Durust whatsapp.com/channel/... link nahi, badge skip: ' + targetUrl);
        return null;
    }
    if (channelCache.has(inviteCode)) return channelCache.get(inviteCode);
    const failedAt = failedAtMap.get(inviteCode) || 0;
    if (failedAt && Date.now() - failedAt < RESOLVE_COOLDOWN_MS) return null;
    if (inFlightMap.has(inviteCode)) return inFlightMap.get(inviteCode);

    const p = (async () => {
        try {
            if (!sock || typeof sock.newsletterMetadata !== 'function') {
                console.warn('[Channel] Is Baileys version me newsletterMetadata() nahi; badge skip.');
                failedAtMap.set(inviteCode, Date.now());
                return null;
            }
            const metadata = await sock.newsletterMetadata('invite', inviteCode);
            if (metadata && metadata.id) {
                const ch = { jid: metadata.id, name: metadata.name || config.BOT_NAME };
                channelCache.set(inviteCode, ch);
                failedAtMap.delete(inviteCode);
                return ch;
            }
            console.warn('[Channel] Invite link se channel metadata nahi mila.');
            failedAtMap.set(inviteCode, Date.now());
            return null;
        } catch (err) {
            console.error('[Channel] Channel resolve fail:', err.message || err);
            failedAtMap.set(inviteCode, Date.now());
            return null;
        } finally {
            inFlightMap.delete(inviteCode);
        }
    })();
    inFlightMap.set(inviteCode, p);
    return p;
}

/**
 * Ready-to-spread payload fragment (contextInfo me "View channel" badge),
 * ya {} agar channel resolve na ho.
 * Usage: sendMessage(jid, { caption, ...(await getChannelContextInfo(sock)) })
 */
async function getChannelContextInfo(sock) {
    const channel = await resolveChannel(sock);
    if (!channel) return {};
    return {
        contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channel.jid,
                newsletterName: channel.name,
                serverMessageId: -1
            }
        }
    };
}

module.exports = { getChannelContextInfo, resolveChannel, extractInviteCode };
