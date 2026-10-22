/**
 * muavia-schedule.js — Scheduler commands for QnMD
 * .schedule, .schedules, .cancel, .cancelall, .remind, .todo
 *
 * Owner-only. Uses MongoDB for persistence.
 */

const { cmd } = require('../inconnuboy');
const { Schedule } = require('../data/Schedule');
const { parseDateTime, fmtKarachi } = require('../lib/miniScheduler');

const FOOTER = '\n\n> *© Powered by Queen MD*';

function genJobId() {
    return `job-${Date.now()}-${Math.random().toString(36).slice(0, 6)}`;
}

// .schedule <number> | <time> | <message>
cmd({
    pattern: "schedule",
    desc: "Schedule a message",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const parts = (q || '').split('|').map(p => p.trim());
    if (parts.length < 3) {
        return await reply(
            '❌ Usage:\n.schedule <number> | <time> | <message>\n\n' +
            'Time formats:\n• 08:30 PM\n• 20:30\n• 2026-10-20 20:30' + FOOTER
        );
    }

    const [number, timeStr, ...msgParts] = parts;
    const message = msgParts.join(' | ').trim();

    // Validate
    if (!number.replace(/\D/g, '').match(/^\d{10,15}$/)) {
        return await reply('❌ Invalid number. Use format: 923001234567' + FOOTER);
    }
    if (!message) {
        return await reply('❌ Message cannot be empty.' + FOOTER);
    }

    const runAt = parseDateTime(timeStr);
    if (!runAt) {
        return await reply('❌ Invalid time format.' + FOOTER);
    }
    if (runAt.getTime() <= Date.now()) {
        return await reply('❌ Time must be in the future.' + FOOTER);
    }

    const jobId = genJobId();
    await Schedule.create({
        jobId,
        recipient: number.replace(/\D/g, ''),
        message,
        runAt,
        kind: 'schedule',
        createdBy: from,
    });

    await reply(
        `✅ Scheduled!\n\n` +
        `📋 ID: ${jobId}\n` +
        `📱 To: ${number}\n` +
        `🕐 At: ${fmtKarachi(runAt)} (PKT)` + FOOTER
    );
});

// .schedules — list pending jobs
cmd({
    pattern: "schedules",
    desc: "List scheduled jobs",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const { listJobs } = require('../data/Schedule');
    const jobs = await listJobs(15);

    if (!jobs.length) {
        return await reply('📭 No pending scheduled jobs.' + FOOTER);
    }

    let text = `📋 *Scheduled Jobs (${jobs.length})*\n\n`;
    for (const j of jobs) {
        text += `• ${j.jobId}\n  ${j.kind} → ${j.recipient}\n  🕐 ${fmtKarachi(j.runAt)} | ${j.status}\n\n`;
    }
    await reply(text + FOOTER);
});

// .cancel <jobId>
cmd({
    pattern: "cancel",
    desc: "Cancel a scheduled job",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const jobId = (q || '').trim();
    if (!jobId) return await reply('❌ Usage: .cancel <jobId>' + FOOTER);

    const { cancelJob } = require('../data/Schedule');
    const ok = await cancelJob(jobId);
    await reply(ok ? `✅ Cancelled: ${jobId}` + FOOTER : `❌ Not found or already done: ${jobId}` + FOOTER);
});

// .cancelall
cmd({
    pattern: "cancelall",
    desc: "Cancel all scheduled jobs",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const { cancelAllJobs } = require('../data/Schedule');
    const n = await cancelAllJobs();
    await reply(`✅ Cancelled ${n} job(s).` + FOOTER);
});

// .remind <time> <message> — remind in current chat
cmd({
    pattern: "remind",
    desc: "Set a reminder in this chat",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    const match = (q || '').match(/^(\S+)\s+(.+)$/);
    if (!match) {
        return await reply(
            '❌ Usage: .remind <time> <message>\n\n' +
            'Examples:\n• .remind 10m Drink water\n• .remind 2h Meeting\n• .remind 08:30 PM Call mom' + FOOTER
        );
    }

    const [, timeStr, message] = match;
    const runAt = parseDateTime(timeStr);

    if (!runAt) return await reply('❌ Invalid time.' + FOOTER);
    if (runAt.getTime() <= Date.now()) return await reply('❌ Time must be in future.' + FOOTER);
    if (!message.trim()) return await reply('❌ Message empty.' + FOOTER);

    const jobId = genJobId();
    await Schedule.create({
        jobId,
        recipient: from,  // current chat
        message: `⏰ *Reminder:*\n\n${message.trim()}`,
        runAt,
        kind: 'remind',
        createdBy: from,
        chatJid: from,
    });

    await reply(`✅ Reminder set for ${fmtKarachi(runAt)} (PKT)\n📋 ID: ${jobId}` + FOOTER);
});

// .todo add <text> | .todo list | .todo done <n> | .todo clear
cmd({
    pattern: "todo",
    desc: "Todo list",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    if (!isOwner) return await reply('❌ Owner only.' + FOOTER);

    // Simple in-message todo (not persistent across restarts — use .remind for persistent)
    // For now, store as immediate reminder-style
    const args = (q || '').trim().split(' ');
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'add' && args.length > 1) {
        const text = args.slice(1).join(' ');
        // Store as a far-future reminder (acts as todo)
        const jobId = genJobId();
        await Schedule.create({
            jobId,
            recipient: m.sender || '',
            message: `📝 *Todo:*\n\n${text}`,
            runAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),  // 1 year
            kind: 'todo',
            createdBy: m.sender || '',
        });
        await reply(`✅ Todo added.\n📋 ID: ${jobId}` + FOOTER);
    } else if (sub === 'list') {
        const todos = await Schedule.find({ kind: 'todo', status: 'pending' }).limit(20);
        if (!todos.length) return await reply('📭 No todos.' + FOOTER);
        let text = '📝 *Todo List*\n\n';
        todos.forEach((t, i) => {
            text += `${i + 1}. ${t.message.replace('📝 *Todo:*\n\n', '').slice(0, 50)}\n   ID: ${t.jobId}\n\n`;
        });
        await reply(text + FOOTER);
    } else if (sub === 'done' && args[1]) {
        const { cancelJob } = require('../data/Schedule');
        // Find by jobId or index — simplified: use jobId
        const ok = await cancelJob(args[1]);
        await reply(ok ? '✅ Todo marked done.' + FOOTER : '❌ Not found.' + FOOTER);
    } else if (sub === 'clear') {
        const r = await Schedule.updateMany(
            { kind: 'todo', status: 'pending' },
            { $set: { status: 'cancelled' } }
        );
        await reply(`✅ Cleared ${r.modifiedCount} todo(s).` + FOOTER);
    } else {
        await reply(
            '❌ Usage:\n.todo add <text>\n.todo list\n.todo done <id>\n.todo clear' + FOOTER
        );
    }
});
