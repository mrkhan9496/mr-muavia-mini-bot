// Shared PostgreSQL pool (Neon) — Queen MD ka data layer ab Postgres par hai
// (MD bot wala proven tareeqa: koi whitelist nahi, koi alag auth server nahi).
const { Pool } = require('pg');
const config = require('../config');

let pool = null;
let tablesReady = false;

function getPool() {
    if (pool) return pool;
    const url = config.DATABASE_URL;
    if (!url) return null;
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    pool = new Pool({
        connectionString: url,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
    });
    pool.on('error', (e) => console.error('❌ PG pool error:', e.message));
    return pool;
}

// Test ke liye pool inject karne ka rasta (production me istemal nahi hota)
function _setPool(p) { pool = p; tablesReady = false; }

async function query(text, params) {
    const p = getPool();
    if (!p) throw new Error('DATABASE_URL set nahi hai');
    return p.query(text, params);
}

async function ensureTables() {
    if (tablesReady) return true;
    const p = getPool();
    if (!p) return false;
    await p.query(`
        CREATE TABLE IF NOT EXISTS wa_auth_state (
            number TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            updated_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (number, key)
        );
        CREATE TABLE IF NOT EXISTS queenmd_bot_settings (
            number TEXT PRIMARY KEY,
            settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS queenmd_sessions (
            number TEXT PRIMARY KEY,
            credentials JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS queenmd_user_configs (
            number TEXT PRIMARY KEY,
            config JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS queenmd_otps (
            id BIGSERIAL PRIMARY KEY,
            number TEXT NOT NULL,
            otp TEXT NOT NULL,
            config JSONB,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_queenmd_otps_number ON queenmd_otps (number);
        CREATE TABLE IF NOT EXISTS queenmd_active_numbers (
            number TEXT PRIMARY KEY,
            last_connected TIMESTAMPTZ DEFAULT now(),
            is_active BOOLEAN DEFAULT true
        );
        CREATE TABLE IF NOT EXISTS queenmd_antidelete (
            chat_id TEXT PRIMARY KEY,
            status BOOLEAN DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS queenmd_schedules (
            job_id TEXT PRIMARY KEY,
            recipient TEXT NOT NULL,
            message TEXT NOT NULL,
            run_at TIMESTAMPTZ NOT NULL,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            last_error TEXT DEFAULT '',
            claimed_at TIMESTAMPTZ,
            claimed_by TEXT,
            created_by TEXT DEFAULT '',
            chat_jid TEXT DEFAULT '',
            kind TEXT DEFAULT 'schedule',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_queenmd_schedules_due ON queenmd_schedules (status, run_at);
        CREATE TABLE IF NOT EXISTS queenmd_stats (
            number TEXT NOT NULL,
            date TEXT NOT NULL,
            commands_used INTEGER DEFAULT 0,
            messages_received INTEGER DEFAULT 0,
            messages_sent INTEGER DEFAULT 0,
            groups_interacted INTEGER DEFAULT 0,
            PRIMARY KEY (number, date)
        );
    `);
    tablesReady = true;
    return true;
}

module.exports = { getPool, query, ensureTables, _setPool };
