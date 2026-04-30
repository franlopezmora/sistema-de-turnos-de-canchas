import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  X,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import ClientsTable from '../../modules/clientes/components/ClientsTable';
import { AdminFilterToolbar, AdminSegmentedControl } from '../../components/admin/ui';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import { ClientService } from '../../services/ClientService';
import { ClubAdminService } from '../../services/ClubAdminService';
import { formatDateTime24 } from '../../utils/dateTime';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../../utils/session';
import { reportUiError } from '../../utils/uiError';
import AccountDrawer from '../../modules/cuentas/components/AccountDrawer';
import {
  buildCanonicalPhone,
  DEFAULT_PHONE_COUNTRY_ISO2,
  normalizePhoneCountryIso2,
  PHONE_COUNTRY_OPTIONS,
  splitCanonicalPhone,
} from '../../utils/phone';

type ClientsView = 'directory' | 'debt' | 'history';
type ClientActionSidebarView = 'none' | 'client_create' | 'client_edit' | 'client_profile' | 'client_delete';


const EPSILON = 0.009;

const formatDate = (dateInput: any) => {
  if (!dateInput) return '-';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const roundMoney = (value: number) => Number(Math.max(0, Number(value || 0)).toFixed(2));

const formatRawTypeFallback = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const shortId = (id: unknown) => String(id || '').slice(-6).toUpperCase();

const formatAccountSourceType = (value: unknown) => {
  const key = String(value || '').trim().toUpperCase();
  if (!key) return '-';
  if (key === 'BOOKING') return 'Reserva';
  if (key === 'BAR') return 'Bar';
  if (key === 'TABLE') return 'Mesa';
  if (key === 'MANUAL') return 'Manual';
  return formatRawTypeFallback(key);
};

const bookingStatusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const sortByCreationDesc = (a: any, b: any) => {
  const createdA = new Date(a?.createdAt || `${a?.date || ''}T${a?.time || '00:00'}:00`).getTime();
  const createdB = new Date(b?.createdAt || `${b?.date || ''}T${b?.time || '00:00'}:00`).getTime();
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) {
    return createdB - createdA;
  }
  return Number(b?.id || 0) - Number(a?.id || 0);
};

const buildClientBookingHistory = (client: any) => {
  const rows = Array.isArray(client?.bookings) ? client.bookings : [];
  const normalized = rows
    .map((entry: any) => ({
      bookingId: entry?.bookingId ?? entry?.id ?? null,
      status: String(entry?.bookingStatus || entry?.status || '').trim().toUpperCase(),
      date: entry?.date || entry?.startDateTime || null,
      time: entry?.time || null,
      courtName: entry?.courtName || '-',
      amount: Number(entry?.totalAmount || entry?.amount || entry?.price || 0),
    }))
    .filter((entry) => entry.bookingId != null);

  const dedup = new Map<string, (typeof normalized)[number]>();
  for (const entry of normalized) {
    const key = String(entry.bookingId);
    if (!dedup.has(key)) dedup.set(key, entry);
  }

  return Array.from(dedup.values()).sort((a, b) => {
    const ta = new Date(a.date || '').getTime();
    const tb = new Date(b.date || '').getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
    return Number(b.bookingId) - Number(a.bookingId);
  });
};


const getClientName = (client: any) => String(client?.name || '').trim() || 'Sin nombre';

const buildConsumptionQuickUnits = (quantity: number) => {
  const normalized = Math.max(1, Math.trunc(Number(quantity) || 1));
  if (normalized === 1) return [1];
  if (normalized === 2) return [1, 2];
  return [1, 2, normalized];
};

