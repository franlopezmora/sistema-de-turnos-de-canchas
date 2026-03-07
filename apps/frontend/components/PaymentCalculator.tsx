import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, X } from 'lucide-react';

export interface PaymentCalculatorItem {
  id?: number;
  tempId?: string;
  productName: string;
  quantity: number;
  price: number;
}

export type PaymentCalculatorResult = {
  method: 'CASH' | 'TRANSFER';
  amount: number;
  courtAmount: number;
  paidItemIds: number[];
  selectedItemKeys: Array<string | number>;
};

export interface PaymentCalculatorProps {
  courtPending: number;
  courtBaseTotal?: number;
  cartItems: PaymentCalculatorItem[];
  alreadyPaid: number;
  grandTotal: number;
  onClose: () => void;
  onConfirm: (result: PaymentCalculatorResult) => Promise<void>;
  submitting?: boolean;
}

export default function PaymentCalculator({
  courtPending,
  courtBaseTotal,
  cartItems,
  alreadyPaid,
  grandTotal,
  onClose,
  onConfirm,
  submitting = false
}: PaymentCalculatorProps) {
  const backdropRef = useRef<boolean>(false);
  const initializedSelectionRef = useRef<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [selectedProductKeys, setSelectedProductKeys] = useState<Array<string | number>>([]);
  const [courtPortion, setCourtPortion] = useState<number>(0);

  const safeCourtPending = Math.max(0, Number(courtPending || 0));
  const safeCourtBaseTotal = Math.max(0, Number(courtBaseTotal ?? courtPending ?? 0));
  const quarterBase = safeCourtBaseTotal / 4;
  const halfBase = safeCourtBaseTotal / 2;
  const canSelectQuarter = quarterBase <= safeCourtPending + 0.01;
  const canSelectHalf = halfBase <= safeCourtPending + 0.01;
  const finalPending = Math.max(0, Number(grandTotal || 0) - Number(alreadyPaid || 0));

  const selectedProductsTotal = useMemo(
    () => cartItems
      .filter((item) => selectedProductKeys.includes(item.tempId || item.id || ''))
      .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems, selectedProductKeys]
  );

  const selectedTotal = (Number(courtPortion) || 0) + selectedProductsTotal;
  const amountEntered = Number(paymentAmount) || 0;
  const amountDiff = Math.abs(amountEntered - selectedTotal);
  const hasSelection = selectedTotal > 0;
  const hasAmountMismatch = hasSelection && amountDiff > 0.01;

  const conceptBreakdown = useMemo(() => {
    const rows: Array<{
      key: string;
      label: string;
      total: number;
      paidNow: number;
      debtAfter: number;
      isSelected: boolean;
    }> = [];

    if (safeCourtPending > 0) {
      const selectedCourt = Math.max(0, Number(courtPortion) || 0);
      const paidNow = Math.min(selectedCourt, safeCourtPending);
      rows.push({
        key: 'court',
        label: 'Cancha',
        total: safeCourtPending,
        paidNow,
        debtAfter: Math.max(0, safeCourtPending - paidNow),
        isSelected: paidNow > 0
      });
    }

    for (const item of cartItems) {
      const itemKey = item.tempId || item.id || `${item.productName}-${item.quantity}`;
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
      const isSelected = selectedProductKeys.includes(itemKey);
      const paidNow = isSelected ? itemTotal : 0;
      rows.push({
        key: String(itemKey),
        label: `${item.quantity}x ${item.productName}`,
        total: itemTotal,
        paidNow,
        debtAfter: Math.max(0, itemTotal - paidNow),
        isSelected
      });
    }

    return rows;
  }, [cartItems, courtPortion, safeCourtPending, selectedProductKeys]);

  const summaryPaidNow = conceptBreakdown.reduce((sum, row) => sum + row.paidNow, 0);
  const summaryDebtAfter = conceptBreakdown.reduce((sum, row) => sum + row.debtAfter, 0);
  const unassignedAmount = Math.max(0, amountEntered - selectedTotal);

  useEffect(() => {
    if (initializedSelectionRef.current) return;

    const allProductKeys = cartItems.map((item) => item.tempId || item.id || '');
    const productsTotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const defaultTotal = safeCourtPending + productsTotal;

    setCourtPortion(safeCourtPending);
    setSelectedProductKeys(allProductKeys);
    setPaymentAmount(defaultTotal > 0 ? defaultTotal.toString() : '');

    initializedSelectionRef.current = true;
  }, [cartItems, safeCourtPending]);

  useEffect(() => {
    if (selectedTotal > 0) {
      setPaymentAmount(selectedTotal.toString());
    }
  }, [selectedTotal]);

  useEffect(() => {
    setPaymentAmount('');
    setSelectedProductKeys([]);
    setCourtPortion(0);
  }, [finalPending]);

  const handleSelectAll = () => {
    setCourtPortion(safeCourtPending);
    setSelectedProductKeys(cartItems.map((item) => item.tempId || item.id || ''));
    setPaymentAmount((safeCourtPending + cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)).toString());
  };

  const handleClearSelection = () => {
    setCourtPortion(0);
    setSelectedProductKeys([]);
    setPaymentAmount('');
  };

  const handlePaymentConfirm = async (method: 'CASH' | 'TRANSFER') => {
    if (submitting) return;
    if (!amountEntered || amountEntered <= 0) return;

    const numericItemIds = Array.from(
      new Set(
        selectedProductKeys
          .map((key) => (typeof key === 'number' ? key : null))
          .filter((value): value is number => value !== null)
      )
    );

    if (!hasSelection) {
      alert('Seleccioná al menos un concepto para cobrar.');
      return;
    }

    if (hasAmountMismatch) {
      alert('El monto debe coincidir exactamente con lo seleccionado. Ajustá el monto o la selección.');
      return;
    }

    await onConfirm({
      method,
      amount: amountEntered,
      courtAmount: Number(courtPortion) || 0,
      paidItemIds: numericItemIds,
      selectedItemKeys: selectedProductKeys
    });
  };

  return (
    <div
      className="fixed inset-0 bg-[#347048]/85 flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
      onMouseDown={(event) => {
        backdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const startedOnBackdrop = backdropRef.current;
        backdropRef.current = false;
        if (!submitting && startedOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#EBE1D8] border-4 border-white rounded-[2rem] shadow-2xl shadow-[#347048]/30 max-w-md w-full max-h-[88vh] overflow-hidden relative flex flex-col text-[#347048]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          <div className="sticky top-0 z-20 bg-[#EBE1D8] border-b border-[#347048]/10 px-6 sm:px-7 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black mb-1 uppercase tracking-tight italic text-[#347048]">Registrar pago</h3>
                <p className="text-[#347048]/60 text-[10px] font-black uppercase tracking-[0.2em]">
                  Saldo pendiente: <span className="text-[#347048] font-black text-sm">${finalPending.toLocaleString()}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="bg-red-50 p-2.5 rounded-full shadow-sm hover:scale-110 transition-transform text-red-500 hover:text-white hover:bg-red-500 border border-red-100 shrink-0"
                title="Cerrar ventana"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>
          </div>

        <div className="px-6 sm:px-7 py-6 sm:py-7">

        <div className="bg-white border-2 border-[#B9CF32]/20 rounded-[1.25rem] p-4 mb-5 shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-[#347048]/10 pb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#347048]/70">Qué vas a cobrar</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleSelectAll} disabled={submitting} className="text-[9px] font-black uppercase tracking-widest text-[#347048] bg-[#B9CF32]/30 border border-[#B9CF32]/40 px-2.5 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                Todo
              </button>
              <button type="button" onClick={handleClearSelection} disabled={submitting} className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                Nada
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-44 overflow-y-auto custom-scrollbar">
            {safeCourtPending > 0 && (
              <div className="p-3 bg-[#347048]/5 rounded-xl border border-[#347048]/10">
                <div className="text-[10px] font-black text-[#347048]/60 uppercase tracking-widest mb-2">Alquiler de cancha</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex justify-center items-center p-2 rounded-lg border transition-all ${
                    !canSelectQuarter
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : courtPortion === quarterBase
                        ? 'bg-[#B9CF32]/25 border-[#B9CF32] text-[#347048] cursor-pointer'
                        : 'bg-white border-[#347048]/15 text-[#347048]/60 hover:border-[#B9CF32]/50 cursor-pointer'
                  }`}>
                    <input type="radio" name="court-portion" className="hidden" checked={courtPortion === quarterBase} onChange={() => setCourtPortion(quarterBase)} disabled={!canSelectQuarter || submitting} />
                    <span className="text-xs font-bold">1/4 (${quarterBase.toLocaleString()})</span>
                  </label>
                  <label className={`flex justify-center items-center p-2 rounded-lg border transition-all ${
                    !canSelectHalf
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : courtPortion === halfBase
                        ? 'bg-[#B9CF32]/25 border-[#B9CF32] text-[#347048] cursor-pointer'
                        : 'bg-white border-[#347048]/15 text-[#347048]/60 hover:border-[#B9CF32]/50 cursor-pointer'
                  }`}>
                    <input type="radio" name="court-portion" className="hidden" checked={courtPortion === halfBase} onChange={() => setCourtPortion(halfBase)} disabled={!canSelectHalf || submitting} />
                    <span className="text-xs font-bold">1/2 (${halfBase.toLocaleString()})</span>
                  </label>
                  <label className={`flex justify-center items-center p-2 rounded-lg border cursor-pointer transition-all col-span-2 ${courtPortion === safeCourtPending ? 'bg-[#B9CF32]/25 border-[#B9CF32] text-[#347048]' : 'bg-white border-[#347048]/15 text-[#347048]/60 hover:border-[#B9CF32]/50'}`}>
                    <input type="radio" name="court-portion" className="hidden" checked={courtPortion === safeCourtPending} onChange={() => setCourtPortion(safeCourtPending)} disabled={submitting} />
                    <span className="text-xs font-bold">Saldo (${safeCourtPending.toLocaleString()})</span>
                  </label>
                </div>
              </div>
            )}

            {cartItems.length > 0 && (
              <div className="p-3 bg-[#347048]/5 rounded-xl border border-[#347048]/10">
                <div className="text-[10px] font-black text-[#347048]/60 uppercase tracking-widest mb-2">Consumos extras</div>
                <div className="space-y-2">
                  {cartItems.map((item) => {
                    const itemKey = item.tempId || item.id || `${item.productName}-${item.quantity}`;
                    const isSelected = selectedProductKeys.includes(itemKey);
                    const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
                    return (
                      <label key={itemKey} className={`flex justify-between items-center p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-[#926699]/10 border-[#926699]/30 text-[#926699]' : 'bg-white border-[#347048]/15 text-[#347048]/60 hover:border-[#926699]/30'}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-[#926699] focus:ring-[#926699] border-gray-300"
                            checked={isSelected}
                            disabled={submitting}
                            onChange={(event) => {
                              if (event.target.checked) setSelectedProductKeys((prev) => [...prev, itemKey]);
                              else setSelectedProductKeys((prev) => prev.filter((value) => value !== itemKey));
                            }}
                          />
                          <span className="text-sm font-bold leading-tight">{item.quantity}x {item.productName}</span>
                        </div>
                        <span className="text-sm font-black">${itemTotal.toLocaleString()}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#926699] ml-2 block mb-2">¿Cuánto ingresa ahora?</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[#347048]/40">$</span>
            <input
              type="number"
              value={paymentAmount}
              disabled={submitting}
              onChange={(event) => setPaymentAmount(event.target.value)}
              onWheel={(event) => {
                event.currentTarget.blur();
              }}
              className="w-full bg-white border-2 border-[#347048]/10 focus:border-[#B9CF32] rounded-2xl py-3.5 pl-10 pr-4 text-3xl font-black text-[#347048] outline-none transition-all shadow-sm italic"
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest">
            <span className="text-[#347048]/50">Seleccionado: ${selectedTotal.toLocaleString()}</span>
            <button
              type="button"
              onClick={() => {
                setPaymentAmount(finalPending);
                handleSelectAll();
              }}
              disabled={submitting}
              className="text-[#347048]/40 hover:text-[#926699] transition-colors"
            >
              Completar total
            </button>
          </div>
        </div>

        <div className="mb-5 bg-white border-2 border-[#347048]/10 rounded-[1.25rem] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#347048]/60">Cierre estimado</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#926699]">Pagado / Deuda</p>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
            {conceptBreakdown.map((row) => (
              <div key={row.key} className={`grid grid-cols-12 gap-2 items-center text-[11px] ${row.isSelected ? 'text-[#347048]' : 'text-[#347048]/60'}`}>
                <span className="col-span-5 font-black truncate">{row.label}</span>
                <span className="col-span-3 text-right font-black text-emerald-600">${row.paidNow.toLocaleString()}</span>
                <span className="col-span-4 text-right font-black text-[#926699]">${row.debtAfter.toLocaleString()}</span>
              </div>
            ))}
            {unassignedAmount > 0.01 && (
              <div className="grid grid-cols-12 gap-2 items-center text-[11px] text-amber-700">
                <span className="col-span-5 font-black truncate">Pago sin asignar</span>
                <span className="col-span-7 text-right font-black">${unassignedAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-[#347048]/10 grid grid-cols-12 gap-2 text-[11px] font-black">
            <span className="col-span-5 text-[#347048]/70 uppercase tracking-widest">Totales</span>
            <span className="col-span-3 text-right text-emerald-600">${summaryPaidNow.toLocaleString()}</span>
            <span className="col-span-4 text-right text-[#926699]">${summaryDebtAfter.toLocaleString()}</span>
          </div>
        </div>

        <div className="mb-2">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              type="button"
              onClick={() => handlePaymentConfirm('CASH')}
              disabled={submitting || !paymentAmount || Number(paymentAmount) <= 0 || !hasSelection || hasAmountMismatch}
              className="flex flex-col items-center justify-center p-5 bg-white border-2 border-transparent hover:border-[#B9CF32] rounded-2xl text-[#347048] transition-all hover:scale-[1.02] shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Banknote size={32} strokeWidth={2} className="mb-2 group-hover:scale-110 transition-transform text-[#347048]" />
              <span className="font-black text-[10px] uppercase tracking-widest">Efectivo</span>
            </button>

            <button
              type="button"
              onClick={() => handlePaymentConfirm('TRANSFER')}
              disabled={submitting || !paymentAmount || Number(paymentAmount) <= 0 || !hasSelection || hasAmountMismatch}
              className="flex flex-col items-center justify-center p-5 bg-white border-2 border-transparent hover:border-[#B9CF32] rounded-2xl text-[#347048] transition-all hover:scale-[1.02] shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard size={32} strokeWidth={2} className="mb-2 group-hover:scale-110 transition-transform text-[#347048]" />
              <span className="font-black text-[10px] uppercase tracking-widest">Digital</span>
            </button>
          </div>
        </div>
        </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="w-full mt-3 mb-6 px-6 sm:px-7 text-[#347048]/40 hover:text-[#347048] text-[10px] font-black uppercase tracking-widest hover:underline transition-all"
        >
          Cancelar operación
        </button>
      </div>
    </div>
  );
}
