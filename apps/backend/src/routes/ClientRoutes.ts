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
    const rawScope = String(req.query.scope || 'all').trim().toLowerCase();
    if (rawScope !== 'all' && rawScope !== 'debt_open') {
      return res.status(400).json({ error: 'scope inválido. Valores permitidos: all | debt_open' });
    }

    const clientsArray = await clientDebtService.listByClub(club.id, {
      scope: rawScope as 'all' | 'debt_open'
    });
    res.json(clientsArray);

  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
