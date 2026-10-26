/* ==========================================================================
 *  👑 Queen MD  —  Multi-user WhatsApp Bot  (Heroku + MongoDB ready)
 * --------------------------------------------------------------------------
 *  Kya karta hai:
 *   • Web page (/) par koi bhi apna number daal kar PAIR CODE le sakta hai
 *   • Code WhatsApp > Linked Devices > "Link with phone number" me paste karo
 *   • Session (creds + keys) MongoDB me save hoti hai  -> Heroku restart /
 *     redeploy ke baad sab users ka bot AUTO wapas chalu ho jata hai
 *   • plugins/ folder ki saari commands auto load hoti hain
 * ========================================================================== */
'use strict';

const {
    default: makeWASocket,
    delay,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    Browsers,
    DisconnectReason,
    jidDecode,
    downloadContentFromMessage,
    getContentType,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');

const config = require('./config');
const events = require('./inconnuboy');
const { sms } = require('./lib/msg');
const { groupEvents } = require('./lib/groupEvents');
const { handleAntidelete } = require('./lib/antidelete');
const { installSpamGuard } = require('./lib/spamGuard');
const { useMongoAuthState, hasMongoAuth, clearMongoAuth } = require('./lib/mongoAuth');
const {
    connectdb,
    isDbReady,
    deleteSessionFromMongoDB,
    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,
    migrateStatusEmoji,
    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getAllNumbersFromMongoDB,
    saveOTPToMongoDB,
    verifyOTPFromMongoDB,
    incrementStats,
    getStatsForNumber,
} = require('./lib/database');
const { getMerged } = require('./lib/botSettings');

/* ==========================================================================
 *  1. SETTINGS
 * ========================================================================== */
const PORT = parseInt(process.env.PORT, 10) || 8000;
const PREFIX = config.PREFIX || '.';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const BOOT_TIME = Date.now();

const SETTINGS = {
    // Ek saath boot par kitne seconds ke gap se sessions restore hon
    RESTORE_GAP_MS: parseInt(process.env.RESTORE_GAP_MS, 10) || 3000,
    // Pair code dene ke baad user ke paas kitna time hai (ms)
    PAIR_TIMEOUT_MS: 3 * 60 * 1000,
    // Reconnect delay (ms) - har fail par barhta hai, max 60 sec
    RECONNECT_BASE_MS: 4000,
    RECONNECT_MAX_MS: 60000,
    // User config cache (DB par load kam karne ke liye)
    CFG_CACHE_MS: 8000,
    // /code endpoint rate limit: har IP ko 60 sec me max 6 request
    RATE_WINDOW_MS: 60 * 1000,
    RATE_MAX: 6,
    MAX_SESSIONS: parseInt(process.env.MAX_SESSIONS, 10) || 200,
    SYNC_HISTORY: process.env.SYNC_HISTORY === 'true',
    MARK_ONLINE: process.env.MARK_ONLINE === 'true',
};

/* 2026-10-19: NEWSLETTER_JIDS aur NEWSLETTER_EMOJIS ab lib/channelFollow.js mein handle hote hain.
 * NEWSLETTER_JIDS env var ab bhi supported hai (channelFollow.getTargetJids() parhta hai).
 * CHANNEL_REACT_EMOJI env var se emoji configure karo (default ❤️).
 */
const OWNER_NUMBERS = String(config.OWNER_NUMBER || '')
    .split(/[,\s]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);

/* ==========================================================================
 *  2. LOGGER
 * ========================================================================== */
const ICONS = { info: '📝', success: '✅', error: '❌', warning: '⚠️', debug: '🐛' };
function log(message, type = 'info') {
    console.log(`${ICONS[type] || '📝'} [Queen MD] ${new Date().toISOString()}: ${message}`);
}

/* ==========================================================================
 *  3. SMALL HELPERS
 * ========================================================================== */
const digits = (v) => String(v || '').replace(/[^0-9]/g, '');
const createSerial = (size) => crypto.randomBytes(size).toString('hex').slice(0, size);
const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// Group admins ki list (lid + phone number dono format me, taake match hamesha ho)
function getGroupAdmins(participants = []) {
    const admins = [];
    for (const p of participants) {
        if (p.admin == null) continue;
        if (p.id) admins.push(p.id);
        if (p.phoneNumber) admins.push(p.phoneNumber);
        if (p.jid) admins.push(p.jid);
    }
    return admins;
}

// @lid wale sender ko asli phone number JID me badalna (agar WhatsApp ne diya ho)
function resolveSenderJid(mek, botJid) {
    if (mek.key.fromMe) return botJid;
    let sender = mek.key.participant || mek.key.remoteJid || '';
    if (sender.endsWith('@lid')) {
        const alt = mek.key.participantAlt || mek.key.remoteJidAlt;
        if (alt && alt.endsWith('@s.whatsapp.net')) sender = alt;
    }
    try { return jidNormalizedUser(sender); } catch (_) { return sender; }
}

// Chhota in-memory message store (anti-delete + getMessage ke liye)
function createStore(limitPerChat = 150) {
    const store = {
        messages: {},
        bind(ev) {
            ev.on('messages.upsert', ({ messages }) => {
                for (const msg of messages) {
                    const jid = msg.key && msg.key.remoteJid;
                    if (!jid || jid === 'status@broadcast') continue;
                    if (!store.messages[jid]) store.messages[jid] = [];
                    store.messages[jid].push(msg);
                    if (store.messages[jid].length > limitPerChat) store.messages[jid].shift();
                }
            });
        },
        async loadMessage(jid, id) {
            const list = store.messages[jid];
            if (!list) return null;
            return list.find(m => m.key && m.key.id === id) || null;
        },
    };
    return store;
}

// Same message do dafa process na ho
const seenIds = new Set();
function alreadySeen(id) {
    if (!id) return false;
    if (seenIds.has(id)) return true;
    seenIds.add(id);
    if (seenIds.size > 3000) {
        const first = seenIds.values().next().value;
        seenIds.delete(first);
    }
    return false;
}

// User config cache
const cfgCache = new Map();
async function getCfg(number) {
    const hit = cfgCache.get(number);
    if (hit && Date.now() - hit.at < SETTINGS.CFG_CACHE_MS) return hit.value;
    let value = {};
    // 2026-10-23 fix: behaviors ko MERGED config do (DB user config +
    // botSettings extra). Toggles botSettings mein likhte hain — sirf DB
    // config parhne se 'ON ho gaya lekin kaam nahi' wali kharabi thi.
    try { value = (await getMerged(number)) || {}; } catch (_) {}
    cfgCache.set(number, { at: Date.now(), value });
    return value;
}
function dropCfgCache(number) { cfgCache.delete(number); }

/* ==========================================================================
 *  4. PLUGINS LOAD
 * ========================================================================== */
function loadPlugins() {
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
    let ok = 0;
    for (const file of files) {
        try {
            require(path.join(pluginsDir, file));
            ok++;
        } catch (e) {
            log(`Plugin load fail: ${file} -> ${e.message}`, 'error');
        }
    }
    log(`Plugins loaded: ${ok}/${files.length}  |  Commands: ${events.commands.length}`, ok === files.length ? 'success' : 'warning');
}

/* ==========================================================================
 *  5. SESSION REGISTRY
 *     sessions: number -> { conn, createdAt, connected, pairing, timer }
 * ========================================================================== */
const sessions = new Map();
const sessionRegistry = require('./lib/sessionRegistry'); // plugins ke liye live session list (sirf references, koi credential nahi)
const connecting = new Set();     // setup ke dauran lock
const pairErrors = new Map();     // number -> { message, at } background pairing ki ghalti (polling page ke liye)
const retryCount = new Map();     // reconnect attempts
const reconnectTimers = new Map();
let shuttingDown = false;

function isConnected(number) {
    const s = sessions.get(number);
    return !!(s && s.connected);
}

function connectionInfo(number) {
    const s = sessions.get(number);
    return {
        isConnected: !!(s && s.connected),
        connectionTime: s ? new Date(s.createdAt).toLocaleString() : null,
        uptime: s ? Math.floor((Date.now() - s.createdAt) / 1000) : 0,
    };
}

function destroySocket(number, conn) {
    const s = sessions.get(number);
    if (s && s.timer) clearTimeout(s.timer);
    if (!s || !conn || s.conn === conn) { sessions.delete(number); sessionRegistry.unregister(number); }
    try { conn && conn.ev.removeAllListeners(); } catch (_) {}
    try { conn && conn.ws && conn.ws.close(); } catch (_) {}
    // 2026-10-19: Follow cache clear taake reconnect par dobara follow ho
    try { require('./lib/channelFollow').clearFollowCache(); } catch (_) {}
}

// User ka sab kuch (session + mongo data) saaf
async function fullCleanup(number) {
    const s = sessions.get(number);
    destroySocket(number, s && s.conn);
    retryCount.delete(number);
    clearTimeout(reconnectTimers.get(number));
    reconnectTimers.delete(number);
    dropCfgCache(number);
    try { await deleteSessionFromMongoDB(number); } catch (_) {}
    try { await clearMongoAuth(number); } catch (_) {}
    try { await removeNumberFromMongoDB(number); } catch (_) {}
}

function scheduleReconnect(number, fast = false) {
    if (shuttingDown || reconnectTimers.has(number)) return;
    const tries = (retryCount.get(number) || 0) + 1;
    retryCount.set(number, tries);
    const wait = fast ? 1500 : Math.min(SETTINGS.RECONNECT_BASE_MS * Math.pow(2, tries - 1), SETTINGS.RECONNECT_MAX_MS);
    log(`Reconnect ${number} in ${Math.round(wait / 1000)}s (try ${tries})`, 'warning');
    const t = setTimeout(async () => {
        reconnectTimers.delete(number);
        try { await startSession(number, { restore: true }); }
        catch (e) { log(`Reconnect error ${number}: ${e.message}`, 'error'); scheduleReconnect(number); }
    }, wait);
    reconnectTimers.set(number, t);
}

/* ==========================================================================
 *  6. SOCKET HELPERS
 * ========================================================================== */
const FALLBACK_WA_VERSION = [2, 3000, 1023223821];
let cachedVersion = null;
let cachedVersionAt = 0;
async function getWaVersion() {
    if (cachedVersion && Date.now() - cachedVersionAt < 60 * 60 * 1000) return cachedVersion;
    try {
        const { version } = await fetchLatestBaileysVersion();
        if (Array.isArray(version) && version.length === 3) {
            cachedVersion = version;
            cachedVersionAt = Date.now();
            return version;
        }
    } catch (e) {
        log(`WA version fetch fail, fallback use ho raha: ${e.message}`, 'warning');
    }
    return cachedVersion || FALLBACK_WA_VERSION;
}

function send(res, payload, status = 200) {
    if (res && !res.headersSent) {
        try { res.status(status).json(payload); } catch (_) {}
    }
}

function addConnHelpers(conn) {
    conn.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
        }
        return jid;
    };

    conn.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        const quoted = message.msg ? message.msg : message;
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        const type = await FileType.fromBuffer(buffer);
        const trueFileName = attachExtension ? `${filename}.${type ? type.ext : 'bin'}` : filename;
        await fs.writeFile(trueFileName, buffer);
        return trueFileName;
    };
}

