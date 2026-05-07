import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  Ticket,
  WalletCards,
} from 'lucide-react';
import DarkPageLayout from '../components/DarkPageLayout';
import UserLoadingState from '../components/UserLoadingState';
import { createBooking } from '../services/BookingService';
import { getPendingLogoutRedirect } from '../services/AuthService';
import { useValidateAuth } from '../hooks/useValidateAuth';
import { extractErrorMessage, reportUiError } from '../utils/uiError';
import {
  readBookingCheckoutDraft,
  removeBookingCheckoutDraft,
  type BookingCheckoutDraft,
} from '../utils/bookingCheckoutDraft';

const CHECKOUT_CSS = `
  .checkout-shell { max-width:1120px; margin:0 auto; }
  .checkout-top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:22px; }
  .checkout-back { display:inline-flex; align-items:center; gap:8px; color:#777; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
  .checkout-back:hover { color:#22c55e; }
  .checkout-layout { display:grid; grid-template-columns:minmax(0,1.1fr) 380px; gap:22px; align-items:start; }
  .checkout-card { background:#0f0f0f; border:1px solid rgba(255,255,255,.07); border-radius:24px; overflow:hidden; }
  .checkout-card-pad { padding:24px; }
  .checkout-hero { position:relative; padding:28px; border-bottom:1px solid rgba(255,255,255,.07); overflow:hidden; }
  .checkout-hero::before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 10% 0%, rgba(34,197,94,.22), transparent 34%), linear-gradient(135deg, rgba(34,197,94,.08), transparent 46%); pointer-events:none; }
  .checkout-hero-content { position:relative; z-index:1; }
  .checkout-pill { display:inline-flex; align-items:center; gap:8px; height:30px; padding:0 11px; border-radius:999px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.22); color:#4ade80; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
  .checkout-title { margin:14px 0 7px; color:#f5f5f5; font-size:clamp(28px,4vw,46px); line-height:.98; font-weight:900; letter-spacing:-.06em; }
  .checkout-copy { margin:0; max-width:560px; color:#777; font-size:14px; line-height:1.6; font-weight:600; }
  .checkout-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .checkout-detail { min-height:88px; border-radius:18px; background:#0a0a0a; border:1px solid rgba(255,255,255,.06); padding:14px; }
  .checkout-label { display:flex; align-items:center; gap:7px; color:#555; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; margin-bottom:9px; }
  .checkout-value { margin:0; color:#f2f2f2; font-size:14px; line-height:1.35; font-weight:850; }
  .checkout-summary { position:sticky; top:88px; }
  .checkout-price { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:22px; border-bottom:1px solid rgba(255,255,255,.07); background:linear-gradient(135deg, rgba(34,197,94,.09), rgba(34,197,94,.025)); }
  .checkout-price-label { margin:0; color:#777; font-size:10px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; }
  .checkout-price-value { margin:5px 0 0; color:#4ade80; font-size:34px; font-weight:900; letter-spacing:-.06em; }
  .payment-option { display:flex; align-items:flex-start; gap:12px; border-radius:18px; padding:14px; border:1px solid rgba(255,255,255,.08); background:#0a0a0a; }
  .payment-option.active { border-color:rgba(34,197,94,.28); background:rgba(34,197,94,.055); }
  .payment-option.disabled { opacity:.55; }
  .payment-icon { width:38px; height:38px; border-radius:14px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; background:rgba(255,255,255,.05); color:#777; }
  .payment-option.active .payment-icon { background:rgba(34,197,94,.12); color:#22c55e; }
  .payment-title { margin:0; color:#f2f2f2; font-size:13px; font-weight:850; }
  .payment-copy { margin:4px 0 0; color:#666; font-size:12px; line-height:1.45; font-weight:600; }
  .checkout-error { border:1px solid rgba(248,113,113,.22); background:rgba(248,113,113,.08); color:#fca5a5; border-radius:16px; padding:13px 14px; font-size:13px; font-weight:700; line-height:1.45; }
  .checkout-actions { display:flex; gap:10px; padding-top:16px; }
  .checkout-secondary,.checkout-primary { height:48px; border-radius:15px; font-family:'Sora',system-ui,sans-serif; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; }
  .checkout-secondary { flex:0 0 auto; min-width:116px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.045); color:#aaa; }
  .checkout-primary { flex:1; border:none; background:#22c55e; color:#052010; }
  .checkout-primary:disabled { cursor:not-allowed; opacity:.65; }
  .checkout-success { max-width:720px; margin:0 auto; text-align:center; }
  .checkout-success-icon { width:68px; height:68px; border-radius:22px; margin:0 auto 18px; display:flex; align-items:center; justify-content:center; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.25); color:#22c55e; }
  @media(max-width:920px){
    .checkout-layout { grid-template-columns:1fr; }
    .checkout-summary { position:static; }
  }
  @media(max-width:620px){
    .checkout-top { align-items:flex-start; flex-direction:column; }
    .checkout-grid { grid-template-columns:1fr; }
    .checkout-actions { flex-direction:column; }
    .checkout-secondary { width:100%; }
  }
`;

