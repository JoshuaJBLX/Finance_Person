import { asyncHandler } from '../middleware/error.middleware.js';
import { authService } from '../services/auth.service.js';

export const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),

  forgot: asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body);
    res.json(result);
  }),

  verifyReset: asyncHandler(async (req, res) => {
    const result = await authService.verifyResetToken(req.query);
    res.json(result);
  }),

  reset: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  }),

  me: asyncHandler(async (req, res) => {
    res.json(await authService.me(req.auth.sub));
  })
};