async function sendWelcome(conn, number) {
    const userJid = jidNormalizedUser(conn.user.id);
    const caption =
        `\n╭────────────────────◇\n` +
        `│✦ *_${config.BOT_NAME}_ — CONNECTED* 🔥\n` +
        `│✦ Type *${PREFIX}menu* to see all commands 💫\n` +
        `│✦ Prefix 『 ${PREFIX} 』  Mode 〔${config.WORK_TYPE}〕\n` +
        `╰────────────────────○\n` +
        `*${config.BOT_FOOTER}*`;
    try {
        await conn.sendMessage(userJid, { image: { url: config.IMAGE_PATH }, caption });
    } catch (_) {
        await conn.sendMessage(userJid, { text: caption }).catch(() => {});
    }
}

/* ==========================================================================
 *  7. CALL HANDLER (anti-call)
 * ========================================================================== */
function setupCallHandler(conn, number) {
    conn.ev.on('call', async (calls) => {
        try {
            const userConfig = await getCfg(number);
            if (userConfig.ANTI_CALL !== 'true') return;
            for (const call of calls) {
                if (call.status !== 'offer') continue;
                await conn.rejectCall(call.id, call.from);
                await conn.sendMessage(call.from, { text: userConfig.REJECT_MSG || config.REJECT_MSG });
                log(`Call reject: ${number} <- ${call.from}`, 'info');
            }
        } catch (err) {
            log(`Anti-call error ${number}: ${err.message}`, 'error');
        }
    });
}

