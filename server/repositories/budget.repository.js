import { getDb } from '../config/database.js';
import { genId, now } from '../utils/helpers.js';

const col = () => getDb().collection('budgets');
const NOCASE = { locale: 'en', strength: 2 };

const map = (doc) =>
  doc
    ? {
        id: doc._id,
        userId: doc.userId,
        categoryId: doc.categoryId,
        month: doc.month,
        amount: doc.amount,
        createdAt: doc.createdAt,
        ...(doc.categoryName !== undefined ? { categoryName: doc.categoryName } : {}),
        ...(doc.categoryColor !== undefined ? { categoryColor: doc.categoryColor } : {})
      }
    : null;

export const budgetRepository = {
  async listByMonth(userId, month) {
    const docs = await col()
      .aggregate(
        [
          { $match: { userId, month } },
          { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
          { $unwind: '$cat' },
          {
            $addFields: {
              categoryName: '$cat.name',
              categoryColor: '$cat.color'
            }
          },
          { $project: { cat: 0 } },
          { $sort: { categoryName: 1 } }
        ],
        { collation: NOCASE }
      )
      .toArray();
    return docs.map(map);
  },

  async findById(id) {
    return map(await col().findOne({ _id: id }));
  },

  async findByUserAndCategory(userId, categoryId, month) {
    return map(await col().findOne({ userId, categoryId, month }));
  },

  async createOrUpdate({ userId, categoryId, month, amount }) {
    const doc = await col().findOneAndUpdate(
      { userId, categoryId, month },
      {
        $set: { amount },
        $setOnInsert: { _id: genId(), createdAt: now() }
      },
      { upsert: true, returnDocument: 'after' }
    );
    return map(doc && doc.value ? doc.value : doc);
  },

  async remove(id) {
    await col().deleteOne({ _id: id });
  }
};
