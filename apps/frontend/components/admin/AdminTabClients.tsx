import ClientsPage from '../ClientsPage';
import AdminDuplicateIncidents from './AdminDuplicateIncidents';

export default function AdminTabClients() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ClientsPage />
      <AdminDuplicateIncidents />
    </div>
  );
}
