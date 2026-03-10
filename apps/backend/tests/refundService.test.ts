import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { RefundService } from '../src/services/RefundService';

type FakeState = {
  paymentAmount: number;
  paidAmount: number;
  source: 'POS' | 'ONLINE' | 'BACKOFFICE';
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'MERCADO_PAGO' | 'OTHER';
  refunds: Array<{ id: string; amount: number }>;
  cashShiftOpen?: boolean;
};

function createHarness(state: FakeState) {
  const calls = {
    ledger: 0,
    cashMovement: 0
  };

  const tx: any = {
    $queryRaw: async () => [{ id: 'p1' }],
    payment: {
      findUnique: async () => ({
        id: 'p1',
        amount: new Prisma.Decimal(state.paymentAmount),
        method: state.method,
        source: state.source,
        accountId: 'a1',
        account: {
          id: 'a1',
          clubId: 1,
          sourceType: 'BOOKING',
          sourceId: '11',
          status: 'OPEN',
          totalAmount: new Prisma.Decimal(20000),
          paidAmount: new Prisma.Decimal(state.paidAmount)
        },
        refunds: state.refunds.map((r) => ({ id: r.id, amount: new Prisma.Decimal(r.amount) }))
      })
    },
    cashShift: {
      findFirst: async () => (state.cashShiftOpen === false ? null : { id: 'shift1' })
    },
    account: {
      update: async ({ data }: any) => {
        state.paidAmount = Number(data.paidAmount ?? state.paidAmount);
        return { id: 'a1' };
      }
    },
    cashMovement: {
      create: async () => {
        calls.cashMovement += 1;
        return { id: 1 };
      }
    },
    booking: {
      findUnique: async () => ({ status: 'CANCELLED' })
    },
    refund: {
      create: async ({ data }: any) => {
        const id = `r${state.refunds.length + 1}`;
        state.refunds.push({ id, amount: Number(data.amount) });
        return {
          id,
          createdAt: new Date('2026-03-10T10:00:00Z'),
          amount: data.amount,
          reason: data.reason,
          paymentId: data.paymentId,
          accountId: data.accountId,
          clubId: data.clubId,
          cashShiftId: data.cashShiftId,
          createdByUserId: data.createdByUserId
        };
      },
      findUnique: async ({ where }: any) => ({ id: where.id, payment: { id: 'p1' }, cashMovement: null }),
      aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(0) } })
    }
  };

  const service = new RefundService();
  (service as any).accountingService = {
    createRefundTransaction: async () => {
      calls.ledger += 1;
      return { id: 'lt1' };
    }
  };
  (service as any).projectionService = {
    refreshAccountSummary: async () => null,
    refreshCashShiftSummary: async () => null,
    refreshDailyCashSummary: async () => null
  };
  (service as any).accountService = {
    reconcilePaidAmountTx: async (_tx: any, _accountId: string) => {
      const paid = Math.max(
        0,
        state.paymentAmount - state.refunds.reduce((sum, refund) => sum + refund.amount, 0)
      );
      state.paidAmount = Number(paid.toFixed(2));
      return {
        netPaid: state.paidAmount,
        total: 20000,
        remaining: Number((20000 - state.paidAmount).toFixed(2))
      };
    }
  };

  return { service, tx, state, calls };
}

test('refund total', async () => {
  const { service, tx, state, calls } = createHarness({
    paymentAmount: 20000,
    paidAmount: 20000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: []
  });

  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 20000, clubId: 1, createdByUserId: 7 });

  assert.equal(state.paidAmount, 0);
  assert.equal(state.refunds.length, 1);
  assert.equal(state.refunds[0].amount, 20000);
  assert.equal(calls.ledger, 1);
});

test('refund parcial', async () => {
  const { service, tx, state } = createHarness({
    paymentAmount: 20000,
    paidAmount: 20000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: []
  });

  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 5000, clubId: 1 });

  assert.equal(state.paidAmount, 15000);
  assert.equal(state.refunds[0].amount, 5000);
});

test('multiples refunds parciales sin exceder', async () => {
  const { service, tx, state } = createHarness({
    paymentAmount: 20000,
    paidAmount: 20000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: []
  });

  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 5000, clubId: 1 });
  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 7000, clubId: 1 });

  assert.equal(state.refunds.length, 2);
  assert.equal(state.refunds[0].amount + state.refunds[1].amount, 12000);
});

test('bloquea refund por exceso', async () => {
  const { service, tx } = createHarness({
    paymentAmount: 20000,
    paidAmount: 20000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: [{ id: 'r1', amount: 18000 }]
  });

  await assert.rejects(
    () => service.refundPaymentTx(tx, { paymentId: 'p1', amount: 3000, clubId: 1 }),
    /saldo refundable/
  );
});

test('refund genera ledger', async () => {
  const { service, tx, calls } = createHarness({
    paymentAmount: 10000,
    paidAmount: 10000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: []
  });

  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 1000, clubId: 1 });
  assert.equal(calls.ledger, 1);
});

test('refund pos genera cash movement', async () => {
  const { service, tx, calls } = createHarness({
    paymentAmount: 10000,
    paidAmount: 10000,
    source: 'POS',
    method: 'CASH',
    refunds: [],
    cashShiftOpen: true
  });

  await service.refundPaymentTx(tx, { paymentId: 'p1', amount: 1200, clubId: 1 });
  assert.equal(calls.cashMovement, 1);
});

test('bloquea refund en cuenta cerrada no-cancelada', async () => {
  const { service, tx } = createHarness({
    paymentAmount: 10000,
    paidAmount: 10000,
    source: 'BACKOFFICE',
    method: 'TRANSFER',
    refunds: []
  });

  tx.payment.findUnique = async () => ({
    id: 'p1',
    amount: new Prisma.Decimal(10000),
    method: 'TRANSFER',
    source: 'BACKOFFICE',
    accountId: 'a1',
    account: {
      id: 'a1',
      clubId: 1,
      sourceType: 'MANUAL',
      sourceId: 'x1',
      status: 'CLOSED',
      totalAmount: new Prisma.Decimal(10000),
      paidAmount: new Prisma.Decimal(10000)
    },
    refunds: []
  });

  await assert.rejects(
    () => service.refundPaymentTx(tx, { paymentId: 'p1', amount: 1000, clubId: 1 }),
    /cuenta cerrada/
  );
});

test('refundBookingPaymentsTx usa solo saldo refundable remanente', async () => {
  const service = new RefundService() as any;
  const calls: Array<{ paymentId: string; amount: number }> = [];
  service.refundPaymentTx = async (_tx: any, input: any) => {
    calls.push({ paymentId: input.paymentId, amount: input.amount });
    return { id: 'rx1' };
  };

  const tx: any = {
    account: {
      findFirst: async () => ({
        id: 'a1',
        payments: [{ id: 'p1', amount: new Prisma.Decimal(10000) }]
      })
    },
    refund: {
      aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(4000) } })
    }
  };

  await service.refundBookingPaymentsTx(tx, { bookingId: 10, clubId: 1, reason: 'cancel parcial' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].paymentId, 'p1');
  assert.equal(calls[0].amount, 6000);
});
