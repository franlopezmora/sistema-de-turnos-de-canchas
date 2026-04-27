import { useRouter } from 'next/router';
import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminTabStatistics from '../../components/admin/AdminTabStatistics';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';
import { AdminModuleTabs } from '../../components/admin/ui';
import { getActiveClubSlug, normalizeSessionUser } from '../../utils/session';

type ReportsTab = 'resumen' | 'reservas' | 'ingresos' | 'clientes' | 'ocupacion';

const REPORT_TABS: Array<{ value: ReportsTab; label: string; comingSoon?: boolean }> = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'reservas', label: 'Reservas', comingSoon: true },
  { value: 'ingresos', label: 'Ingresos', comingSoon: true },
  { value: 'clientes', label: 'Clientes', comingSoon: true },
  { value: 'ocupacion', label: 'Ocupacion', comingSoon: true },
];

const parseReportsTab = (value: unknown): ReportsTab => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'reservas') return 'reservas';
  if (raw === 'ingresos') return 'ingresos';
  if (raw === 'clientes') return 'clientes';
  if (raw === 'ocupacion') return 'ocupacion';
  return 'resumen';
};

export default function AdminReportsPage() {
  const router = useRouter();
  const activeTab = parseReportsTab(router.query.tab);

  const handleChangeTab = (nextTab: ReportsTab) => {
    if (nextTab === activeTab) return;
    void router.replace(
      {
        pathname: '/admin/informes',
        query: { ...router.query, tab: nextTab },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <AdminRouteShell title="Informes | TuCancha Admin" activeItem="Informes" fromPath="/admin/informes">
      {(user) => {
        const userSlug = getActiveClubSlug(normalizeSessionUser(user as any));

        return (
          <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
            <div className="flex min-h-full flex-col gap-4">
              <AdminModuleTabs
                tabs={REPORT_TABS}
                value={activeTab}
                onChange={(value) => handleChangeTab(value as ReportsTab)}
                ariaLabel="Subnavegacion de informes"
              />

              {activeTab === 'resumen' && (
                userSlug ? (
                  <AdminTabStatistics slugProp={userSlug} />
                ) : (
                  <AdminComingSoonPanel
                    title="Informes"
                    description="No se encontro el club activo para cargar el resumen estadistico."
                  />
                )
              )}

              {activeTab !== 'resumen' && (
                <AdminComingSoonPanel
                  title={`Informes de ${activeTab}`}
                  description="Esta vista queda visible en la hoja de ruta del Admin v2 y se va a consolidar con filtros compartidos."
                />
              )}
            </div>
          </section>
        );
      }}
    </AdminRouteShell>
  );
}
