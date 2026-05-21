import { ClubRepository } from '../repositories/ClubRepository';
import { ActivityTypeRepository } from '../repositories/ActivityTypeRepository';
import { Club } from '../entities/Club';
import type { ClubOperationalStatus, FixedBookingSettingsByActivity } from '../entities/Club';
import { Court } from '../entities/Court';
import { Prisma } from '@prisma/client';
import { normalizeEmail } from '../utils/magicLink';
import { normalizeIdentityPhone } from '../utils/phone';
import { ErrorCodes, badRequest, conflict, forbidden, notFound } from '../errors';
import { PersonService, type PersonSearchResult } from './PersonService';

// 👇 1. USAMOS TUS IMPORTS CORRECTOS
import { prisma } from '../prisma'; 

export class ClubService {
    private readonly personService = new PersonService();

    constructor(
        private clubRepo: ClubRepository,
        private activityRepo: ActivityTypeRepository
    ) {}

    async createClub(
        slug: string,
        name: string, 
        addressLine: string,
        city: string,
        province: string,
        country: string,
        contact: string,
        phone?: string,
        logoUrl?: string,
    clubImageUrl?: string,
        instagramUrl?: string,
        facebookUrl?: string,
        websiteUrl?: string,
        description?: string,
        timeZone: string = 'America/Argentina/Buenos_Aires',
        lightsEnabled: boolean = false,
        lightsExtraAmount?: number | null,
        lightsFromHour?: string | null,
        professorDurationOverrideEnabled: boolean = true,
        professorDurationOverrideMinutes: number = 60,
        fixedBookingSettingsByActivity?: FixedBookingSettingsByActivity | null,
        bookingConfirmationMode: 'AUTOMATIC' | 'MANUAL' | 'DEPOSIT_REQUIRED' = 'MANUAL',
        bookingDepositPercent?: number | null,
        allowManualConfirmationOverride: boolean = true,
        autoCancelPendingBookingsEnabled: boolean = false,
        autoCancelPendingBookingsMinutesBefore?: number | null,
        autoCancelPendingBookingsOnlyIfUnpaid: boolean = true,
        autoCancelPendingWarningEnabled: boolean = false,
        autoCancelPendingWarningMinutesBefore?: number | null,
        enforceCashShiftCloseWithOpenAccounts: boolean = false,
        bookingSimpleAdvanceDaysUser: number = 30,
        bookingSimpleAdvanceDaysAdmin: number = 30,
        allowAdminSkipSimpleAdvanceLimit: boolean = false,
        closureDates?: string[] | null,
        openingDays?: number[] | null,
        clubOperationalStatus: ClubOperationalStatus = 'OPEN',
        temporaryClosureStartDate?: string | null,
        temporaryClosureEndDate?: string | null
    ) {
        return await this.clubRepo.createClub(
            slug,
            name, 
            addressLine,
            city,
            province,
            country,
            contact,
            phone,
            logoUrl,
            clubImageUrl,
            instagramUrl,
            facebookUrl,
            websiteUrl,
            description,
            timeZone,
            lightsEnabled,
            lightsExtraAmount,
            lightsFromHour,
            professorDurationOverrideEnabled,
            professorDurationOverrideMinutes,
            fixedBookingSettingsByActivity,
            bookingConfirmationMode,
            bookingDepositPercent,
            allowManualConfirmationOverride,
            autoCancelPendingBookingsEnabled,
            autoCancelPendingBookingsMinutesBefore,
            autoCancelPendingBookingsOnlyIfUnpaid,
            autoCancelPendingWarningEnabled,
            autoCancelPendingWarningMinutesBefore,
            enforceCashShiftCloseWithOpenAccounts,
            bookingSimpleAdvanceDaysUser,
            bookingSimpleAdvanceDaysAdmin,
            allowAdminSkipSimpleAdvanceLimit,
            closureDates,
            openingDays,
            clubOperationalStatus,
            temporaryClosureStartDate,
            temporaryClosureEndDate
        );
    }

    async getClubById(id: number): Promise<Club> {
        const club = await this.clubRepo.findClubById(id);
        if (!club) throw notFound('Club no encontrado', ErrorCodes.CLUB_NOT_FOUND);
        return club;
    }