/* ==========================================================================
 *  8. START SESSION  (pair code / restore dono yahi se hote hain)
 * ========================================================================== */
async function startSession(rawNumber, { res = null, restore = false } = {}) {
    const number = digits(rawNumber);

    if (number.length < 8 || number.length > 15) {
        return send(res, { status: 'error', message: 'Number sahi nahi hai (country code ke saath likho)' }, 400);
    }

    if (!isDbReady()) {
        const ok = await connectdb(2);
        if (!ok) return send(res, { status: 'error', message: 'Database connect nahi hai, thori der baad try karo' }, 503);
    }

    const existing = sessions.get(number);

    if (existing && existing.connected) {
        const info = connectionInfo(number);
        return send(res, {
            status: 'already_connected',
            message: 'Ye number pehle se connected hai',
            connectionTime: info.connectionTime,
            uptime: `${info.uptime} seconds`,
        });
    }

    // Pair code abhi abhi diya hua hai -> wahi dobara do
    if (existing && existing.pairing && !restore) {
        if (Date.now() - existing.pairing.at < 150 * 1000) {
            return send(res, { code: existing.pairing.code, status: 'new_pairing' });
        }
        destroySocket(number, existing.conn);
        await clearMongoAuth(number);
    }

    if (connecting.has(number)) {
        return send(res, { status: 'connection_in_progress', message: 'Thora wait karo' }, 429);
    }
    if (!sessions.has(number) && sessions.size >= SETTINGS.MAX_SESSIONS) {
        pairErrors.set(number, { message: 'Server full hai (MAX_SESSIONS)', at: Date.now() });
        return send(res, { status: 'error', message: 'Server full hai (MAX_SESSIONS)' }, 503);
    }

    connecting.add(number);
    let conn = null;

    try {
        const { state, saveCreds } = await useMongoAuthState(number);
        const alreadyPaired = !!(state.creds.me || state.creds.registered);

        // Restore chal raha ho aur session adhoori ho -> saaf kar do
        if (restore && !alreadyPaired) {
            log(`Adhoori session saaf: ${number}`, 'warning');
            await clearMongoAuth(number);
            await removeNumberFromMongoDB(number);
            return;
        }

        const version = await getWaVersion();
        const silentLogger = pino({ level: 'silent' });
        const store = createStore();

        conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            },
            version,
            logger: silentLogger,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: SETTINGS.SYNC_HISTORY,
            markOnlineOnConnect: SETTINGS.MARK_ONLINE,
            getMessage: async (key) => {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg && msg.message ? msg.message : { conversation: config.BOT_NAME };
            },
        });

        const session = { conn, createdAt: Date.now(), connected: false, pairing: null, timer: null };
        sessions.set(number, session);
        sessionRegistry.register(number, session);
        store.bind(conn.ev);
        addConnHelpers(conn);
        installSpamGuard(conn, config.BOT_NAME); // 2026-10-26 kill-switch: exact 'Queen MD' text kabhi na jaye
        setupCallHandler(conn, number);

        /* ---------------- creds save (MongoDB) ---------------- */
        conn.ev.on('creds.update', async () => {
            try { await saveCreds(); }
            catch (e) { log(`Creds save error ${number}: ${e.message}`, 'error'); }
        });

        /* ---------------- connection open / close ---------------- */
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                session.connected = true;
                session.pairing = null;
                session.createdAt = Date.now();
                clearTimeout(session.timer);
                retryCount.delete(number);
                log(`Connected: ${number}`, 'success');
                try { const oc = await getCfg(number); if (oc.ALWAYS_ONLINE === 'true') await conn.sendPresenceUpdate('available').catch(() => {}); } catch (_) {}
                try {
                    const known = (await getAllNumbersFromMongoDB()).includes(number);
                    await addNumberToMongoDB(number);
                    if (!known) {
                        await delay(1500);
                        await sendWelcome(conn, number);
                    }
                    // 2026-10-18: Auto-follow Muavia's WhatsApp channels
                    try {
                        const { autoFollowChannels } = require('./lib/channelFollow');
                        await autoFollowChannels(conn);
                    } catch (e) { log(`Auto-follow error: ${e.message}`, 'warning'); }
                } catch (e) { log(`Open handler error ${number}: ${e.message}`, 'error'); }
                return;
            }

            if (connection === 'close') {
                session.connected = false;
                const err = lastDisconnect && lastDisconnect.error;
                const statusCode = err && err.output && err.output.statusCode;
                const msg = err && err.message;
                log(`Closed ${number}: ${statusCode} ${msg || ''}`, 'warning');

                const paired = !!(conn.authState.creds.me || conn.authState.creds.registered);
                destroySocket(number, conn);

                // User ne WhatsApp se device unlink kar diya
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    log(`Logged out / unlinked: ${number} -> data delete`, 'warning');
                    await fullCleanup(number);
                    return;
                }

                // Pairing poori nahi hui (code use nahi kiya)
                if (!paired) {
                    log(`Pairing complete nahi hui: ${number}`, 'info');
                    await clearMongoAuth(number).catch(() => {});
                    return;
                }

                // Dusri jagah same login khul gaya
                if (statusCode === DisconnectReason.connectionReplaced) {
                    log(`Connection replaced: ${number} (reconnect nahi kiya)`, 'warning');
                    return;
                }

                // 515 = pairing ke baad restart required, baki sab normal reconnect
                scheduleReconnect(number, statusCode === DisconnectReason.restartRequired);
            }
        });

        /* ---------------- baqi events ---------------- */
        conn.ev.on('messages.update', async (updates) => {
            try { await handleAntidelete(conn, updates, store); } catch (_) {}
        });

        conn.ev.on('group-participants.update', async (update) => {
            try { await groupEvents(conn, update, number); } catch (e) { log(`groupEvents error: ${e.message}`, 'error'); }
        });

        conn.ev.on('messages.upsert', (upsert) => {
            handleUpsert(conn, number, upsert).catch((e) => log(`Message handler error ${number}: ${e.message}`, 'error'));
        });

        /* ---------------- pairing code ---------------- */
        if (!alreadyPaired) {
            log(`Naya pairing start: ${number}`, 'info');
            try {
                await delay(2500);
                const rawCode = await conn.requestPairingCode(number);
                const code = (rawCode && rawCode.match(/.{1,4}/g) || [rawCode]).join('-');
                session.pairing = { code, at: Date.now() };
                pairErrors.delete(number);
                log(`Pair code ${number}: ${code}`, 'success');
                send(res, { code, status: 'new_pairing' });

                // User ne time par code use nahi kiya to band
                session.timer = setTimeout(async () => {
                    const s = sessions.get(number);
                    if (s && !s.connected && !(conn.authState.creds.me)) {
                        log(`Pair timeout: ${number}`, 'warning');
                        destroySocket(number, conn);
                        await clearMongoAuth(number).catch(() => {});
                    }
                }, SETTINGS.PAIR_TIMEOUT_MS);
            } catch (error) {
                log(`Pair code error ${number}: ${error.message}`, 'error');
                pairErrors.set(number, { message: 'Pair code nahi ban saka: ' + error.message, at: Date.now() });
                destroySocket(number, conn);
                await clearMongoAuth(number).catch(() => {});
                send(res, { status: 'error', message: 'Pair code nahi ban saka: ' + error.message }, 500);
            }
        } else {
            log(`Existing session use ho rahi hai: ${number}`, 'success');
            send(res, { status: 'reconnecting', message: 'Session MongoDB se restore ho rahi hai' });
        }
    } catch (err) {
        log(`startSession error ${number}: ${err.message}`, 'error');
        if (!restore) pairErrors.set(number, { message: err.message, at: Date.now() });
        if (conn) destroySocket(number, conn);
        send(res, { status: 'error', message: err.message }, 500);
    } finally {
        connecting.delete(number);
    }
}

