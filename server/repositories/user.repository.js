import { getDb } from '../config/database.js';
import { genId, now } from '../utils/helpers.js';

const users = () => getDb().collection('users');
const resets = () => getDb().collection('password_resets');

const toPublic = (doc) =>
  doc
    ? {
        id: doc._id,
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email,
        role: doc.role,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }
    : null;

const toFull = (doc) => (doc ? { ...toPublic(doc), passwordHash: doc.passwordHash } : null);

const pickUpdated = (res) => (res && res.value ? res.value : res);

export const userRepository = {
  async findByEmail(email) {
    return toPublic(await users().findOne({ email }));
  },

  async findWithPasswordByEmail(email) {
    return toFull(await users().findOne({ email }));
  },

  async findById(id) {
    return toPublic(await users().findOne({ _id: id }));
  },

  async create({ firstName, lastName, email, passwordHash, role = 'user' }) {
    const doc = {
      _id: genId(),
      firstName,
      lastName,
      email,
      passwordHash,
      role,
      createdAt: now(),
      updatedAt: now()
    };
    await users().insertOne(doc);
    return toPublic(doc);
  },

  async update(id, fields) {
    const set = {};
    for (const [key, value] of Object.entries(fields)) {
      if (['firstName', 'lastName', 'passwordHash', 'role'].includes(key) && value !== undefined) {
        set[key] = value;
      }
    }
    set.updatedAt = now();
    const result = await users().findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
    return toPublic(pickUpdated(result));
  },

  async findAll({ search = '', limit = 100, offset = 0 } = {}) {
    const filter = search
      ? {
          $or: ['email', 'firstName', 'lastName'].map((field) => ({
            [field]: { $regex: String(search), $options: 'i' }
          }))
        }
      : {};
    const [docs, total] = await Promise.all([
      users().find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
      users().countDocuments(filter)
    ]);
    return { rows: docs.map(toPublic), total };
  },

  async count() {
    return users().countDocuments();
  },

  async saveResetToken({ token, userId, expiresAt }) {
    await resets().insertOne({ token, userId, expiresAt, used: false });
  },

  async findValidResetToken(token) {
    const doc = await resets().findOne({ token, used: false, expiresAt: { $gt: now() } });
    return doc || null;
  },

  async markResetTokenUsed(token) {
    await resets().updateOne({ token }, { $set: { used: true } });
  },

  async deleteUser(id) {
    const db = getDb();
    await Promise.all([
      db.collection('categories').deleteMany({ userId: id }),
      db.collection('accounts').deleteMany({ userId: id }),
      db.collection('transactions').deleteMany({ userId: id }),
      db.collection('budgets').deleteMany({ userId: id }),
      resets().deleteMany({ userId: id })
    ]);
    await users().deleteOne({ _id: id });
  }
};
