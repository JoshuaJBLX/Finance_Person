import { getDb } from '../config/database.js';
import { genId, now } from '../utils/helpers.js';

const col = () => getDb().collection('categories');
const NOCASE = { locale: 'en', strength: 2 };

const map = (doc) =>
  doc
    ? {
        id: doc._id,
        userId: doc.userId ?? null,
        name: doc.name,
        type: doc.type,
        color: doc.color,
        isSystem: Boolean(doc.isSystem),
        createdAt: doc.createdAt
      }
    : null;

const pickUpdated = (res) => (res && res.value ? res.value : res);

export const categoryRepository = {
  /** Tenant-scoped: categorías del usuario + categorías globales del sistema. */
  async listVisible(userId, type = null) {
    const filter = { $or: [{ userId }, { isSystem: true }] };
    if (type) filter.type = type;
    const docs = await col().find(filter).collation(NOCASE).sort({ name: 1 }).toArray();
    return docs.map(map);
  },

  async listUserCategories(userId) {
    const docs = await col().find({ userId }).collation(NOCASE).sort({ name: 1 }).toArray();
    return docs.map(map);
  },

  async findAll() {
    const docs = await col().find({}).collation(NOCASE).sort({ isSystem: -1, name: 1 }).toArray();
    return docs.map(map);
  },

  async findById(id) {
    return map(await col().findOne({ _id: id }));
  },

  async create({ userId = null, name, type, color = '#C7F13A', isSystem = 0 }) {
    const doc = {
      _id: genId(),
      userId: userId ?? null,
      name,
      type,
      color,
      isSystem: Boolean(isSystem),
      createdAt: now()
    };
    await col().insertOne(doc);
    return map(doc);
  },

  async update(id, fields) {
    const set = {};
    for (const key of ['name', 'color']) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    if (!Object.keys(set).length) return this.findById(id);
    const result = await col().findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
    return map(pickUpdated(result));
  },

  async remove(id) {
    const db = getDb();
    // Equivalente a los FK ON DELETE SET NULL / CASCADE del esquema SQLite.
    await Promise.all([
      db.collection('transactions').updateMany({ categoryId: id }, { $set: { categoryId: null } }),
      db.collection('budgets').deleteMany({ categoryId: id })
    ]);
    await col().deleteOne({ _id: id });
  },

  async countByUser(userId) {
    return col().countDocuments({ userId });
  }
};
