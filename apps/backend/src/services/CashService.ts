import { CashRepository } from '../repositories/CashRepository';
import { TimeHelper } from '../utils/TimeHelper';
import { prisma } from '../prisma';
import { getUserClubContext } from '../utils/getUserClubContext';
import { EventService } from './EventService';
import { AuditLogService } from './AuditLogService';

export class CashService {
    private readonly eventService = new EventService();
    private readonly auditLogService = new AuditLogService();

    constructor(private cashRepository: CashRepository) {}

    private async resolveClubId(clubId?: number, userId?: number, preferredClubId?: number) {
        if (clubId && Number.isInteger(clubId) && clubId > 0) {
            return clubId;
        }
        if (userId && Number.isInteger(userId) && userId > 0) {
            const ctx = await getUserClubContext(userId, preferredClubId);
            return ctx.clubId;
        }
        return undefined;
    }

    async getDailySummary(clubId?: number, userId?: number, preferredClubId?: number) {
        const resolvedClubId = await this.resolveClubId(clubId, userId, preferredClubId);
        const timeZone = resolvedClubId
            ? ((await prisma.club.findUnique({ where: { id: resolvedClubId }, select: { timeZone: true } }))?.timeZone ?? 'America/Argentina/Buenos_Aires')
            : 'America/Argentina/Buenos_Aires';
        const { startUtc: start, endUtc: end } = TimeHelper.getUtcRangeForLocalDate(new Date(), timeZone);

        const movements = await this.cashRepository.findAllByDateRange(start, end, resolvedClubId);

        // 3. Calcular totales (Lógica de negocio)
        let totalCash = 0;
        let totalDigital = 0;
        let totalIncome = 0;
        let totalExpense = 0;

        movements.forEach(m => {
            if (m.method === 'DEBT' && !(m as any).isSettled) {
                return;
            }
            const val = m.type === 'INCOME' ? m.amount : -m.amount;
            
            if (m.type === 'INCOME') totalIncome += m.amount;
            else totalExpense += m.amount;

            if (m.method === 'CASH') totalCash += val;
            else totalDigital += val;
        });

        return {
            balance: {
                total: totalCash + totalDigital,
                cash: totalCash,
                digital: totalDigital,
                income: totalIncome,
                expense: totalExpense
            },
            movements
        };
    }

    async addMovement(data: any, actorUserId?: number) {
        const created = await this.cashRepository.create(data);

        if (data?.type === 'INCOME' && Number(data?.amount) > 0 && Number.isInteger(Number(data?.clubId))) {
            await this.eventService.paymentReceived(Number(data.clubId), {
                movementId: created.id,
                amount: Number(data.amount),
                method: data.method,
                userId: data.userId ?? actorUserId ?? null,
                bookingId: data.bookingId ?? null
            });

            await this.auditLogService.create({
                clubId: Number(data.clubId),
                userId: actorUserId ?? data.userId ?? null,
                entity: 'Payment',
                entityId: String(created.id),
                action: 'PAYMENT_CREATE',
                payload: {
                    type: data.type,
                    amount: Number(data.amount),
                    method: data.method,
                    description: data.description,
                    bookingId: data.bookingId ?? null
                }
            });
        }

        return created;
    }
}