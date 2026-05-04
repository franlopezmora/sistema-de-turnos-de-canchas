import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import BookingGrid from '../../components/BookingGrid';
import DarkPageLayout from '../../components/DarkPageLayout';
import { ClubService, Club } from '../../services/ClubService';
import { ClubReviewItem, getClubReviewsSummary, listClubReviews } from '../../services/ClubReviewService';
import { getMyBookings } from '../../services/BookingService';
import { getMyReviewForBooking } from '../../services/ClubReviewService';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { reportUiError } from '../../utils/uiError';
import { isAuthSessionInvalidatedError } from '../../utils/apiClient';
import { MapPin, Calendar, Phone, Instagram, Share2, Trophy, Star, Heart, ChevronRight } from 'lucide-react';

const formatClubAddress = (club: Club) =>
  [club.addressLine, club.city, club.province, club.country].filter(Boolean).join(', ');

const formatRatingLabel = (value: number) => {
  const safe = Number(value || 0);
  if (!Number.isFinite(safe)) return '0';
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
};

const PAGE_CSS = `
  .cl-hero { position:relative; border-radius:24px; overflow:hidden; border:1px solid rgba(255,255,255,.08); margin-bottom:32px; }
  .cl-hero-bg { position:absolute; inset:0; background:linear-gradient(135deg,#0a1f0e 0%,#050505 50%,#0d1a0d 100%); }
  .cl-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .cl-hero-overlay { position:absolute; inset:0; background:linear-gradient(135deg,rgba(5,5,5,.85) 0%,rgba(5,5,5,.6) 60%,rgba(5,5,5,.75) 100%); }
  .cl-hero-body { position:relative; z-index:2; padding:36px 40px 32px; display:flex; align-items:flex-end; gap:28px; flex-wrap:wrap; }
  .cl-logo-wrap { position:relative; flex-shrink:0; }
  .cl-logo { width:100px; height:100px; border-radius:20px; background:#111; border:2px solid rgba(255,255,255,.12); overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .cl-hero-info { flex:1; min-width:0; }
  .cl-hero-rating { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#c8c8c8; margin-bottom:10px; }
  .cl-hero-h { font-size:clamp(28px,4vw,52px); font-weight:800; color:#fff; letter-spacing:-.04em; line-height:1; margin:0 0 12px; }
  .cl-hero-h i { font-style:italic; color:#22c55e; }
  .cl-hero-meta { display:flex; flex-wrap:wrap; gap:16px; align-items:center; }
  .cl-hero-meta-item { display:flex; align-items:center; gap:6px; font-size:13px; color:#c8c8c8; font-weight:500; }
  .cl-hero-actions { display:flex; gap:10px; flex-shrink:0; }
  .cl-icon-btn { width:44px; height:44px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s,border-color .15s,transform .15s; color:#c8c8c8; }
  .cl-icon-btn:hover:not(:disabled) { background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.2); transform:translateY(-1px); }
  .cl-icon-btn.cl-fav-on { background:rgba(34,197,94,.12); border-color:rgba(34,197,94,.3); color:#22c55e; }
  .cl-icon-btn:disabled { opacity:.5; cursor:not-allowed; }
  /* Grid */
  .cl-grid { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:24px; align-items:start; }
  /* Sidebar panels */
  .cl-panel { background:#0f0f0f; border:1px solid rgba(255,255,255,.07); border-radius:18px; padding:22px 24px; }
  .cl-panel-h { font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#444; margin-bottom:16px; }
  .cl-panel-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:#c8c8c8; font-weight:500; line-height:1.5; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.04); }
  .cl-panel-row:last-child { border-bottom:none; }
  .cl-panel-row a { color:#c8c8c8; text-decoration:none; transition:color .15s; }
  .cl-panel-row a:hover { color:#22c55e; }
  .cl-panel-icon { color:#444; flex-shrink:0; margin-top:1px; }
  .cl-day-chip { padding:3px 8px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); border-radius:6px; font-size:10px; font-weight:800; color:#22c55e; }
  /* Reviews */
  .cl-review-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px 16px; }
  .cl-review-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .cl-review-name { font-size:12px; font-weight:800; color:#e8e8e8; letter-spacing:.04em; text-transform:uppercase; }
  .cl-review-score { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:800; color:#22c55e; }
  .cl-review-comment { font-size:13px; color:#888; line-height:1.55; }
  /* Feedback toast */
  .cl-feedback { padding:10px 16px; border-radius:12px; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2); font-size:12px; font-weight:700; color:#4ade80; margin-top:12px; }
  /* Loading/error */
  .cl-loading { min-height:60vh; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:16px; }
  @media(max-width:900px){
    .cl-grid { grid-template-columns:1fr; }
    .cl-hero-body { padding:24px 24px 20px; }
    .cl-hero-h { font-size:28px; }
  }
  @media(max-width:600px){
    .cl-hero-body { flex-direction:column; align-items:flex-start; gap:16px; }
    .cl-hero-actions { align-self:flex-end; }
  }
`;

