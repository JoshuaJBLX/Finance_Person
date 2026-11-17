import { asyncHandler } from '../middleware/error.middleware.js';
import { categoryService } from '../services/category.service.js';

export const categoryController = {
  list: asyncHandler(async (req, res) => {
    res.json(await categoryService.list({ id: req.auth.sub, role: req.auth.role }, req.query));
  }),

  create: asyncHandler(async (req, res) => {
    const cat = await categoryService.create({ id: req.auth.sub, role: req.auth.role }, req.body);
    res.status(201).json(cat);
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await categoryService.update({ id: req.auth.sub, role: req.auth.role }, req.params.id, req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await categoryService.remove({ id: req.auth.sub, role: req.auth.role }, req.params.id));
  })
};