    async getClubBySlug(slug: string): Promise<Club> {
        const club = await this.clubRepo.findClubBySlug(slug);
        if (!club) throw notFound('Club no encontrado', ErrorCodes.CLUB_NOT_FOUND);
        return club;
    }

    async getAllClubs(): Promise<Club[]> {
        return await this.clubRepo.findAllClubs();
    }

    async updateClub(
        id: number,
        data: {
            slug?: string;
            name?: string;
            addressLine?: string;
            city?: string;
            province?: string;
            country?: string;
            contactInfo?: string;
            phone?: string | null;
            logoUrl?: string | null;
            clubImageUrl?: string | null;
            instagramUrl?: string | null;
            facebookUrl?: string | null;
            websiteUrl?: string | null;
            description?: string | null;
            timeZone?: string;
            lightsEnabled?: boolean;
            lightsExtraAmount?: number | null;
            lightsFromHour?: string | null;
            professorDurationOverrideEnabled?: boolean;
            professorDurationOverrideMinutes?: number;
            fixedBookingSettingsByActivity?: FixedBookingSettingsByActivity | null;
            bookingConfirmationMode?: 'AUTOMATIC' | 'MANUAL' | 'DEPOSIT_REQUIRED';
            bookingDepositPercent?: number | null;
            allowManualConfirmationOverride?: boolean;
            autoCancelPendingBookingsEnabled?: boolean;
            autoCancelPendingBookingsMinutesBefore?: number | null;
            autoCancelPendingBookingsOnlyIfUnpaid?: boolean;
            autoCancelPendingWarningEnabled?: boolean;
            autoCancelPendingWarningMinutesBefore?: number | null;
            enforceCashShiftCloseWithOpenAccounts?: boolean;
            bookingSimpleAdvanceDaysUser?: number;
            bookingSimpleAdvanceDaysAdmin?: number;
            allowAdminSkipSimpleAdvanceLimit?: boolean;
            closureDates?: string[] | null;
            openingDays?: number[] | null;
            clubOperationalStatus?: ClubOperationalStatus;
            temporaryClosureStartDate?: string | null;
            temporaryClosureEndDate?: string | null;
        }
    ): Promise<Club> {
        const club = await this.clubRepo.findClubById(id);
        if (!club) throw notFound('Club no encontrado', ErrorCodes.CLUB_NOT_FOUND);
        return await this.clubRepo.updateClub(id, data);
    }

    async registerCourt(clubId: number, name: string, surface: string, activityTypeId: number | number[]) {
        const club = await this.clubRepo.findClubById(clubId);
        if (!club) throw notFound('Club no encontrado', ErrorCodes.CLUB_NOT_FOUND);

        const normalizedActivityTypeId = Array.isArray(activityTypeId)
            ? Number(activityTypeId[0])
            : Number(activityTypeId);
        if (!Number.isInteger(normalizedActivityTypeId) || normalizedActivityTypeId <= 0) {
            throw badRequest('Actividad inválida', ErrorCodes.INVALID_INPUT);
        }

        const activity = await this.activityRepo.findById(normalizedActivityTypeId);
        if (!activity) throw notFound('Actividad no encontrada', ErrorCodes.ACTIVITY_NOT_FOUND);
        if (activity.clubId && Number(activity.clubId) !== Number(clubId)) {
            throw forbidden('La actividad no pertenece a este club', ErrorCodes.ACTIVITY_OUT_OF_CLUB);
        }

        const court = new Court(0, name, false, surface, club, false, activity);

        return await this.clubRepo.saveCourt(court);
    }

