import { MembershipRole } from '@prisma/client';
import { prisma } from '../prisma';

export type UserClubContext = {
    clubId: number;
    role: MembershipRole;
};

const rolePriority: Record<MembershipRole, number> = {
    OWNER: 0,
    ADMIN: 1,
    STAFF: 2,
    CUSTOMER: 3
};

const pickBestMembership = (rows: Array<{ clubId: number; role: MembershipRole }>) => {
    if (rows.length === 0) return null;
    return [...rows].sort((a, b) => rolePriority[a.role] - rolePriority[b.role])[0] ?? null;
};

export const getUserClubContext = async (userId: number, preferredClubId?: number): Promise<UserClubContext> => {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('userId inválido');
    }

    if (preferredClubId != null) {
        const scopedMembership = await prisma.membership.findUnique({
            where: {
                userId_clubId: {
                    userId,
                    clubId: preferredClubId
                }
            },
            select: {
                clubId: true,
                role: true
            }
        });

        if (scopedMembership) {
            return { clubId: scopedMembership.clubId, role: scopedMembership.role };
        }
    }

    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { clubId: true, role: true }
    });

    const selectedMembership = pickBestMembership(memberships);
    if (selectedMembership) {
        return selectedMembership;
    }

    try {
        const legacyRows = await prisma.$queryRaw<Array<{ clubId: number | null }>>`
            SELECT "clubId"
            FROM "User"
            WHERE "id" = ${userId}
            LIMIT 1
        `;

        const legacyClubId = legacyRows[0]?.clubId ?? null;
        if (legacyClubId != null) {
            return { clubId: Number(legacyClubId), role: MembershipRole.OWNER };
        }
    } catch {
    }

    throw new Error('No se pudo resolver el club del usuario');
};
