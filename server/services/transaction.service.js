import validator from 'validator';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { accountRepository } from '../repositories/account.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { AppError } from '../utils/errors.js';

const TYPES = ['income', 'expense'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new AppError(400, 'El monto debe ser un número mayor que 0.');
  return Math.round(n * 100) / 100;
};

const parseDate = (v) => {
  const d = String(v || '');
  if (!DATE_RE.test(d) || !validator.isISO8601(d)) throw new AppError(400, 'Fecha inválida. Use formato AAAA-MM-DD.');
  return d;
};

const assertOwnAccount = async (userId, accountId) => {
  const acc = await accountRepository.findById(accountId);
  if (!acc || acc.userId !== userId) throw new AppError(400, 'Cuenta inválida.');
  return acc;
};

const assertOwnCategory = async (userId, categoryId) => {
  if (!categoryId) return null;
  const cat = await categoryRepository.findById(categoryId);
  const visible = cat && (cat.userId === userId || cat.isSystem);
  if (!visible) throw new AppError(400, 'Categoría inválida.');
  return cat;
};

export const transactionService = {
  async list(user, filters) {
    return transactionRepository.list({ userId: user.id, ...filters });
  },

  async create(user, { accountId, categoryId, type, amount, description = '', date }) {
    const cleanType = String(type || '').toLowerCase();
    if (!TYPES.includes(cleanType)) throw new AppError(400, 'Tipo inválido (income | expense).');
    await assertOwnAccount(user.id, accountId);
    const cat = await assertOwnCategory(user.id, categoryId);
    const cleanDesc = validator.trim(String(description || '')).slice(0, 300);
    const parsedDate = parseDate(date);
    const parsedAmount = parseAmount(amount);

    return transactionRepository.create({
      userId: user.id,
      accountId,
      categoryId: cat ? cat.id : null,
      type: cleanType,
      amount: parsedAmount,
      description: cleanDesc,
      date: parsedDate
    });
  },

  async update(user, id, fields) {
    const tx = await transactionRepository.findById(id);
    if (!tx || tx.userId !== user.id) throw new AppError(404, 'Movimiento no encontrado.');

    const updates = {};
    if (fields.accountId !== undefined) {
      await assertOwnAccount(user.id, fields.accountId);
      updates.accountId = fields.accountId;
    }
    if (fields.categoryId !== undefined) {
      const cat = await assertOwnCategory(user.id, fields.categoryId);
      updates.categoryId = cat ? cat.id : null;
    }
    if (fields.type !== undefined) {
      const cleanType = String(fields.type).toLowerCase();
      if (!TYPES.includes(cleanType)) throw new AppError(400, 'Tipo inválido (income | expense).');
      updates.type = cleanType;
    }
    if (fields.amount !== undefined) updates.amount = parseAmount(fields.amount);
    if (fields.description !== undefined) {
      updates.description = validator.trim(String(fields.description || '')).slice(0, 300);
    }
    if (fields.date !== undefined) updates.date = parseDate(fields.date);

    return transactionRepository.update(id, updates);
  },

  async remove(user, id) {
    const tx = await transactionRepository.findById(id);
    if (!tx || tx.userId !== user.id) throw new AppError(404, 'Movimiento no encontrado.');
    await transactionRepository.remove(id);
    return { message: 'Movimiento eliminado.' };
  }
};
