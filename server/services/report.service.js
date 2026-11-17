import { transactionRepository } from '../repositories/transaction.repository.js';
import { budgetService } from './budget.service.js';
import { AppError } from '../utils/errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseBoundary = (v, label) => {
  if (!v) return null;
  if (!DATE_RE.test(v)) throw new AppError(400, `${label} inválida. Use formato AAAA-MM-DD.`);
  return v;
};

export const reportService = {
  async summary(user, { from, to }) {
    const f = parseBoundary(from, 'Fecha inicial');
    const t = parseBoundary(to, 'Fecha final');
    const [income, expenses, list] = await Promise.all([
      transactionRepository.sumByType(user.id, 'income', f, t),
      transactionRepository.sumByType(user.id, 'expense', f, t),
      transactionRepository.list({ userId: user.id, from: f, to: t })
    ]);
    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    return {
      from: f,
      to: t,
      income,
      expenses,
      balance,
      savingsRate: Math.round(savingsRate * 100) / 100,
      count: list.rows.length
    };
  },

  async byCategory(user, { type, from, to }) {
    if (!['income', 'expense'].includes(type)) throw new AppError(400, 'Tipo inválido.');
    const f = parseBoundary(from, 'Fecha inicial');
    const t = parseBoundary(to, 'Fecha final');
    return {
      type,
      data: await transactionRepository.sumByCategory(user.id, type, f, t)
    };
  },

  async byAccount(user, { from, to }) {
    const f = parseBoundary(from, 'Fecha inicial');
    const t = parseBoundary(to, 'Fecha final');
    return transactionRepository.sumByAccount(user.id, f, t);
  },

  async monthly(user, { from, to }) {
    const f = parseBoundary(from, 'Fecha inicial');
    const t = parseBoundary(to, 'Fecha final');
    if (f && t && f > t) throw new AppError(400, 'La fecha inicial no puede ser posterior a la final.');
    return transactionRepository.monthlyTotals(user.id, f, t);
  },

  /** Bundle completo usado por las exportaciones (PDF/Excel). */
  async fullReport(user, { from, to, month }) {
    const f = parseBoundary(from, 'Fecha inicial');
    const t = parseBoundary(to, 'Fecha final');
    const all = await transactionRepository.listByUserAll(user.id);
    const transactions = all.filter((tx) => {
      if (f && tx.date < f) return false;
      if (t && tx.date > t) return false;
      return true;
    });
    const budgetSummary = month ? await budgetService.summary(user, month) : null;
    const [summary, byCategoryIncome, byCategoryExpense, monthly, accounts] = await Promise.all([
      this.summary(user, { from: f, to: t }),
      transactionRepository.sumByCategory(user.id, 'income', f, t),
      transactionRepository.sumByCategory(user.id, 'expense', f, t),
      transactionRepository.monthlyTotals(user.id, f, t),
      transactionRepository.sumByAccount(user.id, f, t)
    ]);
    return {
      generatedAt: new Date().toISOString(),
      user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email },
      range: { from: f, to: t, month },
      summary,
      byCategoryIncome,
      byCategoryExpense,
      monthly,
      accounts,
      transactions,
      budgetSpent: budgetSummary ? budgetSummary.totalSpent : null
    };
  }
};