/* ==========================================================================
 *  9. MESSAGE HANDLING
 * ========================================================================== */
const groupCache = new Map();
async function getGroupMeta(conn, jid) {
    const hit = groupCache.get(jid);
    if (hit && Date.now() - hit.at < 20000) return hit.data;
    const data = await conn.groupMetadata(jid);
    groupCache.set(jid, { at: Date.now(), data });
    if (groupCache.size > 300) groupCache.delete(groupCache.keys().next().value);
    return data;
}

function buildQuotedCard() {
    return {
        key: {
            remoteJid: 'status@broadcast',
            participant: '13135550002@s.whatsapp.net',
            fromMe: false,
            id: createSerial(16).toUpperCase(),
        },
        message: {
            contactMessage: {
                displayName: `© ${config.BOT_NAME}`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.BOT_NAME}\nORG:${config.BOT_NAME};\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
            },
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        status: 1,
        verifiedBizName: 'Meta',
    };
}

async function handleUpsert(conn, number, upsert) {
    if (!upsert || upsert.type !== 'notify') return;
    for (const mek of upsert.messages || []) {
        try {
            await processMessage(conn, number, mek);
        } catch (e) {
            log(`processMessage error (${number}): ${e.message}`, 'error');
        }
    }
}

async function processMessage(conn, number, mek) {
    if (!mek || !mek.key || !mek.message) return;
    if (alreadySeen(`${number}:${mek.key.id}`)) return;

    // Ephemeral wrapper hatao
    if (getContentType(mek.message) === 'ephemeralMessage') {
        mek.message = mek.message.ephemeralMessage.message;
    }
    const firstType = getContentType(mek.message);
    if (!firstType || firstType === 'protocolMessage' || firstType === 'senderKeyDistributionMessage') return;

    const userConfig = await getCfg(number);
    const remoteJid = mek.key.remoteJid;
    if (!remoteJid) return;

    /* ---------- Newsletter (channel) auto react ---------- */
    // 2026-10-19: lib/channelFollow.js ka reactToNewsletter use karo
    // (duplicate guard + configurable emoji + proper logging)
    if (remoteJid.endsWith('@newsletter')) {
        try {
            const { reactToNewsletter, noteNewsletterPost } = require('./lib/channelFollow');
            const serverId = mek.newsletterServerId || (mek.key && mek.key.server_id);
            if (serverId) {
                noteNewsletterPost(number, remoteJid, serverId); // .follow ke liye latest post yaad rakho
                await reactToNewsletter(conn, remoteJid, serverId, number); // per-session react — har session apna
            }
        } catch (e) {
            console.log(`[channel] React handler error: ${e.message}`);
        }
        return;
    }

    /* ---------- Status handling ---------- */
    if (remoteJid === 'status@broadcast') {
        if (mek.key.fromMe) return;
        try {
            if (userConfig.AUTO_VIEW_STATUS === 'true') await conn.readMessages([mek.key]);
            if (userConfig.AUTO_LIKE_STATUS === 'true') {
                const botJid = conn.decodeJid(conn.user.id);
                const emojis = (userConfig.AUTO_LIKE_EMOJI && userConfig.AUTO_LIKE_EMOJI.length)
                    ? userConfig.AUTO_LIKE_EMOJI : config.AUTO_LIKE_EMOJI;
                await conn.sendMessage(
                    remoteJid,
                    { react: { text: randomOf(emojis), key: mek.key } },
                    { statusJidList: [mek.key.participant, botJid].filter(Boolean) }
                );
            }
            if (userConfig.AUTO_STATUS_REPLY === 'true' && mek.key.participant) {
                await conn.sendMessage(
                    mek.key.participant,
                    { text: userConfig.AUTO_STATUS_MSG || config.AUTO_STATUS_MSG },
                    { quoted: mek }
                );
            }
        } catch (e) {
            log(`Status handler error (${number}): ${e.message}`, 'warning');
        }
        return;
    }

    if (userConfig.READ_MESSAGE === 'true') {
        conn.readMessages([mek.key]).catch(() => {});
    }

    /* ---------- Normal message ---------- */
    const m = sms(conn, mek);
    const type = getContentType(mek.message);
    const ctxInfo = mek.message[type] && mek.message[type].contextInfo;
    mek.mentionedJid = (ctxInfo && ctxInfo.mentionedJid) || [];

    let body = '';
    if (typeof m.body === 'string') body = m.body;
    else if (type === 'conversation') body = mek.message.conversation;
    else if (type === 'extendedTextMessage') body = mek.message.extendedTextMessage.text || '';

    const from = remoteJid;
    const isGroup = from.endsWith('@g.us');
    const botJid = jidNormalizedUser(conn.user.id);
    const botNumber2 = botJid;
    const botNumber = botJid.split('@')[0];
    const botLid = conn.user.lid ? jidNormalizedUser(conn.user.lid) : null;

    const sender = resolveSenderJid(mek, botJid);
    const senderNumber = sender.split('@')[0].split(':')[0];
    const pushname = mek.pushName || 'User';

    const isMe = !!mek.key.fromMe || senderNumber === botNumber;
    const isOwner = isMe || OWNER_NUMBERS.includes(senderNumber);
    const isCreator = isOwner;

    const isCmd = body.startsWith(PREFIX);
    const command = isCmd ? body.slice(PREFIX.length).trim().split(/\s+/).shift().toLowerCase() : '';
    const args = body.trim().split(/\s+/).slice(1);
    const q = args.join(' ');
    const text = q;

    /* ---------- Group info ---------- */
    let groupMetadata = null, groupName = null, participants = null;
    let groupAdmins = [], isBotAdmins = false, isAdmins = false;
    if (isGroup) {
        try {
            groupMetadata = await getGroupMeta(conn, from);
            groupName = groupMetadata.subject;
            participants = groupMetadata.participants;
            groupAdmins = getGroupAdmins(participants);
            const botIds = [botJid, botLid].filter(Boolean);
            isBotAdmins = botIds.some(id => groupAdmins.includes(id));
            isAdmins = [sender, mek.key.participant].filter(Boolean).some(id => groupAdmins.includes(id));
        } catch (_) { /* metadata na mila to bhi chalo */ }
    }

    /* ---------- Presence ---------- */
    if (userConfig.AUTO_TYPING === 'true') conn.sendPresenceUpdate('composing', from).catch(() => {});
    if (userConfig.AUTO_RECORDING === 'true') conn.sendPresenceUpdate('recording', from).catch(() => {});

    /* ---------- Auto behaviors (autoreact/autosticker/autoreply/guards) ---------- */
    if (!mek.key.fromMe) {
        try {
            const { runAutoBehaviors } = require('./lib/autoBehaviors');
            await runAutoBehaviors(conn, { userConfig, mek, from, isGroup, isAdmins, isOwner, body });
        } catch (e) { log(`Auto behavior error (${number}): ${e.message}`, 'warning'); }
    }

    const myquoted = buildQuotedCard();
    const reply = (t) => conn.sendMessage(from, { text: t }, { quoted: myquoted });
    const l = reply;

    const mergedConfig = isCmd ? await getMerged(number).catch(() => userConfig) : userConfig;

    const ctx = {
        number, userConfig: mergedConfig,
        from, l, quoted: mek, body, isCmd, command, args, q, text, prefix: PREFIX,
        isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
        isMe, isOwner, isCreator, groupMetadata, groupName, participants,
        groupAdmins, isBotAdmins, isAdmins, reply, config, myquoted,
    };

    /* ---------- Work mode ---------- */
    const workMode = (userConfig.WORK_TYPE || config.WORK_TYPE || 'public').toLowerCase();
    const allowed =
        isOwner ||
        workMode === 'public' ||
        (workMode === 'group' && isGroup) ||
        (workMode === 'inbox' && !isGroup);

    /* ---------- Command run ---------- */
    if (isCmd && command && allowed) {
        const cmd =
            events.commands.find(c => c.pattern === command) ||
            events.commands.find(c => Array.isArray(c.alias) && c.alias.includes(command));

        incrementStats(number, 'commandsUsed').catch(() => {});

        if (cmd) {
            if (cmd.react) {
                conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }).catch(() => {});
            }
            Promise.resolve()
                .then(() => cmd.function(conn, mek, m, ctx))
                .catch((e) => {
                    log(`PLUGIN ERROR [${command}] ${number}: ${e && e.message}`, 'error');
                    reply(`❌ *${command}* command me error aaya:\n${(e && e.message) || e}`).catch(() => {});
                });
        }
    }

    incrementStats(number, 'messagesReceived').catch(() => {});
    if (isGroup) incrementStats(number, 'groupsInteracted').catch(() => {});

    /* ---------- Event type plugins (on: body / image / sticker ...) ---------- */
    for (const evCmd of events.commands) {
        if (!evCmd.on) continue;
        let fire = false;
        if ((evCmd.on === 'body' || evCmd.on === 'text') && body) fire = true;
        else if ((evCmd.on === 'image' || evCmd.on === 'photo') && type === 'imageMessage') fire = true;
        else if (evCmd.on === 'video' && type === 'videoMessage') fire = true;
        else if (evCmd.on === 'sticker' && type === 'stickerMessage') fire = true;
        else if (evCmd.on === 'audio' && type === 'audioMessage') fire = true;
        if (!fire) continue;
        Promise.resolve()
            .then(() => evCmd.function(conn, mek, m, ctx))
            .catch((e) => log(`EVENT PLUGIN ERROR (${evCmd.on}): ${e && e.message}`, 'error'));
    }
}

