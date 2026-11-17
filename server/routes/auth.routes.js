import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgot);
router.get('/verify-reset', asyncHandler(authController.verifyReset));
router.post('/reset-password', authController.reset);
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;