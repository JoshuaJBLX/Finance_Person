import validator from 'validator';
import { getDb } from '../config/database.js';
import { userRepository } from '../repositories/user.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { accountRepository } from '../repositories/account.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { AppError } from '../utils/errors.js';

export const adminService = {
  async listUsers({ search = '', limit = 100, offset = 0 }) {
    return userRepository.findAll({ search, limit: Math.min(Number(limit) || 100, 500), offset });
  },

  async overview() {
    return this.globalStats();
  },

  /** Estadísticas globales reales (sin filtro de tenant). */
  async globalStats() {
    const db = getDb();
    const [incomeRows, expenseRows, accounts, categories, budgets, users, transactions, byType] = await Promise.all([
      db.collection('transactions').aggregate([
        { $match: { type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray(),
      db.collection('transactions').aggregate([
        { $match: { type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray(),
      db.collection('accounts').countDocuments(),
      db.collection('categories').countDocuments(),
      db.collection('budgets').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('transactions').countDocuments(),
      db.collection('transactions').aggregate([
        {
          $group: {
            _id: '$type',
            c: { $sum: 1 },
            total: { $sum: '$amount' }
          }
        }
      ]).toArray()
    ]);

    const income = incomeRows[0]?.total || 0;
    const expenses = expenseRows[0]?.total || 0;
    return {
      income,
      expenses,
      balance: income - expenses,
      accounts,
      categories,
      budgets,
      users,
      transactions,
      byType: byType.map((r) => ({ type: r._id, c: r.c, total: r.total }))
    };
  },

  async userTransactions(userId, { from, to }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, 'Usuario no encontrado.');
    const result = await transactionRepository.adminList({ userId, from, to, limit: 10000 });
    const summary = {
      income: await transactionRepository.sumByType(userId, 'income', from, to),
      expenses: await transactionRepository.sumByType(userId, 'expense', from, to)
    };
    return { user, summary, transactions: result.rows };
  },

  /** Categorías del sistema (globales, visibles para todos los usuarios). */
  async listSystemCategories() {
    const all = await categoryRepository.findAll();
    return all.filter((c) => Boolean(c.isSystem));
  },

  async createSystemCategory({ name, type, color }) {
    const cleanName = validator.trim(String(name || ''));
    if (!cleanName) throw new AppError(400, 'El nombre es obligatorio.');
    if (!['income', 'expense'].includes(type)) throw new AppError(400, 'Tipo inválido.');
    const all = await categoryRepository.findAll();
    const dup = all.find(
      (c) => Boolean(c.isSystem) && c.type === type && c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (dup) throw new AppError(409, 'Ya existe una categoría del sistema con ese nombre.');
    return categoryRepository.create({ userId: null, name: cleanName, type, color: color || '#C7F13A', isSystem: 1 });
  },

  async updateSystemCategory(id, { name, color }) {
    const cat = await categoryRepository.findById(id);
    if (!cat || !cat.isSystem) throw new AppError(404, 'Categoría del sistema no encontrada.');
    return categoryRepository.update(id, {
      name: name !== undefined ? validator.trim(String(name)) : undefined,
      color: color !== undefined ? color : undefined
    });
  },

  async removeSystemCategory(id) {
    const cat = await categoryRepository.findById(id);
    if (!cat || !cat.isSystem) throw new AppError(404, 'Categoría del sistema no encontrada.');
    await categoryRepository.remove(id);
    return { message: 'Categoría del sistema eliminada.' };
  },

  async removeUser(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError(404, 'Usuario no encontrado.');
    if (user.role === 'admin') throw new AppError(400, 'No se puede eliminar a un administrador.');
    await userRepository.deleteUser(id);
    return { message: 'Usuario eliminado.' };
  },

  async accountStats(userId) {
    const accounts = await accountRepository.listByUser(userId);
    return Promise.all(
      accounts.map(async (a) => {
        const list = await transactionRepository.list({ userId, accountId: a.id, limit: 100000 });
        const inc = list.rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const out = list.rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return { ...a, balance: a.initialBalance + inc - out };
      })
    );
  }
};
