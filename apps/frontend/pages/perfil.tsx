import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import DarkPageLayout from '../components/DarkPageLayout';
import UserLoadingState from '../components/UserLoadingState';
import { getPendingLogoutRedirect } from '../services/AuthService';
import { useValidateAuth } from '../hooks/useValidateAuth';
import { updateMyProfile } from '../services/AuthService';
import { Mail, Phone, IdCard, User, Save, CheckCircle } from 'lucide-react';
import {
  buildCanonicalPhone,
  DEFAULT_PHONE_COUNTRY_ISO2,
  normalizePhoneCountryIso2,
  PHONE_COUNTRY_OPTIONS,
  resolveCallingCodeByIso2,
  splitCanonicalPhone
} from '../utils/phone';

const PAGE_CSS = `
  .pf-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .pf-full { grid-column:1 / -1; }
  .pf-save { display:inline-flex; align-items:center; gap:8px; padding:12px 28px; background:#22c55e; color:#052010; border:none; border-radius:999px; font-size:13px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; cursor:pointer; font-family:'Sora',system-ui,sans-serif; transition:background .15s,transform .15s; }
  .pf-save:hover:not(:disabled) { background:#4ade80; transform:translateY(-1px); }
  .pf-save:disabled { opacity:.5; cursor:not-allowed; }
  .pf-notice { display:flex; align-items:flex-start; gap:10px; padding:13px 16px; border-radius:14px; font-size:13px; font-weight:600; line-height:1.5; animation:pf-notice-in .18s ease-out; }
  .pf-notice-err { background:rgba(248,113,113,.08); border:1px solid rgba(248,113,113,.2); color:#fca5a5; }
  .pf-notice-ok { background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.24); color:#8df3b1; }
  .pf-zone-link:hover { background:rgba(34,197,94,.16)!important; }
  @keyframes pf-notice-in { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
  .tc-root.tc-theme-light .pf-save { box-shadow:0 8px 18px rgba(34,197,94,.24); }
  .tc-root.tc-theme-light .pf-notice-err { background:rgba(248,113,113,.12); color:#b91c1c; }
  .tc-root.tc-theme-light .pf-notice-ok { background:rgba(34,197,94,.12); color:#166534; }
  .tc-root.tc-theme-light .pf-head { border-bottom-color:rgba(15,23,42,.12)!important; }
  .tc-root.tc-theme-light .pf-zone-title { color:#64748b!important; }
  .tc-root.tc-theme-light .pf-zone-copy-title { color:#0f172a!important; }
  .tc-root.tc-theme-light .pf-zone-copy-sub { color:#475569!important; }
  .tc-root.tc-theme-light .pf-zone-link { background:rgba(34,197,94,.12)!important; border-color:rgba(34,197,94,.24)!important; color:#15803d!important; }
  @media(max-width:600px){ .pf-grid { grid-template-columns:1fr; } }
`;

