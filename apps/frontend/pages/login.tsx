import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { login, register, requestMagicLink, verifyMagicLink } from '../services/AuthService';
import { ClubService } from '../services/ClubService';
import { Mail, Lock, User, Phone, UserPlus, LogIn, AlertCircle, Loader2, IdCard, CheckCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../utils/session';
import { buildCanonicalPhone, DEFAULT_PHONE_COUNTRY_ISO2, normalizePhoneCountryIso2, PHONE_COUNTRY_OPTIONS, resolveCallingCodeByIso2 } from '../utils/phone';
import { useAuth } from '../contexts/AuthContext';

type PostLoginRedirectIntent = { sourceUser?: any };

const FONT = "'Sora',system-ui,sans-serif";

const LOGIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  .lg-root { min-height:100vh; background:#050505; font-family:${FONT}; display:flex; align-items:center; justify-content:center; padding:24px; position:relative; overflow:hidden; -webkit-font-smoothing:antialiased; }
  .lg-root::before { content:''; position:fixed; inset:0; background:radial-gradient(ellipse 70% 60% at 20% 110%,rgba(34,197,94,.1),transparent 65%), radial-gradient(ellipse 50% 40% at 85% -10%,rgba(34,197,94,.06),transparent 60%); pointer-events:none; }
  .lg-card { width:100%; max-width:420px; background:#111; border:1px solid rgba(255,255,255,.1); border-radius:24px; box-shadow:0 24px 64px rgba(0,0,0,.7); overflow:hidden; position:relative; z-index:1; animation:lg-scalein .25s ease; }
  @keyframes lg-scalein { from{opacity:0;transform:scale(.97) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
  .lg-header { padding:32px 32px 24px; text-align:center; border-bottom:1px solid rgba(255,255,255,.06); }
  .lg-icon { width:52px; height:52px; border-radius:16px; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.25); display:inline-flex; align-items:center; justify-content:center; color:#22c55e; margin-bottom:16px; }
  .lg-title { font-size:22px; font-weight:800; color:#f2f2f2; letter-spacing:-.03em; margin:0 0 4px; }
  .lg-sub { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:#444; margin:0; }
  .lg-body { padding:24px 32px 32px; display:flex; flex-direction:column; gap:16px; }
  .lg-notice { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; border-radius:12px; font-size:13px; font-weight:600; line-height:1.5; }
  .lg-err { background:rgba(248,113,113,.07); border:1px solid rgba(248,113,113,.2); color:#fca5a5; }
  .lg-ok { background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.2); color:#4ade80; }
  .lg-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .lg-full { grid-column:1 / -1; }
  .lg-field { display:flex; flex-direction:column; gap:6px; }
  .lg-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#555; }
  .lg-input-wrap { position:relative; display:flex; align-items:center; }
  .lg-input-icon { position:absolute; left:13px; color:#444; display:flex; pointer-events:none; }
  .lg-input { width:100%; padding:11px 14px 11px 38px; background:#0a0a0a; border:1px solid rgba(255,255,255,.09); border-radius:12px; color:#f2f2f2; font-family:${FONT}; font-size:14px; font-weight:600; outline:none; transition:border-color .2s, box-shadow .2s; }
  .lg-input:focus { border-color:rgba(34,197,94,.5); box-shadow:0 0 0 3px rgba(34,197,94,.1); }
  .lg-input::placeholder { color:#2a2a2a; font-weight:400; }
  .lg-input-no-icon { padding-left:14px; }
  .lg-eye-btn { position:absolute; right:12px; background:none; border:none; cursor:pointer; color:#555; display:flex; align-items:center; padding:4px; transition:color .15s; }
  .lg-eye-btn:hover { color:#c8c8c8; }
  .lg-phone-wrap { display:flex; background:#0a0a0a; border:1px solid rgba(255,255,255,.09); border-radius:12px; overflow:hidden; transition:border-color .2s, box-shadow .2s; }
  .lg-phone-wrap:focus-within { border-color:rgba(34,197,94,.5); box-shadow:0 0 0 3px rgba(34,197,94,.1); }
  .lg-phone-prefix { display:flex; align-items:center; gap:8px; padding:0 12px; background:rgba(255,255,255,.03); border-right:1px solid rgba(255,255,255,.07); flex-shrink:0; }
  .lg-phone-select { background:transparent; border:none; color:#c8c8c8; font-family:${FONT}; font-size:13px; font-weight:700; outline:none; }
  .lg-phone-input { flex:1; padding:11px 14px; background:transparent; border:none; color:#f2f2f2; font-family:${FONT}; font-size:14px; font-weight:600; outline:none; }
  .lg-phone-input::placeholder { color:#2a2a2a; font-weight:400; }
  .lg-divider { display:flex; align-items:center; gap:12px; }
  .lg-divider-line { flex:1; height:1px; background:rgba(255,255,255,.07); }
  .lg-divider-text { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#333; }
  .lg-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:13px 20px; border-radius:12px; font-family:${FONT}; font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; border:none; transition:background .15s, transform .15s, opacity .15s; }
  .lg-btn:disabled { opacity:.5; cursor:not-allowed; }
  .lg-btn-primary { background:#22c55e; color:#052010; }
  .lg-btn-primary:hover:not(:disabled) { background:#4ade80; transform:translateY(-1px); }
  .lg-btn-ghost { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09)!important; color:#888; }
  .lg-btn-ghost:hover:not(:disabled) { background:rgba(255,255,255,.09); color:#c8c8c8; }
  .lg-toggle { text-align:center; padding-top:16px; border-top:1px solid rgba(255,255,255,.06); }
  .lg-toggle-btn { background:none; border:none; font-family:${FONT}; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#444; cursor:pointer; transition:color .15s; text-decoration:underline; text-decoration-color:transparent; text-underline-offset:3px; }
  .lg-toggle-btn:hover { color:#22c55e; text-decoration-color:#22c55e; }
  .lg-brand { position:absolute; top:20px; left:50%; transform:translateX(-50%); font-size:11px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#22c55e; white-space:nowrap; }
  @media(max-width:480px) { .lg-grid2 { grid-template-columns:1fr; } .lg-header { padding:24px 24px 20px; } .lg-body { padding:20px 24px 28px; } }
`;

export default function LoginPage() {
  const router = useRouter();
  const { status, user: authUser, revalidateSession } = useAuth();
  const returnTo =
    typeof router.query.from === 'string' &&
    router.query.from.startsWith('/') &&
    !router.query.from.startsWith('//')
      ? router.query.from
      : null;
  const openRegisterMode =
    router.query.mode === 'register' ||
    router.query.view === 'register' ||
    router.query.register === '1' ||
    router.query.register === 'true';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryIso2, setPhoneCountryIso2] = useState(DEFAULT_PHONE_COUNTRY_ISO2);
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [redirectIntent, setRedirectIntent] = useState<PostLoginRedirectIntent | null>(null);
  const redirectingRef = useRef(false);

  const resolvePostLoginDestination = useCallback(async (sourceUser?: any) => {
    const normalizedUser = normalizeSessionUser(sourceUser || authUser);
    const safeReturnTo =
      returnTo && returnTo !== '/login' && !returnTo.startsWith('/login?') && !returnTo.startsWith('/login#')
        ? returnTo
        : null;
    if (hasAdminAccess(normalizedUser)) return '/admin/agenda';
    if (safeReturnTo) return safeReturnTo;
    const activeSlug = getActiveClubSlug(normalizedUser);
    if (activeSlug) return `/club/${activeSlug}`;
    const activeClubId = Number(normalizedUser?.activeClubId || normalizedUser?.clubId || normalizedUser?.club?.id || 0);
    if (Number.isInteger(activeClubId) && activeClubId > 0) {
      try {
        const club = await ClubService.getClubById(activeClubId);
        if (club?.slug) return `/club/${club.slug}`;
      } catch {}
    }
    return '/';
  }, [authUser, returnTo]);

  const navigateAfterAuth = useCallback(async (sourceUser?: any) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    try {
      const target = await resolvePostLoginDestination(sourceUser);
      await router.replace(target);
    } finally {
      window.setTimeout(() => { redirectingRef.current = false; }, 250);
    }
  }, [resolvePostLoginDestination, router]);

  useEffect(() => { setIsLogin(!openRegisterMode); }, [openRegisterMode]);

  useEffect(() => {
    if (router.pathname !== '/login') return;
    if (loading || magicLoading) return;
    if (!redirectIntent && status === 'authenticated') { setRedirectIntent({ sourceUser: authUser }); return; }
    if (!redirectIntent) return;
    void navigateAfterAuth(redirectIntent.sourceUser || authUser).finally(() => setRedirectIntent(null));
  }, [authUser, loading, magicLoading, navigateAfterAuth, redirectIntent, router.pathname, status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        const parsedUser = userRaw ? normalizeSessionUser(JSON.parse(userRaw)) : null;
        const activeClubId = Number(parsedUser?.activeClubId || parsedUser?.clubId || parsedUser?.club?.id || 0);
        if (!Number.isInteger(activeClubId) || activeClubId <= 0) return;
        const club = await ClubService.getClubById(activeClubId);
        if (!cancelled) setPhoneCountryIso2(normalizePhoneCountryIso2(club?.country));
      } catch {
        if (!cancelled) setPhoneCountryIso2(DEFAULT_PHONE_COUNTRY_ISO2);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!rawHash) return;
    const hashParams = new URLSearchParams(rawHash);
    const magicToken = String(hashParams.get('magic_token') || '').trim();
    const magicError = String(hashParams.get('magic_error') || '').trim();
    if (!magicToken && !magicError) return;
    const clearHash = () => window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    if (magicError) {
      clearHash();
      setIsLogin(true);
      setError(magicError === 'internal_error' ? 'No se pudo validar el enlace en este momento. Probá nuevamente.' : 'El enlace es inválido, ya se usó o expiró. Solicitá uno nuevo.');
      return;
    }
    let cancelled = false;
    setIsLogin(true); setLoading(true); setError(''); setSuccessMessage('');
    (async () => {
      try {
        const data = await verifyMagicLink(magicToken);
        if (cancelled) return;
        await revalidateSession();
        setRedirectIntent({ sourceUser: data?.user });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'No se pudo iniciar sesión con el enlace.');
      } finally {
        if (!cancelled) setLoading(false);
        clearHash();
      }
    })();
    return () => { cancelled = true; };
  }, [navigateAfterAuth, revalidateSession, returnTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccessMessage(''); setLoading(true);
    try {
      if (isLogin) {
        const data = await login(email, password);
        await revalidateSession();
        setRedirectIntent({ sourceUser: data?.user });
      } else {
        const localPhone = String(phoneNumber || '').replace(/[^\d]/g, '');
        const fullPhone = buildCanonicalPhone({ countryIso2: phoneCountryIso2, localNumber: localPhone });
        if (!localPhone) { setError('Ingresá un teléfono para completar el registro.'); return; }
        if (!fullPhone) { setError('Ingresá un teléfono con formato válido.'); return; }
        const safeDni = String(dni || '').trim();
        if (safeDni && safeDni.length < 7) { setError('Si cargás DNI, debe tener al menos 7 dígitos.'); return; }
        await register(firstName, lastName, email, password, fullPhone, 'MEMBER', safeDni || undefined, resolveCallingCodeByIso2(phoneCountryIso2), localPhone);
        setSuccessMessage('Usuario registrado exitosamente. Ahora podés iniciar sesión.');
        setIsLogin(true);
        setFirstName(''); setLastName(''); setPhoneNumber(''); setDni('');
      }
    } catch (err: any) {
      setError(err.message || (isLogin ? 'Credenciales inválidas' : 'Error al registrar'));
    } finally { setLoading(false); }
  };

  const handleRequestMagicLink = async () => {
    const safeEmail = String(email || '').trim();
    if (!safeEmail) { setError('Ingresá tu correo para enviarte el enlace.'); return; }
    setError(''); setSuccessMessage(''); setMagicLoading(true);
    try {
      const data = await requestMagicLink(safeEmail);
      setSuccessMessage(data?.message || 'Si el email es válido, te enviamos un enlace para ingresar.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el enlace en este momento.');
    } finally { setMagicLoading(false); }
  };

  return (
    <>
      <Head>
        <title>{isLogin ? 'Ingresar' : 'Crear cuenta'} | TuCancha</title>
      </Head>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />

      <div className="lg-root">
        {/* Brand top link */}
        <Link href="/" className="lg-brand">TuCancha</Link>

        <div className="lg-card">

          {/* Header */}
          <div className="lg-header">
            <div className="lg-icon">
              {isLogin ? <LogIn size={22} /> : <UserPlus size={22} />}
            </div>
            <h1 className="lg-title">{isLogin ? 'Bienvenido' : 'Crear cuenta'}</h1>
            <p className="lg-sub">{isLogin ? 'Ingresá a tu cuenta' : 'Sumate en segundos'}</p>
          </div>

          {/* Body */}
          <div className="lg-body">

            {/* Error */}
            {error && (
              <div className="lg-notice lg-err">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {successMessage && (
              <div className="lg-notice lg-ok">
                <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Register fields */}
              {!isLogin && (
                <div className="lg-grid2">
                  {/* Nombre */}
                  <div className="lg-field">
                    <label className="lg-label">Nombre</label>
                    <div className="lg-input-wrap">
                      <span className="lg-input-icon"><User size={14} /></span>
                      <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="lg-input" placeholder="Ej: Juan" />
                    </div>
                  </div>
                  {/* Apellido */}
                  <div className="lg-field">
                    <label className="lg-label">Apellido</label>
                    <div className="lg-input-wrap">
                      <span className="lg-input-icon"><User size={14} /></span>
                      <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="lg-input" placeholder="Ej: Pérez" />
                    </div>
                  </div>
                  {/* DNI */}
                  <div className="lg-field lg-full">
                    <label className="lg-label">DNI <span style={{ color: '#333', fontWeight: 500 }}>(opcional)</span></label>
                    <div className="lg-input-wrap">
                      <span className="lg-input-icon"><IdCard size={14} /></span>
                      <input type="number" value={dni} onChange={e => setDni(e.target.value)} className="lg-input" placeholder="Ej: 35123456" />
                    </div>
                  </div>
                  {/* Teléfono */}
                  <div className="lg-field lg-full">
                    <label className="lg-label">Teléfono</label>
                    <div className="lg-phone-wrap">
                      <div className="lg-phone-prefix">
                        <Phone size={13} style={{ color: '#444', flexShrink: 0 }} />
                        <select
                          value={phoneCountryIso2}
                          onChange={e => setPhoneCountryIso2(normalizePhoneCountryIso2(e.target.value))}
                          className="lg-phone-select"
                        >
                          {PHONE_COUNTRY_OPTIONS.map(opt => (
                            <option key={opt.iso2} value={opt.iso2}>{opt.callingCode} {opt.iso2}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={20}
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value.replace(/[^\d]/g, ''))}
                        className="lg-phone-input"
                        placeholder="Número local"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="lg-field">
                <label className="lg-label">Correo electrónico</label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon"><Mail size={14} /></span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="lg-input" placeholder="tu@email.com" autoComplete="email" />
                </div>
              </div>

              {/* Password */}
              <div className="lg-field">
                <label className="lg-label">Contraseña</label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon"><Lock size={14} /></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={isLogin}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="lg-input"
                    placeholder="••••••••"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    className="lg-eye-btn"
                    aria-label="Ver contraseña"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="lg-btn lg-btn-primary" style={{ marginTop: 4 }}>
                {loading
                  ? <><Loader2 size={15} style={{ animation: 'lg-spin .8s linear infinite' }} /> Procesando...</>
                  : isLogin
                  ? <><LogIn size={15} /> Ingresar</>
                  : <><UserPlus size={15} /> Crear cuenta</>
                }
              </button>

              {/* Magic link (login only) */}
              {isLogin && (
                <>
                  <div className="lg-divider">
                    <div className="lg-divider-line" />
                    <span className="lg-divider-text">o</span>
                    <div className="lg-divider-line" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestMagicLink}
                    disabled={magicLoading || loading || !String(email || '').trim()}
                    className="lg-btn lg-btn-ghost"
                  >
                    {magicLoading
                      ? <><Loader2 size={15} style={{ animation: 'lg-spin .8s linear infinite' }} /> Enviando...</>
                      : <><Zap size={15} /> Enviar enlace de acceso</>
                    }
                  </button>
                </>
              )}

            </form>

            {/* Toggle login/register */}
            <div className="lg-toggle">
              <button
                type="button"
                className="lg-toggle-btn"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }}
              >
                {isLogin ? '¿No tenés cuenta? Registrate gratis' : '¿Ya tenés cuenta? Iniciá sesión'}
              </button>
            </div>

          </div>
        </div>

        <style>{`@keyframes lg-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </>
  );
}
