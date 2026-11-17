import { getDb } from '../config/database.js';
import { genId, now } from '../utils/helpers.js';

const col = () => getDb().collection('transactions');

/** Equivalente al JOIN con accounts/categories del repositorio SQLite anterior. */
const WITH_REFS = [
  { $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: '_account' } },
  { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: '_category' } },
  { $unwind: { path: '$_account', preserveNullAndEmptyArrays: true } },
  { $unwind: { path: '$_category', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      accountName: '$_account.name',
      accountType: '$_account.type',
      categoryName: '$_category.name',
      categoryColor: '$_category.color',
      categoryType: '$_category.type'
    }
  },
  { $project: { _account: 0, _category: 0 } }
];

const map = (doc) =>
  doc
    ? {
        id: doc._id,
        userId: doc.userId,
        accountId: doc.accountId,
        categoryId: doc.categoryId ?? null,
        type: doc.type,
        amount: doc.amount,
        description: doc.description,
        date: doc.date,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        accountName: doc.accountName ?? null,
        accountType: doc.accountType ?? null,
        categoryName: doc.categoryName ?? null,
        categoryColor: doc.categoryColor ?? null,
        categoryType: doc.categoryType ?? null
      }
    : null;

const pickUpdated = (res) => (res && res.value ? res.value : res);

const rangeFilter = (filter, from, to) => {
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return filter;
};

export const transactionRepository = {
  async list({ userId, accountId, categoryId, type, from, to, search, limit = 500, offset = 0 }) {
    const filter = { userId };
    if (accountId) filter.accountId = accountId;
    if (categoryId) filter.categoryId = categoryId;
    if (type) filter.type = type;
    rangeFilter(filter, from, to);

    if (search) {
      const re = { $regex: String(search), $options: 'i' };
      const matching = await getDb()
        .collection('categories')
        .find({ name: re })
        .project({ _id: 1 })
        .toArray();
      filter.$or = [{ description: re }, { categoryId: { $in: matching.map((c) => c._id) } }];
    }

    const [docs, total] = await Promise.all([
      col()
        .aggregate([
          { $match: filter },
          ...WITH_REFS,
          { $sort: { date: -1, createdAt: -1 } },
          { $skip: offset },
          { $limit: limit }
        ])
        .toArray(),
      col().countDocuments(filter)
    ]);
    return { rows: docs.map(map), total };
  },

  async listByUserAll(userId) {
    const docs = await col()
      .aggregate([{ $match: { userId } }, ...WITH_REFS, { $sort: { date: -1, createdAt: -1 } }])
      .toArray();
    return docs.map(map);
  },

  async adminList({ from, to, userId, limit = 1000, offset = 0 }) {
    const filter = {};
    if (userId) filter.userId = userId;
    rangeFilter(filter, from, to);
    const [docs, total] = await Promise.all([
      col()
        .aggregate([
          { $match: filter },
          ...WITH_REFS,
          { $sort: { date: -1, createdAt: -1 } },
          { $skip: offset },
          { $limit: limit }
        ])
        .toArray(),
      col().countDocuments(filter)
    ]);
    return { rows: docs.map(map), total };
  },

  async findById(id) {
    const docs = await col().aggregate([{ $match: { _id: id } }, ...WITH_REFS]).toArray();
    return map(docs[0]);
  },

  async create({ userId, accountId, categoryId, type, amount, description = '', date }) {
    const doc = {
      _id: genId(),
      userId,
      accountId,
      categoryId: categoryId || null,
      type,
      amount,
      description,
      date,
      createdAt: now(),
      updatedAt: now()
    };
    await col().insertOne(doc);
    return this.findById(doc._id);
  },

  async update(id, fields) {
    const set = {};
    for (const key of ['accountId', 'categoryId', 'type', 'amount', 'description', 'date']) {
      if (fields[key] !== undefined) set[key] = fields[key];
    }
    set.updatedAt = now();
    const result = await col().findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
    return this.findById((pickUpdated(result) || {})._id || id);
  },

  async remove(id) {
    await col().deleteOne({ _id: id });
  },

  /** Suma de un tipo dentro de un rango para un usuario. */
  async sumByType(userId, type, from, to) {
    const filter = { userId, type };
    rangeFilter(filter, from, to);
    const rows = await col()
      .aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
      .toArray();
    return rows[0]?.total || 0;
  },

  /** Totales por categoría, respetando tenant y tipo. */
  async sumByCategory(userId, type, from, to) {
    const filter = { userId, type };
    rangeFilter(filter, from, to);
    return col()
      .aggregate([
        { $match: filter },
        { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        {
          $group: {
            _id: '$cat._id',
            name: { $first: '$cat.name' },
            color: { $first: '$cat.color' },
            total: { $sum: '$amount' }
          }
        },
        { $project: { _id: 0, name: 1, color: 1, total: 1 } },
        { $sort: { total: -1 } }
      ])
      .toArray();
  },

  /** Totales por cuenta (ingresos / gastos). */
  async sumByAccount(userId, from, to) {
    const filter = { userId };
    rangeFilter(filter, from, to);
    return col()
      .aggregate([
        { $match: filter },
        { $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: 'acc' } },
        { $unwind: '$acc' },
        {
          $group: {
            _id: '$acc._id',
            accountName: { $first: '$acc.name' },
            accountType: { $first: '$acc.type' },
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } }
          }
        },
        { $project: { _id: 0, accountName: 1, accountType: 1, income: 1, expenses: 1 } },
        { $sort: { accountName: 1 } }
      ])
      .toArray();
  },

  /** Totales mensuales (cubos YYYY-MM). */
  async monthlyTotals(userId, from, to) {
    const filter = { userId };
    rangeFilter(filter, from, to);
    return col()
      .aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $substrBytes: ['$date', 0, 7] },
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } }
          }
        },
        { $project: { _id: 0, month: '$_id', income: 1, expenses: 1 } },
        { $sort: { month: 1 } }
      ])
      .toArray();
  },

  async adminCount() {
    return col().countDocuments();
  }
};
