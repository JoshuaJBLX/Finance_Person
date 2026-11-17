import { asyncHandler } from '../middleware/error.middleware.js';
import { transactionService } from '../services/transaction.service.js';

export const transactionController = {
  list: asyncHandler(async (req, res) => {
    const { accountId, categoryId, type, from, to, search, page, limit } = req.query;
    const result = await transactionService.list({ id: req.auth.sub, role: req.auth.role }, {
      accountId,
      categoryId,
      type,
      from,
      to,
      search,
      offset: (Math.max(Number(page) || 1, 1) - 1) * (Math.min(Number(limit) || 100, 500)),
      limit: Math.min(Number(limit) || 100, 500)
    });
    res.json({ ...result, page: Number(page) || 1, limit: Math.min(Number(limit) || 100, 500) });
  }),

  create: asyncHandler(async (req, res) => {
    const tx = await transactionService.create({ id: req.auth.sub, role: req.auth.role }, req.body);
    res.status(201).json(tx);
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await transactionService.update({ id: req.auth.sub, role: req.auth.role }, req.params.id, req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await transactionService.remove({ id: req.auth.sub, role: req.auth.role }, req.params.id));
  })
};