/* ==========================================================================
 *  10. WEB SERVER + API
 * ========================================================================== */
const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple IP rate limiter (har route group ka apna store)
const limitStores = [];
function makeRateLimit(max) {
    const hits = new Map();
    limitStores.push(hits);
    return function (req, res, next) {
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const now = Date.now();
        const rec = hits.get(ip) || { count: 0, start: now };
        if (now - rec.start > SETTINGS.RATE_WINDOW_MS) { rec.count = 0; rec.start = now; }
        rec.count++;
        hits.set(ip, rec);
        if (rec.count > max) {
            return res.status(429).json({ status: 'error', message: 'Bohat zyada requests, 1 minute baad try karo' });
        }
        next();
    };
}
const rateLimit = makeRateLimit(SETTINGS.RATE_MAX);
const pairRateLimit = makeRateLimit(60); // /code polling ke liye (page har 3s check karta hai)
setInterval(() => {
    const now = Date.now();
    for (const hits of limitStores) for (const [ip, rec] of hits) if (now - rec.start > SETTINGS.RATE_WINDOW_MS * 2) hits.delete(ip);
}, 5 * 60 * 1000).unref();

// Admin-only routes (Heroku Config Var: ADMIN_KEY)
function requireAdmin(req, res, next) {
    if (!ADMIN_KEY) {
        return res.status(403).json({ error: 'ADMIN_KEY set nahi hai. Heroku Config Vars me ADMIN_KEY daalo.' });
    }
    const key = req.query.key || req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Wrong admin key' });
    next();
}