export default function ClubPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { authChecked, user } = useValidateAuth({ allowGuest: true });
  const [club, setClub] = useState<Club | null>(null);
  const [loadingClub, setLoadingClub] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsSummary, setReviewsSummary] = useState<{ count: number; averageRating: number }>({ count: 0, averageRating: 0 });
  const [reviews, setReviews] = useState<ClubReviewItem[]>([]);
  const [reviewCtaLoading, setReviewCtaLoading] = useState(false);
  const [canReviewClub, setCanReviewClub] = useState(false);
  const [hasExistingClubReview, setHasExistingClubReview] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadClub = async () => {
      if (!slug || typeof slug !== 'string') { setLoadingClub(false); return; }
      try {
        setLoadingClub(true);
        setError(null);
        setClub(await ClubService.getClubBySlug(slug));
      } catch (err: any) {
        reportUiError({ area: 'ClubPage', action: 'loadClubBySlug' }, err);
        setError('Club no encontrado');
      } finally {
        setLoadingClub(false);
      }
    };
    loadClub();
  }, [slug]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!slug || typeof slug !== 'string') return;
      try {
        const [summary, list] = await Promise.all([
          getClubReviewsSummary(slug),
          listClubReviews(slug, { take: 6 })
        ]);
        setReviewsSummary({ count: Number(summary?.count || 0), averageRating: Number(summary?.averageRating || 0) });
        setReviews(Array.isArray(list?.items) ? list.items : []);
      } catch (err) {
        reportUiError({ area: 'ClubPage', action: 'loadClubReviews' }, err);
        setReviewsSummary({ count: 0, averageRating: 0 });
        setReviews([]);
      }
    };
    loadReviews();
  }, [slug]);

  useEffect(() => {
    const loadReviewEligibility = async () => {
      if (!authChecked || !slug || typeof slug !== 'string' || !user?.id) {
        setCanReviewClub(false); setHasExistingClubReview(false); return;
      }
      try {
        setReviewCtaLoading(true);
        const myBookings = await getMyBookings(user.id);
        const completedInClub = Array.isArray(myBookings)
          ? myBookings.filter((b: any) => String(b?.court?.club?.slug || '').trim() === slug && String(b?.status || '') === 'COMPLETED')
          : [];
        if (completedInClub.length === 0) { setCanReviewClub(false); setHasExistingClubReview(false); return; }
        setCanReviewClub(true);
        try {
          const existing = await getMyReviewForBooking(slug, Number(completedInClub[0]?.id || 0));
          setHasExistingClubReview(Boolean(existing));
        } catch { setHasExistingClubReview(false); }
      } catch (err) {
        if (isAuthSessionInvalidatedError(err)) return;
        reportUiError({ area: 'ClubPage', action: 'loadReviewEligibility' }, err);
        setCanReviewClub(false); setHasExistingClubReview(false);
      } finally { setReviewCtaLoading(false); }
    };
    void loadReviewEligibility();
  }, [authChecked, slug, user?.id]);

  useEffect(() => {
    const loadFavoriteState = async () => {
      if (!authChecked || !user?.id || !club?.id) { setIsFavorite(false); return; }
      try {
        const favorites = await ClubService.getMyFavorites();
        const clubId = Number(club.id);
        setIsFavorite(Array.isArray(favorites) && favorites.some((item: any) => Number(item?.clubId) === clubId));
      } catch (err) {
        if (isAuthSessionInvalidatedError(err)) return;
        setIsFavorite(false);
      }
    };
    void loadFavoriteState();
  }, [authChecked, user?.id, club?.id]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.dispatchEvent(new CustomEvent('app:notice', { detail: { message: 'Enlace copiado.' } }));
    } catch (err) { reportUiError({ area: 'ClubPage', action: 'copyShareLink' }, err); }
  };

  const resolveLinkingMessage = (linking: { status?: string; reason?: string } | null | undefined) => {
    const s = String(linking?.status || '');
    if (s === 'linked_existing_client') return 'Favorito guardado y cliente vinculado.';
    if (s === 'created_client') return 'Favorito guardado y cliente creado.';
    if (s === 'already_linked') return 'Favorito guardado. Ya estabas vinculado.';
    if (s === 'duplicate_detected_no_link') return 'Favorito guardado. Detectamos posible duplicado.';
    if (s === 'insufficient_data_no_link') {
      const r = String(linking?.reason || '');
      if (r === 'missing_phone') return 'Favorito guardado. Falta teléfono para vincular.';
      if (r === 'missing_name') return 'Favorito guardado. Falta nombre para vincular.';
      return 'Favorito guardado. Faltan datos para vincular.';
    }
    return 'Favorito guardado.';
  };

  const handleToggleFavorite = async () => {
    if (!club?.id || favoriteBusy) return;
    if (!user?.id) { setFavoriteFeedback('Iniciá sesión para guardar favoritos.'); return; }
    const clubId = Number(club.id);
    if (!Number.isFinite(clubId) || clubId <= 0) return;
    setFavoriteBusy(true);
    setFavoriteFeedback(null);
    try {
      if (isFavorite) {
        await ClubService.unmarkFavorite(clubId);
        setIsFavorite(false);
        setFavoriteFeedback('Favorito eliminado.');
      } else {
        const result = await ClubService.markFavorite(clubId);
        setIsFavorite(true);
        setFavoriteFeedback(resolveLinkingMessage(result?.linking));
      }
    } catch (err) {
      reportUiError({ area: 'ClubPage', action: 'toggleFavorite' }, err);
      setFavoriteFeedback('No se pudo actualizar favorito.');
    } finally { setFavoriteBusy(false); }
  };

  const slugReady = router.isReady && slug && typeof slug === 'string';
  const stillLoading = !slugReady || loadingClub;
  const pageTitle = club?.name ? `${club.name} | TuCancha` : 'Club | TuCancha';

  // ── LOADING STATE ──
  if (stillLoading) {
    return (
      <DarkPageLayout title={pageTitle} extraCss={PAGE_CSS}>
        <div className="cl-loading">
          <div style={{ width: 36, height: 36, border: '3px solid #1a1a1a', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'tc-spin .8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>Cargando club...</span>
        </div>
      </DarkPageLayout>
    );
  }

  // ── ERROR STATE ──
  if (error || !club) {
    return (
      <DarkPageLayout title={pageTitle} extraCss={PAGE_CSS}>
        <div className="cl-loading" style={{ textAlign: 'center', gap: 20 }}>
          <div style={{ fontSize: 48, color: '#222' }}>⚽</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f2f2f2', marginBottom: 8 }}>Club no encontrado</div>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>{error || 'El club solicitado no existe'}</div>
            <button
              onClick={() => router.push('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#22c55e', color: '#052010', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </DarkPageLayout>
    );
  }

  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <DarkPageLayout title={pageTitle} extraCss={PAGE_CSS}>
      <div className="tc-page" style={{ paddingTop: 32 }}>

        {/* ── HERO ── */}
        <div className="cl-hero">
          {/* Background */}
          <div className="cl-hero-bg" />
          {club.clubImageUrl && (
            <>
              <Image
                src={club.clubImageUrl}
                alt={`Banner de ${club.name}`}
                fill
                sizes="100vw"
                className="cl-hero-img"
                unoptimized
              />
              <div className="cl-hero-overlay" />
            </>
          )}

          {/* Body */}
          <div className="cl-hero-body">

            {/* Logo */}
            <div className="cl-logo-wrap">
              <div className="cl-logo">
                {club.logoUrl ? (
                  <Image src={club.logoUrl} alt={club.name} fill sizes="100px" style={{ objectFit: 'contain' }} unoptimized />
                ) : (
                  <Trophy size={32} style={{ color: '#333' }} />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="cl-hero-info">
              {reviewsSummary.count > 0 && (
                <div className="cl-hero-rating">
                  <Star size={13} style={{ color: '#22c55e', fill: '#22c55e' }} />
                  <span style={{ color: '#22c55e', fontWeight: 800 }}>{formatRatingLabel(reviewsSummary.averageRating)}</span>
                  <span style={{ color: '#555' }}>({reviewsSummary.count} reseñas)</span>
                </div>
              )}
              <h1 className="cl-hero-h">{club.name}</h1>
              <div className="cl-hero-meta">
                {(club.addressLine || club.city) && (
                  <span className="cl-hero-meta-item">
                    <MapPin size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                    {[club.addressLine, club.city].filter(Boolean).join(', ')}
                  </span>
                )}
                {club.instagramUrl && (
                  <a
                    href={club.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cl-hero-meta-item"
                    style={{ textDecoration: 'none', transition: 'color .15s' }}
                  >
                    <Instagram size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                    @{club.instagramUrl.replace(/\/$/, '').split('/').pop() || 'Instagram'}
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="cl-hero-actions">
              <button
                className={`cl-icon-btn${isFavorite ? ' cl-fav-on' : ''}`}
                onClick={handleToggleFavorite}
                disabled={favoriteBusy}
                title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                <Heart size={20} style={{ fill: isFavorite ? '#22c55e' : 'none', transition: 'fill .2s' }} />
              </button>
              <button className="cl-icon-btn" onClick={handleShare} title="Copiar enlace">
                <Share2 size={20} />
              </button>
            </div>

          </div>

          {/* Favorite feedback */}
          {favoriteFeedback && (
            <div style={{ position: 'relative', zIndex: 2, padding: '0 40px 20px' }}>
              <div style={{ display: 'inline-flex', padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.12)', fontSize: 12, fontWeight: 700, color: '#c8c8c8' }}>
                {favoriteFeedback}
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN GRID ── */}
        <div className="cl-grid">

          {/* BookingGrid — unchanged */}
          <BookingGrid clubSlug={slug} />

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Info */}
            <div className="cl-panel">
              <div className="cl-panel-h">Información</div>
              {club.description && (
                <p style={{ fontSize: 13, color: '#c8c8c8', lineHeight: 1.6, margin: '0 0 12px', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  {club.description}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(club.addressLine || club.city) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.name + ' ' + formatClubAddress(club))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cl-panel-row"
                  >
                    <MapPin size={14} className="cl-panel-icon" />
                    <span style={{ textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color .15s' }}>
                      {formatClubAddress(club)}
                    </span>
                  </a>
                )}
                {club.phone && (
                  <a href={`tel:${club.phone.replace(/\s+/g, '')}`} className="cl-panel-row">
                    <Phone size={14} className="cl-panel-icon" />
                    <span>{club.phone}</span>
                  </a>
                )}
                {Array.isArray(club.openingDays) && club.openingDays.length > 0 && (
                  <div className="cl-panel-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <Calendar size={14} className="cl-panel-icon" style={{ marginTop: 2 }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {DAY_LABELS.map((label, idx) =>
                        club.openingDays!.includes(idx) ? (
                          <span key={label} className="cl-day-chip">{label}</span>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Social */}
            {(club.instagramUrl || club.facebookUrl || club.websiteUrl) && (
              <div className="cl-panel">
                <div className="cl-panel-h">Social</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {club.instagramUrl && (
                    <a href={club.instagramUrl} target="_blank" rel="noreferrer" className="cl-panel-row">
                      <Instagram size={14} className="cl-panel-icon" />
                      <span>{club.instagramUrl.replace(/^https?:\/\/(www\.)?(instagram\.com\/)?/, '@')}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviewsSummary.count > 0 && (
              <div className="cl-panel">
                <div className="cl-panel-h">Reseñas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', letterSpacing: '-.03em', lineHeight: 1 }}>
                      {formatRatingLabel(reviewsSummary.averageRating)}
                    </div>
                    <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 4 }}>
                      de 5 · {reviewsSummary.count} reseñas
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map(v => (
                      <Star key={v} size={14} style={{ color: v <= Math.round(reviewsSummary.averageRating) ? '#22c55e' : '#222', fill: v <= Math.round(reviewsSummary.averageRating) ? '#22c55e' : 'none' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reviews.slice(0, 3).map(review => (
                    <div key={review.id} className="cl-review-card">
                      <div className="cl-review-head">
                        <span className="cl-review-name">{review.user.name}</span>
                        <span className="cl-review-score">
                          <Star size={11} style={{ fill: '#22c55e' }} />
                          {formatRatingLabel(Number(review.rating || 0))}
                        </span>
                      </div>
                      {review.comment
                        ? <p className="cl-review-comment">{review.comment}</p>
                        : <p className="cl-review-comment" style={{ fontStyle: 'italic', color: '#444' }}>Sin comentario</p>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review CTA */}
            <div className="cl-panel">
              <div className="cl-panel-h">Tu reseña</div>
              {reviewCtaLoading ? (
                <p style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>Validando elegibilidad...</p>
              ) : canReviewClub ? (
                <div>
                  <p style={{ fontSize: 13, color: '#777', marginBottom: 14, lineHeight: 1.5 }}>
                    {hasExistingClubReview
                      ? 'Ya dejaste una reseña en este club. Podés editarla.'
                      : 'Podés dejar tu reseña de este club.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/bookings')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                  >
                    <ChevronRight size={14} />
                    {hasExistingClubReview ? 'Editar mi reseña' : 'Dejar mi reseña'}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                  {user ? 'Completá una reserva en este club para poder reseñarlo.' : 'Iniciá sesión y completá una reserva para reseñar.'}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>TuCancha · Todos los derechos reservados</span>
        </div>

      </div>
    </DarkPageLayout>
  );
}
