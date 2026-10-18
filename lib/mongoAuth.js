// MongoDB based Baileys auth state.
// creds + signal keys dono MongoDB me save hoti hain, is liye Heroku restart
// ya redeploy ke baad bhi session ID khud restore ho jati hai (kisi file ki zaroorat nahi).
const mongoose = require('mongoose');
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const COLLECTION = 'wa_auth_state';

function col() {
    return mongoose.connection.collection(COLLECTION);
}

const clean = (n) => String(n).replace(/[^0-9]/g, '');

async function ensureIndexes() {
    try {
        await col().createIndex({ number: 1, key: 1 }, { unique: true });
    } catch (_) { /* index already exists */ }
}

async function useMongoAuthState(number) {
    const num = clean(number);
    await ensureIndexes();

    const serialize = (v) => JSON.stringify(v, BufferJSON.replacer);
    const parse = (s) => JSON.parse(s, BufferJSON.reviver);

    const readData = async (key) => {
        const doc = await col().findOne({ number: num, key });
        return doc ? parse(doc.value) : null;
    };

    const creds = (await readData('creds')) || initAuthCreds();

    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data = {};
                if (!ids.length) return data;
                const keys = ids.map((id) => `${type}-${id}`);
                const docs = await col().find({ number: num, key: { $in: keys } }).toArray();
                const map = new Map(docs.map((d) => [d.key, d.value]));
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
                const ops = [];
                for (const type in data) {
                    for (const id in data[type]) {
                        const value = data[type][id];
                        const key = `${type}-${id}`;
                        if (value) {
                            ops.push({
                                updateOne: {
                                    filter: { number: num, key },
                                    update: { $set: { number: num, key, value: serialize(value), updatedAt: new Date() } },
                                    upsert: true,
                                },
                            });
                        } else {
                            ops.push({ deleteOne: { filter: { number: num, key } } });
                        }
                    }
                }
                if (ops.length) await col().bulkWrite(ops, { ordered: false });
            },
        },
    };

    const saveCreds = async () => {
        await col().updateOne(
            { number: num, key: 'creds' },
            { $set: { number: num, key: 'creds', value: serialize(creds), updatedAt: new Date() } },
            { upsert: true }
        );
    };

    return { state, saveCreds };
}

async function hasMongoAuth(number) {
    const doc = await col().findOne({ number: clean(number), key: 'creds' }, { projection: { _id: 1 } });
    return !!doc;
}

async function clearMongoAuth(number) {
    await col().deleteMany({ number: clean(number) });
}

module.exports = { useMongoAuthState, hasMongoAuth, clearMongoAuth };
