// Anti-delete per-chat on/off — PostgreSQL (queenmd_antidelete table)
const pg = require('../lib/pg');

const getAntideleteStatus = async (chatId) => {
    try {
        const r = await pg.query('SELECT status FROM queenmd_antidelete WHERE chat_id = $1', [chatId]);
        return r.rows.length ? !!r.rows[0].status : false;
    } catch (e) { return false; }
};

const setAntideleteStatus = async (chatId, status) => {
    try {
        await pg.query(
            `INSERT INTO queenmd_antidelete (chat_id, status) VALUES ($1, $2)
             ON CONFLICT (chat_id) DO UPDATE SET status = EXCLUDED.status`,
            [chatId, !!status]
        );
        return true;
    } catch (e) { return false; }
};

module.exports = { Antidelete: null, getAntideleteStatus, setAntideleteStatus };
