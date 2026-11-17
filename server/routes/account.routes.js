import { Router } from 'express';
import { accountController } from '../controllers/account.controller.js';

const router = Router();

router.get('/', accountController.list);
router.post('/', accountController.create);
router.put('/:id', accountController.update);
router.put('/:id/default', accountController.setDefault);
router.delete('/:id', accountController.remove);

export default router;