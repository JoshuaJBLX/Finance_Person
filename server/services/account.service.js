import validator from 'validator';
import { accountRepository } from '../repositories/account.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { AppError } from '../utils/errors.js';

const TYPES = ['cash', 'bank', 'savings', 'credit', 'other'];

const sanitizeAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new AppError(400, 'El saldo inicial debe ser un número mayor o igual que 0.');
  return n;
};

export const accountService = {
  async list(userId) {
    const accounts = await accountRepository.listByUser(userId);
    return Promise.all(accounts.map((acc) => this.withBalance(userId, acc)));
  },

  async withBalance(userId, acc) {
    const movements = await transactionRepository.list({ userId, accountId: acc.id, limit: 100000 });
    const totalIn = movements.rows
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalOut = movements.rows
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const sign = acc.type === 'credit' ? -1 : 1;
    return {
      ...acc,
      income: totalIn,
      expenses: totalOut,
      balance: Math.round((sign * (acc.initialBalance + totalIn - totalOut)) * 100) / 100
    };
  },

  async create(userId, { name, type, initialBalance }) {
    const cleanName = validator.trim(String(name || ''));
    if (!cleanName) throw new AppError(400, 'El nombre de la cuenta es obligatorio.');
    if (!TYPES.includes(type)) throw new AppError(400, 'Tipo de cuenta inválido.');
    const balance = sanitizeAmount(initialBalance ?? 0);

    const accounts = await accountRepository.listByUser(userId);
    if (accounts.find((a) => a.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new AppError(409, 'Ya existe una cuenta con ese nombre.');
    }

    return accountRepository.create({ userId, name: cleanName, type, initialBalance: balance });
  },

  async update(userId, id, { name, type, initialBalance }) {
    const acc = await accountRepository.findById(id);
    if (!acc || acc.userId !== userId) throw new AppError(404, 'Cuenta no encontrada.');

    const fields = {};
    if (name !== undefined) {
      const cleanName = validator.trim(String(name));
      if (!cleanName) throw new AppError(400, 'El nombre de la cuenta es obligatorio.');
      const accounts = await accountRepository.listByUser(userId);
      if (accounts.find((a) => a.id !== id && a.name.toLowerCase() === cleanName.toLowerCase())) {
        throw new AppError(409, 'Ya existe una cuenta con ese nombre.');
      }
      fields.name = cleanName;
    }
    if (type !== undefined) {
      if (!TYPES.includes(type)) throw new AppError(400, 'Tipo de cuenta inválido.');
      fields.type = type;
    }
    if (initialBalance !== undefined) fields.initialBalance = sanitizeAmount(initialBalance);

    return accountRepository.update(id, fields, userId);
  },

  async setDefault(userId, id) {
    const acc = await accountRepository.findById(id);
    if (!acc || acc.userId !== userId) throw new AppError(404, 'Cuenta no encontrada.');
    await accountRepository.setDefault(userId, id);
    return { message: 'Cuenta predeterminada actualizada.' };
  },

  async remove(userId, id) {
    const acc = await accountRepository.findById(id);
    if (!acc || acc.userId !== userId) throw new AppError(404, 'Cuenta no encontrada.');
    const used = await transactionRepository.list({ userId, accountId: id, limit: 1 });
    if (used.total > 0) {
      throw new AppError(400, 'No se puede eliminar una cuenta con movimientos asociados.');
    }
    await accountRepository.remove(id);
    return { message: 'Cuenta eliminada.' };
  }
};
