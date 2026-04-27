import { useRouter } from 'next/router';
import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminTabClub from '../../components/admin/AdminTabClub';
import AdminTabCourts from '../../components/admin/AdminTabCourts';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';
import { AdminModuleTabs } from '../../components/admin/ui';

type SettingsTab =
  | 'club'
  | 'canchas'
  | 'actividades'
  | 'horarios'
  | 'precios'
  | 'usuarios'
  | 'notificaciones'
  | 'excepciones';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string; comingSoon?: boolean }> = [
  { value: 'club', label: 'Club' },
  { value: 'canchas', label: 'Canchas' },
  { value: 'actividades', label: 'Actividades', comingSoon: true },
  { value: 'horarios', label: 'Horarios', comingSoon: true },
  { value: 'precios', label: 'Precios', comingSoon: true },
  { value: 'usuarios', label: 'Usuarios', comingSoon: true },
  { value: 'notificaciones', label: 'Notificaciones', comingSoon: true },
  { value: 'excepciones', label: 'Excepciones', comingSoon: true },
];

const parseSettingsTab = (value: unknown): SettingsTab => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'canchas') return 'canchas';
  if (raw === 'actividades') return 'actividades';
  if (raw === 'horarios') return 'horarios';
  if (raw === 'precios') return 'precios';
  if (raw === 'usuarios') return 'usuarios';
  if (raw === 'notificaciones') return 'notificaciones';
  if (raw === 'excepciones') return 'excepciones';
  return 'club';
};

const comingSoonLabelByTab: Record<Exclude<SettingsTab, 'club' | 'canchas'>, string> = {
  actividades: 'Actividades y servicios de reserva',
  horarios: 'Horarios y disponibilidad',
  precios: 'Reglas de precios',
  usuarios: 'Usuarios administradores',
  notificaciones: 'Notificaciones automaticas',
  excepciones: 'Excepciones de agenda',
};

export default function AdminSettingsV2Page() {
  const router = useRouter();
  const activeTab = parseSettingsTab(router.query.tab);

  const handleChangeTab = (nextTab: SettingsTab) => {
    if (nextTab === activeTab) return;
    void router.replace(
      {
        pathname: '/admin/ajustes',
        query: { ...router.query, tab: nextTab },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <AdminRouteShell title="Ajustes | TuCancha Admin" activeItem="Ajustes" fromPath="/admin/ajustes">
      <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
        <div className="flex min-h-full flex-col gap-4">
          <AdminModuleTabs
            tabs={SETTINGS_TABS}
            value={activeTab}
            onChange={(value) => handleChangeTab(value as SettingsTab)}
            ariaLabel="Subnavegacion de ajustes"
          />

          {activeTab === 'club' && <AdminTabClub />}
          {activeTab === 'canchas' && <AdminTabCourts />}
          {activeTab !== 'club' && activeTab !== 'canchas' && (
            <AdminComingSoonPanel
              title={comingSoonLabelByTab[activeTab]}
              description="Esta configuracion queda visible en roadmap y se migrara a panel lateral con componentes compartidos."
            />
          )}
        </div>
      </section>
    </AdminRouteShell>
  );
}
