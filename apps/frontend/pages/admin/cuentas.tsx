import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
import { addAccountItem, closeAccount, getAccountById, listAccounts, openAccount, registerPayment, type PaymentMethod, type PaymentSource } from '../../services/AccountService';
import type { RefundDraft } from '../../modules/refunds/refund.types';
import { buildDefaultRefundDraft } from '../../modules/refunds/refund.policy';
import { validateRefundAmountInput } from '../../modules/refunds/refund.validators';
import { requestManualRefund } from '../../modules/refunds/refund.facade';
import RefundRequestModal from '../../components/admin/refunds/RefundRequestModal';

type AccountRow = {
  id: string;
  sourceType: 'BOOKING' | 'BAR' | 'TABLE' | 'MANUAL';
  sourceId: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt?: string | null;
  booking?: {
    id: number;
    startDateTime: string;
    courtName?: string | null;
    clientName?: string | null;
  } | null;
};

export default function AdminAccountsPage() {
  const [openAccounts, setOpenAccounts] = useState<AccountRow[]>([]);
  const [closedAccounts, setClosedAccounts] = useState<AccountRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [newItem, setNewItem] = useState<{ description: string; quantity: number; unitPrice: number; type: 'BOOKING' | 'PRODUCT' | 'SERVICE' | 'ADJUSTMENT' }>({ description: '', quantity: 1, unitPrice: 0, type: 'PRODUCT' });
  const [payment, setPayment] = useState<{ amount: number; method: PaymentMethod; source: PaymentSource }>({ amount: 0, method: 'CASH', source: 'POS' });
  const [splitPayments, setSplitPayments] = useState<Array<{ amount: number; method: PaymentMethod; source: PaymentSource }>>([{ amount: 0, method: 'CASH', source: 'POS' }]);
  const [newAccount, setNewAccount] = useState({ sourceType: 'MANUAL' as const, sourceId: '' });
  const [itemAllocationDraft, setItemAllocationDraft] = useState<Record<string, number>>({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundPaymentMaxAmount, setRefundPaymentMaxAmount] = useState(0);
  const [refundDraft, setRefundDraft] = useState<RefundDraft>(() => buildDefaultRefundDraft('ACCOUNT_MANUAL', 0));
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const refreshLists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [opens, closeds] = await Promise.all([
        listAccounts({ status: 'OPEN' }),
        listAccounts({ status: 'CLOSED' })
      ]);
      setOpenAccounts(opens);
      setClosedAccounts(closeds);
      if (!selectedId && opens.length > 0) {
        setSelectedId(opens[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await getAccountById(id);
      setDetail(data);
      setPayment((prev) => ({ ...prev, amount: Number(data.remaining || 0) }));
      setItemAllocationDraft({});
    } catch (err: any) {
      setError(err.message || 'Error al cargar detalle');
    }
  }, []);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const totals = useMemo(() => ({
    open: openAccounts.length,
    closed: closedAccounts.length
  }), [openAccounts.length, closedAccounts.length]);

  const formatBookingDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString('es-AR');
    const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${time}`;
  };

  const itemOutstandingMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!detail?.items) return map;

    const allocatedByItem = new Map<string, number>();
    for (const paymentEntry of detail?.payments || []) {
      for (const allocation of paymentEntry?.allocations || []) {
        const itemId = String(allocation?.accountItemId || '');
        if (!itemId) continue;
        const prev = Number(allocatedByItem.get(itemId) || 0);
        allocatedByItem.set(itemId, Number((prev + Number(allocation?.amount || 0)).toFixed(2)));
      }
    }

    for (const item of detail.items || []) {
      const itemId = String(item.id || '');
      if (!itemId) continue;
      const total = Number(item.total || 0);
      const allocated = Number(allocatedByItem.get(itemId) || 0);
      map.set(itemId, Math.max(0, Number((total - allocated).toFixed(2))));
    }

    return map;
  }, [detail]);

  const formatAccountSourceType = (sourceType?: string) => {
    switch (sourceType) {
      case 'MANUAL':
        return 'Manual';
      case 'BAR':
        return 'Bar';
      case 'TABLE':
        return 'Mesa';
      case 'BOOKING':
        return 'Reserva';
      default:
        return sourceType || '-';
    }
  };
  const formatAccountStatus = (status?: string) => {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'CLOSED':
        return 'Cerrada';
      default:
        return status || '-';
    }
  };
  const formatItemType = (type?: string) => {
    switch (type) {
      case 'PRODUCT':
        return 'Producto';
      case 'BOOKING':
        return 'Reserva';
      case 'SERVICE':
        return 'Servicio';
      case 'ADJUSTMENT':
        return 'Ajuste';
      default:
        return type || '-';
    }
  };
  const formatPaymentMethod = (method?: string) => {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'MERCADO_PAGO':
        return 'Mercado Pago';
      case 'CARD':
        return 'Tarjeta';
      case 'OTHER':
        return 'Otro';
      default:
        return method || '-';
    }
  };
  const formatPaymentSource = (source?: string) => {
    switch (source) {
      case 'POS':
        return 'Mostrador (POS)';
      case 'ONLINE':
        return 'Online';
      case 'BACKOFFICE':
        return 'Administración';
      default:
        return source || '-';
    }
  };
  const openRefundModal = (paymentId: string, amount: number) => {
    setRefundPaymentId(paymentId);
    setRefundPaymentMaxAmount(amount);
    setRefundDraft(buildDefaultRefundDraft('ACCOUNT_MANUAL', amount));
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    if (submittingRefund) return;
    setShowRefundModal(false);
  };

  const submitRefundModal = async () => {
    try {
      const validation = validateRefundAmountInput(refundDraft.amountInput, refundPaymentMaxAmount);
      if (validation.error) throw new Error(validation.error);
      if (!refundPaymentId) {
        throw new Error('Pago invalido');
      }
      setSubmittingRefund(true);
      await requestManualRefund(refundPaymentId, refundDraft, refundPaymentMaxAmount, 'Devolucion solicitada desde cuentas');
      await loadDetail(selectedId);
      await refreshLists();
      setShowRefundModal(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo solicitar devolucion');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Cuentas | TuCancha Admin</title>
      </Head>

      <div className="bg-[#EBE1D8] border-4 border-white/50 rounded-[2rem] p-8 shadow-2xl text-[#347048] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-black uppercase italic">Cuentas</h1>
          <div className="text-xs font-black uppercase tracking-widest text-[#347048]/60">
            Abiertas: {totals.open} · Cerradas: {totals.closed}
          </div>
        </div>

        {error && <div className="text-sm font-bold text-red-600">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#347048]/10 bg-white p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-[#347048]/60">Abrir cuenta</p>
            <select
              value={newAccount.sourceType}
              onChange={(e) => setNewAccount((prev) => ({ ...prev, sourceType: e.target.value as any }))}
              className="w-full h-10 border rounded-lg px-3"
            >
              <option value="MANUAL">Manual</option>
              <option value="BAR">Bar</option>
              <option value="TABLE">Mesa</option>
              <option value="BOOKING">Reserva</option>
            </select>
            <input
              value={newAccount.sourceId}
              onChange={(e) => setNewAccount((prev) => ({ ...prev, sourceId: e.target.value }))}
              placeholder="ID de origen"
              className="w-full h-10 border rounded-lg px-3"
            />
            <button
              onClick={async () => {
                await openAccount({
                  sourceType: newAccount.sourceType,
                  sourceId: newAccount.sourceId || `manual-${Date.now()}`
                });
                await refreshLists();
              }}
              className="w-full h-10 rounded-lg bg-[#347048] text-[#EBE1D8] font-black text-xs uppercase"
            >
              Crear
            </button>
          </div>

          <div className="rounded-2xl border border-[#347048]/10 bg-white p-4 lg:col-span-2">
            <p className="text-xs font-black uppercase tracking-widest text-[#347048]/60 mb-3">Cuentas abiertas</p>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {openAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedId(account.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${selectedId === account.id ? 'bg-[#347048] text-[#EBE1D8] border-[#347048]' : 'bg-white border-[#347048]/20 text-[#347048]'}`}
                >
                  <div className="text-xs font-black uppercase tracking-wider">
                    {account.sourceType === 'BOOKING' && account.booking
                      ? `${account.booking.clientName || 'Sin cliente'} · ${formatBookingDateTime(account.booking.startDateTime)} · ${account.booking.courtName || 'Sin cancha'}`
                      : `${formatAccountSourceType(account.sourceType)} · ${account.sourceId}`}
                  </div>
                  <div className="text-xs">Estado: {formatAccountStatus(account.status)}</div>
                </button>
              ))}
              {openAccounts.length === 0 && <div className="text-xs font-bold text-[#347048]/50">No hay cuentas abiertas.</div>}
            </div>
          </div>
        </div>

        {detail && (
          <div className="rounded-2xl border border-[#347048]/10 bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm font-bold">
              <div>Total: ${Number(detail.total || 0).toLocaleString()}</div>
              <div>Pagado: ${Number(detail.paid || 0).toLocaleString()}</div>
              <div>Restante: ${Number(detail.remaining || 0).toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input placeholder="Descripción" value={newItem.description} onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))} className="h-10 border rounded-lg px-3" />
              <input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: Number(e.target.value) }))} className="h-10 border rounded-lg px-3" />
              <input type="number" min={0} step="0.01" value={newItem.unitPrice} onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: Number(e.target.value) }))} className="h-10 border rounded-lg px-3" />
              <select value={newItem.type} onChange={(e) => setNewItem((prev) => ({ ...prev, type: e.target.value as any }))} className="h-10 border rounded-lg px-3">
                <option value="PRODUCT">Producto</option>
                <option value="BOOKING">Reserva</option>
                <option value="SERVICE">Servicio</option>
                <option value="ADJUSTMENT">Ajuste</option>
              </select>
              <button
                onClick={async () => {
                  await addAccountItem(selectedId, newItem);
                  setNewItem({ description: '', quantity: 1, unitPrice: 0, type: 'PRODUCT' });
                  await loadDetail(selectedId);
                  await refreshLists();
                }}
                className="h-10 rounded-lg bg-[#926699] text-[#EBE1D8] text-xs font-black uppercase md:col-span-4"
              >
                Agregar consumo
              </button>
            </div>

            <div className="rounded-xl border border-[#347048]/10 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#347048]/60">Items</p>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {(detail.items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border border-[#347048]/10 rounded-lg px-2 py-1">
                    <span className="font-bold">{item.description} · {formatItemType(item.type)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#347048]/70">Pendiente: ${Number(itemOutstandingMap.get(String(item.id)) || 0).toLocaleString()}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        max={Number(itemOutstandingMap.get(String(item.id)) || 0)}
                        value={itemAllocationDraft[String(item.id)] > 0 ? itemAllocationDraft[String(item.id)] : ''}
                        onChange={(e) => {
                          const raw = Number(e.target.value || 0);
                          const max = Number(itemOutstandingMap.get(String(item.id)) || 0);
                          const next = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : 0;
                          setItemAllocationDraft((prev) => ({ ...prev, [String(item.id)]: next }));
                        }}
                        className="h-8 w-24 border rounded px-2 text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
                {(!detail.items || detail.items.length === 0) && <div className="text-[#347048]/50">Sin items.</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="number" min={0} step="0.01" value={payment.amount} onChange={(e) => setPayment((prev) => ({ ...prev, amount: Number(e.target.value) }))} className="h-10 border rounded-lg px-3" />
              <select value={payment.method} onChange={(e) => setPayment((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))} className="h-10 border rounded-lg px-3">
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="MERCADO_PAGO">Mercado Pago</option>
                <option value="CARD">Tarjeta</option>
                <option value="OTHER">Otro</option>
              </select>
              <select value={payment.source} onChange={(e) => setPayment((prev) => ({ ...prev, source: e.target.value as PaymentSource }))} className="h-10 border rounded-lg px-3">
                <option value="POS">Mostrador (POS)</option>
                <option value="ONLINE">Online</option>
                <option value="BACKOFFICE">Administración</option>
              </select>
              <button
                onClick={async () => {
                  const allocations = Object.entries(itemAllocationDraft)
                    .map(([accountItemId, amount]) => ({ accountItemId, amount: Number(amount || 0) }))
                    .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0.009);
                  const allocationTotal = Number(allocations.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2));
                  const amountToPay = Number(payment.amount || 0);

                  if (allocations.length > 0 && Math.abs(allocationTotal - amountToPay) > 0.009) {
                    throw new Error('El monto debe coincidir con la suma asignada a items.');
                  }

                  await registerPayment({
                    accountId: selectedId,
                    amount: amountToPay,
                    method: payment.method,
                    source: payment.source,
                    allocations: allocations.length > 0 ? allocations : undefined
                  });
                  setItemAllocationDraft({});
                  await loadDetail(selectedId);
                  await refreshLists();
                }}
                className="h-10 rounded-lg bg-[#347048] text-[#EBE1D8] text-xs font-black uppercase"
              >
                Registrar pago
              </button>
              <button
                onClick={async () => {
                  await closeAccount(selectedId);
                  setDetail(null);
                  setSelectedId('');
                  await refreshLists();
                }}
                className="h-10 rounded-lg bg-[#B9CF32] text-[#347048] text-xs font-black uppercase"
              >
                Cerrar cuenta
              </button>
            </div>

            <div className="rounded-xl border border-[#347048]/10 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#347048]/60">Pagos divididos</p>
              {splitPayments.map((splitPayment, index) => (
                <div key={`split-payment-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input type="number" min={0} step="0.01" value={splitPayment.amount} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount: Number(e.target.value) } : entry))} className="h-10 border rounded-lg px-3" />
                  <select value={splitPayment.method} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, method: e.target.value as PaymentMethod } : entry))} className="h-10 border rounded-lg px-3">
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="OTHER">Otro</option>
                  </select>
                  <select value={splitPayment.source} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, source: e.target.value as PaymentSource } : entry))} className="h-10 border rounded-lg px-3">
                    <option value="POS">Mostrador (POS)</option>
                    <option value="ONLINE">Online</option>
                    <option value="BACKOFFICE">Administración</option>
                  </select>
                  <button onClick={() => setSplitPayments((prev) => prev.filter((_, entryIndex) => entryIndex !== index))} className="h-10 rounded-lg border border-[#347048]/20 text-xs font-black uppercase text-[#347048]">
                    Quitar
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => setSplitPayments((prev) => [...prev, { amount: 0, method: 'CASH', source: 'POS' }])} className="h-9 px-3 rounded-lg border border-[#347048]/20 text-xs font-black uppercase text-[#347048]">Agregar tramo</button>
                <button
                  onClick={async () => {
                    const validSplits = splitPayments.filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);
                    for (const splitPayment of validSplits) {
                      await registerPayment({ accountId: selectedId, amount: splitPayment.amount, method: splitPayment.method, source: splitPayment.source });
                    }
                    await loadDetail(selectedId);
                    await refreshLists();
                  }}
                  className="h-9 px-3 rounded-lg bg-[#347048] text-[#EBE1D8] text-xs font-black uppercase"
                >
                  Registrar pagos divididos
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#347048]/10 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#347048]/60">Pagos de la cuenta (devolución manual)</p>
              <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                {(detail.payments || []).map((entry: any) => {
                  const paymentId = String(entry?.id || '');
                  if (!paymentId) return null;
                  const amount = Number(entry?.amount || 0);
                  return (
                    <div key={paymentId} className="flex items-center justify-between gap-2 border border-[#347048]/10 rounded-lg px-2 py-1">
                      <div className="min-w-0">
                        <p className="font-black truncate">{paymentId}</p>
                        <p className="text-[#347048]/70 truncate">{formatPaymentMethod(entry.method)} · {formatPaymentSource(entry.source)} · ${amount.toLocaleString()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRefundModal(paymentId, amount)}
                        className="h-8 rounded-lg border border-[#347048]/20 px-2 text-[10px] font-black uppercase"
                      >
                        Solicitar devolución
                      </button>
                    </div>
                  );
                })}
                {(!detail.payments || detail.payments.length === 0) && <div className="text-[#347048]/50">Sin pagos.</div>}
              </div>
            </div>

          </div>
        )}

        <div className="rounded-2xl border border-[#347048]/10 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#347048]/60 mb-2">Cuentas cerradas</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {closedAccounts.slice(0, 12).map((account) => (
              <div key={account.id} className="border border-[#347048]/15 rounded-lg px-3 py-2 text-xs">
                <div className="font-black uppercase">
                  {account.sourceType === 'BOOKING' && account.booking
                    ? `${account.booking.clientName || 'Sin cliente'} · ${formatBookingDateTime(account.booking.startDateTime)} · ${account.booking.courtName || 'Sin cancha'}`
                    : `${formatAccountSourceType(account.sourceType)} · ${account.sourceId}`}
                </div>
                <div>Estado: {formatAccountStatus(account.status)}</div>
              </div>
            ))}
            {!loading && closedAccounts.length === 0 && <div className="text-xs font-bold text-[#347048]/50">No hay cuentas cerradas.</div>}
          </div>
        </div>
      </div>

      <RefundRequestModal
        show={showRefundModal}
        title="Solicitar devolucion"
        paymentId={refundPaymentId}
        maxAmount={refundPaymentMaxAmount}
        draft={refundDraft}
        submitting={submittingRefund}
        onClose={closeRefundModal}
        onSubmit={submitRefundModal}
        onChangeDraft={setRefundDraft}
        submitLabel="Confirmar devolucion"
      />
    </AdminLayout>
  );
}

