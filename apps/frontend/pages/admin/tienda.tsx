import { useRouter } from 'next/router';
import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminTabProducts from '../../components/admin/AdminTabProducts';
import AdminTabServices from '../../components/admin/AdminTabServices';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';
import { AdminModuleTabs } from '../../components/admin/ui';
import { getActiveClubSlug, normalizeSessionUser } from '../../utils/session';

type StoreTab = 'productos' | 'servicios' | 'inventario';

const STORE_TABS: Array<{ value: StoreTab; label: string; comingSoon?: boolean }> = [
  { value: 'productos', label: 'Productos' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'inventario', label: 'Inventario', comingSoon: true },
];

const parseStoreTab = (value: unknown): StoreTab => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'servicios') return 'servicios';
  if (raw === 'inventario') return 'inventario';
  return 'productos';
};

export default function AdminStorePage() {
  const router = useRouter();
  const activeTab = parseStoreTab(router.query.tab);

  const handleChangeTab = (nextTab: StoreTab) => {
    if (nextTab === activeTab) return;
    void router.replace(
      {
        pathname: '/admin/tienda',
        query: { ...router.query, tab: nextTab },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <AdminRouteShell title="Tienda | TuCancha Admin" activeItem="Tienda" fromPath="/admin/tienda">
      {(user) => {
        const normalizedUser = normalizeSessionUser(user as any);
        const clubSlug = getActiveClubSlug(normalizedUser);

        return (
          <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
            <div className="flex min-h-full flex-col gap-4">
              <AdminModuleTabs
                tabs={STORE_TABS}
                value={activeTab}
                onChange={(value) => handleChangeTab(value as StoreTab)}
                ariaLabel="Subnavegacion de tienda"
              />

              {activeTab === 'productos' && <AdminTabProducts clubSlug={clubSlug || undefined} />}
              {activeTab === 'servicios' && <AdminTabServices clubSlug={clubSlug || undefined} />}
              {activeTab === 'inventario' && (
                <AdminComingSoonPanel
                  title="Inventario"
                  description="El inventario consolidado de tienda va a vivir en este modulo, con stock por producto y alertas de reposicion."
                />
              )}
            </div>
          </section>
        );
      }}
    </AdminRouteShell>
  );
}
