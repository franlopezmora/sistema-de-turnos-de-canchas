import { Router } from 'express';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { requireRole } from '../middleware/RoleMiddleware';
import { verifyClubAccess } from '../middleware/ClubMiddleware';
import { ClientDebtService } from '../services/ClientDebtService';

const router = Router();
const clientDebtService = new ClientDebtService();

// GET /api/clients/:slug — solo el admin de ese club puede ver la lista
router.get('/:slug', authMiddleware, verifyClubAccess, requireRole('ADMIN'), async (req, res) => {
  try {
    const club = (req as any).club;
    const clientsArray = await clientDebtService.listByClub(club.id);
    res.json(clientsArray);

  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;