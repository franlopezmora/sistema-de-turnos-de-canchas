import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';

export default function AdminMessagesPage() {
  return (
    <AdminRouteShell title="Mensajes | Punto Admin" activeItem="Mensajes" fromPath="/admin/mensajes">
      <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
        <AdminComingSoonPanel
          title="Mensajes"
          description="Este modulo queda visible para roadmap y va a centralizar notificaciones y comunicacion con clientes."
        />
      </section>
    </AdminRouteShell>
  );
}
