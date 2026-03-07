import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { requireRole } from '../middleware/RoleMiddleware';
import { getUserClubContext } from '../utils/getUserClubContext';

const router = Router();
/** Middleware: verifica que clubSlug en query sea el club del admin autenticado */
const verifyClubSlugAccess = async (req: any, res: any, next: Function) => {
  try {
    const clubSlug = req.query.clubSlug;
    if (!clubSlug) return res.status(400).json({ error: 'Falta el clubSlug' });
    const club = await prisma.club.findUnique({ where: { slug: String(clubSlug) } });
    if (!club) return res.status(404).json({ error: 'Club no encontrado' });

    let context;
    try {
      context = await getUserClubContext(Number(req.user.userId), club.id);
    } catch {
      return res.status(403).json({ error: 'No tienes acceso a este club' });
    }

    if (!context || context.clubId !== club.id) return res.status(403).json({ error: 'No tienes acceso a este club' });
    req.club = club;
    req.clubContext = context;
    req.membershipRole = context.role;
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// GET /clients?clubSlug=... — solo el admin de ese club puede ver la lista
router.get('/', authMiddleware, verifyClubSlugAccess, requireRole('ADMIN'), async (req, res) => {
  try {
    const club = (req as any).club;

    // Buscamos todas las reservas de ese club
    // CORRECCIÓN APLICADA AQUÍ ABAJO 👇
    const bookings = await prisma.booking.findMany({
      where: {
        clubId: club.id
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        guestName: true,
        guestPhone: true,
        guestEmail: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true
          }
        }
      }
    });

    // 3. "Fabricamos" los clientes agrupando por Teléfono o Nombre
    const clientsMap = new Map();

    bookings.forEach((booking) => {
      // Prioridad: Usuario registrado > Invitado
      const phone = booking.user?.phoneNumber || booking.guestPhone || '';
      
      const rawName = booking.user 
        ? `${booking.user.firstName} ${booking.user.lastName}` 
        : booking.guestName;
      
      const email = booking.user?.email || booking.guestEmail || '';

      // Usamos el teléfono como ID único. Si no tiene, usamos el nombre.
      const uniqueKey = phone && phone.length > 4 ? phone.trim() : (rawName ? rawName.trim() : 'Desconocido');

      if (uniqueKey === 'Desconocido') return;

      if (!clientsMap.has(uniqueKey)) {
        clientsMap.set(uniqueKey, {
          id: booking.id, // ID ficticio para la tabla visual
          firstName: rawName || 'Sin Nombre',
          lastName: '',   
          email: email,
          phoneNumber: phone,
          totalBookings: 0 
        });
      }

      // Sumar al contador de reservas
      const client = clientsMap.get(uniqueKey);
      client.totalBookings += 1;
      
      // Actualizar datos si la reserva es más nueva y tiene mejor info
      if (!client.phoneNumber && phone) client.phoneNumber = phone;
      if (!client.email && email) client.email = email;
    });

    const clientsArray = Array.from(clientsMap.values());

    res.json(clientsArray);

  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;