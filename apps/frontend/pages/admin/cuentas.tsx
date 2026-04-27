import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import { AdminPageHeader, AdminPanel, AdminRightSidebar } from '../../components/admin/ui';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { addAccountItem, closeAccount, getAccountById, listAccounts, openAccount, registerPayment, type PaymentChannel, type PaymentSource } from '../../services/AccountService';
import { ClubAdminService, type ClubCatalogService } from '../../services/ClubAdminService';
import AdminAppModal from '../../components/admin/ui/AdminAppModal';
import type { RefundDraft } from '../../modules/refunds/refund.types';
import { buildDefaultRefundDraft } from '../../modules/refunds/refund.policy';
import { validateRefundAmountInput } from '../../modules/refunds/refund.validators';
import { requestManualRefund } from '../../modules/refunds/refund.facade';
import RefundRequestModal from '../../components/admin/refunds/RefundRequestModal';
import AccountManagerModal from '../../components/admin/AccountManagerModal';
import PaymentCalculator, { type PaymentCalculatorResult } from '../../components/PaymentCalculator';
import { type ClubProductSearchItem } from '../../components/ui/ClubProductSearch';
import { type ClubServiceSearchItem } from '../../components/ui/ClubServiceSearch';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../../utils/session';
import { reportUiError } from '../../utils/uiError';

type AccountRow = {
  id: string;
  sourceType: 'BOOKING' | 'BAR' | 'TABLE' | 'MANUAL';
  sourceId: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt?: string | null;
  booking?: {
    id: number;
    startDateTime: string;
    courtName?: string | null;
    clientName?: string | null;
  } | null;
};

const EMPTY_NEW_ITEM = {
  description: '',
  quantity: 0,
  unitPrice: 0,
  type: 'PRODUCT' as const,
  productId: undefined,
  serviceCode: undefined
};

