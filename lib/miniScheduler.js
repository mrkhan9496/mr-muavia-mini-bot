/**
 * miniScheduler.js — Scheduler engine for Queen MD
 *
 * - 30-second tick loop
 * - Atomic job claiming (prevents duplicate sends across sessions/workers)
 * - Stale job recovery (5 min timeout)
 * - Asia/Karachi timezone
 * - Single global tick (not per-session) to prevent duplicate sends
 */

const moment = require('moment-timezone');
const { claimDueJob, markSent, markFailed } = require('../data/Schedule');

const TIMEZONE = 'Asia/Karachi';
const TICK_MS = 30 * 1000;

let tickTimer = null;
let workerId = null;
let isRunning = false;

/**
 * Generate unique worker ID for this scheduler instance.
 */
function genWorkerId() {
    return `worker-${Date.now()}-${Math.random().toString(36).slice(0, 6)}`;
}

/**
 * Start the scheduler. Call ONCE globally (not per-session).
 *
 * @param {Function} getSocket - Function that returns active WhatsApp socket
 */
function start(getSocket) {
    if (isRunning) {
        console.log('[scheduler] Already running, skipping duplicate start');
        return;
    }
    isRunning = true;
    workerId = genWorkerId();
    console.log(`[scheduler] Started (worker=${workerId}, tz=${TIMEZONE})`);

    // Initial tick after 5s (catch up on overdue)
    setTimeout(() => tick(getSocket), 5000);
    // Then every 30s
    tickTimer = setInterval(() => tick(getSocket), TICK_MS);
}

/**
 * Stop the scheduler.
 */
function stop() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    isRunning = false;
    console.log('[scheduler] Stopped');
}

/**
 * Single tick: claim and process one due job.
 * Processes one at a time to avoid overwhelming WhatsApp.
 */
async function tick(getSocket) {
    try {
        const job = await claimDueJob(workerId);
        if (!job) return;  // No due jobs

        console.log(`[scheduler] Claimed job ${job.jobId} (${job.kind})`);

        const sock = getSocket();
        if (!sock) {
            console.log('[scheduler] No active socket, releasing job');
            await markFailed(job.jobId, 'No active WhatsApp session');
            return;
        }

        try {
            // Determine recipient JID
            let targetJid = job.recipient;
            if (!targetJid.includes('@')) {
                targetJid = targetJid.replace(/\D/g, '') + '@s.whatsapp.net';
            }

            // Send the message
            await sock.sendMessage(targetJid, { text: job.message });

            // Mark as sent
            await markSent(job.jobId);
            console.log(`[scheduler] ✅ Sent job ${job.jobId}`);

        } catch (sendErr) {
            console.error(`[scheduler] Send failed for ${job.jobId}:`, sendErr.message);
            await markFailed(job.jobId, sendErr.message);
        }

        // Process next job immediately (don't wait 30s if backlog exists)
        setImmediate(() => tick(getSocket));

    } catch (err) {
        console.error('[scheduler] Tick error:', err.message);
    }
}

/**
 * Parse datetime string in Asia/Karachi timezone.
 * Supports: "08:30 PM", "20:30", "2026-10-20 20:30"
 */
function parseDateTime(input) {
    const tz = TIMEZONE;
    input = input.trim();

    // "2026-10-20 20:30" or "2026-10-20"
    let m = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
    if (m) {
        let hh = parseInt(m[4] || '09', 10), mm = parseInt(m[5] || '00', 10);
        const ap = (m[6] || '').toUpperCase();
        if (ap === 'PM' && hh < 12) hh += 12;
        if (ap === 'AM' && hh === 12) hh = 0;
        return moment.tz(`${m[1]}-${m[2]}-${m[3]} ${hh}:${mm}`, 'YYYY-MM-DD HH:mm', tz).toDate();
    }

    // "08:30 PM" or "20:30" → today (or tomorrow if passed)
    m = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
        let hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        const ap = (m[3] || '').toUpperCase();
        if (ap === 'PM' && hh < 12) hh += 12;
        if (ap === 'AM' && hh === 12) hh = 0;

        let dt = moment.tz(tz).set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
        if (dt.isBefore(moment.tz(tz))) dt.add(1, 'day');  // tomorrow if passed
        return dt.toDate();
    }

    // "10m", "2h", "1d" (relative)
    m = input.match(/^(\d+)\s*([smhd])$/i);
    if (m) {
        const num = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
        return new Date(Date.now() + num * mult);
    }

    return null;
}

/**
 * Format date for display in Asia/Karachi.
 */
function fmtKarachi(date) {
    return moment(date).tz(TIMEZONE).format('DD MMM, hh:mm A');
}

module.exports = {
    start,
    stop,
    tick,
    parseDateTime,
    fmtKarachi,
    TIMEZONE,
    isRunning: () => isRunning,
};
