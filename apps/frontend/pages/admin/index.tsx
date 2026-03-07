import { useEffect } from 'react';
import { useRouter } from 'next/router';
import NotFound from '../../components/NotFound';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { hasAdminAccess } from '../../utils/session';

export default function AdminIndex() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });

  useEffect(() => {
    if (!authChecked || !user) return;
    if (!hasAdminAccess(user)) return;
    router.replace('/admin/agenda');
  }, [authChecked, user, router]);

  if (!authChecked || !user) return null;
  if (!hasAdminAccess(user)) return <NotFound message="No tenés permiso para acceder al panel de administración." />;
  return null;
}