export default function PerfilPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dni: '',
    phoneCountryIso2: DEFAULT_PHONE_COUNTRY_ISO2,
    phoneLocal: ''
  });

  useEffect(() => {
    if (!authChecked) return;
    if (user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/perfil')}`);
  }, [authChecked, user, router]);

  useEffect(() => {
    if (!user) return;
    const splitPhone = splitCanonicalPhone(String(user.phoneNumber || ''), DEFAULT_PHONE_COUNTRY_ISO2);
    setForm({
      firstName: String(user.firstName || ''),
      lastName: String(user.lastName || ''),
      email: String(user.email || ''),
      dni: String((user as any).dni || ''),
      phoneCountryIso2: normalizePhoneCountryIso2(splitPhone.countryIso2),
      phoneLocal: String(splitPhone.localNumber || '')
    });
  }, [user]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 3500);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (!authChecked || !user) {
    return <UserLoadingState mode="page" message={authChecked ? 'Redirigiendo...' : 'Validando sesión...'} />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const firstName = String(form.firstName || '').trim();
    const lastName = String(form.lastName || '').trim();
    const phoneLocal = String(form.phoneLocal || '').replace(/[^\d]/g, '');
    const safeDni = String(form.dni || '').trim();

    if (!firstName || !lastName) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    if (!phoneLocal) {
      setError('Ingresá un teléfono.');
      return;
    }
    if (safeDni && safeDni.length < 7) {
      setError('Si cargás DNI, debe tener al menos 7 dígitos.');
      return;
    }

    const canonicalPhone = buildCanonicalPhone({ countryIso2: form.phoneCountryIso2, localNumber: phoneLocal });
    if (!canonicalPhone) {
      setError('Número de teléfono inválido.');
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        firstName,
        lastName,
        phoneNumber: canonicalPhone,
        phoneCountryCode: resolveCallingCodeByIso2(form.phoneCountryIso2),
        phoneNumberLocal: phoneLocal,
        dni: safeDni || undefined
      });
      setSuccess('Cambios guardados.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = user.firstName || (user as any).name || 'Usuario';

  return (
    <DarkPageLayout
      title="Mi Perfil | TuCancha"
      extraCss={PAGE_CSS}
      breadcrumbs={[
        { label: 'Inicio', href: '/' },
        { label: 'Mi perfil' },
      ]}
    >
      <div className="tc-page-sm">

        {/* ── PAGE HEADER ── */}
        <div className="pf-head" style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <span className="tc-page-eyebrow">Cuenta</span>
          <h1 className="tc-page-h">Mi <i>perfil</i></h1>
          <p className="tc-page-sub">Editá los datos de tu cuenta, {displayName}.</p>
        </div>

        {/* ── FORM CARD ── */}
        <div className="tc-card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>

            {/* Notices */}
            {error && (
              <div className="pf-notice pf-notice-err" style={{ marginBottom: 24 }} role="alert">
                <span>⚠</span> {error}
              </div>
            )}
            {success && (
              <div className="pf-notice pf-notice-ok" style={{ marginBottom: 24 }} role="status" aria-live="polite">
                <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {success}
              </div>
            )}

            <div className="pf-grid">

              {/* Nombre */}
              <div className="tc-field">
                <div className="tc-field-label">
                  <User size={12} /> Nombre
                </div>
                <input
                  className="tc-input"
                  value={form.firstName}
                  onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))}
                  placeholder="Tu nombre"
                />
              </div>

              {/* Apellido */}
              <div className="tc-field">
                <div className="tc-field-label">
                  <User size={12} /> Apellido
                </div>
                <input
                  className="tc-input"
                  value={form.lastName}
                  onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))}
                  placeholder="Tu apellido"
                />
              </div>

              {/* Email */}
              <div className="tc-field pf-full">
                <div className="tc-field-label">
                  <Mail size={12} /> Email (no editable)
                </div>
                <input
                  className="tc-input"
                  value={form.email}
                  disabled
                />
              </div>

              {/* Teléfono */}
              <div className="tc-field pf-full">
                <div className="tc-field-label">
                  <Phone size={12} /> Teléfono
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <select
                    className="tc-select"
                    value={form.phoneCountryIso2}
                    onChange={(e) => setForm(p => ({ ...p, phoneCountryIso2: normalizePhoneCountryIso2(e.target.value) }))}
                  >
                    {PHONE_COUNTRY_OPTIONS.map(opt => (
                      <option key={opt.iso2} value={opt.iso2}>{opt.callingCode} {opt.iso2}</option>
                    ))}
                  </select>
                  <input
                    className="tc-input"
                    value={form.phoneLocal}
                    onChange={(e) => setForm(p => ({ ...p, phoneLocal: e.target.value.replace(/[^\d]/g, '') }))}
                    placeholder="Número local"
                  />
                </div>
              </div>

              {/* DNI */}
              <div className="tc-field pf-full">
                <div className="tc-field-label">
                  <IdCard size={12} /> DNI (opcional)
                </div>
                <input
                  className="tc-input"
                  value={form.dni}
                  onChange={(e) => setForm(p => ({ ...p, dni: e.target.value.replace(/[^\d]/g, '') }))}
                  placeholder="Sin puntos ni espacios"
                />
              </div>

            </div>

            {/* Submit */}
            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} className="pf-save">
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

          </form>
        </div>

        {/* ── DANGER ZONE ── */}
        <div style={{ marginTop: 40 }}>
          <div className="pf-zone-title" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#444', marginBottom: 16 }}>Zona de cuenta</div>
          <div className="tc-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="pf-zone-copy-title" style={{ fontSize: 14, fontWeight: 700, color: '#f2f2f2', marginBottom: 4 }}>Tus reservas activas</div>
                <div className="pf-zone-copy-sub" style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Revisá el estado de todas tus reservas en un solo lugar.</div>
              </div>
              <Link
                href="/bookings"
                className="pf-zone-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 999, color: '#22c55e', fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'background .15s' }}
              >
                Ver reservas →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </DarkPageLayout>
  );
}
