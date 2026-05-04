import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import DarkPageLayout from '../components/DarkPageLayout';
import { getMyBookings, cancelBooking } from '../services/BookingService';
import { getMyReviewForBooking, upsertMyClubReview } from '../services/ClubReviewService';
import AppModal from '../components/AppModal';
import { useValidateAuth } from '../hooks/useValidateAuth';
import { getPendingLogoutRedirect } from '../services/AuthService';
import Link from 'next/link';
import RouteTransitionScreen from '../components/RouteTransitionScreen';
import { Calendar, Clock, MapPin, Ticket, ArrowRight, Search, XCircle, CheckCircle2, Star, MessageSquare, X } from 'lucide-react';

const PAGE_CSS = `
  .bk-layout { display:grid; grid-template-columns:1.4fr 1fr; gap:24px; align-items:start; }
  .bk-list-panel { background:#0f0f0f; border:1px solid rgba(255,255,255,.07); border-radius:24px; overflow:hidden; }
  .bk-list-body { padding:0 16px 16px; max-height:68vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
  .bk-list-body::-webkit-scrollbar { width:4px; }
  .bk-list-body::-webkit-scrollbar-track { background:transparent; }
  .bk-list-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:4px; }
  .bk-card { display:flex; align-items:center; gap:16px; padding:16px 18px; background:#111; border:1px solid rgba(255,255,255,.06); border-radius:16px; cursor:pointer; transition:border-color .2s,background .2s; }
  .bk-card:hover { border-color:rgba(34,197,94,.2); background:#161616; }
  .bk-card.bk-selected { border-color:rgba(34,197,94,.45); background:#0d1a0d; }
  .bk-date-box { width:48px; height:48px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; }
  .bk-date-box-active { background:rgba(34,197,94,.15); border:1px solid rgba(34,197,94,.25); }
  .bk-date-box-past { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07); }
  .bk-date-box-cancelled { background:rgba(248,113,113,.08); border:1px solid rgba(248,113,113,.15); }
  .bk-date-day { font-size:20px; font-weight:800; line-height:1; color:#f2f2f2; }
  .bk-date-month { font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#666; }
  .bk-card-club { font-size:15px; font-weight:800; color:#f2f2f2; line-height:1.2; margin-bottom:4px; }
  .bk-card-meta { display:flex; align-items:center; gap:8px; font-size:11px; color:#555; font-weight:600; flex-wrap:wrap; }
  .bk-card-chip { padding:2px 8px; background:rgba(255,255,255,.05); border-radius:6px; font-size:10px; color:#888; font-weight:600; }
  /* Detail panel */
  .bk-detail { background:#0f0f0f; border:1px solid rgba(255,255,255,.07); border-radius:24px; padding:28px; position:sticky; top:84px; }
  .bk-ticket-label { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#22c55e; margin-bottom:20px; }
  .bk-detail-court { font-size:22px; font-weight:800; color:#f2f2f2; letter-spacing:-.02em; line-height:1.1; margin-bottom:6px; }
  .bk-detail-activity { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#555; margin-bottom:24px; }
  .bk-detail-row { display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid rgba(255,255,255,.05); }
  .bk-detail-row:last-of-type { border-bottom:none; }
  .bk-detail-icon { width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; color:#444; flex-shrink:0; }
  .bk-detail-row-label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#444; margin-bottom:3px; }
  .bk-detail-row-val { font-size:14px; font-weight:700; color:#c8c8c8; line-height:1.4; }
  .bk-detail-total { display:flex; align-items:center; justify-content:space-between; padding:20px 0 16px; border-top:1px solid rgba(255,255,255,.08); margin-top:8px; }
  .bk-detail-total-label { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#555; }
  .bk-detail-total-val { font-size:26px; font-weight:800; color:#f2f2f2; letter-spacing:-.03em; }
  .bk-action-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px 16px; border-radius:14px; font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:'Sora',system-ui,sans-serif; border:none; transition:background .15s,transform .15s; text-decoration:none; }
  .bk-action-btn:hover { transform:translateY(-1px); }
  .bk-action-cancel { background:rgba(248,113,113,.08); border:1px solid rgba(248,113,113,.2)!important; color:#f87171; }
  .bk-action-cancel:hover { background:rgba(248,113,113,.15); }
  .bk-action-review { background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2)!important; color:#22c55e; }
  .bk-action-review:hover { background:rgba(34,197,94,.14); }
  .bk-action-rebook { background:#22c55e; color:#052010; }
  .bk-action-rebook:hover { background:#4ade80; }
  /* Empty state */
  .bk-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 32px; text-align:center; gap:16px; }
  .bk-empty-icon { color:#222; }
  .bk-empty-title { font-size:13px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#444; }
  /* Review modal */
  .bk-review-overlay { position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
  .bk-review-panel { background:#111; border:1px solid rgba(255,255,255,.1); border-radius:24px; width:100%; max-width:480px; padding:32px; box-shadow:0 24px 64px rgba(0,0,0,.6); }
  .bk-review-h { font-size:20px; font-weight:800; color:#f2f2f2; letter-spacing:-.02em; margin-bottom:6px; }
  .bk-review-sub { font-size:13px; color:#555; margin-bottom:24px; font-weight:500; }
  .bk-review-stars { display:flex; gap:8px; }
  .bk-review-star { width:40px; height:40px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s,border-color .15s; color:#555; }
  .bk-review-star.bk-star-on { background:rgba(34,197,94,.15); border-color:rgba(34,197,94,.3); color:#22c55e; }
  .bk-review-textarea { width:100%; background:#0a0a0a; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:14px 16px; color:#f2f2f2; font-family:'Sora',system-ui,sans-serif; font-size:14px; outline:none; resize:none; transition:border-color .2s; }
  .bk-review-textarea:focus { border-color:rgba(34,197,94,.3); }
  @media(max-width:900px){
    .bk-layout { grid-template-columns:1fr; }
    .bk-detail { position:static; }
    .bk-list-body { max-height:50vh; }
  }
`;