const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;

const parseDraftDate = (date: string) => {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDraftDateLabels = (draft: BookingCheckoutDraft) => {
  const date = parseDraftDate(draft.date);
  if (!date) {
    return { longDate: draft.date, shortDate: draft.date };
  }
  return {
    longDate: date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }),
    shortDate: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
};

const getTimeRange = (draft: BookingCheckoutDraft) => {
  const minutes = Number(draft.durationMinutes || 0);
  const [hour, minute] = String(draft.slotTime || '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(minutes)) return draft.slotTime;
  const start = new Date(2000, 0, 1, hour, minute);
  const end = new Date(start.getTime() + minutes * 60000);
  const format = (date: Date) => date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${format(start)} - ${format(end)}`;
};

const formatSlugLabel = (value: string) =>
  String(value || '')
    .split('-')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

export default function CheckoutPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth();
  const [draft, setDraft] = useState<BookingCheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const draftId = typeof router.query.draft === 'string' ? router.query.draft : '';
    setDraft(readBookingCheckoutDraft(draftId));
    setDraftLoaded(true);
  }, [router.isReady, router.query.draft]);

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/checkout')}`);
  }, [authChecked, router, user]);

  const dateLabels = useMemo(() => (draft ? getDraftDateLabels(draft) : null), [draft]);
  const timeRange = useMemo(() => (draft ? getTimeRange(draft) : ''), [draft]);
  const backHref = draft?.clubSlug ? `/club/${draft.clubSlug}` : '/';
  const checkoutBreadcrumbs = useMemo(() => {
    const items: Array<{ label: string; href?: string }> = [{ label: 'Inicio', href: '/' }];
    if (draft?.clubSlug) {
      items.push({ label: 'Complejos', href: '/complejos' });
      items.push({ label: formatSlugLabel(draft.clubSlug) || 'Club', href: `/club/${draft.clubSlug}` });
    }
    items.push({ label: confirmedBookingId !== null ? 'Confirmación' : 'Checkout' });
    return items;
  }, [confirmedBookingId, draft?.clubSlug]);

  const handleConfirm = async () => {
    if (!draft || submitting) return;
    const date = parseDraftDate(draft.date);
    if (!date) {
      setSubmitError('No pudimos leer la fecha de la reserva. Volvé a elegir el turno.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');
      const result = await createBooking(draft.courtId, draft.activityId, date, draft.slotTime, {
        durationMinutes: draft.durationMinutes,
        applyDiscount: false,
      });
      const booking = (result as any)?.booking || result;
      const bookingId = String(booking?.id || (result as any)?.bookingId || '').trim();
      removeBookingCheckoutDraft(draft.id);
      setConfirmedBookingId(bookingId || 'created');
    } catch (error) {
      const message = extractErrorMessage(error, 'No pudimos confirmar la reserva. Intentá nuevamente.');
      reportUiError({ area: 'CheckoutPage', action: 'confirmBooking' }, error);
      if (message.toLowerCase().includes('sesión expirada') || message.toLowerCase().includes('sesion expirada')) {
        void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/checkout')}`);
        return;
      }
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked || !draftLoaded) {
    return <UserLoadingState mode="page" message="Preparando checkout..." />;
  }

  if (!draft) {
    return (
      <DarkPageLayout title="Checkout | TuCancha" extraCss={CHECKOUT_CSS} breadcrumbs={checkoutBreadcrumbs}>
        <main className="tc-page-sm">
          <section className="checkout-card checkout-card-pad checkout-success">
            <div className="checkout-success-icon">
              <Ticket size={30} />
            </div>
            <h1 className="checkout-title">No encontramos esta reserva</h1>
            <p className="checkout-copy" style={{ margin: '0 auto 24px' }}>
              El resumen pudo haber vencido o se abrió desde otra pestaña. Volvé a elegir el turno para continuar.
            </p>
            <Link href="/" className="checkout-primary" style={{ maxWidth: 260, margin: '0 auto' }}>
              Buscar turno
            </Link>
          </section>
        </main>
      </DarkPageLayout>
    );
  }

  if (confirmedBookingId !== null) {
    return (
      <DarkPageLayout title="Reserva confirmada | TuCancha" extraCss={CHECKOUT_CSS} breadcrumbs={checkoutBreadcrumbs}>
        <main className="tc-page-sm">
          <section className="checkout-card checkout-card-pad checkout-success">
            <div className="checkout-success-icon">
              <CheckCircle2 size={34} />
            </div>
            <span className="checkout-pill">
              <ShieldCheck size={13} />
              Reserva creada
            </span>
            <h1 className="checkout-title">Tu turno quedó reservado</h1>
            <p className="checkout-copy" style={{ margin: '0 auto 22px' }}>
              Guardamos la reserva en el club. Podés verla desde Mis Reservas cuando necesites revisar el horario.
            </p>
            <div className="checkout-card" style={{ textAlign: 'left', marginBottom: 20 }}>
              <div className="checkout-card-pad checkout-grid">
                <div className="checkout-detail">
                  <div className="checkout-label"><Calendar size={14} /> Fecha</div>
                  <p className="checkout-value" style={{ textTransform: 'capitalize' }}>{dateLabels?.longDate}</p>
                </div>
                <div className="checkout-detail">
                  <div className="checkout-label"><Clock size={14} /> Horario</div>
                  <p className="checkout-value">{timeRange}</p>
                </div>
                <div className="checkout-detail">
                  <div className="checkout-label"><MapPin size={14} /> Cancha</div>
                  <p className="checkout-value">{draft.courtName}</p>
                </div>
                <div className="checkout-detail">
                  <div className="checkout-label"><Ticket size={14} /> Total</div>
                  <p className="checkout-value">{formatMoney(draft.price)}</p>
                </div>
              </div>
            </div>
            <div className="checkout-actions">
              <Link href={backHref} className="checkout-secondary">Reservar otro</Link>
              <Link href="/bookings" className="checkout-primary">Ver mis reservas</Link>
            </div>
          </section>
        </main>
      </DarkPageLayout>
    );
  }

  return (
    <DarkPageLayout title="Checkout | TuCancha" extraCss={CHECKOUT_CSS} breadcrumbs={checkoutBreadcrumbs}>
      <main className="tc-page">
        <div className="checkout-shell">
          <div className="checkout-top">
            <Link href={backHref} className="checkout-back">
              <ArrowLeft size={15} />
              Volver al club
            </Link>
          </div>

          <div className="checkout-layout">
            <section className="checkout-card">
              <div className="checkout-hero">
                <div className="checkout-hero-content">
                  <span className="checkout-pill">
                    <ShieldCheck size={13} />
                    Revisá antes de pagar
                  </span>
                  <h1 className="checkout-title">Ya casi terminamos</h1>
                  <p className="checkout-copy">
                    Confirmá que los datos del turno sean correctos.
                  </p>
                </div>
              </div>

              <div className="checkout-card-pad">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(34,197,94,.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ticket size={19} />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#f2f2f2', fontSize: 17, fontWeight: 900 }}>{draft.activityName}</p>
                    <p style={{ margin: '2px 0 0', color: '#666', fontSize: 13, fontWeight: 650 }}>{draft.courtName}</p>
                  </div>
                </div>

                <div className="checkout-grid">
                  <div className="checkout-detail">
                    <div className="checkout-label"><Calendar size={14} /> Fecha</div>
                    <p className="checkout-value" style={{ textTransform: 'capitalize' }}>{dateLabels?.longDate}</p>
                  </div>
                  <div className="checkout-detail">
                    <div className="checkout-label"><Clock size={14} /> Horario</div>
                    <p className="checkout-value">{timeRange}</p>
                  </div>
                  <div className="checkout-detail">
                    <div className="checkout-label"><MapPin size={14} /> Cancha</div>
                    <p className="checkout-value">{draft.courtName}</p>
                  </div>
                  <div className="checkout-detail">
                    <div className="checkout-label"><Ticket size={14} /> Duración</div>
                    <p className="checkout-value">{draft.durationMinutes} min</p>
                  </div>
                </div>
              </div>
            </section>

            <aside className="checkout-card checkout-summary">
              <div className="checkout-price">
                <div>
                  <p className="checkout-price-label">Total del turno</p>
                  <p className="checkout-price-value">{formatMoney(draft.price)}</p>
                </div>
                <div style={{ textAlign: 'right', color: '#777', fontSize: 12, lineHeight: 1.55, fontWeight: 650 }}>
                  {draft.lightsExtraApplied > 0.009 && (
                    <div>Luces +{formatMoney(draft.lightsExtraApplied)}{draft.lightsFromHour ? ` desde ${draft.lightsFromHour}` : ''}</div>
                  )}
                  {draft.discountAmount > 0.009 && <div style={{ color: '#4ade80' }}>Descuento -{formatMoney(draft.discountAmount)}</div>}
                  {draft.lightsExtraApplied <= 0.009 && draft.discountAmount <= 0.009 && <div>Pago en el club</div>}
                </div>
              </div>

              <div className="checkout-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="payment-option active">
                  <div className="payment-icon"><WalletCards size={18} /></div>
                  <div>
                    <p className="payment-title">Pago en el club</p>
                    <p className="payment-copy">Confirmás el turno ahora y el club gestiona el cobro en caja.</p>
                  </div>
                </div>

                <div className="payment-option disabled">
                  <div className="payment-icon"><CreditCard size={18} /></div>
                  <div>
                    <p className="payment-title">Seña online</p>
                    <p className="payment-copy">Preparado para habilitar pago parcial o total cuando activemos proveedor.</p>
                  </div>
                </div>

                {submitError && <div className="checkout-error">{submitError}</div>}

                <div className="checkout-actions">
                  <Link href={backHref} className="checkout-secondary">Volver</Link>
                  <button
                    type="button"
                    className="checkout-primary"
                    onClick={() => { void handleConfirm(); }}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'tc-spin .8s linear infinite' }} />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} />
                        Confirmar reserva
                      </>
                    )}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </DarkPageLayout>
  );
}