/* ---------- Pair page ---------- */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'pair.html')));

/* ---------- Pair code ---------- */
app.get('/code', pairRateLimit, async (req, res) => {
    const number = digits(req.query.number);
    if (!number || number.length < 8 || number.length > 15) return res.status(400).json({ status: 'error', error: 'Number required', message: 'Number sahi nahi hai (country code ke saath likho)' });

    // Database tayyar na ho to fauri jawab (25s wale purane timeout wala chakkar khatam:
    // ab code background me banta hai aur page polling se le leta hai)
    if (!isDbReady()) {
        return send(res, { status: 'error', message: 'Database connect nahi hai, thori der baad try karo' }, 503);
    }

    const s = sessions.get(number);
    if (s && s.connected) {
        const info = connectionInfo(number);
        return send(res, { status: 'already_connected', message: 'Ye number pehle se connected hai', connectionTime: info.connectionTime, uptime: `${info.uptime} seconds` });
    }
    // Tayyar code para hai -> fauri do
    if (s && s.pairing && Date.now() - s.pairing.at < 150 * 1000) {
        return send(res, { code: s.pairing.code, status: 'new_pairing' });
    }
    // Generation chal rahi hai -> page ko wait ka signal
    if (s || connecting.has(number)) {
        return send(res, { status: 'generating', message: 'Code ban raha hai, wait karo...' }, 202);
    }
    // Pichli background koshish ki ghalti (ek dafa dikha kar saaf)
    const pe = pairErrors.get(number);
    if (pe && Date.now() - pe.at < 60 * 1000) {
        pairErrors.delete(number);
        return send(res, { status: 'error', message: pe.message }, 500);
    }
    // Nayi generation background me shuru karo aur fauri jawab do
    pairErrors.delete(number);
    startSession(number, {}).catch((e) => log(`Pair start error ${number}: ${e.message}`, 'error'));
    return send(res, { status: 'generating', message: 'Code ban raha hai, wait karo...' }, 202);
});

