import { asyncHandler } from '../middleware/error.middleware.js';
import { userService } from '../services/user.service.js';

export const userController = {
  profile: asyncHandler(async (req, res) => {
    res.json(await userService.getProfile(req.auth.sub));
  }),

  update: asyncHandler(async (req, res) => {
    const profile = await userService.updateProfile(req.auth.sub, req.body);
    res.json(profile);
  })
};