export default function MyBookingsPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PAST' | 'CANCELLED'>('ACTIVE');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const selectedDetailRef = useRef<HTMLDivElement | null>(null);
  const bookingRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState<{
    show: boolean;
    title?: string;
    message?: string;
    cancelText?: string;
    confirmText?: string;
    isWarning?: boolean;
    onConfirm?: () => Promise<void> | void;
  }>({ show: false });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const reviewBackdropMouseDownRef = useRef(false);
  const tabRefs = useRef<Record<'ACTIVE' | 'PAST' | 'CANCELLED', HTMLButtonElement | null>>({
    ACTIVE: null, PAST: null, CANCELLED: null
  });

  const closeModal = () => setModalState(p => ({ ...p, show: false, onConfirm: undefined }));

  const showError = (message: string) => setModalState({ show: true, title: 'Error', message, isWarning: true, cancelText: '', confirmText: 'Aceptar' });

  const showConfirm = (options: {
    title: string; message: string; confirmText?: string; cancelText?: string;
    isWarning?: boolean; onConfirm: () => Promise<void> | void;
  }) => {
    setModalState({
      show: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Aceptar',
      cancelText: options.cancelText ?? 'Cancelar',
      isWarning: options.isWarning ?? true,
      onConfirm: async () => { closeModal(); await options.onConfirm(); }
    });
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyBookings(user.id);
      setBookings(data.sort((a: any, b: any) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (authChecked && user) loadData(); }, [authChecked, user, loadData]);

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/bookings')}`);
  }, [authChecked, user, router]);

  const { activeBookings, pastBookings, cancelledBookings } = useMemo(() => {
    const now = new Date();
    const active: any[] = [], past: any[] = [], cancelled: any[] = [];
    bookings.forEach(b => {
      const end = b.endDateTime ? new Date(b.endDateTime) : new Date(b.startDateTime);
      if (b.status === 'CANCELLED') cancelled.push(b);
      else if (b.status === 'COMPLETED' || end.getTime() < now.getTime()) past.push(b);
      else active.push(b);
    });
    return { activeBookings: active, pastBookings: past, cancelledBookings: cancelled };
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    if (activeTab === 'PAST') return pastBookings;
    if (activeTab === 'CANCELLED') return cancelledBookings;
    return activeBookings;
  }, [activeTab, activeBookings, pastBookings, cancelledBookings]);

  useEffect(() => {
    if (selectedBooking && !bookings.some(b => b.id === selectedBooking.id)) setSelectedBooking(null);
  }, [bookings, selectedBooking]);

  useEffect(() => {
    if (!reviewModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !reviewSaving) setReviewModalOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reviewModalOpen, reviewSaving]);

  useEffect(() => {
    if (!selectedBooking) return;
    const el = selectedDetailRef.current;
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
    catch { el.scrollIntoView(); }
  }, [selectedBooking]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });

  const formatWeekday = (date: Date) =>
    date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
      .replace(/^\w/, c => c.toUpperCase());

  const getDuration = (b: any) => {
    if (b.endDateTime) {
      const d = Math.max(0, Math.round((new Date(b.endDateTime).getTime() - new Date(b.startDateTime).getTime()) / 60000));
      if (d) return d;
    }
    return b.activity?.defaultDurationMinutes || 60;
  };

  const formatCurrency = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

  const getConsumptionTotal = (b: any) =>
    Array.isArray(b.items) ? b.items.reduce((t: number, i: any) => t + Number(i.price || 0) * Number(i.quantity || 0), 0) : 0;

  const handleCancel = (id: number) => showConfirm({
    title: 'Cancelar turno',
    message: '¿Seguro que querés cancelar esta reserva?',
    confirmText: 'Cancelar reserva',
    onConfirm: async () => {
      try { await cancelBooking(id); setSelectedBooking(null); loadData(); }
      catch (e: any) { showError('Error: ' + e.message); }
    }
  });

  const handleOpenReviewModal = async (booking: any) => {
    const clubSlug = String(booking?.court?.club?.slug || '').trim();
    const bookingId = Number(booking?.id || 0);
    if (!clubSlug || !Number.isInteger(bookingId) || bookingId <= 0) { showError('No se pudo preparar la reseña para esta reserva'); return; }
    setReviewModalOpen(true);
    setReviewLoading(true);
    try {
      const existing = await getMyReviewForBooking(clubSlug, bookingId);
      if (existing) { setReviewRating(Number(existing.rating || 5)); setReviewComment(String(existing.comment || '')); }
      else { setReviewRating(5); setReviewComment(''); }
    } catch (e: any) {
      showError(e?.message || 'No se pudo cargar tu reseña');
      setReviewModalOpen(false);
    } finally { setReviewLoading(false); }
  };

  const handleSubmitReview = async () => {
    if (!selectedBooking) return;
    const clubSlug = String(selectedBooking?.court?.club?.slug || '').trim();
    const bookingId = Number(selectedBooking?.id || 0);
    if (!clubSlug || !Number.isInteger(bookingId) || bookingId <= 0) { showError('No se pudo identificar la reserva'); return; }
    try {
      setReviewSaving(true);
      await upsertMyClubReview(clubSlug, { bookingId, rating: reviewRating, comment: reviewComment.trim() || null });
      setReviewModalOpen(false);
      setReviewComment('');
      showConfirm({ title: 'Reseña guardada', message: 'Tu reseña fue guardada correctamente.', confirmText: 'Aceptar', cancelText: '', isWarning: false, onConfirm: async () => {} });
    } catch (e: any) {
      showError(e?.message || 'No se pudo guardar la reseña');
    } finally { setReviewSaving(false); }
  };

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando sesion...'} />;
  }

  const TAB_LABELS: Record<'ACTIVE' | 'PAST' | 'CANCELLED', string> = {
    ACTIVE: `Activas${activeBookings.length ? ` (${activeBookings.length})` : ''}`,
    PAST: 'Pasadas',
    CANCELLED: 'Canceladas'
  };

  return (
    <DarkPageLayout title="Mis Reservas | TuCancha" extraCss={PAGE_CSS}>
      <div className="tc-page">

        {/* ── PAGE HEADER ── */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingBottom: 28, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div>
            <span className="tc-page-eyebrow">Mi cuenta</span>
            <h1 className="tc-page-h">Mis <i>reservas</i></h1>
            <p className="tc-page-sub">Próximos partidos e historial</p>
          </div>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#22c55e', color: '#052010', borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}
          >
            + Nueva reserva
          </Link>
        </div>

        {/* ── TABS ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="tc-tabs" style={{ display: 'inline-flex' }}>
            {(['ACTIVE', 'PAST', 'CANCELLED'] as const).map(tab => (
              <button
                key={tab}
                ref={el => { tabRefs.current[tab] = el; }}
                className={`tc-tab${activeTab === tab ? ' tc-active' : ''}`}
                onClick={() => { setActiveTab(tab); setSelectedBooking(null); }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div className="bk-layout">

          {/* LIST PANEL */}
          <div className="bk-list-panel">
            <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#444' }}>
                {visibleBookings.length} {activeTab === 'ACTIVE' ? 'próximas' : activeTab === 'PAST' ? 'pasadas' : 'canceladas'}
              </div>
            </div>
            <div className="bk-list-body" style={{ padding: '16px' }}>
              {loading ? (
                <div className="bk-empty">
                  <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'tc-spin .8s linear infinite' }} />
                  <span style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Cargando...</span>
                </div>
              ) : error ? (
                <div style={{ padding: '20px 16px', background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 12, fontSize: 13, color: '#f87171', fontWeight: 600 }}>
                  {error}
                </div>
              ) : visibleBookings.length === 0 ? (
                <div className="bk-empty">
                  <Search size={40} className="bk-empty-icon" />
                  <div className="bk-empty-title">
                    {activeTab === 'CANCELLED' ? 'Sin cancelaciones' : activeTab === 'PAST' ? 'Sin historial' : 'No hay reservas activas'}
                  </div>
                  {activeTab === 'ACTIVE' && (
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#22c55e', color: '#052010', borderRadius: 999, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', textDecoration: 'none', marginTop: 4 }}>
                      Reservar ahora
                    </Link>
                  )}
                </div>
              ) : (
                visibleBookings.map(booking => {
                  const date = new Date(booking.startDateTime);
                  const isSelected = selectedBooking?.id === booking.id;
                  const boxClass = activeTab === 'ACTIVE' ? 'bk-date-box-active' : activeTab === 'CANCELLED' ? 'bk-date-box-cancelled' : 'bk-date-box-past';
                  const dayColor = activeTab === 'ACTIVE' ? '#22c55e' : activeTab === 'CANCELLED' ? '#f87171' : '#666';
                  return (
                    <div
                      key={booking.id}
                      ref={el => { bookingRefs.current[booking.id] = el; }}
                      tabIndex={-1}
                      className={`bk-card${isSelected ? ' bk-selected' : ''}`}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className={`bk-date-box ${boxClass}`}>
                        <span className="bk-date-day" style={{ color: dayColor }}>{date.getDate()}</span>
                        <span className="bk-date-month">{date.toLocaleString('es-AR', { month: 'short' }).replace('.', '')}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bk-card-club">{booking.court?.club?.name || 'Club'}</div>
                        <div className="bk-card-meta">
                          {booking.activity?.name && <span className="bk-card-chip">{booking.activity.name}</span>}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} /> {formatTime(date)}
                          </span>
                          {booking.court?.name && <span style={{ color: '#444' }}>{booking.court.name}</span>}
                        </div>
                      </div>
                      <ArrowRight size={16} style={{ color: isSelected ? '#22c55e' : '#333', flexShrink: 0, transition: 'color .2s' }} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DETAIL PANEL */}
          {selectedBooking ? (
            <div
              className="bk-detail"
              ref={el => { selectedDetailRef.current = el; }}
              tabIndex={-1}
            >
              <div className="bk-ticket-label">
                <Ticket size={12} /> Ticket de reserva
              </div>
              <div className="bk-detail-court">{selectedBooking.court?.name || 'Cancha'}</div>
              <div className="bk-detail-activity">{selectedBooking.activity?.name || 'Deporte'} · {selectedBooking.court?.club?.name}</div>

              <hr className="tc-divider" style={{ margin: '0 0 16px' }} />

              <div>
                <div className="bk-detail-row">
                  <div className="bk-detail-icon"><Calendar size={16} /></div>
                  <div>
                    <div className="bk-detail-row-label">Fecha</div>
                    <div className="bk-detail-row-val">{formatWeekday(new Date(selectedBooking.startDateTime))}</div>
                  </div>
                </div>
                <div className="bk-detail-row">
                  <div className="bk-detail-icon"><Clock size={16} /></div>
                  <div>
                    <div className="bk-detail-row-label">Horario</div>
                    <div className="bk-detail-row-val">{formatTime(new Date(selectedBooking.startDateTime))} · {getDuration(selectedBooking)} min</div>
                  </div>
                </div>
                <div className="bk-detail-row">
                  <div className="bk-detail-icon"><MapPin size={16} /></div>
                  <div>
                    <div className="bk-detail-row-label">Ubicación</div>
                    <div className="bk-detail-row-val">
                      {Array.from(new Set([
                        selectedBooking.court?.club?.addressLine,
                        selectedBooking.court?.club?.address,
                        selectedBooking.court?.club?.street,
                        selectedBooking.court?.club?.city
                      ].filter(Boolean))).join(', ') || 'Dirección no disponible'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="bk-detail-total">
                <div>
                  <div className="bk-detail-total-label">Total</div>
                  {activeTab === 'PAST' && getConsumptionTotal(selectedBooking) > 0 && (
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>+ consumos: {formatCurrency(getConsumptionTotal(selectedBooking))}</div>
                  )}
                </div>
                <div className="bk-detail-total-val">{formatCurrency(selectedBooking.price || 0)}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTab === 'ACTIVE' && (
                  <button className="bk-action-btn bk-action-cancel" onClick={() => handleCancel(selectedBooking.id)}>
                    <XCircle size={15} /> Cancelar reserva
                  </button>
                )}
                {(activeTab === 'PAST' || activeTab === 'CANCELLED') && selectedBooking.court?.club?.slug && (
                  <>
                    {String(selectedBooking?.status || '') === 'COMPLETED' && (
                      <button className="bk-action-btn bk-action-review" onClick={() => handleOpenReviewModal(selectedBooking)}>
                        <MessageSquare size={15} /> Dejar / editar reseña
                      </button>
                    )}
                    <Link href={`/club/${selectedBooking.court.club.slug}`} className="bk-action-btn bk-action-rebook">
                      <CheckCircle2 size={15} /> Volver a reservar
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.08)', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: 40, textAlign: 'center', gap: 12 }}>
              <Ticket size={48} style={{ color: '#222' }} />
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#333' }}>Seleccioná un turno<br />para ver el ticket</div>
            </div>
          )}

        </div>
      </div>

      {/* ── CONFIRM/ERROR MODAL ── */}
      <AppModal
        show={modalState.show}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        cancelText={modalState.cancelText}
        confirmText={modalState.confirmText}
        isWarning={modalState.isWarning}
        onConfirm={modalState.onConfirm}
      />

      {/* ── REVIEW MODAL ── */}
      {reviewModalOpen && (
        <div
          className="bk-review-overlay"
          onMouseDown={e => { reviewBackdropMouseDownRef.current = e.target === e.currentTarget; }}
          onTouchStart={e => { reviewBackdropMouseDownRef.current = e.target === e.currentTarget; }}
          onClick={e => {
            const started = reviewBackdropMouseDownRef.current;
            reviewBackdropMouseDownRef.current = false;
            if (started && e.target === e.currentTarget && !reviewSaving) setReviewModalOpen(false);
          }}
        >
          <div className="bk-review-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="bk-review-h">Tu reseña del club</div>
              <button onClick={() => setReviewModalOpen(false)} style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div className="bk-review-sub">
              {selectedBooking?.court?.club?.name || 'Club'} · {selectedBooking?.court?.name || 'Cancha'}
            </div>

            {reviewLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#555', fontSize: 13 }}>Cargando reseña...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>Calificación</div>
                  <div className="bk-review-stars">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button key={v} type="button" className={`bk-review-star${reviewRating >= v ? ' bk-star-on' : ''}`} onClick={() => setReviewRating(v)} aria-label={`${v} estrellas`}>
                        <Star size={16} className={reviewRating >= v ? 'fill-current' : ''} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>Comentario (opcional)</div>
                  <textarea
                    className="bk-review-textarea"
                    rows={4}
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value.slice(0, 220))}
                    placeholder="Contá tu experiencia..."
                  />
                  <div style={{ fontSize: 11, color: '#444', textAlign: 'right', marginTop: 4 }}>{reviewComment.length}/220</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                style={{ flex: 1, height: 46, borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,.1)', color: '#888', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={reviewLoading || reviewSaving}
                style={{ flex: 1, height: 46, borderRadius: 12, background: '#22c55e', border: 'none', color: '#052010', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', opacity: (reviewLoading || reviewSaving) ? .5 : 1 }}
              >
                {reviewSaving ? 'Guardando...' : 'Guardar reseña'}
              </button>
            </div>
          </div>
        </div>
      )}

    </DarkPageLayout>
  );
}
