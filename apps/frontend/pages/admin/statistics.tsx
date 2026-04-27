import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import AdminTabStatistics from '../../components/admin/AdminTabStatistics';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../../utils/session';

export default function AdminStatisticsPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/statistics')}`);
  }, [authChecked, user, router]);

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }

  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenes permiso para acceder." />;
  }

  const userSlug = getActiveClubSlug(normalizeSessionUser(user as any));

  return (
    <>
      <Head>
        <title>Estadisticas | TuCancha Admin</title>
      </Head>
      <AdminPlaygroundShell activeItem="Informes" user={user}>
        {userSlug ? (
          <AdminTabStatistics slugProp={userSlug} />
        ) : (
          <div className="p-8 text-red-500">Error: No se encontro el club asociado a este administrador.</div>
        )}
      </AdminPlaygroundShell>
    </>
  );
}
