import AdminLayout from '../../components/AdminLayout';
import NotFound from '../../components/NotFound';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import AdminTabClients from '../../components/admin/AdminTabClients';
import Head from 'next/head';
import { hasAdminAccess } from '../../utils/session';

export default function AdminClientesPage() {
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });

  if (!authChecked || !user) return null;
  if (!hasAdminAccess(user)) return <NotFound message="No tenés permiso para acceder al panel de administración." />;

  return (
    <div className="min-h-screen text-text relative overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <AdminLayout>
        <Head>
          <title>Clientes | TuCancha Admin</title>
        </Head>
        <AdminTabClients />
      </AdminLayout>
    </div>
  );
}