    async getClients(clubId: number, query?: string) {
        const search = (query || '').trim();
        const prismaAny = prisma as any;
        const clients: any[] = await prismaAny.client.findMany({
            where: {
                clubId,
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } },
                            { dni: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                    : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        return this.dedupeClientSearchRows(clients).map((client) => ({
            id: client.id,
            name: client.name,
            phone: client.phone || '',
            email: client.email || '',
            dni: client.dni || '',
            isProfessor: Boolean(client.isProfessor)
        }));
    }

    async searchParticipants(clubId: number, query?: string) {
        const search = String(query || '').trim();
        if (!search) return [];

        const prismaAny = prisma as any;
        const clients: any[] = await prismaAny.client.findMany({
            where: {
                clubId,
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { dni: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 24
        });

        const clientResults = this.dedupeClientSearchRows(clients).map((client) => ({
            id: `client-${client.id}`,
            name: client.name,
            phone: client.phone || '',
            email: client.email || '',
            dni: client.dni || '',
            isProfessor: Boolean(client.isProfessor),
            sourceType: 'clubClient' as const,
            userId: client.userId || null
        }));

        const linkedUserIds = new Set<number>(
            clientResults
                .map((item) => Number(item.userId))
                .filter((value) => Number.isInteger(value) && value > 0)
        );

        const users: any[] = await prismaAny.user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { memberships: { some: { clubId } } },
                            { clients: { some: { clubId } } }
                        ]
                    },
                    {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } },
                            { phoneNumber: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true
            },
            orderBy: { id: 'desc' },
            take: 24
        });

        const systemUserResults = users
            .filter((user) => !linkedUserIds.has(Number(user.id)))
            .map((user) => {
                const fullName = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
                return {
                    id: `user-${user.id}`,
                    name: fullName || String(user.email || '').trim() || `Usuario ${user.id}`,
                    phone: String(user.phoneNumber || '').trim(),
                    email: String(user.email || '').trim(),
                    dni: '',
                    isProfessor: false,
                    sourceType: 'systemUser' as const,
                    userId: user.id
                };
            });

