import { asyncHandler } from '../middleware/error.middleware.js';
import { adminService } from '../services/admin.service.js';

export const adminController = {
  stats: asyncHandler(async (req, res) => {
    res.json(await adminService.globalStats());
  }),

  overview: asyncHandler(async (req, res) => {
    res.json(await adminService.overview());
  }),

  listUsers: asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query;
    const result = await adminService.listUsers({
      search,
      limit: Math.min(Number(limit) || 100, 500),
      offset: (Math.max(Number(page) || 1, 1) - 1) * Math.min(Number(limit) || 100, 500)
    });
    res.json({ ...result, page: Number(page) || 1, limit: Math.min(Number(limit) || 100, 500) });
  }),

  userTransactions: asyncHandler(async (req, res) => {
    res.json(await adminService.userTransactions(req.params.id, req.query));
  }),

  removeUser: asyncHandler(async (req, res) => {
    res.json(await adminService.removeUser(req.params.id));
  }),

  systemCategories: asyncHandler(async (req, res) => {
    res.json(await adminService.listSystemCategories());
  }),

  createSystemCategory: asyncHandler(async (req, res) => {
    res.status(201).json(await adminService.createSystemCategory(req.body));
  }),

  updateSystemCategory: asyncHandler(async (req, res) => {
    res.json(await adminService.updateSystemCategory(req.params.id, req.body));
  }),

  removeSystemCategory: asyncHandler(async (req, res) => {
    res.json(await adminService.removeSystemCategory(req.params.id));
  })
};