import React from 'react';
import type { RefundDraft, RefundReasonType } from '../../../modules/refunds/refund.types';
import { REFUND_REASON_OPTIONS } from '../../../modules/refunds/refund.constants';

type RefundRequestModalProps = {
  show: boolean;
  title?: string;
  paymentId?: string;
  maxAmount: number;
  draft: RefundDraft;
  submitting?: boolean;
  closeLabel?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: () => void;
  onChangeDraft: (next: RefundDraft) => void;
};

export default function RefundRequestModal({
  show,
  title = 'Gestion de devolucion',
  paymentId,
  maxAmount,
  draft,
  submitting = false,
  closeLabel = 'Cancelar',
  submitLabel = 'Confirmar devolucion',
  onClose,
  onSubmit,
  onChangeDraft
}: RefundRequestModalProps) {
  if (!show) return null;

  const setDraft = (patch: Partial<RefundDraft>) => {
    onChangeDraft({ ...draft, ...patch });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#347048]/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#EBE1D8] border-4 border-white/60 rounded-[1.5rem] shadow-2xl p-6 text-[#347048] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black uppercase italic">{title}</h3>
            {paymentId ? (
              <p className="text-xs font-black uppercase tracking-widest text-[#347048]/60">Pago: {paymentId}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8 px-3 rounded-lg border border-[#347048]/20 text-xs font-black uppercase"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#347048]/60 mb-1">Monto</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.amountInput}
              onChange={(e) => setDraft({ amountInput: e.target.value })}
              className="w-full h-10 border rounded-lg px-3 bg-white"
            />
            <p className="text-[11px] text-[#347048]/60 mt-1">Maximo: ${Number(maxAmount || 0).toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#347048]/60 mb-1">Tipo</label>
            <select
              value={draft.reasonType}
              onChange={(e) => setDraft({ reasonType: e.target.value as RefundReasonType })}
              className="w-full h-10 border rounded-lg px-3 bg-white"
            >
              {REFUND_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#347048]/60 mb-1">Nota operativa</label>
            <textarea
              value={draft.executionNotes}
              onChange={(e) => setDraft({ executionNotes: e.target.value })}
              rows={3}
              maxLength={500}
              className="w-full border rounded-lg px-3 py-2 bg-white resize-none"
              placeholder="Detalle interno"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={draft.executeNow}
              onChange={(e) => setDraft({ executeNow: e.target.checked })}
            />
            Ejecutar ahora
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-lg border border-[#347048]/20 text-xs font-black uppercase"
          >
            {closeLabel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="h-10 rounded-lg bg-[#347048] text-[#EBE1D8] text-xs font-black uppercase disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
