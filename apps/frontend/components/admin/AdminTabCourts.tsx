import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, Ban, Plus, Power } from 'lucide-react';
import { getCourts, reactivateCourt, suspendCourt, updateCourtPrice } from '../../services/CourtService';
import { isAuthSessionInvalidatedError } from '../../utils/apiClient';
import AdminAppModal from './ui/AdminAppModal';

export default function AdminTabCourts() {
  const [courts, setCourts] = useState<any[]>([]);
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});
  const [modalState, setModalState] = useState<{
    show: boolean;
    title?: string;
    message?: ReactNode;
    cancelText?: string;
    confirmText?: string;
    isWarning?: boolean;
    onConfirm?: () => Promise<void> | void;
    onCancel?: () => Promise<void> | void;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
  }>({ show: false });

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, show: false, onConfirm: undefined, onCancel: undefined }));
  }, []);

  const wrapAction = useCallback(
    (action?: () => Promise<void> | void) => async () => {
      closeModal();
      await action?.();
    },
    [closeModal]
  );

  const showInfo = useCallback((message: ReactNode, title = 'Informacion') => {
    setModalState({ show: true, title, message, cancelText: '', confirmText: 'OK' });
  }, []);

  const showError = useCallback((message: ReactNode) => {
    setModalState({ show: true, title: 'Error', message, isWarning: true, cancelText: '', confirmText: 'Aceptar' });
  }, []);

  const showConfirm = useCallback(
    (options: {
      title: string;
      message: ReactNode;
      confirmText?: string;
      cancelText?: string;
      isWarning?: boolean;
      onConfirm: () => Promise<void> | void;
      onCancel?: () => Promise<void> | void;
      closeOnBackdrop?: boolean;
      closeOnEscape?: boolean;
    }) =>
      setModalState({
        show: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? 'Aceptar',
        cancelText: options.cancelText ?? 'Cancelar',
        isWarning: options.isWarning ?? true,
        closeOnBackdrop: options.closeOnBackdrop,
        closeOnEscape: options.closeOnEscape,
        onConfirm: wrapAction(options.onConfirm),
        onCancel: options.onCancel ? wrapAction(options.onCancel) : undefined,
      }),
    [wrapAction]
  );

  const loadCourts = useCallback(async () => {
    try {
      const data = await getCourts();
      setCourts(data);
      setPriceEdits((prev) => {
        const next = { ...prev };
        data.forEach((court: any) => {
          if (next[court.id] === undefined) {
            next[court.id] = court.price !== undefined && court.price !== null ? String(court.price) : '';
          }
        });
        return next;
      });
    } catch (error: any) {
      if (isAuthSessionInvalidatedError(error)) return;
      showError(`Error: ${error.message}`);
    }
  }, [showError]);

  useEffect(() => {
    void loadCourts();
  }, [loadCourts]);

  const handleSuspend = async (id: number) => {
    showConfirm({
      title: 'Suspender cancha',
      message: 'Seguro que deseas poner esta cancha en mantenimiento?',
      confirmText: 'Suspender',
      onConfirm: async () => {
        try {
          await suspendCourt(id);
          await loadCourts();
        } catch (error: any) {
          showError(`Error: ${error.message}`);
        }
      },
    });
  };

  const handleReactivate = async (id: number) => {
    showConfirm({
      title: 'Reactivar cancha',
      message: 'Deseas habilitar nuevamente esta cancha para reservas?',
      confirmText: 'Reactivar',
      isWarning: false,
      onConfirm: async () => {
        try {
          await reactivateCourt(id);
          await loadCourts();
        } catch (error: any) {
          showError(`Error: ${error.message}`);
        }
      },
    });
  };

  const handlePriceSave = async (id: number) => {
    try {
      const raw = priceEdits[id];
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showError('Ingresa un precio valido.');
        return;
      }
      await updateCourtPrice(id, parsed);
      showInfo('Precio actualizado', 'Listo');
      await loadCourts();
    } catch (error: any) {
      showError(`Error: ${error.message}`);
    }
  };

  const getCourtTypeLabel = (court: any) => {
    const activityName = String(court?.activityType?.name || '').trim();
    if (activityName) return activityName;
    return String(court?.sport || court?.surface || '-');
  };

  const getPriceReferenceMinutes = (court: any) => {
    const activityName = String(court?.activityType?.name || court?.sport || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .trim();

    if (activityName === 'FUTBOL' || activityName === 'TENIS') return 60;

    const rawDefault = Number(court?.activityType?.defaultDurationMinutes);
    if (Number.isFinite(rawDefault) && rawDefault > 0) return rawDefault;

    return 90;
  };

  const activeCourts = courts.filter((court) => !court.isUnderMaintenance).length;
  const maintenanceCourts = courts.length - activeCourts;
  const averagePrice = courts.length
    ? courts.reduce((sum, court) => sum + Number(court.price || 0), 0) / courts.length
    : 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4 pb-20 lg:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Total</p>
            <p className="mt-1 text-[24px] font-bold text-[#3155df]">{courts.length}</p>
          </div>
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Operativas</p>
            <p className="mt-1 text-[24px] font-bold text-[#2f5e46]">{activeCourts}</p>
          </div>
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Mantenimiento</p>
            <p className="mt-1 text-[24px] font-bold text-[#9a5a00]">{maintenanceCourts}</p>
          </div>
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Precio prom.</p>
            <p className="mt-1 text-[24px] font-bold text-[#27314a]">${Math.round(averagePrice).toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#e7ebf3] bg-[#f8faff] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6f7890]">Calculo de precio</p>
          <p className="mt-1 text-[12px] leading-5 text-[#4e5870]">
            El precio definido es la base para la duracion por defecto de cada actividad. Si la reserva es mas corta o larga, el sistema ajusta el importe de forma proporcional. Para Futbol y Tenis la base es siempre 60 min.
          </p>
        </div>

        {courts.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-[#dce2ee] bg-white py-16 text-sm font-semibold text-[#98a1b3]">
            Sin canchas registradas.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courts.map((court) => (
              <div
                key={court.id}
                className="relative overflow-hidden rounded-xl border border-[#dce2ee] bg-white shadow-[0_8px_26px_rgba(34,42,68,0.05)]"
              >
                <div
                  className={`absolute inset-y-0 left-0 w-[3px] ${
                    court.isUnderMaintenance ? 'bg-red-400' : 'bg-emerald-400'
                  }`}
                />
                <div className="p-5 pl-6">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b95aa]">
                        #{court.id.toString().padStart(3, '0')}
                      </p>
                      <h3 className="mt-0.5 text-[18px] font-semibold text-[#1f2638]">
                        {court.name}
                      </h3>
                    </div>
                    {court.isUnderMaintenance ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ffd6d6] bg-[#fff5f5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#b42318]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d92d20]" />
                        Mantenimiento
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ccebd7] bg-[#f0fbf4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#167647]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#17b26a]" />
                        Operativo
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe4f2] bg-[#f8faff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#5b6680]">
                    <Activity size={11} />
                    {getCourtTypeLabel(court)}
                  </span>

                  <div className="mt-4 rounded-xl border border-[#eef2f8] bg-[#f8faff] p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#8b95aa]">
                      Precio base · {getPriceReferenceMinutes(court)} min
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8b95aa]">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white pl-7 pr-3 text-[13px] font-semibold text-[#27314a] outline-none transition-all focus:border-[#3053e2]"
                          value={priceEdits[court.id] ?? ''}
                          onChange={(event) =>
                            setPriceEdits((prev) => ({ ...prev, [court.id]: event.target.value }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handlePriceSave(court.id)}
                        className="h-10 shrink-0 rounded-lg bg-[#3053e2] px-4 text-[12px] font-semibold text-white transition-all hover:bg-[#2748cc]"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[#f0f3f8] pt-3">
                    {court.isUnderMaintenance ? (
                      <button
                        type="button"
                        onClick={() => void handleReactivate(court.id)}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#17b26a] px-3 text-[12px] font-semibold text-white transition-all hover:bg-[#079455]"
                      >
                        <Power size={13} strokeWidth={2.4} />
                        Reactivar cancha
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSuspend(court.id)}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#ffd6d6] bg-white px-3 text-[12px] font-semibold text-[#b42318] transition-all hover:bg-[#fff5f5]"
                      >
                        <Ban size={13} strokeWidth={2.4} />
                        Poner en mantenimiento
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-[#e7ebf3] bg-[#f8faff] p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#3053e2] shadow-[0_4px_12px_rgba(34,42,68,0.06)]">
            <Plus size={16} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3053e2]">Alta de canchas</p>
            <p className="mt-1 text-[12px] leading-5 text-[#4e5870]">
              Deshabilitada en el panel. Para altas, comunicarse con soporte.
            </p>
          </div>
        </div>

        <AdminAppModal
          show={modalState.show}
          onClose={closeModal}
          onCancel={modalState.onCancel}
          title={modalState.title}
          message={modalState.message}
          cancelText={modalState.cancelText}
          confirmText={modalState.confirmText}
          isWarning={modalState.isWarning}
          onConfirm={modalState.onConfirm}
          closeOnBackdrop={modalState.closeOnBackdrop}
          closeOnEscape={modalState.closeOnEscape}
        />
      </div>
    </div>
  );
}
