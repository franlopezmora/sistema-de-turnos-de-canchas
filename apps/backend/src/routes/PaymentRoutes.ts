import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { requireRole } from '../middleware/RoleMiddleware';
import { setAdminClubFromUser } from '../middleware/ClubMiddleware';
import { paymentLimiter } from '../middleware/rateLimit';

const router = Router();
const paymentController = new PaymentController();

router.get('/', authMiddleware, setAdminClubFromUser, requireRole('ADMIN'), paymentController.list);
router.post('/', paymentLimiter, authMiddleware, setAdminClubFromUser, requireRole('ADMIN'), paymentController.create);
router.post('/:id/refunds', paymentLimiter, authMiddleware, setAdminClubFromUser, requireRole('ADMIN'), paymentController.refund);

export default router;