export default function AdminClientesPlayground2Page() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });

  const [activeView, setActiveView] = useState<ClientsView>('directory');
  const [searchTerm, setSearchTerm] = useState('');

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [sidebarView, setSidebarView] = useState<ClientActionSidebarView>('none');
  const [editingClientId, setEditingClientId] = useState<string>('');
  const [submittingClient, setSubmittingClient] = useState(false);
  const [clubPhoneCountryIso2, setClubPhoneCountryIso2] = useState(DEFAULT_PHONE_COUNTRY_ISO2);
  const [clientForm, setClientForm] = useState({
    name: '',
    phoneCountryIso2: DEFAULT_PHONE_COUNTRY_ISO2,
    phone: '',
    dni: '',
    email: '',
    isProfessor: false,
  });

  const [deletingClient, setDeletingClient] = useState(false);

  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountDrawerAccountId, setAccountDrawerAccountId] = useState('');

  const [selectedClientDiscountAssignments, setSelectedClientDiscountAssignments] = useState<any[]>([]);
  const [loadingDiscountAssignments, setLoadingDiscountAssignments] = useState(false);
  const [adminToasts, setAdminToasts] = useState<Array<{ id: number; message: string }>>([]);
  const adminToastIdRef = useRef(1);
  const adminToastTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const showAdminToast = useCallback((message: string) => {
    const text = String(message || '').trim();
    if (!text) return;
    const id = adminToastIdRef.current++;
    setAdminToasts((prev) => [...prev, { id, message: text }].slice(-4));
    const timeout = setTimeout(() => {
      setAdminToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
    adminToastTimeoutsRef.current.push(timeout);
  }, []);

  useEffect(() => {
    return () => {
      adminToastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      adminToastTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const text = String(successMessage || '').trim();
    if (!text) return;
    showAdminToast(text);
    setSuccessMessage('');
  }, [showAdminToast, successMessage]);

  useEffect(() => {
    const text = String(errorMessage || '').trim();
    if (!text) return;
    showAdminToast(text);
    setErrorMessage('');
  }, [errorMessage, showAdminToast]);

  const resolveClubSlug = useCallback(() => {
    try {
      if (typeof window === 'undefined') return '';
      const raw = localStorage.getItem('user');
      if (!raw) return '';
      const normalized = normalizeSessionUser(JSON.parse(raw));
      return getActiveClubSlug(normalized) || '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/clientes-playground2')}`);
  }, [authChecked, user, router]);

  useEffect(() => {
    const run = async () => {
      try {
        const slug = resolveClubSlug();
        if (!slug) return;
        const club = await ClubAdminService.getClubInfo(slug);
        const iso = normalizePhoneCountryIso2(club?.country);
        setClubPhoneCountryIso2(iso);
        setClientForm((prev) => ({ ...prev, phoneCountryIso2: prev.phoneCountryIso2 || iso }));
      } catch {
        setClubPhoneCountryIso2(DEFAULT_PHONE_COUNTRY_ISO2);
      }
    };
    void run();
  }, [resolveClubSlug]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const slug = resolveClubSlug() || undefined;
      const rows = await ClientService.listDebtors(slug, { scope: 'all' });
      const normalized = Array.isArray(rows) ? rows : [];
      setClients(normalized);

      if (normalized.length > 0) {
        setSelectedClientId((prev) => {
          if (prev && normalized.some((client) => String(client.id) === prev)) return prev;
          return String(normalized[0].id);
        });
      } else {
        setSelectedClientId('');
      }
      return normalized;
    } catch (error: any) {
      reportUiError({ area: 'ClientesPlayground', action: 'loadClients' }, error);
      setErrorMessage(String(error?.message || 'No se pudo cargar la lista de clientes.'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [resolveClubSlug]);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    void loadClients();
  }, [authChecked, user, loadClients]);

  const clientsWithOpenDebt = useMemo(
    () => clients.filter((client) => Number(client?.totalDebt || 0) > EPSILON),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const source = activeView === 'debt' ? clientsWithOpenDebt : clients;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return source;
    return source.filter((client) => {
      const name = getClientName(client).toLowerCase();
      const phone = String(client?.phone || '').toLowerCase();
      const dni = String(client?.dni || '').toLowerCase();
      const email = String(client?.email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || dni.includes(q) || email.includes(q);
    });
  }, [activeView, clients, clientsWithOpenDebt, searchTerm]);

  useEffect(() => {
    if (activeView !== 'debt') return;
    if (filteredClients.length === 0) {
      setSelectedClientId('');
      return;
    }
    const selectedStillValid = filteredClients.some((client) => String(client.id) === String(selectedClientId));
    if (!selectedStillValid) {
      setSelectedClientId(String(filteredClients[0].id));
    }
  }, [activeView, filteredClients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(selectedClientId)) || null,
    [clients, selectedClientId]
  );

  const totalClients = clients.length;
  const totalDebt = clients.reduce((sum, client) => sum + Number(client?.totalDebt || 0), 0);

  const openCreateClient = () => {
    setEditingClientId('');
    setClientForm({
      name: '',
      phoneCountryIso2: clubPhoneCountryIso2,
      phone: '',
      dni: '',
      email: '',
      isProfessor: false,
    });
    setSidebarView('client_create');
  };

  const openEditClient = (client: any) => {
    const splitPhone = splitCanonicalPhone(String(client?.phone || ''), clubPhoneCountryIso2);
    setEditingClientId(String(client?.id || ''));
    setClientForm({
      name: getClientName(client),
      phoneCountryIso2: splitPhone.countryIso2 || clubPhoneCountryIso2,
      phone: String(splitPhone.localNumber || ''),
      dni: String(client?.dni && client?.dni !== '-' ? client.dni : ''),
      email: String(client?.email || ''),
      isProfessor: Boolean(client?.isProfessor),
    });
    setSidebarView('client_edit');
  };

  const openClientProfile = (client: any) => {
    setSelectedClientId(String(client?.id || ''));
    setSidebarView('client_profile');
  };

  const openDeleteClient = (client: any) => {
    setSelectedClientId(String(client?.id || ''));
    setSidebarView('client_delete');
  };

  const submitClient = async () => {
    const slug = resolveClubSlug();
    if (!slug) {
      setErrorMessage('No se pudo resolver el club activo.');
      return;
    }

    const name = String(clientForm.name || '').trim();
    const phoneLocal = String(clientForm.phone || '').trim();
    const canonicalPhone = buildCanonicalPhone({
      countryIso2: clientForm.phoneCountryIso2 || clubPhoneCountryIso2,
      localNumber: phoneLocal,
    });
    const dni = String(clientForm.dni || '').trim();
    const email = String(clientForm.email || '').trim();

    if (name.length < 2) {
      setErrorMessage('Ingresa un nombre valido.');
      return;
    }
    if (phoneLocal.length > 0 && !canonicalPhone) {
      setErrorMessage('Si cargas telefono, debe ser valido.');
      return;
    }
    if (dni.length > 0 && dni.length < 6) {
      setErrorMessage('Si cargas DNI, debe tener al menos 6 digitos.');
      return;
    }

    try {
      setSubmittingClient(true);
      setErrorMessage('');
      const payload = {
        name,
        phone: canonicalPhone || undefined,
        phoneCountryCode: clientForm.phoneCountryIso2 || undefined,
        phoneNumberLocal: phoneLocal || undefined,
        dni: dni || undefined,
        email: email || undefined,
        isProfessor: Boolean(clientForm.isProfessor),
      };

      if (editingClientId) {
        await ClientService.updateByClubSlug(slug, editingClientId, payload);
        setSuccessMessage('Cliente actualizado correctamente.');
      } else {
        await ClientService.createByClubSlug(slug, payload);
        setSuccessMessage('Cliente creado correctamente.');
      }

      setSidebarView('none');
      const updated = await loadClients();
      if (editingClientId) {
        const found = updated.find((client: any) => String(client.id) === editingClientId);
        if (found) setSelectedClientId(String(found.id));
      }
    } catch (error: any) {
      reportUiError({ area: 'ClientesPlayground', action: 'submitClient' }, error);
      setErrorMessage(String(error?.message || 'No se pudo guardar el cliente.'));
    } finally {
      setSubmittingClient(false);
    }
  };

  const deleteSelectedClient = async () => {
    const slug = resolveClubSlug();
    if (!slug || !selectedClient?.id) {
      setSidebarView('none');
      return;
    }
    try {
      setDeletingClient(true);
      await ClientService.deleteByClubSlug(slug, String(selectedClient.id));
      setSidebarView('none');
      setSuccessMessage('Cliente eliminado correctamente.');
      await loadClients();
    } catch (error: any) {
      reportUiError({ area: 'ClientesPlayground', action: 'deleteClient' }, error);
      setErrorMessage(String(error?.message || 'No se pudo eliminar el cliente.'));
    } finally {
      setDeletingClient(false);
    }
  };

  const selectedDebtorPendingEntries = useMemo(() => {
    if (!selectedClient) return [];
    return (Array.isArray(selectedClient.history) ? selectedClient.history : [])
      .slice()
      .sort(sortByCreationDesc)
      .filter((entry: any) => Number(entry?.amount || 0) > EPSILON);
  }, [selectedClient]);


  const openAccountDrawer = (accountId: string) => {
    setAccountDrawerAccountId(accountId);
    setAccountDrawerOpen(true);
  };


  const sidebarOpen = sidebarView !== 'none';
  const isClientFormView = sidebarView === 'client_create' || sidebarView === 'client_edit';

  const closeActionSidebar = useCallback(() => {
    if (deletingClient || submittingClient) return;
    setSidebarView('none');
  }, [deletingClient, submittingClient]);


  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeActionSidebar();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen, closeActionSidebar]);


  useEffect(() => {
    const run = async () => {
      if (!selectedClient?.id) {
        setSelectedClientDiscountAssignments([]);
        return;
      }
      if (activeView !== 'history') return;
      const slug = resolveClubSlug();
      if (!slug) return;
      try {
        setLoadingDiscountAssignments(true);
        const rows = await ClubAdminService.listClientDiscountAssignments(slug, String(selectedClient.id));
        setSelectedClientDiscountAssignments(Array.isArray(rows) ? rows : []);
      } catch {
        setSelectedClientDiscountAssignments([]);
      } finally {
        setLoadingDiscountAssignments(false);
      }
    };
    void run();
  }, [activeView, selectedClient?.id, resolveClubSlug]);

  const historyBookings = useMemo(() => (selectedClient ? buildClientBookingHistory(selectedClient) : []), [selectedClient]);
  const historyAccounts = useMemo(
    () => (selectedClient?.history || []).slice().sort(sortByCreationDesc),
    [selectedClient]
  );

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }

  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenes permiso para acceder al panel de administracion." />;
  }

  return (
    <>
      <Head>
        <title>Clientes | TuCancha Admin</title>
      </Head>

      <AdminPlaygroundShell activeItem="Clientes" user={user} contentMuted={sidebarOpen}>
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
              <AdminSegmentedControl
                ariaLabel="Vistas de clientes"
                value={activeView}
                onChange={(nextView) => setActiveView(nextView as ClientsView)}
                options={[
                  { value: 'directory', label: 'Directorio' },
                  { value: 'debt', label: 'Cuentas y deuda' },
                  { value: 'history', label: 'Historial' },
                ]}
                className="w-fit"
              />

              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Total clientes</p>
                  <p className="mt-2 text-lg font-semibold text-[#1f2638]">{totalClients}</p>
                </article>
                <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Deuda total</p>
                  <p className={`mt-2 text-lg font-semibold ${totalDebt > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(totalDebt)}</p>
                </article>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                {activeView === 'directory' && (
                  <div className="flex h-full flex-col">
                    <article className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#dce2ee] bg-white">
                      <div className="border-b border-[#eef2f7] pl-4 pr-2 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h2 className="text-[13px] font-semibold text-[#1f2638]">Directorio de clientes</h2>
                            <p className="mt-1 text-[12px] text-[#6f7890]">
                              Listado operativo con acceso rápido a perfil, edición y baja.
                            </p>
                          </div>
                          <AdminFilterToolbar className="border-0 bg-transparent p-0 gap-1 sm:flex-nowrap sm:justify-end">
                            <label className="relative w-full sm:w-[300px] sm:flex-none">
                              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a5]" />
                              <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar por nombre, dni, email o telefono"
                                className="h-8 w-full rounded-xl border border-[#dce2ee] bg-white pl-9 pr-3 text-[12px] outline-none focus:border-[#3053e2]"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={openCreateClient}
                              className="h-8 rounded-lg bg-[#3053e2] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#2748cc]"
                            >
                              <span className="inline-flex items-center gap-1"><Plus size={14} /> Nuevo cliente</span>
                            </button>
                          </AdminFilterToolbar>
                        </div>
                      </div>

                      <ClientsTable
                        clients={filteredClients}
                        loading={loading}
                        onRowClick={openClientProfile}
                        onEdit={openEditClient}
                        onDelete={openDeleteClient}
                        selectedId={selectedClientId}
                        className="rounded-b-xl"
                      />
                    </article>
                  </div>
                )}

                {activeView === 'debt' && (
                  <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
                    <article className="flex min-h-0 flex-col rounded-xl border border-[#dce2ee] bg-white">
                      <div className="p-4 pb-3">
                        <h2 className="text-[13px] font-semibold text-[#1f2638]">Clientes con deuda</h2>
                        <p className="mt-1 text-[12px] text-[#6f7890]">Selecciona un cliente para revisar cuentas pendientes.</p>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto border-t border-[#dce2ee]">
                        {loading ? (
                          <div className="p-6 text-center text-[13px] text-[#6f7890]">Cargando...</div>
                        ) : filteredClients.length === 0 ? (
                          <div className="p-6 text-center text-[13px] text-[#6f7890]">No hay clientes con deuda.</div>
                        ) : (
                          <ul className="divide-y divide-[#eef2f7]">
                            {filteredClients.map((client) => (
                              <li key={String(client.id)}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedClientId(String(client.id))}
                                  className={`w-full px-3 py-3 text-left transition ${
                                    String(selectedClientId) === String(client.id) ? 'bg-[#edf1ff]' : 'hover:bg-[#f8f9fd]'
                                  }`}
                                >
                                  <p className="text-[13px] font-semibold text-[#1f2638]">{getClientName(client)}</p>
                                  <p className="text-[12px] text-red-700">Pendiente: {formatMoney(Number(client.totalDebt || 0))}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>

                    <article className="flex min-h-0 flex-col rounded-xl border border-[#dce2ee] bg-white">
                      <div className="flex items-center justify-between p-4 pb-3">
                        <h2 className="text-[13px] font-semibold text-[#1f2638]">Cuentas pendientes</h2>
                        <span className="text-[12px] text-[#6f7890]">{selectedClient ? getClientName(selectedClient) : 'Sin seleccion'}</span>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto border-t border-[#dce2ee] p-4">
                      {!selectedClient ? (
                        <div className="rounded-xl border border-[#dce2ee] p-8 text-center text-[13px] text-[#6f7890]">Selecciona un cliente para ver su deuda.</div>
                      ) : selectedDebtorPendingEntries.length === 0 ? (
                        <div className="rounded-xl border border-[#dce2ee] p-8 text-center text-[13px] text-[#6f7890]">Este cliente no tiene cuentas pendientes.</div>
                      ) : (
                        <div className="space-y-3">
                          {selectedDebtorPendingEntries.map((account: any) => (
                            <div key={String(account.id)} className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[13px] font-semibold text-[#1f2638]">Cuenta {formatAccountSourceType(account.sourceType)} #{shortId(account.id)}</p>
                                  <p className="text-[12px] text-[#6f7890]">{formatDate(account.date)} {account.time ? `· ${account.time}` : ''}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[12px] text-[#6f7890]">Pendiente</p>
                                  <p className="text-[13px] font-semibold text-red-700">{formatMoney(Number(account.amount || 0))}</p>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openAccountDrawer(String(account.id))}
                                  className="h-8 rounded-lg border border-[#dce2ee] bg-white px-2.5 text-[12px] font-semibold text-[#4e5870] hover:bg-[#f8f9fd]"
                                >
                                  Ver detalle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAccountDrawer(String(account.id))}
                                  className="h-8 rounded-lg bg-[#3053e2] px-2.5 text-[12px] font-semibold text-white hover:bg-[#2748cc]"
                                >
                                  <span className="inline-flex items-center gap-1"><DollarSign size={13} /> Cobrar</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    </article>
                  </div>
                )}

                {activeView === 'history' && (
                  <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                    <article className="flex min-h-0 flex-col rounded-xl border border-[#dce2ee] bg-white">
                      <div className="p-4 pb-3">
                        <h2 className="text-[13px] font-semibold text-[#1f2638]">Clientes</h2>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto border-t border-[#dce2ee]">
                        {loading ? (
                          <div className="p-6 text-center text-[13px] text-[#6f7890]">Cargando...</div>
                        ) : filteredClients.length === 0 ? (
                          <div className="p-6 text-center text-[13px] text-[#6f7890]">Sin clientes.</div>
                        ) : (
                          <ul className="divide-y divide-[#eef2f7]">
                            {filteredClients.map((client) => (
                              <li key={String(client.id)}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedClientId(String(client.id))}
                                  className={`w-full px-3 py-3 text-left transition ${
                                    String(selectedClientId) === String(client.id) ? 'bg-[#edf1ff]' : 'hover:bg-[#f8f9fd]'
                                  }`}
                                >
                                  <p className="text-[13px] font-semibold text-[#1f2638]">{getClientName(client)}</p>
                                  <p className="text-[12px] text-[#6f7890]">{String(client.phone || client.email || '-')}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>

                    <article className="flex min-h-0 flex-col overflow-auto rounded-xl border border-[#dce2ee] bg-white p-4">
                      {!selectedClient ? (
                        <div className="rounded-xl border border-[#dce2ee] p-8 text-center text-[13px] text-[#6f7890]">Selecciona un cliente para ver su perfil.</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Cliente</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{getClientName(selectedClient)}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">DNI</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{String(selectedClient.dni || '-')}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Telefono</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{String(selectedClient.phone || '-')}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Email</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638] break-all">{String(selectedClient.email || '-')}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Total reservas</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{Number(selectedClient.totalBookings || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Saldo actual</p>
                              <p className={`mt-1 text-[13px] font-semibold ${Number(selectedClient.totalDebt || 0) > EPSILON ? 'text-red-700' : 'text-[#6f7890]'}`}>
                                {Number(selectedClient.totalDebt || 0) > EPSILON ? formatMoney(Number(selectedClient.totalDebt || 0)) : 'Sin deuda'}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#dce2ee] p-3">
                            <h3 className="text-[13px] font-semibold text-[#1f2638]">Asignaciones de descuentos</h3>
                            {loadingDiscountAssignments ? (
                              <p className="mt-2 text-[12px] text-[#6f7890]">Cargando asignaciones...</p>
                            ) : selectedClientDiscountAssignments.length === 0 ? (
                              <p className="mt-2 text-[12px] text-[#6f7890]">Sin asignaciones registradas.</p>
                            ) : (
                              <ul className="mt-2 space-y-1">
                                {selectedClientDiscountAssignments.map((assignment: any, index: number) => (
                                  <li key={String(assignment?.id || `${index}`)} className="rounded-lg border border-[#dce2ee] bg-[#f8f9fd] px-2 py-1.5 text-[12px] text-[#4e5870]">
                                    {String(assignment?.policy?.name || assignment?.policyName || assignment?.policyId || 'Politica')}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <div className="rounded-xl border border-[#dce2ee] p-3">
                              <h3 className="text-[13px] font-semibold text-[#1f2638]">Historial de reservas</h3>
                              <div className="mt-2 max-h-[280px] overflow-auto">
                                {historyBookings.length === 0 ? (
                                  <p className="text-[12px] text-[#6f7890]">Sin reservas registradas.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {historyBookings.map((booking: any) => (
                                      <li key={String(booking.bookingId)} className="rounded-lg border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                                        <p className="text-[12px] font-semibold text-[#1f2638]">Reserva #{booking.bookingId}</p>
                                        <p className="text-[12px] text-[#6f7890]">{formatDate(booking.date)}{booking.time ? ` · ${booking.time}` : ''} · {booking.courtName || '-'}</p>
                                        <p className="text-[12px] text-[#4e5870]">{bookingStatusLabel[booking.status] || booking.status || 'Sin estado'} · {formatMoney(Number(booking.amount || 0))}</p>
                                      </li>
                                    ))}
                                  </ul>
              )}
            </div>

            {adminToasts.length > 0 && (
              <div className="pointer-events-none fixed right-5 top-[84px] z-[150] flex w-full max-w-[360px] flex-col gap-2">
                {adminToasts.map((toast) => (
                  <div
                    key={toast.id}
                    className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2 text-[12px] font-semibold text-[#27314a] shadow-lg"
                  >
                    {toast.message}
                  </div>
                ))}
              </div>
            )}
          </div>

                            <div className="rounded-xl border border-[#dce2ee] p-3">
                              <h3 className="text-[13px] font-semibold text-[#1f2638]">Historial de cuentas</h3>
                              <div className="mt-2 max-h-[280px] overflow-auto">
                                {historyAccounts.length === 0 ? (
                                  <p className="text-[12px] text-[#6f7890]">Sin cuentas registradas.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {historyAccounts.map((account: any) => (
                                      <li key={String(account.id)} className="rounded-lg border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                                        <p className="text-[12px] font-semibold text-[#1f2638]">Cuenta {formatAccountSourceType(account.sourceType)} #{shortId(account.id)}</p>
                                        <p className="text-[12px] text-[#6f7890]">{formatDate(account.date)}{account.time ? ` · ${account.time}` : ''}</p>
                                        <p className="text-[12px] text-[#4e5870]">Total {formatMoney(Number(account.totalAmount || 0))} · Pendiente {formatMoney(Number(account.amount || 0))}</p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  </div>
                )}
              </div>
        </div>
      </AdminPlaygroundShell>


      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar panel"
          className="fixed inset-x-0 bottom-0 top-16 z-[105] bg-[#101326]/20 transition-[left] duration-200 ease-out will-change-[left] lg:left-[var(--admin-playground-sidebar-left,168px)] lg:rounded-tl-[12px]"
          onClick={closeActionSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 top-16 z-[115] w-full max-w-[620px] border-l border-[#e6e8ee] bg-white transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative h-full w-full flex flex-col">
          <header className="border-b border-[#eef0f5] px-6 py-5 flex items-start justify-between">
            <div>
              <h2 className="text-[24px] leading-none font-semibold text-[#1f2638] tracking-[-0.015em]">
                {sidebarView === 'client_create' && 'Nuevo cliente'}
                {sidebarView === 'client_edit' && 'Editar cliente'}
                {sidebarView === 'client_profile' && 'Perfil del cliente'}
                {sidebarView === 'client_delete' && 'Eliminar cliente'}
              </h2>
              <p className="mt-3 text-[13px] leading-snug text-[#7d879d]">
                {isClientFormView && 'Gestion de datos basicos del cliente.'}
                {sidebarView === 'client_profile' && (selectedClient ? getClientName(selectedClient) : 'Sin cliente seleccionado')}
                {sidebarView === 'client_delete' && 'Esta accion es permanente.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeActionSidebar}
              className="h-9 w-9 rounded-full border border-[#e4e7ee] text-[#798194] grid place-items-center hover:bg-[#f7f8fb] shrink-0"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {isClientFormView && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(event) => setClientForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="Nombre y apellido"
                />

                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <select
                    value={clientForm.phoneCountryIso2}
                    onChange={(event) => setClientForm((prev) => ({ ...prev, phoneCountryIso2: normalizePhoneCountryIso2(event.target.value) }))}
                    className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-2 text-[12px] font-semibold outline-none focus:border-[#3053e2]"
                  >
                    {PHONE_COUNTRY_OPTIONS.map((option) => (
                      <option key={option.iso2} value={option.iso2}>
                        {option.callingCode} {option.iso2}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={clientForm.phone}
                    onChange={(event) =>
                      setClientForm((prev) => ({ ...prev, phone: event.target.value.replace(/[^\d]/g, '') }))
                    }
                    className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                    placeholder="Telefono"
                  />
                </div>

                <input
                  type="text"
                  value={clientForm.dni}
                  onChange={(event) => setClientForm((prev) => ({ ...prev, dni: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="DNI"
                />

                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) => setClientForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="Email"
                />

                <label className="inline-flex items-center gap-2 pt-1 text-[12px] font-semibold text-[#4e5870]">
                  <input
                    type="checkbox"
                    checked={Boolean(clientForm.isProfessor)}
                    onChange={(event) => setClientForm((prev) => ({ ...prev, isProfessor: event.target.checked }))}
                  />
                  Es profesor
                </label>
              </div>
            )}

            {sidebarView === 'client_profile' && (
              <div className="space-y-4">
                {!selectedClient ? (
                  <div className="rounded-xl border border-[#dce2ee] p-8 text-center text-[13px] text-[#6f7890]">Selecciona un cliente.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Cliente</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{getClientName(selectedClient)}</p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">DNI</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{String(selectedClient.dni || '-')}</p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Telefono</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{String(selectedClient.phone || '-')}</p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Email</p>
                        <p className="mt-1 break-all text-[13px] font-semibold text-[#1f2638]">{String(selectedClient.email || '-')}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Estado comercial</p>
                      <p className="mt-1 text-[13px] text-[#4e5870]">
                        Total reservas: <span className="font-semibold text-[#1f2638]">{Number(selectedClient.totalBookings || 0)}</span>
                      </p>
                      {Number(selectedClient.totalDebt || 0) > EPSILON ? (
                        <p className="mt-1 text-[13px] text-red-700">
                          Deuda vigente: <span className="font-semibold">{formatMoney(Number(selectedClient.totalDebt || 0))}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#6f7890]">
                          Sin deuda vigente
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {sidebarView === 'client_delete' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] p-3 text-[13px] text-[#7f1d1d]">
                  Vas a eliminar a {selectedClient ? getClientName(selectedClient) : 'este cliente'}. Esta accion no se puede deshacer.
                </div>
                <div className="rounded-xl border border-[#dce2ee] bg-white p-3">
                  <p className="text-[12px] uppercase tracking-wide text-[#6f7890]">Cliente seleccionado</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{selectedClient ? getClientName(selectedClient) : '-'}</p>
                </div>
              </div>
            )}

          </div>

          <footer className="border-t border-[#eef0f5] bg-white p-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeActionSidebar}
                className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] hover:bg-[#f8f9fd]"
              >
                Cancelar
              </button>

            {isClientFormView && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingClientId('');
                    setClientForm({
                      name: '',
                      phoneCountryIso2: clubPhoneCountryIso2,
                      phone: '',
                      dni: '',
                      email: '',
                      isProfessor: false,
                    });
                  }}
                  className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] hover:bg-[#f8f9fd]"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => void submitClient()}
                  disabled={submittingClient}
                  className="h-10 rounded-xl bg-[#3053e2] px-3 text-[13px] font-semibold text-white transition hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingClient ? 'Guardando...' : sidebarView === 'client_edit' ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </>
            )}

            {sidebarView === 'client_profile' && selectedClient && (
              <button
                type="button"
                onClick={() => openEditClient(selectedClient)}
                className="h-10 rounded-xl bg-[#3053e2] px-3 text-[13px] font-semibold text-white hover:bg-[#2748cc]"
              >
                Editar cliente
              </button>
            )}

            {sidebarView === 'client_delete' && (
              <button
                type="button"
                onClick={() => {
                  if (deletingClient) return;
                  void deleteSelectedClient();
                }}
                className="h-10 rounded-xl bg-[#b91c1c] px-3 text-[13px] font-semibold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingClient}
              >
                {deletingClient ? 'Eliminando...' : 'Si, eliminar'}
              </button>
            )}


            </div>
          </footer>
        </div>
      </aside>
      <AccountDrawer
        accountId={accountDrawerAccountId || null}
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        onSuccess={() => void loadClients()}
      />
    </>
  );
}
