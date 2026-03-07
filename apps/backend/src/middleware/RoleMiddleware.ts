import { Request, Response, NextFunction } from 'express';

const expandAcceptedRoles = (roles: string[]) => {
    const accepted = new Set<string>();
    for (const role of roles) {
        accepted.add(role);
        if (role === 'ADMIN') {
            accepted.add('OWNER');
        }
    }
    return accepted;
};

export const requireRole = (role: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Acceso denegado. Falta autenticación.' });
        }
        const requestedRoles = Array.isArray(role) ? role : [role];
        const acceptedRoles = expandAcceptedRoles(requestedRoles);
        const membershipRole = String((req as any).membershipRole || '');

        if (acceptedRoles.has(String(user.role)) || (membershipRole && acceptedRoles.has(membershipRole))) {
            return next();
        }

        if (!acceptedRoles.has(String(user.role))) {
            return res.status(403).json({ error: 'Permisos insuficientes.' });
        }
    };
};

