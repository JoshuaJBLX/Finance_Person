import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';

const router = Router();

router.get('/me', userController.profile);
router.put('/me', userController.update);

export default router;