/* ---------- Status / info ---------- */
app.get('/status', async (req, res) => {
    const number = digits(req.query.number);
    if (!number) {
        // Poori list sirf admin ko
        if (!ADMIN_KEY || (req.query.key || req.headers['x-admin-key']) !== ADMIN_KEY) {
            return res.json({ totalActive: [...sessions.values()].filter(s => s.connected).length });
        }
        const list = [...sessions.keys()].map(n => {
            const s = connectionInfo(n);
            return { number: n, status: s.isConnected ? 'connected' : 'connecting', connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` };
        });
        return res.json({ totalActive: list.filter(x => x.status === 'connected').length, connections: list });
    }
    const s = connectionInfo(number);
    res.json({ number, isConnected: s.isConnected, connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` });
});

app.get('/active', requireAdmin, (req, res) => {
    const nums = [...sessions.entries()].filter(([, s]) => s.connected).map(([n]) => n);
    res.json({ count: nums.length, numbers: nums });
});

app.get(['/ping', '/health'], (req, res) => {
    res.json({
        status: 'active',
        message: `${config.BOT_NAME} is running 🔥`,
        activeSessions: [...sessions.values()].filter(s => s.connected).length,
        commands: events.commands.length,
        database: isDbReady() ? 'connected' : 'disconnected',
        uptime: formatUptime((Date.now() - BOOT_TIME) / 1000),
    });
});

/* ---------- Disconnect (admin) ---------- */
app.get('/disconnect', requireAdmin, async (req, res) => {
    const number = digits(req.query.number);
    if (!number) return res.status(400).json({ error: 'Number required' });
    try {
        await fullCleanup(number);
        res.json({ status: 'success', message: 'Disconnected & session deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to disconnect', details: e.message });
    }
});

/* ---------- Connect all saved sessions (admin) ---------- */
app.get('/connect-all', requireAdmin, async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        if (!numbers.length) return res.status(404).json({ error: 'No numbers found' });
        const results = [];
        for (const n of numbers) {
            if (isConnected(n)) { results.push({ number: n, status: 'already_connected' }); continue; }
            await startSession(n, { restore: true });
            results.push({ number: n, status: 'connection_initiated' });
            await delay(1000);
        }
        res.json({ status: 'success', total: numbers.length, connections: results });
    } catch (e) {
        res.status(500).json({ error: 'Failed', details: e.message });
    }
});

