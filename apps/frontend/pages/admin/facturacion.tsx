import AdminRouteShell from '../../components/admin/AdminRouteShell';
import AdminComingSoonPanel from '../../components/admin/AdminComingSoonPanel';

export default function AdminBillingPage() {
  return (
    <AdminRouteShell title="Facturacion | TuCancha Admin" activeItem="Facturacion" fromPath="/admin/facturacion">
      <section className="h-full min-h-0 overflow-y-auto p-4 pb-20 lg:p-6">
        <AdminComingSoonPanel
          title="Facturacion"
          description="Este modulo queda visible para roadmap y va a concentrar comprobantes, estados y conciliacion."
        />
      </section>
    </AdminRouteShell>
  );
}
