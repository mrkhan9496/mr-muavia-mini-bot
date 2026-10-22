/**
 * channelFollow.js — Queen MD
 * Auto-follow WhatsApp channels on connection open + auto-react to new posts.
 *
 * ENV:
 *   AUTO_FOLLOW_CHANNELS=false  → follow disable
 *   AUTO_REACT_CHANNELS=false   → reaction disable
 *   CHANNEL_REACT_EMOJI=❤️      → reaction emoji (default ❤️)
 *   NEWSLETTER_JIDS=jid1,jid2   → extra JIDs (invite codes ke ilawa)
 */

const CHANNELS = [
    '0029VbDUrr1AojYnZ7f3ny39', // MUAVIA MINI BOT 🎭
    '0029VbEhkSP4yltQOjpNjz1s', // Main
    '0029VbAYFuA7z4kXHVNHfM1Y', // Android & iPhone Tips
    '0029VbDbXlAHbFV4GgoF5N32', // Prompt Gallery
    '0029VbE0YLqCnA7mdEewPx17', // AI Image Prompt ✔️
];

// Track followed JIDs per connection to avoid duplicates on reconnect
const followedJids = new Set();
// Track reacted message serverIds to avoid duplicate reactions
const reactedMessages = new Set();
// Cap the set size to prevent memory leak
const MAX_TRACKED = 5000;

function getReactEmoji() {
    return process.env.CHANNEL_REACT_EMOJI || '❤️';
}

function isFollowEnabled() {
    return process.env.AUTO_FOLLOW_CHANNELS !== 'false';
}

function isReactEnabled() {
    return process.env.AUTO_REACT_CHANNELS !== 'false';
}

function getTargetJids() {
    const jids = new Set();
    // Extra JIDs from env
    const envJids = (process.env.NEWSLETTER_JIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const j of envJids) jids.add(j);
    return jids;
}

async function autoFollowChannels(conn) {
    if (!isFollowEnabled()) {
        console.log('[channel] Auto-follow disabled (AUTO_FOLLOW_CHANNELS=false)');
        return [];
    }
    const followed = [];
    for (const code of CHANNELS) {
        try {
            const meta = await conn.newsletterMetadata('invite', code);
            const jid = meta?.id;
            if (!jid) {
                console.log(`[channel] ⚠️ No JID for invite code: ${code}`);
                continue;
            }
            if (followedJids.has(jid)) {
                console.log(`[channel] Already following: ${jid}`);
                followed.push(jid);
                continue;
            }
            await conn.newsletterFollow(jid);
            followedJids.add(jid);
            followed.push(jid);
            console.log(`[channel] ✅ Followed: ${code} → ${jid}`);
        } catch (e) {
            console.log(`[channel] ❌ Follow failed for ${code}: ${e.message}`);
            // Continue with next channel — ek fail ho to baqi rukte nahi
        }
    }
    // Env se extra JIDs bhi follow karo
    for (const jid of getTargetJids()) {
        if (followedJids.has(jid)) continue;
        try {
            await conn.newsletterFollow(jid);
            followedJids.add(jid);
            followed.push(jid);
            console.log(`[channel] ✅ Followed (env): ${jid}`);
        } catch (e) {
            console.log(`[channel] ❌ Follow failed for ${jid}: ${e.message}`);
        }
    }
    return followed;
}

/**
 * Check if a newsletter message should get auto-reaction.
 * Returns { shouldReact: bool, jid, serverId }
 */
function shouldReactToNewsletter(remoteJid, serverId) {
    if (!isReactEnabled()) return { shouldReact: false };
    if (!remoteJid || !remoteJid.endsWith('@newsletter')) return { shouldReact: false };
    if (!serverId) return { shouldReact: false };

    // Sirf followed/target channels par react karo
    const targetJids = new Set([...followedJids, ...getTargetJids()]);
    // Agar koi target configure nahi to sab newsletters par react karo (backward compat)
    const hasTargets = targetJids.size > 0;
    if (hasTargets && !targetJids.has(remoteJid)) return { shouldReact: false };

    // Duplicate guard
    const key = `${remoteJid}:${serverId}`;
    if (reactedMessages.has(key)) return { shouldReact: false };

    return { shouldReact: true, jid: remoteJid, serverId: String(serverId) };
}

async function reactToNewsletter(conn, remoteJid, serverId) {
    const check = shouldReactToNewsletter(remoteJid, serverId);
    if (!check.shouldReact) return false;

    const key = `${check.jid}:${check.serverId}`;
    try {
        const emoji = getReactEmoji();
        await conn.newsletterReactMessage(check.jid, check.serverId, emoji);
        // Success par hi mark karo
        reactedMessages.add(key);
        if (reactedMessages.size > MAX_TRACKED) {
            // Purani entries saaf karo (FIFO approx)
            const iter = reactedMessages.values();
            for (let i = 0; i < 1000; i++) {
                const v = iter.next();
                if (v.done) break;
                reactedMessages.delete(v.value);
            }
        }
        console.log(`[channel] ❤️ Reacted ${emoji} on ${check.jid} msg ${check.serverId}`);
        return true;
    } catch (e) {
        console.log(`[channel] ❌ React failed for ${check.jid}: ${e.message}`);
        return false;
    }
}

// Reconnect par followed set clear karo taake naye connection par dobara follow ho
function clearFollowCache() {
    followedJids.clear();
}

module.exports = {
    autoFollowChannels,
    reactToNewsletter,
    shouldReactToNewsletter,
    clearFollowCache,
    getReactEmoji,
    isFollowEnabled,
    isReactEnabled,
    CHANNELS,
};
