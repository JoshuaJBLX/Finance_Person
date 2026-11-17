import { Router } from 'express';
import { budgetController } from '../controllers/budget.controller.js';

const router = Router();

router.get('/', budgetController.list);
router.get('/summary', budgetController.summary);
router.post('/', budgetController.upsert);
router.delete('/:id', budgetController.remove);

export default router;