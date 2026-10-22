// PostgreSQL based Baileys auth state (file ka naam purana hi rakha hai taake
// index.js ke imports na badalne paren — andar ka engine ab Postgres/Neon hai).
// creds + signal keys dono Postgres me save hoti hain, is liye Heroku restart
// ya redeploy ke baad bhi session khud restore ho jati hai.
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const pg = require('./pg');

const clean = (n) => String(n).replace(/[^0-9]/g, '');

async function useMongoAuthState(number) {
    const num = clean(number);

    const serialize = (v) => JSON.stringify(v, BufferJSON.replacer);
    const parse = (s) => JSON.parse(s, BufferJSON.reviver);

    const readData = async (key) => {
        const r = await pg.query('SELECT value FROM wa_auth_state WHERE number = $1 AND key = $2', [num, key]);
        return r.rows.length && r.rows[0].value ? parse(r.rows[0].value) : null;
    };

    const creds = (await readData('creds')) || initAuthCreds();

    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data = {};
                if (!ids.length) return data;
                const keys = ids.map((id) => `${type}-${id}`);
                const r = await pg.query('SELECT key, value FROM wa_auth_state WHERE number = $1 AND key = ANY($2)', [num, keys]);
                const map = new Map(r.rows.map((row) => [row.key, row.value]));
                for (const id of ids) {
                    const raw = map.get(`${type}-${id}`);
                    if (!raw) { data[id] = null; continue; }
                    let value = parse(raw);
                    if (type === 'app-state-sync-key' && value) {
                        value = proto.Message.AppStateSyncKeyData.fromObject(value);
                    }
                    data[id] = value;
                }
                return data;
            },
            set: async (data) => {
                const client = await pg.getPool().connect();
                try {
                    await client.query('BEGIN');
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            const key = `${type}-${id}`;
                            if (value) {
                                await client.query(
                                    `INSERT INTO wa_auth_state (number, key, value, updated_at)
                                     VALUES ($1, $2, $3, now())
                                     ON CONFLICT (number, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
                                    [num, key, serialize(value)]
                                );
                            } else {
                                await client.query('DELETE FROM wa_auth_state WHERE number = $1 AND key = $2', [num, key]);
                            }
                        }
                    }
                    await client.query('COMMIT');
                } catch (e) {
                    await client.query('ROLLBACK').catch(() => {});
                    throw e;
                } finally {
                    client.release();
                }
            },
        },
    };

    const saveCreds = async () => {
        await pg.query(
            `INSERT INTO wa_auth_state (number, key, value, updated_at)
             VALUES ($1, 'creds', $2, now())
             ON CONFLICT (number, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [num, serialize(creds)]
        );
    };

    return { state, saveCreds };
}

async function hasMongoAuth(number) {
    const r = await pg.query('SELECT 1 FROM wa_auth_state WHERE number = $1 AND key = $2', [clean(number), 'creds']);
    return r.rows.length > 0;
}

async function clearMongoAuth(number) {
    await pg.query('DELETE FROM wa_auth_state WHERE number = $1', [clean(number)]);
}

module.exports = { useMongoAuthState, hasMongoAuth, clearMongoAuth };
