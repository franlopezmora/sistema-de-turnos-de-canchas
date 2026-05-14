import { useEffect, useMemo, useState } from 'react';
import {
  ClubAdminService,
  type ClientDuplicateIncident
} from '../../services/ClubAdminService';
import { getActiveClubSlug, normalizeSessionUser } from '../../utils/session';
import { extractErrorMessage } from '../../utils/uiError';
import { AdminFeedbackBanner } from './ui/AdminFeedback';

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
  const [feedback, setFeedback] = useState<string>('');
  const [incidents, setIncidents] = useState<ClientDuplicateIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<ClientDuplicateIncident | null>(null);

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

  const handleResolve = async (clientId: string) => {
    if (!clubSlug || !detail?.id || !clientId) return;
    setBusy(true);
    setFeedback('');
    setError('');
    try {
      await ClubAdminService.resolveClientDuplicateIncidentLink(clubSlug, detail.id, clientId);
      setFeedback('Incidente resuelto y vínculo aplicado.');
      await loadIncidents(clubSlug);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'No se pudo resolver el incidente'));
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    if (!clubSlug || !detail?.id) return;
    setBusy(true);
    setFeedback('');
    setError('');
    try {
      await ClubAdminService.dismissClientDuplicateIncident(clubSlug, detail.id);
      setFeedback('Incidente descartado.');
      await loadIncidents(clubSlug);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'No se pudo descartar el incidente'));
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
      {feedback ? <AdminFeedbackBanner tone="success">{feedback}</AdminFeedbackBanner> : null}

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
                        onClick={() => handleResolve(client.id)}
                        className="mt-2 h-9 rounded-lg bg-ink-900 px-3 text-[12px] font-semibold text-ink-50 disabled:opacity-50"
                      >
                        Vincular usuario a este cliente
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDismiss}
                  className="h-9 rounded-lg border border-p-border bg-p-surface px-3 text-[12px] font-semibold text-p-text-secondary hover:bg-p-surface-2 disabled:opacity-50"
                >
                  Descartar incidente
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
