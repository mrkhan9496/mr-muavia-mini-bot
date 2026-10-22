// Queen MD — Data layer (PostgreSQL / Neon)
// Pehle ye file MongoDB (mongoose) par thi; 2026-10-23 ko MD bot wale proven
// tareeqe par Postgres me port kar di gayi. Bahar ke tamam function naam aur
// behavior bilkul wohi rakhe hain taake index.js aur plugins ko farq na pare.
const config = require('../config');
const pg = require('./pg');

let dbReady = false;
let connectPromise = null;

// Postgres se connect (fail ho to khud dobara try karta rehta hai)
const connectdb = async (retries = 5) => {
    if (dbReady) return true;
    if (!config.DATABASE_URL) {
        console.error("❌ DATABASE_URL set nahi hai (config.js ya Heroku Config Vars me daalo)");
        return false;
    }
    if (connectPromise) return connectPromise;
    connectPromise = (async () => {
        for (let i = 1; i <= retries; i++) {
            try {
                await pg.query('SELECT 1');
                await pg.ensureTables();
                dbReady = true;
                console.log("✅ Database Connected Successfully");
                return true;
            } catch (e) {
                dbReady = false;
                console.error(`❌ Database Connection Failed (${i}/${retries}):`, e.message);
                if (i < retries) await new Promise(r => setTimeout(r, 4000 * i));
            }
        }
        return false;
    })();
    try { return await connectPromise; }
    finally { connectPromise = null; }
};

const isDbReady = () => dbReady;

const clean = (number) => String(number).replace(/[^0-9]/g, '');