        return this.dedupeParticipantSearchRows([...clientResults, ...systemUserResults]).slice(0, 8);
    }

    async searchPeople(clubId: number, query?: string): Promise<PersonSearchResult[]> {
        return this.personService.searchPeople(clubId, query);
    }

    private normalizeSearchEmail(value: string | null | undefined) {
        const normalized = normalizeEmail(String(value || ''));
        return normalized || null;
    }

    private normalizeSearchPhone(value: string | null | undefined) {
        return normalizeIdentityPhone(value);
    }

    private normalizeSearchDni(value: string | null | undefined) {
        const normalized = String(value || '').replace(/\D/g, '');
        return normalized.length >= 6 ? normalized : null;
    }

    private buildIdentityTokens(input: {
        userId?: number | null;
        email?: string | null;
        phone?: string | null;
        dni?: string | null;
    }) {
        const tokens: string[] = [];
        const userId = Number(input.userId || 0);
        if (Number.isInteger(userId) && userId > 0) tokens.push(`user:${userId}`);
        const email = this.normalizeSearchEmail(input.email);
        if (email) tokens.push(`email:${email}`);
        const phone = this.normalizeSearchPhone(input.phone);
        if (phone) tokens.push(`phone:${phone}`);
        const dni = this.normalizeSearchDni(input.dni);
        if (dni) tokens.push(`dni:${dni}`);
        return tokens;
    }

    private dedupeClientSearchRows(rows: any[]) {
        const tokenOwner = new Map<string, string>();
        const deduped: any[] = [];

        for (const row of Array.isArray(rows) ? rows : []) {
            const id = String(row?.id || '').trim();
            if (!id) continue;
            const tokens = this.buildIdentityTokens({
                userId: row?.userId ?? null,
                email: row?.email ?? null,
                phone: row?.phone ?? null,
                dni: row?.dni ?? null
            });
            if (tokens.length > 0 && tokens.some((token) => tokenOwner.has(token))) {
                continue;
            }
            deduped.push(row);
            for (const token of tokens) tokenOwner.set(token, id);
        }

        return deduped;
    }

    private dedupeParticipantSearchRows(rows: Array<{
        id: string;
        name: string;
        phone?: string;
        email?: string;
        dni?: string;
        isProfessor?: boolean;
        sourceType: 'clubClient' | 'systemUser';
        userId?: number | null;
    }>) {
        const tokenOwner = new Map<string, string>();
        const deduped: Array<{
            id: string;
            name: string;
            phone?: string;
            email?: string;
            dni?: string;
            isProfessor?: boolean;
            sourceType: 'clubClient' | 'systemUser';
            userId?: number | null;
        }> = [];

        for (const row of rows) {
            const tokens = this.buildIdentityTokens({
                userId: row.userId ?? null,
                email: row.email ?? null,
                phone: row.phone ?? null,
                dni: row.dni ?? null
            });
            if (tokens.length > 0 && tokens.some((token) => tokenOwner.has(token))) {
                continue;
            }
            deduped.push(row);
            for (const token of tokens) tokenOwner.set(token, row.id);
        }

        return deduped;
    }

    async createClient(clubId: number, input: {
        name: string;
        phone?: string | null;
        dni?: string | null;
        email?: string | null;
        isProfessor?: boolean;
    }) {
        const club = await prisma.club.findUnique({
            where: { id: clubId },
            select: { country: true }
        });
        const normalizedName = String(input.name || '').trim();
        const normalizedPhone = normalizeIdentityPhone(
            { phone: input.phone ?? null },
            { defaultCountryIso2: String(club?.country || '').trim() || null }
        );
        const normalizedDni = String(input.dni || '').replace(/\D/g, '');
        const normalizedEmail = String(input.email || '').trim().toLowerCase();

        if (normalizedName.length < 2) throw badRequest('Nombre inválido', ErrorCodes.INVALID_INPUT);
        if (!normalizedPhone) throw badRequest('El teléfono es obligatorio', ErrorCodes.INVALID_INPUT);
        // Fase 1.2: email es opcional en CRUD admin.
        if (normalizedDni && normalizedDni.length < 6) throw badRequest('DNI inválido', ErrorCodes.INVALID_INPUT);

        try {
            return await prisma.client.create({
                data: {
                    clubId,
                    name: normalizedName,
                    phone: normalizedPhone,
                    dni: normalizedDni || null,
                    email: normalizedEmail || null,
                    isProfessor: Boolean(input.isProfessor)
                }
            });
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw conflict('Ya existe un cliente con ese DNI, teléfono o email', ErrorCodes.CONFLICT);
            }
            throw error;
        }
    }

    async updateClient(clubId: number, clientId: string, input: {
        name: string;
        phone?: string | null;
        dni?: string | null;
        email?: string | null;
        isProfessor?: boolean;
    }) {
        const existing = await prisma.client.findFirst({ where: { id: clientId, clubId } });
        if (!existing) throw notFound('Cliente no encontrado', ErrorCodes.CLIENT_NOT_FOUND);
        const club = await prisma.club.findUnique({
            where: { id: clubId },
            select: { country: true }
        });

        const normalizedName = String(input.name || '').trim();
        const normalizedPhone = normalizeIdentityPhone(
            { phone: input.phone ?? null },
            { defaultCountryIso2: String(club?.country || '').trim() || null }
        );
        const normalizedDni = String(input.dni || '').replace(/\D/g, '');
        const normalizedEmail = String(input.email || '').trim().toLowerCase();

        if (normalizedName.length < 2) throw badRequest('Nombre inválido', ErrorCodes.INVALID_INPUT);
        if (!normalizedPhone) throw badRequest('El teléfono es obligatorio', ErrorCodes.INVALID_INPUT);
        // Fase 1.2: email es opcional en CRUD admin.
        if (normalizedDni && normalizedDni.length < 6) throw badRequest('DNI inválido', ErrorCodes.INVALID_INPUT);

        try {
            return await prisma.client.update({
                where: { id: clientId },
                data: {
                    name: normalizedName,
                    phone: normalizedPhone,
                    dni: normalizedDni || null,
                    email: normalizedEmail || null,
                    isProfessor: Boolean(input.isProfessor)
                }
            });
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw conflict('Ya existe un cliente con ese DNI, teléfono o email', ErrorCodes.CONFLICT);
            }
            throw error;
        }
    }

    async deleteClient(clubId: number, clientId: string) {
        const existing = await prisma.client.findFirst({ where: { id: clientId, clubId } });
        if (!existing) throw notFound('Cliente no encontrado', ErrorCodes.CLIENT_NOT_FOUND);

        const hasLinkedBookings = await prisma.booking.count({ where: { clubId, clientId } });
        if (hasLinkedBookings > 0) {
            throw conflict('No se puede eliminar: el cliente tiene reservas asociadas', ErrorCodes.CONFLICT);
        }

        await prisma.client.delete({ where: { id: clientId } });
    }
}
