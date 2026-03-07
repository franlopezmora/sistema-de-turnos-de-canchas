import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

type CashCreateInput = {
  clubId: number;
  cashShiftId: string;
  type: 'PAYMENT_IN' | 'REFUND' | 'WITHDRAW' | 'DEPOSIT';
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'MP';
  amount: number;
  concept: string;
  paymentId?: string;
  createdByUserId?: number;
};

export class CashRepository {
  async create(data: CashCreateInput) {
    return prisma.cashMovement.create({
      data: {
        clubId: data.clubId,
        cashShiftId: data.cashShiftId,
        type: data.type,
        method: data.method,
        amount: new Prisma.Decimal(data.amount),
        concept: data.concept,
        paymentId: data.paymentId,
        createdByUserId: data.createdByUserId
      }
    });
  }

  async findAllByDateRange(startDate: Date, endDate: Date, clubId?: number) {
    return prisma.cashMovement.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(clubId ? { clubId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
