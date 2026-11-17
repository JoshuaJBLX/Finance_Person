import { asyncHandler } from '../middleware/error.middleware.js';
import { accountService } from '../services/account.service.js';

export const accountController = {
  list: asyncHandler(async (req, res) => {
    res.json(await accountService.list(req.auth.sub));
  }),

  create: asyncHandler(async (req, res) => {
    const account = await accountService.create(req.auth.sub, req.body);
    res.status(201).json(account);
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await accountService.update(req.auth.sub, req.params.id, req.body));
  }),

  setDefault: asyncHandler(async (req, res) => {
    res.json(await accountService.setDefault(req.auth.sub, req.params.id));
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await accountService.remove(req.auth.sub, req.params.id));
  })
};