import { CashMovementMethod, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AccountingService } from './AccountingService';
import { ProjectionService } from './ProjectionService';
import { AccountService } from './AccountService';

const EPSILON = 0.009;

type TxClient = Prisma.TransactionClient;

type RefundPaymentInput = {
  clubId?: number;
  paymentId: string;
  amount: number;
  reason?: string | null;
  cashShiftId?: string;
  createdByUserId?: number;
};

export class RefundService {
  private readonly accountingService = new AccountingService();
  private readonly projectionService = new ProjectionService();
  private readonly accountService = new AccountService();

  private mapPaymentMethodToCashMovement(method: PaymentMethod): CashMovementMethod {
    if (method === 'MERCADO_PAGO') return 'MP';
    if (method === 'CARD') return 'CARD';
    if (method === 'TRANSFER') return 'TRANSFER';
    return 'CASH';
  }

  async refundPayment(input: RefundPaymentInput) {
    return prisma.$transaction((tx) => this.refundPaymentTx(tx, input));
  }

  async refundPaymentTx(tx: TxClient, input: RefundPaymentInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('El monto de devolución debe ser mayor a 0');
    }

    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${input.paymentId}
      FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        account: true,
        refunds: true
      }
    });

    if (!payment) throw new Error('Pago no encontrado');
    if (input.clubId && payment.account.clubId !== input.clubId) throw new Error('Pago no encontrado');
    if (payment.account.status !== 'OPEN') {
      if (payment.account.sourceType !== 'BOOKING') {
        throw new Error('No se puede devolver un pago de una cuenta cerrada');
      }
      const bookingForClosedAccount = await tx.booking.findUnique({
        where: { id: Number(payment.account.sourceId) },
        select: { status: true }
      });
      if (!bookingForClosedAccount || bookingForClosedAccount.status !== 'CANCELLED') {
        throw new Error('No se puede devolver un pago de una reserva no cancelada con cuenta cerrada');
      }
    }

    if (payment.account.sourceType === 'BOOKING') {
      const booking = await tx.booking.findUnique({
        where: { id: Number(payment.account.sourceId) },
        select: { status: true }
      });
      if (!booking) {
        throw new Error('Reserva asociada al pago no encontrada');
      }
      if (booking.status === 'COMPLETED') {
        throw new Error('No se permiten devoluciones sobre reservas completadas');
      }
    }

    const alreadyRefunded = payment.refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
    const refundable = Number((Number(payment.amount || 0) - alreadyRefunded).toFixed(2));

    if (input.amount > refundable + EPSILON) {
      throw new Error('El monto de devolución supera el saldo refundable del pago');
    }

    let resolvedCashShiftId: string | null = null;
    if (payment.source === 'POS') {
      if (input.cashShiftId) {
        const providedShift = await tx.cashShift.findFirst({
          where: {
            id: input.cashShiftId,
            status: 'OPEN',
            cashRegister: { clubId: payment.account.clubId }
          }
        });
        if (!providedShift) {
          throw new Error('El turno de caja indicado no está abierto o no pertenece al club');
        }
        resolvedCashShiftId = providedShift.id;
      } else {
        const openShift = await tx.cashShift.findFirst({
          where: {
            status: 'OPEN',
            cashRegister: { clubId: payment.account.clubId }
          },
          orderBy: { openedAt: 'desc' }
        });
        if (!openShift) throw new Error('No hay turno de caja abierto para registrar la devolución');
        resolvedCashShiftId = openShift.id;
      }
    }

    const refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        accountId: payment.accountId,
        clubId: payment.account.clubId,
        amount: new Prisma.Decimal(input.amount),
        reason: input.reason ?? null,
        cashShiftId: resolvedCashShiftId,
        createdByUserId: input.createdByUserId ?? null
      }
    });

    await this.accountingService.createRefundTransaction(tx, {
      clubId: payment.account.clubId,
      type: 'REFUND',
      referenceType: 'REFUND',
      referenceId: refund.id,
      accountId: payment.accountId,
      refundId: refund.id,
      amount: input.amount,
      paymentMethod: payment.method,
      description: `Devolución pago ${payment.id}`,
      createdByUserId: input.createdByUserId ?? null
    });

    await this.accountService.reconcilePaidAmountTx(tx, payment.accountId, {
      updateStatus: false,
      reopenIfRemaining: false
    });

    if (payment.source === 'POS' && resolvedCashShiftId) {
      await tx.cashMovement.create({
        data: {
          type: 'REFUND',
          amount: new Prisma.Decimal(input.amount),
          method: this.mapPaymentMethodToCashMovement(payment.method),
          concept: `Refund pago ${payment.id}`,
          clubId: payment.account.clubId,
          refundId: refund.id,
          cashShiftId: resolvedCashShiftId,
          createdByUserId: input.createdByUserId ?? null
        }
      });
    }

    await this.projectionService.refreshAccountSummary(payment.accountId, tx);
    if (resolvedCashShiftId) {
      await this.projectionService.refreshCashShiftSummary(resolvedCashShiftId, tx);
      await this.projectionService.refreshDailyCashSummary(payment.account.clubId, refund.createdAt, tx);
    }

    return tx.refund.findUnique({
      where: { id: refund.id },
      include: {
        payment: true,
        cashMovement: true
      }
    });
  }

  async refundBookingPaymentsTx(tx: TxClient, input: {
    bookingId: number;
    clubId: number;
    reason?: string;
    createdByUserId?: number;
  }) {
    const account = await tx.account.findFirst({
      where: {
        clubId: input.clubId,
        sourceType: 'BOOKING',
        sourceId: String(input.bookingId)
      },
      include: {
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!account) throw new Error('Cuenta de reserva no encontrada');

    const refunds = [];
    for (const payment of account.payments) {
      const refundedAgg = await tx.refund.aggregate({
        where: { paymentId: payment.id },
        _sum: { amount: true }
      });
      const alreadyRefunded = Number(refundedAgg._sum.amount || 0);
      const refundable = Number((Number(payment.amount || 0) - alreadyRefunded).toFixed(2));
      if (refundable <= EPSILON) continue;

      const refund = await this.refundPaymentTx(tx, {
        clubId: input.clubId,
        paymentId: payment.id,
        amount: refundable,
        reason: input.reason ?? `Cancelación reserva #${input.bookingId}`,
        createdByUserId: input.createdByUserId
      });
      refunds.push(refund);
    }

    return refunds;
  }
}
