import { asyncHandler } from '../middleware/error.middleware.js';
import { budgetService } from '../services/budget.service.js';

export const budgetController = {
  list: asyncHandler(async (req, res) => {
    res.json(await budgetService.listWithProgress({ id: req.auth.sub }, req.query.month));
  }),

  summary: asyncHandler(async (req, res) => {
    res.json(await budgetService.summary({ id: req.auth.sub }, req.query.month));
  }),

  upsert: asyncHandler(async (req, res) => {
    const budget = await budgetService.upsert({ id: req.auth.sub }, req.body);
    res.json(budget);
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await budgetService.remove({ id: req.auth.sub }, req.params.id));
  })
};