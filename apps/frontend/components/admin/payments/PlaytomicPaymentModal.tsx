import React from 'react';
import { X } from 'lucide-react';

type PaymentQuickPreset = 'FULL' | 'COURT_ONLY' | 'CUSTOM_ITEMS' | 'MY_SHARE';

type Option = {
  value: string;
  label: string;
};

type PendingItem = {
  id: string;
  type?: string;
  label?: string;
  description?: string;
  remainingAmount: number;
};

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  methodOptions: Option[];
  methodValue: string;
  onMethodChange: (value: string) => void;
  presetOptions: Array<{ id: PaymentQuickPreset; label: string }>;
  selectedPreset: PaymentQuickPreset;
  onPresetChange: (preset: PaymentQuickPreset) => void;
  pendingItems: PendingItem[];
  selectedItemIds: string[];
  customAmountById: Record<string, string>;
  customSelectedTotal: number;
  onSelectAll?: () => void;
  onClear?: () => void;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onItemAmountChange: (itemId: string, value: string) => void;
  amountDraft: string;
  onAmountChange: (value: string) => void;
  maxInlineLabel: string;
  maxFooterLabel: string;
  onClose: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  onBackdropPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onBackdropPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export default function PlaytomicPaymentModal({
  open,
  title,
  subtitle,
  methodOptions,
  methodValue,
  onMethodChange,
  presetOptions,
  selectedPreset,
  onPresetChange,
  pendingItems,
  selectedItemIds,
  customAmountById,
  customSelectedTotal,
  onSelectAll,
  onClear,
  onToggleItem,
  onItemAmountChange,
  amountDraft,
  onAmountChange,
  maxInlineLabel,
  maxFooterLabel,
  onClose,
  onContinue,
  continueLabel = 'Continuar',
  continueDisabled = false,
  onBackdropPointerDown,
  onBackdropPointerUp,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483200] flex items-center justify-center bg-[#0d1326]/45 p-4"
      role="presentation"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={onBackdropPointerUp}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-[#dce2ee] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-4 py-3">
          <div>
            <p className="text-[18px] font-semibold text-[#1f2638]">{title}</p>
            <p className="text-[12px] text-[#707a92]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-[#7e879c] grid place-items-center hover:bg-[#f3f5fa]"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 overflow-hidden px-4 py-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="block">
              <span className="text-[12px] font-medium text-[#79829a]">Método</span>
              <select
                value={methodValue}
                onChange={(event) => onMethodChange(String(event.target.value || ''))}
                className="mt-1 h-11 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[14px] text-[#2a3245] outline-none focus:border-[#3053e2]"
              >
                {methodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[#44506b]">Conceptos a cobrar</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {presetOptions.map((option) => {
                const isActive = selectedPreset === option.id;
                return (
                  <button
                    key={`payment-playtomic-preset-${option.id}`}
                    type="button"
                    onClick={() => onPresetChange(option.id)}
                    className={`h-9 rounded-lg border text-[12px] font-semibold transition ${
                      isActive
                        ? 'border-[#3155df] bg-[#eef2ff] text-[#3155df]'
                        : 'border-[#dce2ee] bg-white text-[#5f6880] hover:bg-[#f5f7fc]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPreset === 'CUSTOM_ITEMS' && (
            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-[#44506b]">Selección manual</p>
                <span className="text-[11px] font-semibold text-[#6f7890]">
                  Total: {customSelectedTotal.toFixed(2)} $
                </span>
                <div className="flex items-center gap-2">
                  {onSelectAll && (
                    <button
                      type="button"
                      onClick={onSelectAll}
                      className="h-7 rounded-md border border-[#d9e0ed] bg-white px-2 text-[11px] font-semibold text-[#4d5875] hover:bg-[#f4f7fc]"
                    >
                      Seleccionar todo
                    </button>
                  )}
                  {onClear && (
                    <button
                      type="button"
                      onClick={onClear}
                      className="h-7 rounded-md border border-[#d9e0ed] bg-white px-2 text-[11px] font-semibold text-[#4d5875] hover:bg-[#f4f7fc]"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 max-h-[180px] overflow-auto rounded-lg border border-[#dce2ee] bg-white p-2">
                {pendingItems.length === 0 ? (
                  <p className="px-1 py-2 text-[12px] text-[#7a8398]">
                    No hay conceptos con deuda pendiente.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {pendingItems.map((item) => {
                      const itemId = String(item.id);
                      const checked = selectedItemIds.includes(itemId);
                      const label =
                        item.type === 'BOOKING'
                          ? 'Cancha'
                          : item.description || item.label || 'Concepto';
                      return (
                        <div
                          key={`payment-playtomic-concept-item-${itemId}`}
                          onClick={() => onToggleItem(itemId, !checked)}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[#f5f7fc]"
                        >
                          <span className="min-w-0 flex items-center gap-2 text-[12px] text-[#2a3245]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => onToggleItem(itemId, event.target.checked)}
                              className="h-4 w-4 accent-[#3053e2]"
                            />
                            <span className="truncate">{label}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-[116px] items-center rounded-md border border-[#dce2ee] bg-white px-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={!checked}
                                onClick={(event) => event.stopPropagation()}
                                value={
                                  checked
                                    ? String(
                                        customAmountById[itemId] ??
                                          Number(item.remainingAmount || 0).toFixed(2)
                                      )
                                    : ''
                                }
                                onChange={(event) => onItemAmountChange(itemId, event.target.value)}
                                className="w-full bg-transparent text-right text-[12px] font-semibold text-[#2a3245] outline-none disabled:text-[#9ca5ba]"
                              />
                              <span className="ml-1 text-[11px] font-semibold text-[#8a92a5]">$</span>
                            </div>
                            <span className="w-[88px] text-right text-[11px] font-semibold text-[#62708f]">
                              {Number(item.remainingAmount || 0).toFixed(2)} $
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-[12px] font-medium text-[#79829a]">Monto final</span>
            <div className="mt-1 h-11 rounded-xl border border-[#dce2ee] bg-white px-3 flex items-center justify-between">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountDraft}
                onChange={(event) => onAmountChange(event.target.value)}
                className="w-full bg-transparent text-[16px] text-[#2a3245] outline-none"
              />
              <span className="text-[15px] font-semibold text-[#8a92a5]">$</span>
            </div>
            <p className="mt-1 text-[11px] text-[#6f7890]">{maxInlineLabel}</p>
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[#79829a]">Monto</span>
            <div className="mt-1 h-11 rounded-xl border border-[#dce2ee] bg-white px-3 flex items-center justify-between">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountDraft}
                onChange={(event) => onAmountChange(event.target.value)}
                className="w-full bg-transparent text-[16px] text-[#2a3245] outline-none"
              />
              <span className="text-[15px] font-semibold text-[#8a92a5]">$</span>
            </div>
            <p className="mt-1 text-[11px] text-[#6f7890]">{maxFooterLabel}</p>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eef1f6] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#dce2ee] px-4 text-[14px] font-semibold text-[#5d667f] hover:bg-[#f7f9fc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className="h-10 rounded-xl bg-[#3053e2] px-4 text-[14px] font-semibold text-white hover:bg-[#2748cc] disabled:opacity-50"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