export default function AdminAccountsPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });
  const [openAccounts, setOpenAccounts] = useState<AccountRow[]>([]);
  const [closedAccounts, setClosedAccounts] = useState<AccountRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [newItem, setNewItem] = useState<{ description: string; quantity: number; unitPrice: number; type: 'PRODUCT' | 'SERVICE' | 'ADJUSTMENT'; productId?: number; serviceCode?: string }>(EMPTY_NEW_ITEM);
  const [payment, setPayment] = useState<{ channel: PaymentChannel; collectorAccountLabel: string; externalReference: string; source: PaymentSource }>({ channel: 'AUTO', collectorAccountLabel: '', externalReference: '', source: 'POS' });
  const [newAccount, setNewAccount] = useState({ sourceType: 'MANUAL' as const, sourceId: '' });
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundPaymentMaxAmount, setRefundPaymentMaxAmount] = useState(0);
  const [refundDraft, setRefundDraft] = useState<RefundDraft>(() => buildDefaultRefundDraft('ACCOUNT_MANUAL', 0));
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [clubSlug, setClubSlug] = useState('');
  const [products, setProducts] = useState<ClubProductSearchItem[]>([]);
  const [services, setServices] = useState<ClubServiceSearchItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [showPaymentCalculator, setShowPaymentCalculator] = useState(false);
  const [showOpenAccountModal, setShowOpenAccountModal] = useState(false);
  const [openAccountModalError, setOpenAccountModalError] = useState('');
  const [submittingCalculator, setSubmittingCalculator] = useState(false);
  const [openAccountsSearch, setOpenAccountsSearch] = useState('');
  const [closedVisibleCount, setClosedVisibleCount] = useState(12);
  const [showCloseAccountConfirm, setShowCloseAccountConfirm] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);
  const [closeBlockedModal, setCloseBlockedModal] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: '' });
  const [showClosedAccountModal, setShowClosedAccountModal] = useState(false);
  const [selectedClosedAccountId, setSelectedClosedAccountId] = useState<string>('');
  const [selectedClosedAccountDetail, setSelectedClosedAccountDetail] = useState<any>(null);
  const [loadingClosedAccountDetail, setLoadingClosedAccountDetail] = useState(false);
  const [closedAccountSidebarTab, setClosedAccountSidebarTab] = useState<'SUMMARY' | 'ITEMS' | 'PAYMENTS'>('SUMMARY');

  useEffect(() => {
    if (!showClosedAccountModal) return;
    setClosedAccountSidebarTab('SUMMARY');
  }, [showClosedAccountModal, selectedClosedAccountId]);

  const refreshLists = useCallback(async () => {
    if (!authChecked || !user) return;
    setLoading(true);
    setError('');
    try {
      const [opens, closeds] = await Promise.all([
        listAccounts({ status: 'OPEN' }),
        listAccounts({ status: 'CLOSED' })
      ]);
      setOpenAccounts(opens);
      setClosedAccounts(closeds);
      if (!selectedId && opens.length > 0) {
        setSelectedId(opens[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  }, [authChecked, selectedId, user]);

  const resolveClubSlug = useCallback(() => {
    if (typeof window === 'undefined') return '';
    try {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      const clubIdx = parts.findIndex((part) => part === 'club');
      if (clubIdx >= 0 && parts[clubIdx + 1]) return parts[clubIdx + 1];

      const rawUser = localStorage.getItem('user');
      if (!rawUser) return '';
      const normalized = normalizeSessionUser(JSON.parse(rawUser));
      return getActiveClubSlug(normalized) || '';
    } catch (err) {
      reportUiError({ area: 'AdminAccountsPage', action: 'resolveClubSlug' }, err);
      setError('No se pudo resolver el club activo para cargar productos.');
      return '';
    }
  }, []);

  const loadClubProducts = useCallback(async (slug: string) => {
    if (!slug) {
      setProducts([]);
      return;
    }
    try {
      setProductsLoading(true);
      const data = await ClubAdminService.getProducts(slug);
      const normalizedProducts = Array.isArray(data)
        ? data.map((item: any) => ({
            id: Number(item?.id || 0),
            name: String(item?.name || ''),
            price: Number(item?.price || 0),
            stock: item?.stock !== undefined && item?.stock !== null ? Number(item.stock) : null
          }))
        : [];
      setProducts(normalizedProducts.filter((item: ClubProductSearchItem) => Number(item.id) > 0 && item.name.trim().length > 0));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los productos del club');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadClubServices = useCallback(async (slug: string) => {
    if (!slug) {
      setServices([]);
      return;
    }
    try {
      setServicesLoading(true);
      const data = await ClubAdminService.getServices(slug, false);
      const normalizedServices = Array.isArray(data)
        ? data.map((item: ClubCatalogService) => ({
            id: Number(item?.id || 0),
            code: String(item?.code || '').trim(),
            name: String(item?.name || '').trim(),
            price: Number(item?.price || 0),
            isActive: Boolean(item?.isActive)
          }))
        : [];
      setServices(
        normalizedServices.filter(
          (item: ClubServiceSearchItem) =>
            Number(item.id) > 0 &&
            item.name.length > 0 &&
            item.code.length > 0 &&
            Number.isFinite(item.price)
        )
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los servicios del club');
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await getAccountById(id);
      setDetail(data);
      setPayment((prev) => ({
        ...prev,
        collectorAccountLabel: '',
        externalReference: ''
      }));
    } catch (err: any) {
      setError(err.message || 'Error al cargar detalle');
    }
  }, []);

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/cuentas')}`);
  }, [authChecked, user, router]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (!authChecked || !user) return;
    const resolved = resolveClubSlug();
    setClubSlug(resolved);
    void Promise.all([loadClubProducts(resolved), loadClubServices(resolved)]);
  }, [authChecked, loadClubProducts, loadClubServices, resolveClubSlug, user]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const totals = useMemo(() => ({
    open: openAccounts.length,
    closed: closedAccounts.length
  }), [openAccounts.length, closedAccounts.length]);

  const filteredOpenAccounts = useMemo(() => {
    const term = openAccountsSearch.trim().toLowerCase();
    if (!term) return openAccounts;
    return openAccounts.filter((account) => {
      const booking = account.booking;
      const haystack = [
        account.id,
        account.sourceType,
        account.sourceId,
        booking?.clientName || '',
        booking?.courtName || '',
        booking?.id ? String(booking.id) : ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [openAccounts, openAccountsSearch]);

  const visibleClosedAccounts = useMemo(
    () => closedAccounts.slice(0, Math.max(1, closedVisibleCount)),
    [closedAccounts, closedVisibleCount]
  );

  const hasMoreClosedAccounts = closedAccounts.length > visibleClosedAccounts.length;

  const shortCode = (value?: string) => {
    if (!value) return '-';
    return value.slice(0, 8).toUpperCase();
  };

  const formatRawCode = (value?: string) => {
    if (!value) return '-';
    return value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatBookingDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString('es-AR');
    const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${time}`;
  };

  const itemOutstandingMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!detail?.items) return map;

    const allocatedByItem = new Map<string, number>();
    for (const paymentEntry of detail?.payments || []) {
      for (const allocation of paymentEntry?.allocations || []) {
        const itemId = String(allocation?.accountItemId || '');
        if (!itemId) continue;
        const prev = Number(allocatedByItem.get(itemId) || 0);
        allocatedByItem.set(itemId, Number((prev + Number(allocation?.amount || 0)).toFixed(2)));
      }
    }

    for (const item of detail.items || []) {
      const itemId = String(item.id || '');
      if (!itemId) continue;
      const total = Number(item.total || 0);
      const allocated = Number(allocatedByItem.get(itemId) || 0);
      map.set(itemId, Math.max(0, Number((total - allocated).toFixed(2))));
    }

    return map;
  }, [detail]);

  const pendingAccountItems = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail.items : [];
    return items
      .map((item: any) => {
        const id = String(item?.id || '');
        const quantity = Math.max(1, Number(item?.quantity || 1));
        const remaining = Number(itemOutstandingMap.get(id) || 0);
        return {
          id,
          type: String(item?.type || 'OTHER'),
          description: String(item?.description || 'Concepto'),
          quantity,
          remaining
        };
      })
      .filter((item) => item.id && item.remaining > 0.009);
  }, [detail?.items, itemOutstandingMap]);

  const bookingPendingItems = useMemo(
    () => pendingAccountItems.filter((item) => item.type === 'BOOKING'),
    [pendingAccountItems]
  );

  const consumptionPendingItems = useMemo(
    () => pendingAccountItems.filter((item) => item.type !== 'BOOKING'),
    [pendingAccountItems]
  );

  const paymentCalculatorContext = useMemo(() => {
    const courtPending = Number(bookingPendingItems.reduce((sum, item) => sum + item.remaining, 0).toFixed(2));
    const cartItems = consumptionPendingItems.map((item) => ({
      id: item.id,
      productName: item.description,
      quantity: item.quantity,
      price: Number((item.remaining / item.quantity).toFixed(2))
    }));
    const cartTotal = Number(cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    const totalPending = Number((courtPending + cartTotal).toFixed(2));
    return { courtPending, cartItems, totalPending };
  }, [bookingPendingItems, consumptionPendingItems]);

  const formatAccountSourceType = (sourceType?: string) => {
    switch (sourceType) {
      case 'MANUAL':
        return 'Manual';
      case 'BAR':
        return 'Bar';
      case 'TABLE':
        return 'Mesa';
      case 'BOOKING':
        return 'Reserva';
      default:
        return formatRawCode(sourceType);
    }
  };
  const formatAccountStatus = (status?: string) => {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'CLOSED':
        return 'Cerrada';
      default:
        return formatRawCode(status);
    }
  };
  const formatItemType = (type?: string) => {
    switch (type) {
      case 'PRODUCT':
        return 'Producto';
      case 'BOOKING':
        return 'Reserva';
      case 'SERVICE':
        return 'Servicio';
      case 'ADJUSTMENT':
        return 'Ajuste (+)';
      default:
        return formatRawCode(type);
    }
  };
  const formatPaymentMethod = (method?: string) => {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'CARD':
        return 'Tarjeta';
      case 'OTHER':
        return 'Otro';
      default:
        return formatRawCode(method);
    }
  };
  const formatPaymentSource = (source?: string) => {
    switch (source) {
      case 'POS':
        return 'Mostrador (POS)';
      case 'ONLINE':
        return 'En lÃ­nea';
      case 'BACKOFFICE':
        return 'AdministraciÃ³n';
      default:
        return formatRawCode(source);
    }
  };
  const formatPaymentChannel = (channel?: string) => {
    switch (channel) {
      case 'CASH_DRAWER':
        return 'Caja';
      case 'BANK_ACCOUNT':
        return 'Cuenta bancaria';
      case 'CARD_TERMINAL':
        return 'Terminal tarjeta';
      case 'VIRTUAL_WALLET':
        return 'Billetera virtual';
      case 'AUTO':
        return 'AutomÃ¡tico';
      case 'OTHER':
        return 'Otro';
      default:
        return formatRawCode(channel);
    }
  };

  const isSelectedAccountClosed =
    String(detail?.status || detail?.accountStatus || '').toUpperCase() === 'CLOSED';

  useEffect(() => {
    if (!isSelectedAccountClosed) return;
    setShowPaymentCalculator(false);
    setShowCloseAccountConfirm(false);
    setShowRefundModal(false);
    setNewItem(EMPTY_NEW_ITEM);
    setPayment({
      channel: 'AUTO',
      collectorAccountLabel: '',
      externalReference: '',
      source: 'POS'
    });
  }, [isSelectedAccountClosed]);

  const handleSelectProduct = (product: ClubProductSearchItem) => {
    setNewItem((prev) => ({
      ...prev,
      description: product.name,
      unitPrice: Number(product.price || 0),
      quantity: 1,
      productId: Number(product.id || 0) || undefined,
      type: 'PRODUCT',
      serviceCode: undefined
    }));
  };

  const handleSelectService = (service: ClubServiceSearchItem) => {
    setNewItem((prev) => ({
      ...prev,
      description: service.name,
      unitPrice: Number(service.price || 0),
      quantity: 1,
      productId: undefined,
      type: 'SERVICE',
      serviceCode: service.code
    }));
  };

  const openClosedAccountDetail = useCallback(async (accountId: string) => {
    try {
      setLoadingClosedAccountDetail(true);
      setSelectedClosedAccountId(accountId);
      setShowClosedAccountModal(true);
      setSelectedClosedAccountDetail(null);
      const data = await getAccountById(accountId);
      setSelectedClosedAccountDetail(data);
    } catch (err: any) {
      setShowClosedAccountModal(false);
      setError(err?.message || 'No se pudo cargar el detalle de la cuenta cerrada');
    } finally {
      setLoadingClosedAccountDetail(false);
    }
  }, []);

  const handleCalculatorPaymentConfirm = async (result: PaymentCalculatorResult) => {
    let paymentRegistered = false;
    try {
      if (!selectedId) return;
      setSubmittingCalculator(true);

      const itemAllocationMap = new Map<string, number>(
        (result.itemAllocations || [])
          .map((entry) => [String(entry.key), Number(entry.amount || 0)] as const)
          .filter(([, amount]) => amount > 0.009)
      );

      const allocations: Array<{ accountItemId: string; amount: number }> = [];

      for (const item of consumptionPendingItems) {
        const allocated = Number(itemAllocationMap.get(String(item.id)) || 0);
        if (allocated > 0.009) {
          allocations.push({
            accountItemId: String(item.id),
            amount: Number(Math.min(item.remaining, allocated).toFixed(2))
          });
        }
      }

      let remainingCourtToAllocate = Math.max(0, Number(result.courtAmount || 0));
      for (const item of bookingPendingItems) {
        if (remainingCourtToAllocate <= 0.009) break;
        const amount = Math.min(item.remaining, remainingCourtToAllocate);
        if (amount > 0.009) {
          allocations.push({
            accountItemId: String(item.id),
            amount: Number(amount.toFixed(2))
          });
          remainingCourtToAllocate = Number((remainingCourtToAllocate - amount).toFixed(2));
        }
      }

      const resolveAutoChannel = (method: string): PaymentChannel => {
        if (method === 'CASH') return 'CASH_DRAWER';
        if (method === 'TRANSFER') return 'BANK_ACCOUNT';
        if (method === 'CARD') return 'CARD_TERMINAL';
        return 'OTHER';
      };
      const resolvedSource: PaymentSource = payment.source || 'POS';
      const fallbackChannel =
        payment.channel !== 'AUTO'
          ? payment.channel
          : resolveAutoChannel(String(result.method || 'OTHER'));

      await registerPayment({
        accountId: selectedId,
        amount: Number(result.amount || 0),
        method: result.method,
        channel: result.channel || fallbackChannel,
        collectorAccountLabel: payment.collectorAccountLabel,
        externalReference: payment.externalReference,
        source: resolvedSource,
        allocations: allocations.length > 0 ? allocations : undefined
      });
      paymentRegistered = true;

      await loadDetail(selectedId);
      await refreshLists();
    } catch (err: any) {
      if (paymentRegistered) {
        setError('Pago registrado. No se pudo refrescar la vista automÃ¡ticamente.');
      } else {
        setError(err?.message || 'No se pudo registrar el pago con calculadora');
        throw err;
      }
    } finally {
      setSubmittingCalculator(false);
    }
  };

  const openRefundModal = (paymentId: string, amount: number) => {
    setRefundPaymentId(paymentId);
    setRefundPaymentMaxAmount(amount);
    setRefundDraft(buildDefaultRefundDraft('ACCOUNT_MANUAL', amount));
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    if (submittingRefund) return;
    setShowRefundModal(false);
  };

  const submitRefundModal = async () => {
    try {
      const validation = validateRefundAmountInput(refundDraft.amountInput, refundPaymentMaxAmount);
      if (validation.error) throw new Error(validation.error);
      if (!refundPaymentId) {
        throw new Error('Pago invalido');
      }
      setSubmittingRefund(true);
      await requestManualRefund(refundPaymentId, refundDraft, refundPaymentMaxAmount, 'Devolucion solicitada desde cuentas');
      await loadDetail(selectedId);
      await refreshLists();
      setShowRefundModal(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo solicitar devolucion');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const pageCardClass = 'rounded-xl border border-[#dce2ee] bg-white shadow-[0_8px_26px_rgba(34,42,68,0.05)] p-4';
  const fieldClass =
    'w-full h-11 rounded-lg border border-[#d9dfeb] bg-white px-3 text-sm font-semibold text-[#1f2638] outline-none transition-all placeholder:text-[#98a1b3] focus:border-[#6f7edb] focus:ring-3 focus:ring-[#6f7edb]/10';
  const selectClass = `${fieldClass} pr-10 appearance-none`;
  const primaryButtonClass =
    'w-full h-11 rounded-lg bg-[#1f2638] text-white font-bold text-xs uppercase tracking-[0.14em] shadow-[0_10px_22px_rgba(31,38,56,0.18)] hover:bg-[#6f7edb] transition-all';
  const accountButtonClass = (isSelected: boolean) =>
    `w-full text-left rounded-lg border px-3 py-3 text-xs transition-all ${
      isSelected
        ? 'border-[#6f7edb] bg-[#f1f4ff] text-[#24305f] shadow-[0_8px_20px_rgba(111,126,219,0.12)]'
        : 'border-[#e1e6f0] bg-white text-[#30384c] hover:border-[#b8c1da] hover:bg-[#f8faff]'
    }`;

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }
  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenes permiso para acceder al panel de administracion." />;
  }

  return (
    <>
      <Head>
        <title>Cuentas | TuCancha Admin</title>
      </Head>

      <AdminPlaygroundShell activeItem="Caja" user={user}>
        <div className="h-full overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4">
            <AdminPageHeader
              eyebrow="Caja"
              title="Cuentas"
              description="Gestiona consumos abiertos, pagos pendientes y cuentas cerradas desde una vista operativa."
              actions={
                <div className="flex items-center gap-2 rounded-xl border border-[#dce2ee] bg-white px-3 py-2 text-xs font-bold text-[#566178]">
                  <span>{totals.open} abiertas</span>
                  <span className="h-1 w-1 rounded-full bg-[#aeb7c8]" />
                  <span>{totals.closed} cerradas</span>
                </div>
              }
            />

            {error && (
              <div className="rounded-xl border border-[#ffd4d4] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#b42318]">
                {error}
              </div>
            )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AdminPanel title="Abrir cuenta" description="Crea una cuenta manual o asociada a una fuente." bodyClassName="space-y-3">
            <select
              value={newAccount.sourceType}
              onChange={(e) => setNewAccount((prev) => ({ ...prev, sourceType: e.target.value as any }))}
              className={selectClass}
            >
              <option value="MANUAL">Manual</option>
              <option value="BAR">Bar</option>
              <option value="TABLE">Mesa</option>
              <option value="BOOKING">Reserva</option>
            </select>
            <input
              value={newAccount.sourceId}
              onChange={(e) => setNewAccount((prev) => ({ ...prev, sourceId: e.target.value }))}
              placeholder="ID de origen"
              className={fieldClass}
            />
            <button
              onClick={async () => {
                try {
                  await openAccount({
                    sourceType: newAccount.sourceType,
                    sourceId: newAccount.sourceId || `manual-${Date.now()}`
                  });
                  await refreshLists();
                } catch (err: any) {
                  setError(err?.message || 'No se pudo crear la cuenta');
                }
              }}
              className={primaryButtonClass}
            >
              Crear
            </button>
          </AdminPanel>

          <AdminPanel
            title="Cuentas abiertas"
            description="Selecciona una cuenta para cargar consumos, pagos o cerrarla."
            className="lg:col-span-2"
          >
            <input
              value={openAccountsSearch}
              onChange={(e) => setOpenAccountsSearch(e.target.value)}
              placeholder="Buscar por cliente, cancha, origen o ID"
              className={`${fieldClass} mb-3`}
            />
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {filteredOpenAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setOpenAccountModalError('');
                    setShowOpenAccountModal(true);

                    if (account.id === selectedId) {
                      setNewItem(EMPTY_NEW_ITEM);
                      void loadDetail(account.id);
                      return;
                    }

                    setNewItem(EMPTY_NEW_ITEM);
                    setDetail(null);
                    setSelectedId(account.id);
                  }}
                  className={accountButtonClass(selectedId === account.id)}
                >
                  <div className="text-xs font-black uppercase tracking-widest">
                    {account.sourceType === 'BOOKING' && account.booking
                      ? `${account.booking.clientName || 'Sin cliente'} Â· ${formatBookingDateTime(account.booking.startDateTime)} Â· ${account.booking.courtName || 'Sin cancha'}`
                      : `${formatAccountSourceType(account.sourceType)} Â· ${account.sourceId}`}
                  </div>
                  <div className="text-xs">Estado: {formatAccountStatus(account.status)}</div>
                </button>
              ))}
              {filteredOpenAccounts.length === 0 && <div className="text-xs font-bold text-[#758198]">No hay cuentas abiertas para ese filtro.</div>}
            </div>
          </AdminPanel>
        </div>

        <AccountManagerModal
          show={showOpenAccountModal}
          accountId={selectedId}
          detail={detail}
          isClosed={isSelectedAccountClosed}
          clubSlug={clubSlug}
          products={products}
          services={services}
          productsLoading={productsLoading}
          servicesLoading={servicesLoading}
          newItem={newItem}
          setNewItem={setNewItem}
          payment={payment}
          setPayment={setPayment}
          itemOutstandingMap={itemOutstandingMap}
          paymentCalculatorTotalPending={paymentCalculatorContext.totalPending}
          paymentCalculatorCourtPending={paymentCalculatorContext.courtPending}
          actionError={openAccountModalError}
          formatItemType={formatItemType}
          formatPaymentMethod={formatPaymentMethod}
          formatPaymentChannel={formatPaymentChannel}
          formatPaymentSource={formatPaymentSource}
          onClose={() => {
            setShowOpenAccountModal(false);
            setShowPaymentCalculator(false);
            setOpenAccountModalError('');
            setNewItem(EMPTY_NEW_ITEM);
          }}
          onAddItem={async () => {
            try {
              await addAccountItem(selectedId, {
                description: newItem.description,
                quantity: newItem.quantity,
                unitPrice: newItem.unitPrice,
                type: newItem.type,
                productId: newItem.type === 'PRODUCT' ? newItem.productId : undefined,
                serviceCode: newItem.type === 'SERVICE' && newItem.serviceCode ? newItem.serviceCode : undefined
              });
              setNewItem(EMPTY_NEW_ITEM);
              setOpenAccountModalError('');
              await loadDetail(selectedId);
              await refreshLists();
            } catch (err: any) {
              const message = err?.message || 'No se pudo agregar el consumo';
              setOpenAccountModalError(message);
              setError(message);
            }
          }}
          onSelectProduct={handleSelectProduct}
          onSelectService={handleSelectService}
          onOpenPaymentCalculator={async () => {
            if (!selectedId) return;
            await loadDetail(selectedId);
            setShowPaymentCalculator(true);
          }}
          onOpenCloseAccountConfirm={() => setShowCloseAccountConfirm(true)}
          onRequestRefund={openRefundModal}
        />
        <AdminPanel title="Cuentas cerradas" description="Historial reciente de cuentas ya cobradas o cerradas.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleClosedAccounts.map((account) => (
              <button
                type="button"
                key={account.id}
                onClick={() => void openClosedAccountDetail(account.id)}
                className={accountButtonClass(selectedClosedAccountId === account.id && showClosedAccountModal)}
              >
                <div className="font-black uppercase">
                  {account.sourceType === 'BOOKING' && account.booking
                    ? `${account.booking.clientName || 'Sin cliente'} Â· ${formatBookingDateTime(account.booking.startDateTime)} Â· ${account.booking.courtName || 'Sin cancha'}`
                    : `${formatAccountSourceType(account.sourceType)} Â· ${account.sourceId}`}
                </div>
                <div>Estado: {formatAccountStatus(account.status)}</div>
              </button>
            ))}
            {!loading && closedAccounts.length === 0 && <div className="text-xs font-bold text-[#758198]">No hay cuentas cerradas.</div>}
          </div>
          {hasMoreClosedAccounts && (
            <button
              type="button"
              onClick={() => setClosedVisibleCount((prev) => prev + 12)}
              className="mt-3 h-10 px-4 rounded-lg border border-[#dce2ee] bg-white text-xs font-bold uppercase tracking-[0.14em] text-[#46516a] hover:bg-[#f8faff] transition-all"
            >
              Ver mÃ¡s
            </button>
          )}
          {closedVisibleCount > 12 && (
            <button
              type="button"
              onClick={() => setClosedVisibleCount(12)}
              className="mt-3 ml-2 h-10 px-4 rounded-lg border border-[#dce2ee] bg-white text-xs font-bold uppercase tracking-[0.14em] text-[#46516a] hover:bg-[#f8faff] transition-all"
            >
              Ver menos
            </button>
          )}
        </AdminPanel>
      </div>

      {showPaymentCalculator && detail && (
        <PaymentCalculator
          courtPending={paymentCalculatorContext.courtPending}
          courtBaseTotal={paymentCalculatorContext.courtPending}
          cartItems={paymentCalculatorContext.cartItems}
          alreadyPaid={0}
          grandTotal={paymentCalculatorContext.totalPending}
          onClose={() => {
            if (submittingCalculator) return;
            setShowPaymentCalculator(false);
          }}
          onConfirm={handleCalculatorPaymentConfirm}
          submitting={submittingCalculator}
          zIndexClass="z-[2147483300]"
        />
      )}

      <RefundRequestModal
        show={showRefundModal}
        title="Solicitar devolucion"
        paymentId={refundPaymentId}
        maxAmount={refundPaymentMaxAmount}
        draft={refundDraft}
        submitting={submittingRefund}
        onClose={closeRefundModal}
        onSubmit={submitRefundModal}
        onChangeDraft={setRefundDraft}
        submitLabel="Confirmar devolucion"
      />

      <AdminRightSidebar
        open={showClosedAccountModal}
        title="Detalle de cuenta cerrada"
        description={selectedClosedAccountId ? `Cuenta #${shortCode(selectedClosedAccountId)}` : undefined}
        onClose={() => {
          if (loadingClosedAccountDetail) return;
          setShowClosedAccountModal(false);
          setSelectedClosedAccountDetail(null);
          setSelectedClosedAccountId('');
        }}
        widthClassName="w-full max-w-[700px]"
        tabs={[
          { id: 'SUMMARY', label: 'Resumen' },
          { id: 'ITEMS', label: 'Items' },
          { id: 'PAYMENTS', label: 'Pagos' },
        ]}
        activeTabId={closedAccountSidebarTab}
        onTabChange={(tabId) => setClosedAccountSidebarTab(tabId as 'SUMMARY' | 'ITEMS' | 'PAYMENTS')}
      >
        {loadingClosedAccountDetail ? (
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 text-[13px] text-[#6f7890]">Cargando detalle...</div>
        ) : selectedClosedAccountDetail ? (
          <div className="space-y-3">
            {closedAccountSidebarTab === 'SUMMARY' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                <p className="text-[11px] text-[#6f7890]">Origen</p>
                <p className="text-[13px] font-semibold text-[#27314a]">
                  {formatAccountSourceType(
                    selectedClosedAccountDetail?.sourceType ||
                    selectedClosedAccountDetail?.account?.sourceType ||
                    selectedClosedAccountDetail?.source ||
                    undefined
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                <p className="text-[11px] text-[#6f7890]">Estado</p>
                <p className="text-[13px] font-semibold text-[#27314a]">
                  {formatAccountStatus(
                    selectedClosedAccountDetail?.status ||
                    selectedClosedAccountDetail?.accountStatus ||
                    selectedClosedAccountDetail?.account?.status ||
                    undefined
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                <p className="text-[11px] text-[#6f7890]">Total</p>
                <p className="text-[13px] font-semibold text-[#27314a]">${Number(selectedClosedAccountDetail?.total || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                <p className="text-[11px] text-[#6f7890]">Pagado</p>
                <p className="text-[13px] font-semibold text-[#1b7b42]">${Number(selectedClosedAccountDetail?.paid || 0).toLocaleString()}</p>
              </div>
            </div>
            )}

            {closedAccountSidebarTab === 'ITEMS' && (
            <div className="rounded-xl border border-[#dce2ee] bg-white">
              <div className="border-b border-[#eef2f8] px-3 py-2 text-[12px] font-semibold text-[#27314a]">Items</div>
              <div className="max-h-52 overflow-y-auto divide-y divide-[#eef2f8]">
                {(selectedClosedAccountDetail?.items || []).map((item: any, index: number) => (
                  <div key={String(item?.id || `item-${index}`)} className="flex items-center justify-between px-3 py-2 text-[12px] text-[#4b5672]">
                    <span>{item?.description || 'Concepto'} · {formatItemType(item?.type)}</span>
                    <span className="font-semibold text-[#27314a]">${Number(item?.total || 0).toLocaleString()}</span>
                  </div>
                ))}
                {(!selectedClosedAccountDetail?.items || selectedClosedAccountDetail.items.length === 0) && (
                  <p className="px-3 py-4 text-[12px] text-[#7a8398]">Sin items.</p>
                )}
              </div>
            </div>
            )}

            {closedAccountSidebarTab === 'PAYMENTS' && (
            <div className="rounded-xl border border-[#dce2ee] bg-white">
              <div className="border-b border-[#eef2f8] px-3 py-2 text-[12px] font-semibold text-[#27314a]">Pagos</div>
              <div className="max-h-52 overflow-y-auto divide-y divide-[#eef2f8]">
                {(selectedClosedAccountDetail?.payments || []).map((entry: any, index: number) => (
                  <div key={String(entry?.id || `payment-${index}`)} className="flex items-center justify-between px-3 py-2 text-[12px] text-[#4b5672]">
                    <span>{formatPaymentMethod(entry?.method)} · {formatPaymentChannel(entry?.channel)} · {formatPaymentSource(entry?.source)}</span>
                    <span className="font-semibold text-[#27314a]">${Number(entry?.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                {(!selectedClosedAccountDetail?.payments || selectedClosedAccountDetail.payments.length === 0) && (
                  <p className="px-3 py-4 text-[12px] text-[#7a8398]">Sin pagos.</p>
                )}
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[#dce2ee] bg-white p-4 text-[13px] text-[#6f7890]">Sin datos para mostrar.</div>
        )}
      </AdminRightSidebar>

      <AdminAppModal
        show={showCloseAccountConfirm}
        zIndexClass="z-[2147483500]"
        title="Cerrar cuenta"
        message="Vas a cerrar la cuenta seleccionada. No vas a poder agregar consumos ni pagos despuÃ©s."
        confirmText={closingAccount ? 'Cerrando...' : 'SÃ­, cerrar cuenta'}
        cancelText="Cancelar"
        isWarning
        onClose={() => {
          if (closingAccount) return;
          setShowCloseAccountConfirm(false);
        }}
        onCancel={() => {
          if (closingAccount) return;
          setShowCloseAccountConfirm(false);
        }}
        onConfirm={async () => {
          if (closingAccount || !selectedId) return;
          try {
            setClosingAccount(true);
            setError('');
            await closeAccount(selectedId);
            setDetail(null);
            setSelectedId('');
            setShowOpenAccountModal(false);
            setShowCloseAccountConfirm(false);
            await refreshLists();
          } catch (err: any) {
            const code = String(err?.code || '');
            const remaining = Number(err?.remaining || 0);
            if (code === 'ACCOUNT_HAS_PENDING_BALANCE') {
              const remainingLabel = Number.isFinite(remaining) && remaining > 0
                ? `Saldo pendiente actual: $${remaining.toLocaleString()}. `
                : '';
              setShowCloseAccountConfirm(false);
              setCloseBlockedModal({
                show: true,
                message: `${remainingLabel}Para cerrar la cuenta primero registrÃ¡ el pago pendiente o ajustÃ¡ consumos.`
              });
            } else {
              setError(err?.message || 'No se pudo cerrar la cuenta');
            }
          } finally {
            setClosingAccount(false);
          }
        }}
      />

      <AdminAppModal
        show={closeBlockedModal.show}
        zIndexClass="z-[2147483500]"
        title="No se pudo cerrar la cuenta"
        message={closeBlockedModal.message}
        isWarning
        confirmText="Entendido"
        cancelText=""
        onClose={() => setCloseBlockedModal({ show: false, message: '' })}
      />
        </div>
      </AdminPlaygroundShell>
    </>
  );
}
