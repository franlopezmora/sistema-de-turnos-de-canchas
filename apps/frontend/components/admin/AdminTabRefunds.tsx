import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefundRecord, RefundStatus } from '../../modules/refunds/refund.types';
import { searchRefunds, refundActions } from '../../modules/refunds/refund.facade';
import RefundList from './refunds/RefundList';
import RefundLifecycleActions from './refunds/RefundLifecycleActions';

const STATUS_OPTIONS: Array<{ value: 'ALL' | RefundStatus; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'REQUESTED', label: 'Solicitada' },
  { value: 'APPROVED', label: 'Aprobada' },
  { value: 'READY_TO_EXECUTE', label: 'Lista para ejecutar' },
  { value: 'EXECUTED', label: 'Ejecutada' },
  { value: 'FAILED', label: 'Fallida' },
  { value: 'CANCELLED', label: 'Cancelada' }
];

export default function AdminTabRefunds() {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | RefundStatus>('ALL');
  const [paymentIdFilter, setPaymentIdFilter] = useState('');
  const [accountIdFilter, setAccountIdFilter] = useState('');

  const hasActiveFilters = useMemo(
    () => statusFilter !== 'ALL' || Boolean(paymentIdFilter.trim()) || Boolean(accountIdFilter.trim()),
    [statusFilter, paymentIdFilter, accountIdFilter]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await searchRefunds({
        take: 200,
        status: statusFilter === 'ALL' ? undefined : [statusFilter],
        paymentId: paymentIdFilter.trim() || undefined,
        accountId: accountIdFilter.trim() || undefined
      });
      setRefunds(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar devoluciones');
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentIdFilter, accountIdFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (refundId: string, action: () => Promise<any>) => {
    try {
      setActionBusyId(refundId);
      await action();
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo procesar la devolucion');
    } finally {
      setActionBusyId(null);
    }
  };

  const onApprove = (refund: RefundRecord, executeNow: boolean) => {
    const ok = window.confirm(executeNow ? 'Aprobar y ejecutar esta devolucion?' : 'Aprobar esta devolucion?');
    if (!ok) return;
    runAction(refund.id, () => refundActions.approve(refund.id, executeNow));
  };

  const onExecute = (refund: RefundRecord) => {
    if (!window.confirm('Ejecutar esta devolucion?')) return;
    runAction(refund.id, () => refundActions.execute(refund.id));
  };

  const onRetry = (refund: RefundRecord, executeNow: boolean) => {
    if (!window.confirm('Reintentar esta devolucion?')) return;
    runAction(refund.id, () => refundActions.retry(refund.id, executeNow));
  };

  const onFail = (refund: RefundRecord) => {
    if (!window.confirm('Marcar esta devolucion como fallida?')) return;
    runAction(refund.id, () => refundActions.fail(refund.id));
  };

  const onCancel = (refund: RefundRecord) => {
    if (!window.confirm('Cancelar esta devolucion?')) return;
    runAction(refund.id, () => refundActions.cancel(refund.id));
  };

  return (
    <div className="rounded-2xl border border-[#347048]/10 bg-white p-4 space-y-4 text-[#347048]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase italic">Bandeja de devoluciones</h2>
          <p className="text-xs font-bold text-[#347048]/60">Centraliza solicitudes de cuentas y turnos.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="h-9 px-3 rounded-lg border border-[#347048]/20 text-xs font-black uppercase"
        >
          Recargar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | RefundStatus)}
          className="h-10 border rounded-lg px-3"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Estado: {opt.label}
            </option>
          ))}
        </select>
        <input
          value={paymentIdFilter}
          onChange={(e) => setPaymentIdFilter(e.target.value)}
          placeholder="Filtrar por pago"
          className="h-10 border rounded-lg px-3"
        />
        <input
          value={accountIdFilter}
          onChange={(e) => setAccountIdFilter(e.target.value)}
          placeholder="Filtrar por cuenta"
          className="h-10 border rounded-lg px-3"
        />
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setPaymentIdFilter('');
            setAccountIdFilter('');
          }}
          disabled={!hasActiveFilters}
          className="h-10 rounded-lg border border-[#347048]/20 text-xs font-black uppercase disabled:opacity-40"
        >
          Limpiar filtros
        </button>
      </div>

      {error ? <div className="text-sm font-bold text-red-600">{error}</div> : null}

      <RefundList
        refunds={refunds}
        loading={loading}
        emptyText="No hay devoluciones para los filtros seleccionados."
        maxHeightClass="max-h-[60vh]"
        actionBusyId={actionBusyId}
        renderActions={(refund, isBusy) => (
          <RefundLifecycleActions
            status={refund.status}
            disabled={isBusy}
            handlers={{
              onApprove: (executeNow) => onApprove(refund, executeNow),
              onExecute: () => onExecute(refund),
              onRetry: (executeNow) => onRetry(refund, executeNow),
              onFail: () => onFail(refund),
              onCancel: () => onCancel(refund)
            }}
          />
        )}
      />
    </div>
  );
}
