import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppModal from './AppModal';
import { LogOut, Calendar, Users, ShieldCheck, MapPin, X, Phone, Mail, Instagram } from 'lucide-react';
import { logout } from '../services/AuthService';
import { getMyBookings } from '../services/BookingService';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminAccess, normalizeSessionUser, getActiveClubSlug } from '../utils/session';
import { reportUiError } from '../utils/uiError';
import { isAuthSessionInvalidatedError } from '../utils/apiClient';

const countActiveBookings = (rows: any[]): number => {
  const now = Date.now();
  return rows.filter((b: any) => {
    const status = String(b?.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'COMPLETED') return false;
    const endTs = new Date(b?.endDateTime || b?.startDateTime).getTime();
    if (!Number.isFinite(endTs)) return true;
    return endTs >= now;
  }).length;
};

const BASE_CSS = `
  .tc-root { min-height:100vh; background:#050505; color:#f2f2f2; font-family:'Sora',system-ui,sans-serif; -webkit-font-smoothing:antialiased; overflow-x:hidden; padding-top:68px; }
  .tc-root *,.tc-root *::before,.tc-root *::after { box-sizing:border-box; }
  .tc-root a { color:inherit; text-decoration:none; }
  .tc-root ::selection { background:#22c55e; color:#052010; }
  /* Header */
  .tc-header { position:fixed; top:0; left:0; right:0; z-index:50; background:rgba(5,5,5,.9); backdrop-filter:blur(16px); border-bottom:1px solid rgba(255,255,255,.06); transform:translateY(0); transition:transform .38s cubic-bezier(.4,0,.2,1); }
  .tc-header-hidden { transform:translateY(-110%); }
  .tc-header-inner { max-width:1360px; margin:0 auto; padding:0 24px; min-height:68px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .tc-brand-text { font-size:13px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:#22c55e; }
  .tc-btn { display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:700; border:1px solid rgba(255,255,255,.14); background:#111; color:#e8e8e8; cursor:pointer; transition:transform .15s,box-shadow .15s; font-family:inherit; }
  .tc-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.3); }
  .tc-btn-primary { background:#22c55e!important; color:#052010!important; border-color:#22c55e!important; }
  .tc-btn-primary:hover { background:#16a34a!important; }
  .tc-btn-ghost { background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.12); }
  .tc-btn-ghost:hover { background:rgba(255,255,255,.12); }
  /* User button */
  .tc-user-btn { display:flex; align-items:center; gap:10px; padding:5px 14px 5px 5px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:999px; cursor:pointer; transition:background .15s; }
  .tc-user-btn:hover { background:rgba(255,255,255,.1); }
  .tc-user-avatar { width:34px; height:34px; border-radius:50%; background:#22c55e; color:#052010; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; position:relative; flex-shrink:0; }
  .tc-user-name { font-size:13px; font-weight:600; color:#e8e8e8; }
  .tc-user-menu { position:absolute; right:0; top:calc(100% + 8px); width:260px; background:#111; border:1px solid rgba(255,255,255,.1); border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.5); z-index:120; }
  /* Contact panel */
  .tc-contact-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:60; transition:opacity .3s; }
  .tc-contact-panel { position:fixed; top:0; right:0; height:100%; width:100%; max-width:360px; background:#111; z-index:70; box-shadow:-8px 0 32px rgba(0,0,0,.5); transform:translateX(100%); transition:transform .3s ease-out; border-left:1px solid rgba(255,255,255,.08); }
  .tc-contact-panel.tc-open { transform:translateX(0); }
  /* Page shell */
  .tc-page { max-width:1360px; margin:0 auto; padding:48px 40px 80px; }
  .tc-page-sm { max-width:860px; margin:0 auto; padding:48px 40px 80px; }
  .tc-breadcrumbs-wrap { padding:12px 24px 0; }
  .tc-breadcrumbs { max-width:1360px; margin:0 auto; }
  .tc-breadcrumbs-cloud {
    display:inline-flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
    width:fit-content;
    max-width:100%;
    padding:8px 12px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.1);
    background:rgba(12,12,12,.74);
    backdrop-filter:blur(10px);
    box-shadow:0 8px 24px rgba(0,0,0,.28);
  }
  .tc-breadcrumb-link,.tc-breadcrumb-current { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .tc-breadcrumb-link { color:#6c6c6c; transition:color .15s; }
  .tc-breadcrumb-link:hover { color:#22c55e; }
  .tc-breadcrumb-current {
    color:#e9e9e9;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.08);
    border-radius:999px;
    padding:4px 8px;
  }
  .tc-breadcrumb-sep { color:#3a3a3a; font-size:10px; font-weight:700; }
  /* Section heading */
  .tc-page-eyebrow { display:inline-flex; align-items:center; gap:10px; font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#555; margin-bottom:14px; }
  .tc-page-eyebrow::before { content:''; display:inline-block; width:24px; height:1px; background:#555; }
  .tc-page-h { font-size:clamp(30px,4vw,52px); font-weight:800; letter-spacing:-.04em; line-height:1; margin:0 0 8px; color:#f2f2f2; }
  .tc-page-h i { font-style:italic; color:#22c55e; }
  .tc-page-sub { font-size:14px; color:#777; font-weight:400; margin:0; }
  /* Cards */
  .tc-card { background:#0f0f0f; border:1px solid rgba(255,255,255,.07); border-radius:20px; overflow:hidden; }
  .tc-card-inset { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:14px; }
  /* Form inputs */
  .tc-field { background:#0f0f0f; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:14px 18px; transition:border-color .2s; }
  .tc-field:focus-within { border-color:rgba(34,197,94,.4); }
  .tc-field-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#555; display:flex; align-items:center; gap:6px; margin-bottom:8px; }
  .tc-field-label svg { color:#444; }
  .tc-input { width:100%; background:transparent; border:none; outline:none; color:#f2f2f2; font-family:'Sora',system-ui,sans-serif; font-size:15px; font-weight:600; }
  .tc-input::placeholder { color:#333; font-weight:400; }
  .tc-input:disabled { color:#444; cursor:not-allowed; }
  .tc-select { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:6px 10px; color:#e8e8e8; font-family:'Sora',system-ui,sans-serif; font-size:13px; font-weight:600; outline:none; }
  /* Tabs */
  .tc-tabs { display:flex; gap:4px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:999px; padding:4px; }
  .tc-tab { padding:8px 20px; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; transition:background .2s,color .2s; color:#666; background:none; border:none; font-family:inherit; letter-spacing:.02em; }
  .tc-tab.tc-active { background:#22c55e; color:#052010; }
  .tc-tab:not(.tc-active):hover { color:#e8e8e8; background:rgba(255,255,255,.05); }
  /* Badges */
  .tc-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.04em; }
  .tc-badge-green { background:rgba(34,197,94,.15); color:#22c55e; border:1px solid rgba(34,197,94,.2); }
  .tc-badge-red { background:rgba(248,113,113,.1); color:#f87171; border:1px solid rgba(248,113,113,.15); }
  .tc-badge-gray { background:rgba(255,255,255,.06); color:#888; border:1px solid rgba(255,255,255,.08); }
  /* Stars */
  .tc-star { color:#333; transition:color .15s; cursor:pointer; }
  .tc-star.tc-filled { color:#22c55e; }
  .tc-star:hover { color:#4ade80; }
  /* Divider */
  .tc-divider { height:1px; background:rgba(255,255,255,.06); margin:0; border:none; }
  /* Responsive */
  @media(max-width:720px){
    .tc-page,.tc-page-sm { padding:32px 20px 64px; }
    .tc-breadcrumbs-wrap { padding:10px 20px 0; }
    .tc-breadcrumbs-cloud { border-radius:14px; }
  }
  @keyframes tc-pulse { 0%,100%{opacity:1}50%{opacity:.5} }
  @keyframes tc-spin { to{transform:rotate(360deg)} }
  @keyframes tc-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;

interface DarkPageLayoutProps {
  title: string;
  children: React.ReactNode;
  extraCss?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function DarkPageLayout({ title, children, extraCss = '', breadcrumbs = [] }: DarkPageLayoutProps) {
  const router = useRouter();
  const { user: rawUser } = useAuth();
  const user = rawUser ? normalizeSessionUser(rawUser) : null;
  const isAdmin = user ? hasAdminAccess(user) : false;
  const adminClubSlug = user ? getActiveClubSlug() : null;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [navHidden, setNavHidden] = useState(false);
  const [contactMenu, setContactMenu] = useState<{ type: 'whatsapp' | 'email' | 'instagram'; top: number; left: number; href: string; copyText: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const userInitials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || (user.name?.[0] || 'U').toUpperCase()
    : 'U';

  useEffect(() => {
    if (!user?.id) return;
    getMyBookings(user.id).then(rows => {
      setActiveBookingsCount(countActiveBookings(rows));
    }).catch((err) => {
      if (!isAuthSessionInvalidatedError(err)) {
        reportUiError({ area: 'DarkPageLayout', action: 'loadActiveBookings' }, err);
      }
    });
  }, [user]);

  useEffect(() => {
    let lastY = window.scrollY;
    const handler = () => {
      const y = window.scrollY;
      if (y < 80) {
        setNavHidden(false);
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) < 4) return;
      setNavHidden(y > lastY);
      lastY = y;
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close contactMenu on outside click / Escape
  useEffect(() => {
    if (!contactMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContactMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContactMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [contactMenu]);

  useEffect(() => {
    const closeTransientPanels = () => {
      setShowContact(false);
      setContactMenu(null);
      setShowUserMenu(false);
      setNavHidden(false);
    };
    router.events.on('routeChangeStart', closeTransientPanels);
    return () => {
      router.events.off('routeChangeStart', closeTransientPanels);
    };
  }, [router.events]);

  const openContactMenu = (e: React.MouseEvent, type: 'whatsapp' | 'email' | 'instagram') => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let top = rect.height + 8;
    let left = 0;
    if (sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      top = rect.bottom - sidebarRect.top + 8;
      left = rect.left - sidebarRect.left;
    }
    const map: Record<string, { href: string; copyText: string }> = {
      whatsapp: { href: 'https://wa.me/5493513436163', copyText: '+54 351 343 6163' },
      email: { href: 'mailto:soporte.tucancha@gmail.com', copyText: 'soporte.tucancha@gmail.com' },
      instagram: { href: 'https://instagram.com/tucancha.app_', copyText: '@tucancha.app_' },
    };
    setContactMenu({ type, top: Math.max(top, 10), left: Math.max(left, 10), ...map[type] });
  };

  const handleOpenHref = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
    setContactMenu(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      reportUiError({ area: 'DarkPageLayout', action: 'copyContact' }, new Error('clipboard error'));
    }
    setContactMenu(null);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      void router.replace('/');
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <style
        dangerouslySetInnerHTML={{
          __html: BASE_CSS + (extraCss ? '\n' + extraCss : '')
        }}
      />

      <div className="tc-root" onClick={() => { setShowUserMenu(false); }}>

        {/* ── HEADER ── */}
        <header className={`tc-header${navHidden ? ' tc-header-hidden' : ''}`}>
          <div className="tc-header-inner">
            <Link href="/" className="tc-brand">
              <span className="tc-brand-text">TuCancha</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setShowContact(true)} className="tc-btn tc-btn-ghost">Contacto</button>
              {user ? (
                <div style={{ position: 'relative' }}>
                  <button
                    className="tc-user-btn"
                    onClick={(e) => { e.stopPropagation(); setShowUserMenu(p => !p); }}
                  >
                    <div className="tc-user-avatar">
                      {userInitials}
                      {activeBookingsCount > 0 && (
                        <span style={{ position: 'absolute', top: -3, right: -3, background: '#22c55e', color: '#052010', fontSize: 9, fontWeight: 900, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {activeBookingsCount}
                        </span>
                      )}
                    </div>
                    <span className="tc-user-name">{user.firstName || user.name || 'Usuario'}</span>
                  </button>

                  {showUserMenu && (
                    <div className="tc-user-menu" onClick={e => e.stopPropagation()}>
                      <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        <div className="tc-user-avatar" style={{ width: 52, height: 52, borderRadius: '50%', fontSize: 16, margin: '0 auto 10px' }}>{userInitials}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>{user.firstName || user.name || 'Usuario'}</div>
                        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>{isAdmin ? 'Administrador' : 'Miembro'}</div>
                      </div>
                      <div style={{ padding: 6 }}>
                        {isAdmin && (
                          <Link href="/admin/agenda" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}>
                            <ShieldCheck size={15} /> Gestión
                          </Link>
                        )}
                        {isAdmin && adminClubSlug && (
                          <Link href={`/club/${adminClubSlug}`} onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}>
                            <MapPin size={15} /> Mi club
                          </Link>
                        )}
                        <Link href="/perfil" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}>
                          <Users size={15} /> Mi perfil
                        </Link>
                        <Link href="/bookings" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Calendar size={15} /> Mis reservas</span>
                          {activeBookingsCount > 0 && (
                            <span style={{ background: '#22c55e', color: '#052010', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{activeBookingsCount}</span>
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <LogOut size={15} /> Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login" className="tc-btn tc-btn-primary">Ingresar</Link>
              )}
            </div>
          </div>
        </header>

        {breadcrumbs.length > 0 && (
          <nav className="tc-breadcrumbs-wrap" aria-label="Breadcrumb">
            <div className="tc-breadcrumbs">
              <div className="tc-breadcrumbs-cloud">
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <div key={`${item.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {item.href && !isLast ? (
                        <Link href={item.href} className="tc-breadcrumb-link">{item.label}</Link>
                      ) : (
                        <span className="tc-breadcrumb-current">{item.label}</span>
                      )}
                      {!isLast && <span className="tc-breadcrumb-sep">/</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>
        )}

        {/* ── PAGE CONTENT ── */}
        {children}

        {/* ── CONTACT SIDEBAR ── */}
        <div className="tc-contact-overlay" style={{ opacity: showContact ? 1 : 0, pointerEvents: showContact ? 'auto' : 'none' }} onClick={() => setShowContact(false)} />
        <div
          className={`tc-contact-panel${showContact ? ' tc-open' : ''}`}
          style={{
            transform: showContact ? 'translateX(0)' : 'translateX(100%)',
            visibility: showContact ? 'visible' : 'hidden',
            pointerEvents: showContact ? 'auto' : 'none',
          }}
          aria-hidden={!showContact}
        >
          <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', margin: 0 }}>Contacto</h2>
            <button onClick={() => setShowContact(false)} style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171' }}>
              <X size={16} />
            </button>
          </div>
          <div ref={sidebarRef} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, margin: 0 }}>¿Tenés dudas o querés dar de alta tu club? Escribinos.</p>
            {([
              { type: 'whatsapp' as const, label: 'WhatsApp', value: '+54 351 343 6163', icon: <Phone size={16} /> },
              { type: 'email' as const, label: 'Email', value: 'soporte.tucancha@gmail.com', icon: <Mail size={16} /> },
            ]).map(c => (
              <button key={c.type} type="button" onClick={e => openContactMenu(e, c.type)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s', width: '100%' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#555' }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f2f2f2' }}>{c.value}</div>
                </div>
              </button>
            ))}
            <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <button type="button" onClick={e => openContactMenu(e, 'instagram')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>
                <Instagram size={15} /> @tucancha.app_
              </button>
            </div>
            {contactMenu && (
              <div ref={menuRef} role="dialog" style={{ position: 'absolute', top: contactMenu.top, left: contactMenu.left, zIndex: 90, background: '#1a1a1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 6, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                <button onClick={() => handleOpenHref(contactMenu.href)}
                  style={{ display: 'block', width: '100%', padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#f2f2f2', fontWeight: 500, textAlign: 'left', borderRadius: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Abrir</button>
                <button onClick={() => handleCopy(contactMenu.copyText)}
                  style={{ display: 'block', width: '100%', padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#f2f2f2', fontWeight: 500, textAlign: 'left', borderRadius: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{copied ? '¡Copiado!' : 'Copiar'}</button>
              </div>
            )}
          </div>
        </div>

        {/* ── LOGOUT MODAL ── */}
        <AppModal
          show={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          title="¿Cerrar sesión?"
          message="¿Estás seguro que querés salir de tu cuenta?"
          cancelText="Cancelar"
          confirmText={loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          confirmDisabled={loggingOut}
          isWarning={false}
          closeOnBackdrop={!loggingOut}
          closeOnEscape={!loggingOut}
        />

      </div>
    </>
  );
}
