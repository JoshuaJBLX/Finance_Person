import { getDb } from '../config/database.js';
import { genId, now } from '../utils/helpers.js';

const col = () => getDb().collection('accounts');
const NOCASE = { locale: 'en', strength: 2 };

const map = (doc) =>
  doc
    ? {
        id: doc._id,
        userId: doc.userId,
        name: doc.name,
        type: doc.type,
        initialBalance: doc.initialBalance,
        isDefault: Boolean(doc.isDefault),
        createdAt: doc.createdAt
      }
    : null;

const pickUpdated = (res) => (res && res.value ? res.value : res);

export const accountRepository = {
  async listByUser(userId) {
    const docs = await col()
      .find({ userId })
      .collation(NOCASE)
      .sort({ isDefault: -1, name: 1 })
      .toArray();
    return docs.map(map);
  },

  async findById(id) {
    return map(await col().findOne({ _id: id }));
  },

  async create({ userId, name, type = 'bank', initialBalance = 0 }) {
    const doc = {
      _id: genId(),
      userId,
      name,
      type,
      initialBalance,
      isDefault: false,
      createdAt: now()
    };
    await col().insertOne(doc);
    return map(doc);
  },

  async update(id, fields, userId) {
    const set = {};
    for (const key of ['name', 'type', 'initialBalance']) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    if (!Object.keys(set).length) return this.findById(id, userId);
    const result = await col().findOneAndUpdate(
      { _id: id, userId },
      { $set: set },
      { returnDocument: 'after' }
    );
    return map(pickUpdated(result));
  },

  async setDefault(userId, accountId) {
    await col().updateMany({ userId }, { $set: { isDefault: false } });
    await col().updateOne({ _id: accountId, userId }, { $set: { isDefault: true } });
  },

  async remove(id) {
    await col().deleteOne({ _id: id });
  }
};
