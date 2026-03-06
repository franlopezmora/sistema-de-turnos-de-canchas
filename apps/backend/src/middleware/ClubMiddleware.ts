import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { getUserClubContext } from '../utils/getUserClubContext';
import { getPreferredClubIdFromRequest } from '../utils/clubContext';

/**
 * Middleware para verificar que el usuario autenticado pertenece al club especificado en el slug
 * Debe usarse después de authMiddleware
 */
export const verifyClubAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        const slug = req.params.slug;

        if (!slug) {
            return res.status(400).json({ error: 'Slug de club requerido' });
        }

        // Obtener el club por slug
        const club = await prisma.club.findUnique({
            where: { slug: slug as string }
        });

        if (!club) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }

        let context;
        try {
            context = await getUserClubContext(Number(user.userId), club.id);
        } catch {
            return res.status(403).json({ error: 'No tienes acceso a este club' });
        }

        if (!context || context.clubId !== club.id) {
            return res.status(403).json({ error: 'No tienes acceso a este club' });
        }

        // Agregar el club al request para uso posterior
        (req as any).club = club;
        (req as any).clubId = club.id;

        next();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Middleware para verificar que el usuario puede acceder a un club por ID
 */
export const verifyClubAccessById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        const clubId = req.params.id != null ? parseInt(req.params.id as string) : NaN;
        const parsed = !isNaN(clubId) ? clubId : (req.body?.clubId != null ? parseInt(String(req.body.clubId)) : NaN);

        if (!parsed || isNaN(parsed)) {
            return res.status(400).json({ error: 'ID de club inválido' });
        }

        let context;
        try {
            context = await getUserClubContext(Number(user.userId), parsed);
        } catch {
            return res.status(403).json({ error: 'No tienes acceso a este club' });
        }

        if (!context || context.clubId !== parsed) {
            return res.status(403).json({ error: 'No tienes acceso a este club' });
        }

        (req as any).clubId = parsed;
        next();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Middleware para rutas admin que no llevan slug en la URL.
 * Establece req.clubId con el club del usuario autenticado.
 * Debe usarse después de authMiddleware y requireRole('ADMIN').
 * Si el admin no tiene clubId, responde 403.
 */
export const setAdminClubFromUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user?.userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        let context;
        try {
            const preferredClubId = getPreferredClubIdFromRequest(req);
            context = await getUserClubContext(Number(user.userId), preferredClubId);
        } catch {
            return res.status(403).json({ error: 'No tienes un club asignado' });
        }

        (req as any).clubId = context.clubId;
        next();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Versión opcional: solo setea req.clubId si el usuario está autenticado y es ADMIN con club.
 * Para GET /api/courts: sin auth devuelve todas las canchas; con auth de admin devuelve solo las de su club.
 */
export const optionalSetAdminClubFromUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user?.userId || user.role !== 'ADMIN') return next();
        try {
            const preferredClubId = getPreferredClubIdFromRequest(req);
            const context = await getUserClubContext(Number(user.userId), preferredClubId);
            if (context?.clubId != null) (req as any).clubId = context.clubId;
        } catch {
        }
        next();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
