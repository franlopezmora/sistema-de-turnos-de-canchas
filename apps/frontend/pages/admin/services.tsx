import { useEffect, useState } from 'react';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
import NotFound from '../../components/NotFound';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../../utils/session';
import AdminTabServices from '../../components/admin/AdminTabServices';

export default function AdminServicesPage() {
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });
  const [clubSlug, setClubSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!authChecked || !user) return;
    const normalizedUser = normalizeSessionUser(user as any);
    const activeSlug = getActiveClubSlug(normalizedUser);
    setClubSlug(activeSlug || undefined);
  }, [authChecked, user]);

  if (!authChecked || !user) return null;
  if (!hasAdminAccess(user)) return <NotFound message="No tenes permiso para acceder al panel de administracion." />;

  return (
    <div className="min-h-screen text-text relative overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <AdminLayout>
        <Head>
          <title>Servicios | TuCancha Admin</title>
        </Head>
        <AdminTabServices clubSlug={clubSlug} />
      </AdminLayout>
    </div>
  );
}
