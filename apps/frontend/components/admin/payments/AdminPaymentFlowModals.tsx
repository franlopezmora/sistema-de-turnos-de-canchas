import { X } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';

type PaymentSummaryRow = {
  label: string;
  value: string;
};

type PaymentConceptRow = {
  id: string;
  label: string;
  value: string;
};

type BackdropHandlers = {
  onBackdropPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onBackdropPointerUp: (event: PointerEvent<HTMLElement>) => void;
};

type AdminPaymentPreconfirmModalProps = BackdropHandlers & {
  title?: string;
  subtitle?: string;
  summaryTitle?: string;
  methodLabel?: string;
  methodValue: string;
  summaryRows: PaymentSummaryRow[];
  conceptTitle?: string;
  conceptRows?: PaymentConceptRow[];
  showConcepts?: boolean;
  backLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

type AdminPaymentResultModalProps = BackdropHandlers & {
  title: string;
  detail: string;
  variant: 'success' | 'error' | 'partial';
  summaryRows: PaymentSummaryRow[];
  conceptTitle?: string;
  conceptRows?: PaymentConceptRow[];
  closeLabel?: string;
  retryLabel?: string;
  onClose: () => void;
  onRetry?: (() => void) | null;
};

type AdminPaymentFormModalProps = BackdropHandlers & {
  title: string;
  subtitle: string;
  onClose: () => void;
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
};

const headerColorByVariant: Record<AdminPaymentResultModalProps['variant'], string> = {
  success: 'text-[#22724a]',
  partial: 'text-[#9a5a00]',
  error: 'text-[#b42346]',
};

export function AdminPaymentFormModal({
  title,
  subtitle,
  onClose,
  onBackdropPointerDown,
  onBackdropPointerUp,
  bodyClassName = 'space-y-3 overflow-hidden px-4 py-3',
  children,
  footer,
}: AdminPaymentFormModalProps) {
  return (
    <div
      className="fixed inset-0 z-[2147483200] flex items-center justify-center p-4 bg-[#0d1326]/45"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={onBackdropPointerUp}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-[#dce2ee] bg-white shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
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
          <div className={bodyClassName}>{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-[#eef1f6] px-4 py-3">{footer}</div>
          ) : null}
        </div>
    </div>
  );
}

export function AdminPaymentPreconfirmModal({
  title = 'Confirmar cobro',
  subtitle = 'Revisa estos datos antes de confirmar.',
  summaryTitle = 'Resumen final',
  methodLabel = 'Metodo',
  methodValue,
  summaryRows,
  conceptTitle = 'Conceptos que cubre',
  conceptRows = [],
  showConcepts = true,
  backLabel = 'Editar cobro',
  confirmLabel = 'Confirmar cobro',
  confirmDisabled = false,
  onBack,
  onClose,
  onConfirm,
  onBackdropPointerDown,
  onBackdropPointerUp,
}: AdminPaymentPreconfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[2147483250] bg-[#11162a]/35 flex items-center justify-center p-4"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={onBackdropPointerUp}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[#e0e5f2] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#edf1f6]">
          <div>
            <h3 className="text-[22px] font-bold tracking-[-0.01em] text-[#222a3d]">{title}</h3>
            <p className="mt-1 text-[12px] text-[#6f7890]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[#e2e6ef] grid place-items-center text-[#7a8398] hover:bg-[#f7f9fc]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="rounded-lg border border-[#e0e5f2] bg-white">
            <div className="border-b border-[#edf1f6] px-3 py-2 text-[12px] font-semibold text-[#4b5672]">
              {summaryTitle}
            </div>
            <div className="divide-y divide-[#eef2f8] text-[13px]">
              {summaryRows.map((row) => (
                <div key={`summary-row-${row.label}`} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[#6f7890]">{row.label}</span>
                  <strong className="text-[#1f2a44]">{row.value}</strong>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#6f7890]">{methodLabel}</span>
                <strong className="text-[#1f2a44]">{methodValue}</strong>
              </div>
            </div>
          </div>
          {showConcepts && (
            <div className="rounded-lg border border-[#e0e5f2] bg-white">
              <div className="border-b border-[#edf1f6] px-3 py-2 text-[12px] font-semibold text-[#4b5672]">
                {conceptTitle}
              </div>
              {conceptRows.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[#7a8398]">No hay conceptos seleccionados.</p>
              ) : (
                <div className="max-h-44 overflow-auto divide-y divide-[#eef2f8]">
                  {conceptRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between px-3 py-2 text-[12px] text-[#44506b]">
                      <span className="truncate pr-2">{row.label}</span>
                      <strong className="text-[#2a3245]">{row.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-xl border border-[#dbe2ef] bg-white px-4 text-sm font-semibold text-[#4e5870] hover:bg-[#f7f9fc]"
            >
              {backLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="h-10 rounded-xl bg-[#3053e2] px-5 text-white text-sm font-bold hover:bg-[#2748cc] disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPaymentResultModal({
  title,
  detail,
  variant,
  summaryRows,
  conceptTitle = 'Conceptos aplicados',
  conceptRows = [],
  closeLabel = 'Entendido',
  retryLabel = 'Reintentar',
  onClose,
  onRetry,
  onBackdropPointerDown,
  onBackdropPointerUp,
}: AdminPaymentResultModalProps) {
  return (
    <div
      className="fixed inset-0 z-[2147483250] bg-[#11162a]/35 flex items-center justify-center p-4"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={onBackdropPointerUp}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[#e0e5f2] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#edf1f6]">
          <h3 className={`text-[22px] font-bold tracking-[-0.01em] ${headerColorByVariant[variant]}`}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[#e2e6ef] grid place-items-center text-[#7a8398] hover:bg-[#f7f9fc]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-[14px] text-[#4b556d]">{detail}</p>
          <div className="grid grid-cols-2 gap-3">
            {summaryRows.map((row) => (
              <div
                key={`result-row-${row.label}`}
                className="rounded-lg bg-[#f7f8fc] px-3 py-2 text-xs text-[#5c6478] flex justify-between"
              >
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          {conceptRows.length > 0 && (
            <div className="rounded-lg border border-[#e0e5f2] bg-white">
              <div className="border-b border-[#edf1f6] px-3 py-2 text-[12px] font-semibold text-[#4b5672]">
                {conceptTitle}
              </div>
              <div className="max-h-44 overflow-auto divide-y divide-[#eef2f8]">
                {conceptRows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between px-3 py-2 text-[12px] text-[#44506b]">
                    <span className="truncate pr-2">{row.label}</span>
                    <strong className="text-[#2a3245]">{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#dbe2ef] bg-white px-4 text-sm font-semibold text-[#4e5870] hover:bg-[#f7f9fc]"
            >
              {closeLabel}
            </button>
            {onRetry && variant !== 'success' && (
              <button
                type="button"
                onClick={onRetry}
                className="h-10 rounded-xl bg-[#3053e2] px-5 text-white text-sm font-bold hover:bg-[#2748cc]"
              >
                {retryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
