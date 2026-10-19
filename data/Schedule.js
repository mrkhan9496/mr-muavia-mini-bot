/**
 * Schedule.js — MongoDB model for scheduled messages & reminders
 * MR Muavia Mini Bot
 *
 * Features:
 * - Atomic job claiming via findOneAndUpdate (prevents race conditions)
 * - Stale job recovery (jobs stuck in 'sending' > 5 min get re-queued)
 * - Asia/Karachi timezone support
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

const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true },
    recipient: { type: String, required: true },  // phone number or chat JID
    message: { type: String, required: true },
    runAt: { type: Date, required: true },
    status: {
        type: String,
        enum: ['pending', 'sending', 'sent', 'failed', 'dead', 'cancelled'],
        default: 'pending'
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    // Atomic claiming fields
    claimedAt: { type: Date, default: null },
    claimedBy: { type: String, default: null },  // worker/session ID
    // Metadata
    createdBy: { type: String, default: '' },  // who scheduled it
    chatJid: { type: String, default: '' },     // where .remind was used
    kind: { type: String, enum: ['schedule', 'remind', 'todo'], default: 'schedule' },
}, { timestamps: true });

// Index for efficient due-job queries
scheduleSchema.index({ status: 1, runAt: 1 });
scheduleSchema.index({ claimedAt: 1 });

const Schedule = mongoose.model('Schedule', scheduleSchema);

// Stale timeout: jobs stuck in 'sending' longer than this get re-queued
const STALE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

/**
 * Atomically claim a due job. Only one worker can claim a job.
 * Uses findOneAndUpdate with status filter — atomic in MongoDB.
 *
 * @param {string} workerId - Unique ID for this scheduler instance
 * @returns {Object|null} The claimed job, or null if none available
 */
async function claimDueJob(workerId) {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_MS);

    // Try to claim a pending job OR a stale 'sending' job
    const job = await Schedule.findOneAndUpdate(
        {
            $or: [
                { status: 'pending', runAt: { $lte: now } },
                {
                    status: 'sending',
                    claimedAt: { $lt: staleCutoff }  // stale recovery
                }
            ]
        },
        {
            $set: {
                status: 'sending',
                claimedAt: now,
                claimedBy: workerId,
            },
            $inc: { attempts: 1 }
        },
        { new: true, sort: { runAt: 1 } }  // oldest first
    );
    return job;
}

/**
 * Mark job as successfully sent.
 */
async function markSent(jobId) {
    await Schedule.findOneAndUpdate(
        { jobId },
        { $set: { status: 'sent', claimedAt: null, claimedBy: null } }
    );
}

/**
 * Mark job as failed. After MAX_ATTEMPTS, mark as dead.
 */
async function markFailed(jobId, error) {
    const job = await Schedule.findOne({ jobId });
    if (!job) return;

    const newStatus = job.attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
    // Failed jobs go back to pending for retry (if not dead)
    const retryStatus = newStatus === 'dead' ? 'dead' : 'pending';

    await Schedule.findOneAndUpdate(
        { jobId },
        {
            $set: {
                status: retryStatus,
                lastError: String(error).slice(0, 500),
                claimedAt: null,
                claimedBy: null,
            }
        }
    );
}

/**
 * Cancel a specific job.
 */
async function cancelJob(jobId) {
    const result = await Schedule.findOneAndUpdate(
        { jobId, status: { $in: ['pending', 'failed'] } },
        { $set: { status: 'cancelled' } },
        { new: true }
    );
    return !!result;
}

/**
 * Cancel all pending jobs.
 */
async function cancelAllJobs() {
    const result = await Schedule.updateMany(
        { status: { $in: ['pending', 'failed'] } },
        { $set: { status: 'cancelled' } }
    );
    return result.modifiedCount;
}

/**
 * List pending/failed jobs.
 */
async function listJobs(limit = 15) {
    return await Schedule.find(
        { status: { $in: ['pending', 'failed', 'sending'] } }
    ).sort({ runAt: 1 }).limit(limit);
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
