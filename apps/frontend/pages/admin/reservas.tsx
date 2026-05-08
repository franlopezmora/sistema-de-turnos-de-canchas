import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';

export default function AdminBookingsPage() {
  return (
    <AdminRouteShell title="Reservas | Punto Admin" activeItem="Reservas" fromPath="/admin/reservas">
      <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
        <AdminComingSoonPanel
          title="Reservas"
          description="Este modulo se mantiene visible para la hoja de ruta y va a consolidar la operacion de reservas fuera de Agenda."
        />
      </section>
    </AdminRouteShell>
  );
}
