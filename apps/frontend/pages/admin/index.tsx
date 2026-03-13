import { useEffect } from 'react';
import Head from 'next/head';
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

  return (
    <>
      <Head>
        <title>Admin | TuCancha</title>
      </Head>
      {!authChecked || !user
        ? null
        : !hasAdminAccess(user)
          ? <NotFound message="No tenes permiso para acceder al panel de administracion." />
          : null}
    </>
  );
}
