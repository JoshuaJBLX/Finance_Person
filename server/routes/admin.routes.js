import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Todas las rutas del panel de administración requieren rol admin.
router.use(requireRole('admin'));

router.get('/stats', adminController.stats);
router.get('/overview', adminController.overview);
router.get('/users', adminController.listUsers);
router.get('/users/:id/transactions', adminController.userTransactions);
router.delete('/users/:id', adminController.removeUser);

router.get('/categories/system', adminController.systemCategories);
router.post('/categories/system', adminController.createSystemCategory);
router.put('/categories/system/:id', adminController.updateSystemCategory);
router.delete('/categories/system/:id', adminController.removeSystemCategory);

export default router;