// Sauvegarde session
async function saveSessionToMongoDB(number, credentials) {
    try {
        const cleanNumber = clean(number);
        await pg.query(
            `INSERT INTO queenmd_sessions (number, credentials, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (number) DO UPDATE SET credentials = EXCLUDED.credentials, updated_at = now()`,
            [cleanNumber, JSON.stringify(credentials)]
        );
        console.log(`📁 [Queen MD] Session saved for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving session to DB:', error);
        return false;
    }
}

// Récupération session
async function getSessionFromMongoDB(number) {
    try {
        const cleanNumber = clean(number);
        const r = await pg.query('SELECT credentials FROM queenmd_sessions WHERE number = $1', [cleanNumber]);
        return r.rows.length ? r.rows[0].credentials : null;
    } catch (error) {
        console.error('❌ Error getting session from DB:', error);
        return null;
    }
}

// Suppression session
async function deleteSessionFromMongoDB(number) {
    try {
        const cleanNumber = clean(number);
        await pg.query('DELETE FROM queenmd_sessions WHERE number = $1', [cleanNumber]);
        await pg.query('DELETE FROM queenmd_active_numbers WHERE number = $1', [cleanNumber]);
        try { await require('./mongoAuth').clearMongoAuth(cleanNumber); } catch (_) {}
        console.log(`🗑️ Session deleted from DB for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting session from DB:', error);
        return false;
    }
}

// Configuration utilisateur
const DEFAULT_CONFIG = {
    AUTO_RECORDING: 'false',
    AUTO_TYPING: 'false',
    ANTI_CALL: 'false',
    REJECT_MSG: '*🔕 ʏᴏᴜʀ ᴄᴀʟʟ ᴡᴀs ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ..!*',
    READ_MESSAGE: 'false',
    AUTO_VIEW_STATUS: 'false',
    AUTO_LIKE_STATUS: 'false',
    AUTO_STATUS_REPLY: 'false',
    AUTO_STATUS_MSG: 'Hello from Queen MD! 🔥',
    AUTO_LIKE_EMOJI: ['❤️', '👍', '😮', '😎'],
    ANTIDELETE: 'false'
};

async function getUserConfigFromMongoDB(number) {
    try {
        const cleanNumber = clean(number);
        const r = await pg.query('SELECT config FROM queenmd_user_configs WHERE number = $1', [cleanNumber]);
        if (r.rows.length && r.rows[0].config) {
            return r.rows[0].config;
        }
        // Configuration par défaut (save karke wapas do)
        await pg.query(
            `INSERT INTO queenmd_user_configs (number, config) VALUES ($1, $2)
             ON CONFLICT (number) DO NOTHING`,
            [cleanNumber, JSON.stringify(DEFAULT_CONFIG)]
        );
        return { ...DEFAULT_CONFIG };
    } catch (error) {
        console.error('❌ Error getting user config from DB:', error);
        return {};
    }
}

// Mise à jour configuration
async function updateUserConfigInMongoDB(number, newConfig) {
    try {
        const cleanNumber = clean(number);
        await pg.query(
            `INSERT INTO queenmd_user_configs (number, config, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (number) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
            [cleanNumber, JSON.stringify(newConfig)]
        );
        console.log(`⚙️ [Queen MD] Config updated for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating user config in DB:', error);
        return false;
    }
}

// Gestion OTP
async function saveOTPToMongoDB(number, otp, configData) {
    try {
        const cleanNumber = clean(number);
        await pg.query(
            `INSERT INTO queenmd_otps (number, otp, config, expires_at)
             VALUES ($1, $2, $3, now() + interval '5 minutes')`,
            [cleanNumber, String(otp), JSON.stringify(configData)]
        );
        console.log(`🔐 OTP saved for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving OTP to DB:', error);
        return false;
    }
}

async function verifyOTPFromMongoDB(number, otp) {
    try {
        const cleanNumber = clean(number);
        const r = await pg.query(
            `SELECT id, config FROM queenmd_otps
             WHERE number = $1 AND otp = $2 AND expires_at > now()
             ORDER BY created_at DESC LIMIT 1`,
            [cleanNumber, String(otp)]
        );
        if (!r.rows.length) {
            return { valid: false, error: 'Invalid or expired OTP' };
        }
        // Supprime OTP après vérification
        await pg.query('DELETE FROM queenmd_otps WHERE id = $1', [r.rows[0].id]);
        return { valid: true, config: r.rows[0].config };
    } catch (error) {
        console.error('❌ Error verifying OTP from DB:', error);
        return { valid: false, error: 'Verification error' };
    }
}

// Gestion numéros actifs
async function addNumberToMongoDB(number) {
    try {
        const cleanNumber = clean(number);
        await pg.query(
            `INSERT INTO queenmd_active_numbers (number, last_connected, is_active)
             VALUES ($1, now(), true)
             ON CONFLICT (number) DO UPDATE SET last_connected = now(), is_active = true`,
            [cleanNumber]
        );
        return true;
    } catch (error) {
        console.error('❌ Error adding number to DB:', error);
        return false;
    }
}

async function removeNumberFromMongoDB(number) {
    try {
        const cleanNumber = clean(number);
        await pg.query('DELETE FROM queenmd_active_numbers WHERE number = $1', [cleanNumber]);
        return true;
    } catch (error) {
        console.error('❌ Error removing number from DB:', error);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        const r = await pg.query('SELECT number FROM queenmd_active_numbers WHERE is_active = true');
        return r.rows.map(row => row.number);
    } catch (error) {
        console.error('❌ Error getting numbers from DB:', error);
        return [];
    }
}

// Statistiques
const STAT_FIELDS = {
    commandsUsed: 'commands_used',
    messagesReceived: 'messages_received',
    messagesSent: 'messages_sent',
    groupsInteracted: 'groups_interacted'
};

async function incrementStats(number, field) {
    try {
        const col = STAT_FIELDS[field];
        if (!col) return;
        const cleanNumber = clean(number);
        const today = new Date().toISOString().split('T')[0];
        await pg.query(
            `INSERT INTO queenmd_stats (number, date, ${col}) VALUES ($1, $2, 1)
             ON CONFLICT (number, date) DO UPDATE SET ${col} = queenmd_stats.${col} + 1`,
            [cleanNumber, today]
        );
    } catch (error) {
        console.error('❌ Error updating stats:', error);
    }
}

async function getStatsForNumber(number) {
    try {
        const cleanNumber = clean(number);
        const r = await pg.query(
            `SELECT number, date, commands_used, messages_received, messages_sent, groups_interacted
             FROM queenmd_stats WHERE number = $1 ORDER BY date DESC LIMIT 30`,
            [cleanNumber]
        );
        return r.rows.map(row => ({
            number: row.number,
            date: row.date,
            commandsUsed: row.commands_used,
            messagesReceived: row.messages_received,
            messagesSent: row.messages_sent,
            groupsInteracted: row.groups_interacted
        }));
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        return [];
    }
}

// ==============================================================================
// EXPORTS (naam purane wale hi rakhe hain taake callers ko tabdeeli na karni pare)
// Models ab istemal nahi hote (sab kaam helpers se hota hai) — null rakhe hain.
// ==============================================================================

module.exports = {
    connectdb,
    isDbReady,

    Session: null,
    UserConfig: null,
    OTP: null,
    ActiveNumber: null,
    Stats: null,

    // Fonctions session
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    deleteSessionFromMongoDB,

    // Fonctions configuration
    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,

    // Fonctions OTP
    saveOTPToMongoDB,
    verifyOTPFromMongoDB,

    // Fonctions numéros
    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getAllNumbersFromMongoDB,

    // Fonctions statistiques
    incrementStats,
    getStatsForNumber,

    // Anciennes fonctions (pour compatibilité)
    getUserConfig: async (number) => {
        const config = await getUserConfigFromMongoDB(number);
        return config || {};
    },
    updateUserConfig: updateUserConfigInMongoDB
};
