const toNumber = (value: unknown) => Number(value || 0);

export const mapPaymentDto = (payment: any) => ({
  id: payment.id,
  createdAt: payment.createdAt,
  amount: toNumber(payment.amount),
  method: payment.method,
  source: payment.source,
  accountId: payment.accountId,
  cashShiftId: payment.cashShiftId ?? null
});

export const mapAccountItemDto = (item: any) => ({
  id: item.id,
  accountId: item.accountId,
  type: item.type,
  description: item.description,
  quantity: item.quantity,
  unitPrice: toNumber(item.unitPrice),
  total: toNumber(item.total),
  createdAt: item.createdAt
});

export const mapAccountDto = (account: any) => ({
  id: account.id,
  clubId: account.clubId,
  sourceType: account.sourceType,
  sourceId: account.sourceId,
  status: account.status,
  totalAmount: toNumber(account.totalAmount),
  paidAmount: toNumber(account.paidAmount),
  createdAt: account.createdAt,
  closedAt: account.closedAt ?? null
});

export const mapLedgerEntryDto = (entry: any) => ({
  id: entry.id,
  clubId: entry.clubId,
  type: entry.type,
  referenceType: entry.referenceType,
  referenceId: entry.referenceId,
  accountId: entry.accountId ?? null,
  accountItemId: entry.accountItemId ?? null,
  paymentId: entry.paymentId ?? null,
  amount: toNumber(entry.amount),
  direction: entry.direction,
  description: entry.description,
  createdByUserId: entry.createdByUserId ?? null,
  createdAt: entry.createdAt
});

export const mapCashMovementDto = (movement: any) => ({
  id: movement.id,
  type: movement.type,
  method: movement.method,
  concept: movement.concept,
  amount: toNumber(movement.amount),
  clubId: movement.clubId,
  paymentId: movement.paymentId ?? null,
  cashShiftId: movement.cashShiftId ?? null,
  createdByUserId: movement.createdByUserId ?? null,
  createdAt: movement.createdAt
});

export const mapCashShiftDto = (shift: any) => ({
  id: shift.id,
  cashRegisterId: shift.cashRegisterId,
  openedByUserId: shift.openedByUserId,
  openedAt: shift.openedAt,
  closedAt: shift.closedAt ?? null,
  openingAmount: toNumber(shift.openingAmount),
  expectedCash: shift.expectedCash == null ? null : toNumber(shift.expectedCash),
  countedCash: shift.countedCash == null ? null : toNumber(shift.countedCash),
  difference: shift.difference == null ? null : toNumber(shift.difference),
  status: shift.status,
  cashRegister: shift.cashRegister
    ? {
        id: shift.cashRegister.id,
        clubId: shift.cashRegister.clubId,
        name: shift.cashRegister.name,
        location: shift.cashRegister.location ?? null,
        createdAt: shift.cashRegister.createdAt
      }
    : undefined,
  movements: Array.isArray(shift.movements) ? shift.movements.map(mapCashMovementDto) : undefined,
  payments: Array.isArray(shift.payments) ? shift.payments.map(mapPaymentDto) : undefined
});