/* ---------- Config update with OTP (WhatsApp par OTP aata hai) ---------- */
app.get('/update-config', rateLimit, async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) return res.status(400).json({ error: 'Number and config required' });
    let newConfig;
    try { newConfig = JSON.parse(configString); } catch (_) { return res.status(400).json({ error: 'Invalid config' }); }
    const n = digits(number);
    const s = sessions.get(n);
    if (!s || !s.connected) return res.status(404).json({ error: 'No active session' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOTPToMongoDB(n, otp, newConfig);
    try {
        await s.conn.sendMessage(jidNormalizedUser(s.conn.user.id), {
            text: `*🔐 ${config.BOT_NAME} — CONFIG UPDATE*\n\nOTP: *${otp}*\nValid 5 minutes`,
        });
        res.json({ status: 'otp_sent' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

app.get('/verify-otp', rateLimit, async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) return res.status(400).json({ error: 'Number and OTP required' });
    const n = digits(number);
    const verification = await verifyOTPFromMongoDB(n, otp);
    if (!verification.valid) return res.status(400).json({ error: verification.error });
    await updateUserConfigInMongoDB(n, verification.config);
    dropCfgCache(n);
    const s = sessions.get(n);
    if (s && s.connected) {
        await s.conn.sendMessage(jidNormalizedUser(s.conn.user.id), { text: '*✅ CONFIG UPDATED*' }).catch(() => {});
    }
    res.json({ status: 'success' });
});

app.get('/stats', async (req, res) => {
    const n = digits(req.query.number);
    if (!n) return res.status(400).json({ error: 'Number required' });
    try {
        const stats = await getStatsForNumber(n);
        const s = connectionInfo(n);
        res.json({ number: n, connectionStatus: s.isConnected ? 'Connected' : 'Disconnected', uptime: s.uptime, stats });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
    log(`Express error: ${err.message}`, 'error');
    res.status(500).json({ error: 'Internal Server Error' });
});

/* ==========================================================================
 *  11. AUTO RESTORE  (Heroku restart ke baad sab users wapas online)
 * ========================================================================== */
let restoring = false;
async function restoreAllSessions() {
    if (restoring) return;
    restoring = true;
    try {
        log('MongoDB se saved sessions restore ho rahi hain...', 'info');
        const numbers = await getAllNumbersFromMongoDB();
        if (!numbers.length) { log('Koi saved session nahi mili', 'info'); return; }
        log(`${numbers.length} session(s) mili`, 'info');
        for (const n of numbers) {
            if (shuttingDown) break;
            if (!sessions.has(n)) {
                try { await startSession(n, { restore: true }); }
                catch (e) { log(`Restore fail ${n}: ${e.message}`, 'error'); }
                await delay(SETTINGS.RESTORE_GAP_MS);
            }
        }
        log('Auto restore complete', 'success');
    } catch (e) {
        log(`restoreAllSessions error: ${e.message}`, 'error');
    } finally {
        restoring = false;
    }
}

/* ==========================================================================
 *  12. HOUSEKEEPING
 * ========================================================================== */
function cleanTempFiles() {
    const dirs = [path.join(__dirname, 'temp'), path.join(__dirname, 'tmp')];
    const maxAge = 60 * 60 * 1000;
    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) continue;
            for (const f of fs.readdirSync(dir)) {
                const p = path.join(dir, f);
                try {
                    const st = fs.statSync(p);
                    if (st.isFile() && Date.now() - st.mtimeMs > maxAge) fs.unlinkSync(p);
                } catch (_) {}
            }
        } catch (_) {}
    }
}

function startKeepAlive() {
    if (!config.APP_URL) return;
    setInterval(() => {
        axios.get(`${config.APP_URL}/ping`, { timeout: 15000 }).catch(() => {});
    }, 20 * 60 * 1000).unref();
    log(`Keep-alive on: ${config.APP_URL}`, 'info');
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} mila, band ho raha hai (sessions MongoDB me safe hain)`, 'warning');
    for (const [n, s] of sessions) {
        try { s.conn.ws.close(); } catch (_) {}
        clearTimeout(s.timer);
    }
    setTimeout(() => process.exit(0), 1500);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    log(`Unhandled rejection: ${reason && reason.message ? reason.message : reason}`, 'error');
});
process.on('uncaughtException', (err) => {
    log(`Uncaught exception: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`, 'error');
});

/* ==========================================================================
 *  13. BOOT
 * ========================================================================== */
async function main() {
    log(`${config.BOT_NAME} start ho raha hai... (Node ${process.version})`, 'info');

    loadPlugins();

    // Pehle port bind karo (Heroku 60 sec me port maangta hai)
    app.listen(PORT, () => log(`🚀 Server running on port ${PORT}`, 'success'));

    const dbOk = await connectdb(5);
    if (dbOk) {
        // 2026-10-26: status react list migration (purani default wali configs -> Muavia ki nayi list)
        try { await migrateStatusEmoji(); } catch (_) {}
        setTimeout(restoreAllSessions, 2000);
    } else {
        log('Database abhi connect nahi hua, har 30 sec me dobara try hoga', 'error');
        const t = setInterval(async () => {
            if (await connectdb(1)) {
                clearInterval(t);
                restoreAllSessions();
            }
        }, 30000);
    }

    cleanTempFiles();
    setInterval(cleanTempFiles, 30 * 60 * 1000).unref();
    startKeepAlive();
}

main().catch((e) => log(`Boot error: ${e.stack || e.message}`, 'error'));

module.exports = app;
