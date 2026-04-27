import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import AdminTabClub from '../../components/admin/AdminTabClub';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { hasAdminAccess } from '../../utils/session';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/settings')}`);
  }, [authChecked, user, router]);

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }
  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenes permiso para acceder al panel de administracion." />;
  }

  return (
    <>
      <Head>
        <title>Configuracion | TuCancha Admin</title>
      </Head>
      <AdminPlaygroundShell activeItem="Ajustes" user={user}>
        <AdminTabClub />
      </AdminPlaygroundShell>
    </>
  );
}
