import { asyncHandler } from '../middleware/error.middleware.js';
import { reportService } from '../services/report.service.js';

export const reportController = {
  summary: asyncHandler(async (req, res) => {
    res.json(await reportService.summary({ id: req.auth.sub, role: req.auth.role, firstName: req.auth.name }, req.query));
  }),

  byCategory: asyncHandler(async (req, res) => {
    res.json(await reportService.byCategory({ id: req.auth.sub }, req.query));
  }),

  byAccount: asyncHandler(async (req, res) => {
    res.json(await reportService.byAccount({ id: req.auth.sub }, req.query));
  }),

  monthly: asyncHandler(async (req, res) => {
    res.json(await reportService.monthly({ id: req.auth.sub }, req.query));
  }),

  full: asyncHandler(async (req, res) => {
    res.json(await reportService.fullReport({ id: req.auth.sub, firstName: req.auth.name }, req.query));
  })
};