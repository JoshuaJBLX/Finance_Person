import { budgetRepository } from '../repositories/budget.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { AppError } from '../utils/errors.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const budgetService = {
  async listWithProgress(user, month) {
    if (!month || !MONTH_RE.test(month)) throw new AppError(400, 'Mes inválido. Use formato AAAA-MM.');
    const budgets = await budgetRepository.listByMonth(user.id, month);
    const spent = await transactionRepository.sumByCategory(user.id, 'expense', `${month}-01`, `${month}-31`);
    const spentByCategory = new Map(spent.map((r) => [r.name, r.total]));
    return budgets.map((b) => {
      const used = spentByCategory.get(b.categoryName) || 0;
      return {
        ...b,
        spent: used,
        remaining: Math.round((b.amount - used) * 100) / 100,
        progress: b.amount > 0 ? used / b.amount : 0
      };
    });
  },

  async summary(user, month) {
    const list = await budgetRepository.listByMonth(user.id, month);
    const spent = await transactionRepository.sumByCategory(user.id, 'expense', `${month}-01`, `${month}-31`);
    return {
      month,
      totalBudget: list.reduce((s, b) => s + b.amount, 0),
      totalSpent: spent.reduce((s, r) => s + r.total, 0),
      count: list.length
    };
  },

  async upsert(user, { categoryId, month, amount }) {
    if (!MONTH_RE.test(String(month || ''))) throw new AppError(400, 'Mes inválido. Use formato AAAA-MM.');
    const cat = await categoryRepository.findById(categoryId);
    const visible = cat && (cat.userId === user.id || cat.isSystem);
    if (!visible) throw new AppError(400, 'Categoría inválida.');
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) throw new AppError(400, 'El presupuesto debe ser un número mayor o igual a 0.');

    return budgetRepository.createOrUpdate({
      userId: user.id,
      categoryId,
      month,
      amount: Math.round(n * 100) / 100
    });
  },

  async remove(user, id) {
    const budget = await budgetRepository.findById(id);
    if (!budget || budget.userId !== user.id) throw new AppError(404, 'Presupuesto no encontrado.');
    await budgetRepository.remove(id);
    return { message: 'Presupuesto eliminado.' };
  }
};
