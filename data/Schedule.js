/**
 * Schedule.js — PostgreSQL store for scheduled messages & reminders
 * Queen MD (2026-10-23: MongoDB/mongoose se Postgres port — bahar ka API wohi hai)
 *
 * Features:
 * - Atomic job claiming via UPDATE ... FOR UPDATE (ek hi worker claim karta hai)
 * - Stale job recovery (jobs stuck in 'sending' > 5 min get re-queued)
 * - Asia/Karachi timezone support (callers handle karte hain)
 *
 * CRASH RISK DOCUMENTATION:
 * There is an inherent race between WhatsApp send and DB update:
 * 1. Job claimed (status='sending', claimedAt=now, claimedBy=workerId)
 * 2. sock.sendMessage() called → message MAY be delivered
 * 3. DB updated to 'sent' → if crash happens between 2 and 3,
 *    the job will be retried after stale timeout (5 min), causing
 *    a DUPLICATE send. This is unavoidable without WhatsApp-side
 *    idempotency (which Baileys doesn't provide).
 * Mitigation: claimedAt + workerId tracking, 5-min stale timeout,
 * max 3 attempts before marking 'dead'.
 */

const pg = require('../lib/pg');

// Stale timeout: jobs stuck in 'sending' longer than this get re-queued
const STALE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function mapRow(r) {
    if (!r) return null;
    return {
        jobId: r.job_id,
        recipient: r.recipient,
        message: r.message,
        runAt: r.run_at,
        status: r.status,
        attempts: r.attempts,
        lastError: r.last_error,
        claimedAt: r.claimed_at,
        claimedBy: r.claimed_by,
        createdBy: r.created_by,
        chatJid: r.chat_jid,
        kind: r.kind,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

const COLS = 'job_id, recipient, message, run_at, status, attempts, last_error, claimed_at, claimed_by, created_by, chat_jid, kind, created_at, updated_at';

// --- Model-shaped facade (plugins isi ko istemal karte hain: create / find().limit / updateMany) ---

async function createJob(doc) {
    const r = await pg.query(
        `INSERT INTO queenmd_schedules
            (job_id, recipient, message, run_at, status, attempts, last_error, claimed_at, claimed_by, created_by, chat_jid, kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING ${COLS}`,
        [
            doc.jobId,
            doc.recipient,
            doc.message,
            doc.runAt,
            doc.status || 'pending',
            doc.attempts || 0,
            doc.lastError || '',
            doc.claimedAt || null,
            doc.claimedBy || null,
            doc.createdBy || '',
            doc.chatJid || '',
            doc.kind || 'schedule',
        ]
    );
    return mapRow(r.rows[0]);
}

// Sirf woh filter shapes jo codebase me istemal hote hain (barabar wali shartein)
const FILTER_COLS = { kind: 'kind', status: 'status', jobId: 'job_id', recipient: 'recipient' };
function whereFrom(filter, params) {
    const parts = [];
    for (const [k, v] of Object.entries(filter || {})) {
        const col = FILTER_COLS[k];
        if (!col) throw new Error(`Schedule.find: unsupported filter key ${k}`);
        params.push(v);
        parts.push(`${col} = $${params.length}`);
    }
    return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

function findJobs(filter) {
    return {
        limit: async (n) => {
            const params = [];
            const where = whereFrom(filter, params);
            params.push(n || 20);
            const r = await pg.query(
                `SELECT ${COLS} FROM queenmd_schedules ${where} ORDER BY run_at ASC LIMIT $${params.length}`,
                params
            );
            return r.rows.map(mapRow);
        },
    };
}

async function updateManyJobs(filter, update) {
    const set = (update && update.$set) || {};
    const SET_COLS = { status: 'status', lastError: 'last_error' };
    const params = [];
    const sets = [];
    for (const [k, v] of Object.entries(set)) {
        const col = SET_COLS[k];
        if (!col) throw new Error(`Schedule.updateMany: unsupported set key ${k}`);
        params.push(v);
        sets.push(`${col} = $${params.length}`);
    }
    if (!sets.length) return { modifiedCount: 0 };
    const where = whereFrom(filter, params);
    const r = await pg.query(
        `UPDATE queenmd_schedules SET ${sets.join(', ')}, updated_at = now() ${where}`,
        params
    );
    return { modifiedCount: r.rowCount };
}

const Schedule = { create: createJob, find: findJobs, updateMany: updateManyJobs };

// --- Engine functions (lib/miniScheduler.js inhein istemal karta hai) ---

/**
 * Atomically claim a due job. Only one worker can claim a job.
 */
async function claimDueJob(workerId) {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_MS);
    const client = await pg.getPool().connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query(
            `SELECT job_id FROM queenmd_schedules
             WHERE (status = 'pending' AND run_at <= $1)
                OR (status = 'sending' AND claimed_at < $2)
             ORDER BY run_at ASC
             LIMIT 1
             FOR UPDATE`,
            [now, staleCutoff]
        );
        if (!sel.rows.length) {
            await client.query('COMMIT');
            return null;
        }
        const upd = await client.query(
            `UPDATE queenmd_schedules
             SET status = 'sending', claimed_at = $1, claimed_by = $2,
                 attempts = attempts + 1, updated_at = now()
             WHERE job_id = $3
             RETURNING ${COLS}`,
            [now, workerId, sel.rows[0].job_id]
        );
        await client.query('COMMIT');
        return upd.rows.length ? mapRow(upd.rows[0]) : null;
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Mark job as successfully sent.
 */
async function markSent(jobId) {
    await pg.query(
        `UPDATE queenmd_schedules SET status = 'sent', claimed_at = NULL, claimed_by = NULL, updated_at = now() WHERE job_id = $1`,
        [jobId]
    );
}

/**
 * Mark job as failed. After MAX_ATTEMPTS, mark as dead.
 */
async function markFailed(jobId, error) {
    const r = await pg.query('SELECT attempts FROM queenmd_schedules WHERE job_id = $1', [jobId]);
    if (!r.rows.length) return;
    const retryStatus = r.rows[0].attempts >= MAX_ATTEMPTS ? 'dead' : 'pending';
    await pg.query(
        `UPDATE queenmd_schedules
         SET status = $2, last_error = $3, claimed_at = NULL, claimed_by = NULL, updated_at = now()
         WHERE job_id = $1`,
        [jobId, retryStatus, String(error).slice(0, 500)]
    );
}

/**
 * Cancel a specific job.
 */
async function cancelJob(jobId) {
    const r = await pg.query(
        `UPDATE queenmd_schedules SET status = 'cancelled', updated_at = now()
         WHERE job_id = $1 AND status IN ('pending', 'failed')`,
        [jobId]
    );
    return r.rowCount > 0;
}

/**
 * Cancel all pending jobs.
 */
async function cancelAllJobs() {
    const r = await pg.query(
        `UPDATE queenmd_schedules SET status = 'cancelled', updated_at = now()
         WHERE status IN ('pending', 'failed')`
    );
    return r.rowCount;
}

/**
 * List pending/failed jobs.
 */
async function listJobs(limit = 15) {
    const r = await pg.query(
        `SELECT ${COLS} FROM queenmd_schedules
         WHERE status IN ('pending', 'failed', 'sending')
         ORDER BY run_at ASC LIMIT $1`,
        [limit]
    );
    return r.rows.map(mapRow);
}

module.exports = {
    Schedule,
    claimDueJob,
    markSent,
    markFailed,
    cancelJob,
    cancelAllJobs,
    listJobs,
    STALE_MS,
    MAX_ATTEMPTS,
};
