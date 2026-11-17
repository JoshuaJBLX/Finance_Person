import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';

const router = Router();

router.get('/summary', reportController.summary);
router.get('/by-category', reportController.byCategory);
router.get('/by-account', reportController.byAccount);
router.get('/monthly', reportController.monthly);
router.get('/full', reportController.full);

export default router;