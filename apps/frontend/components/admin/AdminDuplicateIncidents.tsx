import { useEffect, useMemo, useState } from 'react';
import {
  ClubAdminService,
  type ClientDuplicateIncident
} from '../../services/ClubAdminService';
import { ClientService } from '../../services/ClientService';
import { getActiveClubSlug, normalizeSessionUser } from '../../utils/session';
import { showAdminToast } from '../../utils/adminToast';
import { extractErrorMessage } from '../../utils/uiError';
import { AdminFeedbackBanner } from './ui/AdminFeedback';
import AdminAppModal from './ui/AdminAppModal';

const formatUserName = (user?: { firstName?: string | null; lastName?: string | null } | null) => {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  return `${first} ${last}`.trim() || 'Sin usuario';
};

export default function AdminDuplicateIncidents() {
  const [clubSlug, setClubSlug] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [incidents, setIncidents] = useState<ClientDuplicateIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<ClientDuplicateIncident | null>(null);
  const [linkState, setLinkState] = useState<{
    clientId: string;
    clientName: string;
  } | null>(null);
  const [mergeState, setMergeState] = useState<{
    sourceClientId: string;
    sourceClientName: string;
    targetClientId: string;
  } | null>(null);
  const [mergeNotes, setMergeNotes] = useState('');
  const [dismissConfirmOpen, setDismissConfirmOpen] = useState(false);

  useEffect(() => {
    const resolvedSlug = getActiveClubSlug(normalizeSessionUser(null));
    setClubSlug(resolvedSlug || '');
  }, []);

  const loadIncidents = async (slug: string) => {
    setLoading(true);
    setError('');
    try {
      const rows = await ClubAdminService.listClientDuplicateIncidents(slug, { status: 'OPEN' });
      setIncidents(rows);
      if (rows.length === 0) {
        setSelectedId('');
        setDetail(null);
      } else if (!rows.some((row) => row.id === selectedId)) {
        setSelectedId(rows[0].id);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'No se pudo cargar la bandeja'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clubSlug) return;
    void loadIncidents(clubSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubSlug]);

  useEffect(() => {
    if (!clubSlug || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError('');
    ClubAdminService.getClientDuplicateIncident(clubSlug, selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractErrorMessage(err, 'No se pudo cargar el detalle'));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubSlug, selectedId]);

  const openCount = useMemo(
    () => incidents.filter((incident) => String(incident.status) === 'OPEN').length,
    [incidents]
  );

  const handleResolve = async () => {
    if (!clubSlug || !detail?.id || !linkState?.clientId) return;
    setBusy(true);
    setError('');
    try {
      await ClubAdminService.resolveClientDuplicateIncidentLink(clubSlug, detail.id, linkState.clientId);
      setLinkState(null);
      showAdminToast('Incidente resuelto y vínculo aplicado.');
      await loadIncidents(clubSlug);
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'No se pudo resolver el incidente');
      setError(message);
      showAdminToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    if (!clubSlug || !detail?.id) return;
    setBusy(true);
    setError('');
    try {
      await ClubAdminService.dismissClientDuplicateIncident(clubSlug, detail.id);
      showAdminToast('Incidente descartado.');
      await loadIncidents(clubSlug);
      setDismissConfirmOpen(false);
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'No se pudo descartar el incidente');
      setError(message);
      showAdminToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openResolveLink = (clientId: string, clientName: string) => {
    setLinkState({
      clientId: String(clientId),
      clientName: String(clientName || 'Cliente seleccionado'),
    });
  };

  const openMerge = (sourceClientId: string) => {
    const candidates = detail?.candidateClients || [];
    const source = candidates.find((client) => String(client.id) === String(sourceClientId));
    if (!source) return;
    const preferredTargetId =
      String(detail?.primaryClientId || '').trim() ||
      String(candidates.find((client) => String(client.id) !== String(source.id))?.id || '').trim();
    if (!preferredTargetId || preferredTargetId === String(source.id)) return;
    setMergeNotes('');
    setMergeState({
      sourceClientId: String(source.id),
      sourceClientName: String(source.name || 'Cliente origen'),
      targetClientId: preferredTargetId,
    });
  };

  const handleMerge = async () => {
    if (!clubSlug || !detail?.id || !mergeState?.sourceClientId || !mergeState?.targetClientId) return;
    setBusy(true);
    setError('');
    try {
      await ClientService.mergeByClubSlug(clubSlug, mergeState.sourceClientId, mergeState.targetClientId, {
        incidentId: detail.id,
        resolutionNotes: mergeNotes.trim() || undefined,
      });
      setMergeState(null);
      setMergeNotes('');
      showAdminToast('Incidente resuelto mediante fusión manual.');
      await loadIncidents(clubSlug);
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'No se pudo fusionar el cliente');
      setError(message);
      showAdminToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!clubSlug) {
    return (
      <AdminFeedbackBanner tone="error">
        No se pudo resolver el club activo para mostrar la bandeja.
      </AdminFeedbackBanner>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-p-border bg-p-surface p-5 shadow-p-card">
        <h1 className="text-[18px] font-semibold tracking-tight text-p-text">Posibles clientes duplicados</h1>
        <p className="mt-1 text-[13px] text-p-text-muted">
          Incidentes abiertos: <span className="font-bold">{openCount}</span>
        </p>
      </div>

      {error ? <AdminFeedbackBanner tone="error">{error}</AdminFeedbackBanner> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-p-border bg-p-surface p-4 shadow-p-card lg:col-span-1">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-p-text-muted">Bandeja</h2>
          {loading ? <p className="text-[13px] text-p-text-muted">Cargando...</p> : null}
          {!loading && incidents.length === 0 ? <p className="text-[13px] text-p-text-muted">No hay incidentes abiertos.</p> : null}
          <div className="space-y-2">
            {incidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                onClick={() => setSelectedId(incident.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedId === incident.id ? 'border-p-accent bg-p-positive-bg' : 'border-p-border bg-p-surface-2 hover:bg-p-surface'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-p-text-muted">
                  {incident.sourceType} · {incident.reasonType}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-p-text">
                  Usuario: {formatUserName(incident.user)}
                </div>
                <div className="text-[12px] text-p-text-muted">
                  {Array.isArray(incident.candidateClientIds) ? incident.candidateClientIds.length : 0} candidatos
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-p-border bg-p-surface p-4 shadow-p-card lg:col-span-2">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-p-text-muted">Detalle</h2>
          {!selectedId ? <p className="text-[13px] text-p-text-muted">Seleccioná un incidente.</p> : null}
          {selectedId && busy && !detail ? <p className="text-[13px] text-p-text-muted">Cargando detalle...</p> : null}
          {detail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-p-border bg-p-surface-2 p-3 text-[13px] text-p-text-secondary">
                <p><span className="font-bold">Origen:</span> {detail.sourceType}</p>
                <p><span className="font-bold">Motivo:</span> {detail.reasonType}</p>
                <p><span className="font-bold">Usuario:</span> {formatUserName(detail.user)}</p>
              </div>

              <div className="space-y-2">
                {(detail.candidateClients || []).map((client) => (
                  <div key={client.id} className="rounded-xl border border-p-border bg-p-surface-2 p-3 text-[13px] text-p-text-secondary">
                    <p className="font-semibold text-p-text">{client.name || 'Sin nombre'}</p>
                    <p>Tel: {client.phone || '—'}</p>
                    <p>Email: {client.email || '—'}</p>
                    <p>DNI: {client.dni || '—'}</p>
                    <p>UserId: {client.userId || '—'}</p>
                    {detail.userId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openResolveLink(client.id, client.name || 'Sin nombre')}
                        className="mt-2 h-9 rounded-lg bg-ink-900 px-3 text-[12px] font-semibold text-ink-50 disabled:opacity-50"
                      >
                        Vincular usuario a este cliente
                      </button>
                    ) : null}
                    {(detail.candidateClients || []).length > 1 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openMerge(client.id)}
                        className="mt-2 ml-2 h-9 rounded-lg border border-p-border bg-p-surface px-3 text-[12px] font-semibold text-p-text-secondary disabled:opacity-50"
                      >
                        Fusionar manualmente
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDismissConfirmOpen(true)}
                  className="h-9 rounded-lg border border-p-border bg-p-surface px-3 text-[12px] font-semibold text-p-text-secondary hover:bg-p-surface-2 disabled:opacity-50"
                >
                  Descartar incidente
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <AdminAppModal
        show={dismissConfirmOpen}
        onClose={() => {
          if (busy) return;
          setDismissConfirmOpen(false);
        }}
        title="Descartar incidente"
        isWarning
        confirmText={busy ? 'Descartando...' : 'Descartar incidente'}
        confirmDisabled={busy}
        onConfirm={() => {
          void handleDismiss();
        }}
        message="Vas a cerrar este incidente sin vincular ni fusionar clientes. Esta acción queda como decisión manual del equipo."
      />
      <AdminAppModal
        show={Boolean(linkState)}
        onClose={() => {
          if (busy) return;
          setLinkState(null);
        }}
        title="Confirmar vínculo manual"
        confirmText={busy ? 'Vinculando...' : 'Confirmar vínculo'}
        confirmDisabled={busy || !linkState?.clientId}
        onConfirm={() => {
          void handleResolve();
        }}
        message={
          <div className="space-y-4">
            <p>Vas a vincular manualmente el usuario del incidente con este cliente. Esta acción no se resuelve nunca de forma automática.</p>
            <div className="rounded-xl border border-p-border bg-p-surface-2 p-3 text-[13px] text-p-text-secondary">
              <p><span className="font-semibold text-p-text">Cliente destino:</span> {linkState?.clientName || '-'}</p>
              <p className="mt-1"><span className="font-semibold text-p-text">Usuario del incidente:</span> {formatUserName(detail?.user)}</p>
            </div>
          </div>
        }
      />
      <AdminAppModal
        show={Boolean(mergeState)}
        onClose={() => {
          if (busy) return;
          setMergeState(null);
          setMergeNotes('');
        }}
        title="Fusionar cliente desde incidente"
        isWarning
        confirmText={busy ? 'Fusionando...' : 'Confirmar fusión'}
        confirmDisabled={busy || !mergeState?.sourceClientId || !mergeState?.targetClientId}
        onConfirm={() => {
          void handleMerge();
        }}
        message={
          <div className="space-y-4">
            <p>Esta acción mueve reservas, cuentas y referencias del cliente origen al cliente destino. No hay merge automático.</p>
            <div className="rounded-xl border border-p-border bg-p-surface-2 p-3 text-[13px] text-p-text-secondary">
              <p><span className="font-semibold text-p-text">Origen:</span> {mergeState?.sourceClientName || '-'}</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-[12px] font-medium text-p-text-secondary">Cliente destino</span>
                <select
                  value={mergeState?.targetClientId || ''}
                  onChange={(event) =>
                    setMergeState((prev) => prev ? { ...prev, targetClientId: event.target.value } : prev)
                  }
                  className="h-10 w-full rounded-xl border border-p-border bg-p-surface px-3 text-[13px] text-p-text outline-none focus:border-p-accent"
                >
                  {(detail?.candidateClients || [])
                    .filter((client) => String(client.id) !== String(mergeState?.sourceClientId || ''))
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name || 'Sin nombre'} · {client.phone || client.email || client.id}
                      </option>
                    ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-[12px] font-medium text-p-text-secondary">Nota interna (opcional)</span>
                <textarea
                  value={mergeNotes}
                  onChange={(event) => setMergeNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-p-border bg-p-surface px-3 py-2 text-[13px] text-p-text outline-none focus:border-p-accent"
                  placeholder="Qué revisaste antes de fusionar"
                />
              </label>
            </div>
          </div>
        }
      />
    </div>
  );
}
