import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
import { addAccountItem, closeAccount, getAccountById, listAccounts, openAccount, registerPayment, type PaymentMethod, type PaymentSource } from '../../services/AccountService';

type AccountRow = {
  id: string;
  sourceType: 'BOOKING' | 'BAR' | 'TABLE' | 'MANUAL';
  sourceId: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt?: string | null;
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

  return (
    <AdminLayout>
      <Head>
        <title>Cuentas | Admin Panel</title>
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
              <option value="MANUAL">MANUAL</option>
              <option value="BAR">BAR</option>
              <option value="TABLE">TABLE</option>
              <option value="BOOKING">BOOKING</option>
            </select>
            <input
              value={newAccount.sourceId}
              onChange={(e) => setNewAccount((prev) => ({ ...prev, sourceId: e.target.value }))}
              placeholder="Source ID"
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
                  <div className="text-xs font-black uppercase tracking-wider">{account.sourceType} · {account.sourceId}</div>
                  <div className="text-xs">Estado: {account.status}</div>
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
                <option value="PRODUCT">PRODUCT</option>
                <option value="BOOKING">BOOKING</option>
                <option value="SERVICE">SERVICE</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
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
                    <span className="font-bold">{item.description} · {item.type}</span>
                    <span>${Number(item.total || 0).toLocaleString()}</span>
                  </div>
                ))}
                {(!detail.items || detail.items.length === 0) && <div className="text-[#347048]/50">Sin items.</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="number" min={0} step="0.01" value={payment.amount} onChange={(e) => setPayment((prev) => ({ ...prev, amount: Number(e.target.value) }))} className="h-10 border rounded-lg px-3" />
              <select value={payment.method} onChange={(e) => setPayment((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))} className="h-10 border rounded-lg px-3">
                <option value="CASH">CASH</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="MERCADO_PAGO">MERCADO_PAGO</option>
                <option value="CARD">CARD</option>
                <option value="OTHER">OTHER</option>
              </select>
              <select value={payment.source} onChange={(e) => setPayment((prev) => ({ ...prev, source: e.target.value as PaymentSource }))} className="h-10 border rounded-lg px-3">
                <option value="POS">POS</option>
                <option value="ONLINE">ONLINE</option>
                <option value="BACKOFFICE">BACKOFFICE</option>
              </select>
              <button
                onClick={async () => {
                  await registerPayment({ accountId: selectedId, amount: payment.amount, method: payment.method, source: payment.source });
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
              <p className="text-[10px] font-black uppercase tracking-widest text-[#347048]/60">Split payments</p>
              {splitPayments.map((splitPayment, index) => (
                <div key={`split-payment-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input type="number" min={0} step="0.01" value={splitPayment.amount} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount: Number(e.target.value) } : entry))} className="h-10 border rounded-lg px-3" />
                  <select value={splitPayment.method} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, method: e.target.value as PaymentMethod } : entry))} className="h-10 border rounded-lg px-3">
                    <option value="CASH">CASH</option>
                    <option value="TRANSFER">TRANSFER</option>
                    <option value="MERCADO_PAGO">MERCADO_PAGO</option>
                    <option value="CARD">CARD</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <select value={splitPayment.source} onChange={(e) => setSplitPayments((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, source: e.target.value as PaymentSource } : entry))} className="h-10 border rounded-lg px-3">
                    <option value="POS">POS</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="BACKOFFICE">BACKOFFICE</option>
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
                  Registrar split
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#347048]/10 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#347048]/60 mb-2">Cuentas cerradas</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {closedAccounts.slice(0, 12).map((account) => (
              <div key={account.id} className="border border-[#347048]/15 rounded-lg px-3 py-2 text-xs">
                <div className="font-black uppercase">{account.sourceType} · {account.sourceId}</div>
                <div>Estado: {account.status}</div>
              </div>
            ))}
            {!loading && closedAccounts.length === 0 && <div className="text-xs font-bold text-[#347048]/50">No hay cuentas cerradas.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
