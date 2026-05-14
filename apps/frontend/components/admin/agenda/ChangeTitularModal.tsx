import { ADMIN_Z_INDEX } from '../../../utils/adminZIndex';
import { AdminFeedbackBanner } from '../ui/AdminFeedback';

export type ChangeTitularCandidate = {
  id: string | number;
  name: string;
  phone?: string;
  email?: string;
};

type ChangeTitularModalProps = {
  open: boolean;
  currentTitle: string;
  search: string;
  reason: string;
  candidates: ChangeTitularCandidate[];
  selectedClientId: string;
  selectedCandidate: ChangeTitularCandidate | null;
  loading: boolean;
  submitting: boolean;
  error: string;
  onSearchChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSelectClient: (clientId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ChangeTitularModal({
  open,
  currentTitle,
  search,
  reason,
  candidates,
  selectedClientId,
  selectedCandidate,
  loading,
  submitting,
  error,
  onSearchChange,
  onReasonChange,
  onSelectClient,
  onClose,
  onSubmit,
}: ChangeTitularModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-ink-950/45 px-4"
      style={{ zIndex: ADMIN_Z_INDEX.modal }}
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-p-border bg-p-surface shadow-p-lg">
        <div className="border-b border-p-border px-5 py-4">
          <p className="text-[16px] font-semibold text-p-text">Cambiar titular</p>
          <p className="mt-1 text-[13px] text-p-text-muted">
            Seleccioná manualmente un cliente del club para esta reserva.
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-xl border border-p-border bg-p-surface-2 px-3 py-2 text-[12px] text-p-text-secondary">
            <p>
              <span className="font-semibold text-p-text">Titular actual:</span>{' '}
              {currentTitle || 'Titular actual'}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-p-text">Nuevo titular:</span>{' '}
              {selectedCandidate?.name || 'Seleccioná un cliente'}
            </p>
            <p className="mt-1 text-p-text-muted">
              Si la reserva tiene pagos o movimientos registrados, el sistema puede bloquear el cambio.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por nombre, teléfono o email"
            disabled={submitting}
            className="h-10 w-full rounded-xl border border-p-border bg-p-surface px-3 text-[13px] text-p-text outline-none"
          />

          <div className="max-h-[34vh] space-y-2 overflow-y-auto">
            {loading && (
              <p className="text-[12px] text-p-text-muted">Buscando clientes...</p>
            )}
            {!loading && candidates.length === 0 && (
              <p className="rounded-xl border border-p-border bg-p-surface-2 px-3 py-2 text-[12px] text-p-text-muted">
                Escribí al menos 2 caracteres para buscar.
              </p>
            )}
            {candidates.map((candidate) => {
              const isSelected = String(selectedClientId) === String(candidate.id);
              return (
                <button
                  key={`change-titular-candidate-${candidate.id}`}
                  type="button"
                  onClick={() => onSelectClient(String(candidate.id))}
                  disabled={submitting}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-p-accent bg-p-positive-bg'
                      : 'border-p-border bg-p-surface hover:bg-p-surface-2'
                  } disabled:opacity-50`}
                >
                  <p className="text-[13px] font-semibold text-p-text">{candidate.name}</p>
                  <p className="mt-0.5 text-[12px] text-p-text-muted">
                    {[candidate.phone, candidate.email].filter(Boolean).join(' · ') || 'Sin contacto visible'}
                  </p>
                </button>
              );
            })}
          </div>

          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Motivo (opcional)"
            rows={2}
            disabled={submitting}
            className="w-full rounded-xl border border-p-border bg-p-surface px-3 py-2 text-[13px] text-p-text outline-none"
          />

          {error && (
            <AdminFeedbackBanner tone="error" compact>
              {error}
            </AdminFeedbackBanner>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-p-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-xl border border-p-border bg-p-surface px-4 text-[13px] font-semibold text-p-text-secondary disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !selectedClientId}
            className="h-10 rounded-xl bg-ink-900 px-4 text-[13px] font-semibold text-ink-50 disabled:opacity-40"
          >
            {submitting ? 'Guardando...' : 'Confirmar cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}
