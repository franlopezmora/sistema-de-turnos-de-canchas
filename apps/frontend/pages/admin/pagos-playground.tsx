import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Receipt,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/router';
import AgendaLikeRightSidebar from '../../components/admin/AgendaLikeRightSidebar';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import { listAccounts, type AccountStatus } from '../../services/AccountService';
import { CashService } from '../../services/CashService';
import { listPendingRefunds, listRefunds, type RefundRecord } from '../../services/PaymentService';
import { formatDateTime24 } from '../../utils/dateTime';
import { hasAdminAccess } from '../../utils/session';
import { extractErrorMessage, reportUiError } from '../../utils/uiError';

type PaymentsTab = 'ACCOUNTS' | 'CASH' | 'REFUNDS';
type CashPeriod = 'hoy' | 'semana' | 'mes';
type MovementTypeFilter = 'ALL' | 'INCOME' | 'EXPENSE';
type MovementMethodFilter = 'ALL' | 'CASH' | 'TRANSFER' | 'CARD';
type CashView = 'live' | 'movements' | 'closures';
type CashActionSidebarView = 'none' | 'open_shift' | 'close_shift' | 'movement_create' | 'close_report';
type AccountsFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'WITH_DEBT' | 'WITH_REFUNDS';

type AccountRow = {
  id: string;
  sourceType: 'BOOKING' | 'BAR' | 'TABLE' | 'MANUAL';
  status: AccountStatus;
  createdAt: string;
  booking?: {
    id?: number;
    courtName?: string | null;
    clientName?: string | null;
  } | null;
};

type Movement = {
  id: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  method: 'CASH' | 'TRANSFER' | 'CARD';
};

type Balance = {
  total: number;
  cash: number;
  digital: number;
  income: number;
  expense: number;
};

type CashRegister = {
  id: string;
  name: string;
  location?: string | null;
};

type CashShift = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openingAmount: number;
  cashRegister?: {
    id: string;
    name: string;
    location?: string | null;
  };
};

type CashShiftCloseReport = {
  shift: {
    id: string;
    openedAt?: string;
    closedAt?: string | null;
  };
  expectedCash: number;
  countedCash: number;
  difference: number;
};

const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;

const shortCode = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 5)}...${raw.slice(-3)}`;
};

const formatRefundStatus = (status: string) => {
  if (status === 'REQUESTED') return 'Solicitada';
  if (status === 'APPROVED') return 'Aprobada';
  if (status === 'READY_TO_EXECUTE') return 'Lista';
  if (status === 'EXECUTED') return 'Ejecutada';
  if (status === 'FAILED') return 'Fallida';
  if (status === 'CANCELLED') return 'Cancelada';
  return status;
};

const toDateLabel = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getCashDateRange = (period: CashPeriod, offset = 0) => {
  const base = new Date();
  const start = new Date(base);
  const end = new Date(base);

  if (period === 'hoy') {
    start.setDate(start.getDate() + offset);
    end.setDate(end.getDate() + offset);
  } else if (period === 'semana') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1 + (offset * 7));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else {
    start.setFullYear(start.getFullYear(), start.getMonth() + offset, 1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: toDateLabel(start),
    endDate: toDateLabel(end),
    rawStart: start,
    rawEnd: end,
  };
};

const shortId = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 8) return raw;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
};

const formatMovementConcept = (movement: any) => {
  const rawConcept = String(movement?.concept || '').trim();
  const sourceType = String(movement?.sourceType || '').toUpperCase();
  const accountId = String(movement?.accountId || '').trim();
  const paymentId = String(movement?.paymentId || '').trim();
  const refundId = String(movement?.refundId || '').trim();
  const booking = movement?.booking;

  const paymentMatch = rawConcept.match(/^pago\s+cuenta\s+(.+)$/i);
  if (paymentMatch) {
    if (sourceType === 'BOOKING' && booking) {
      const court = String(booking?.courtName || '').trim();
      const client = String(booking?.clientName || '').trim();
      if (court && client) return `Pago reserva ${court} - ${client}`;
      if (court) return `Pago reserva ${court}`;
      if (client) return `Pago reserva - ${client}`;
      return 'Pago de reserva';
    }

    if (sourceType === 'BAR') {
      return 'Pago de consumos';
    }

    return `Pago de cuenta ${accountId ? `#${shortId(accountId)}` : ''}`.trim();
  }

  const refundMatch = rawConcept.match(/^refund\s+pago\s+(.+)$/i);
  if (refundMatch) {
    const reference = refundId || paymentId || refundMatch[1];
    return `Reintegro de pago ${reference ? `#${shortId(reference)}` : ''}`.trim();
  }

  if (!rawConcept) return 'Movimiento de caja';
  return rawConcept;
};

const movementMethodLabel = (method: Movement['method']) => {
  if (method === 'CASH') return 'Efectivo';
  if (method === 'CARD') return 'Tarjeta';
  return 'Transferencia';
};

const accountSourceLabel = (sourceType: AccountRow['sourceType']) => {
  if (sourceType === 'BOOKING') return 'Reserva';
  if (sourceType === 'BAR') return 'Consumos';
  if (sourceType === 'TABLE') return 'Mesa';
  return 'Manual';
};

export default function AdminPaymentsPlaygroundPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });
  const [activeTab, setActiveTab] = useState<PaymentsTab>('ACCOUNTS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openAccounts, setOpenAccounts] = useState<AccountRow[]>([]);
  const [closedAccounts, setClosedAccounts] = useState<AccountRow[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<RefundRecord[]>([]);
  const [recentRefunds, setRecentRefunds] = useState<RefundRecord[]>([]);
  const [accountsSearchTerm, setAccountsSearchTerm] = useState('');
  const [accountsFilter, setAccountsFilter] = useState<AccountsFilter>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [cashActiveView, setCashActiveView] = useState<CashView>('live');
  const [cashActivePeriod, setCashActivePeriod] = useState<CashPeriod>('hoy');
  const [cashPeriodOffset, setCashPeriodOffset] = useState(0);
  const [loadingCashSummary, setLoadingCashSummary] = useState(false);
  const [loadingCashShift, setLoadingCashShift] = useState(false);
  const [submittingCashMovement, setSubmittingCashMovement] = useState(false);
  const [openingCashShift, setOpeningCashShift] = useState(false);
  const [closingCashShift, setClosingCashShift] = useState(false);

  const [cashBalance, setCashBalance] = useState<Balance>({
    total: 0,
    cash: 0,
    digital: 0,
    income: 0,
    expense: 0,
  });
  const [cashMovements, setCashMovements] = useState<Movement[]>([]);
  const [cashCurrentShift, setCashCurrentShift] = useState<CashShift | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);

  const [cashSummaryError, setCashSummaryError] = useState('');
  const [cashShiftError, setCashShiftError] = useState('');
  const [cashMovementError, setCashMovementError] = useState('');
  const [cashSuccessMessage, setCashSuccessMessage] = useState('');
  const [cashSearchTerm, setCashSearchTerm] = useState('');
  const [cashTypeFilter, setCashTypeFilter] = useState<MovementTypeFilter>('ALL');
  const [cashMethodFilter, setCashMethodFilter] = useState<MovementMethodFilter>('ALL');
  const [cashShowFilters, setCashShowFilters] = useState(false);
  const [cashSidebarView, setCashSidebarView] = useState<CashActionSidebarView>('none');
  const [cashLastCloseReport, setCashLastCloseReport] = useState<CashShiftCloseReport | null>(null);

  const [cashOpenShiftForm, setCashOpenShiftForm] = useState({
    cashRegisterId: '',
    openingAmount: '',
  });
  const [cashCloseShiftForm, setCashCloseShiftForm] = useState({ countedCash: '' });
  const [cashNewMovement, setCashNewMovement] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    description: '',
    amount: '',
    method: 'CASH' as 'CASH' | 'TRANSFER' | 'CARD',
  });

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/pagos-playground')}`);
  }, [authChecked, router, user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [open, closed, pending, recent] = await Promise.all([
        listAccounts({ status: 'OPEN' }),
        listAccounts({ status: 'CLOSED' }),
        listPendingRefunds(20),
        listRefunds({ take: 30 }),
      ]);

      setOpenAccounts(Array.isArray(open) ? open : []);
      setClosedAccounts(Array.isArray(closed) ? closed : []);
      setPendingRefunds(Array.isArray(pending) ? pending : []);
      setRecentRefunds(Array.isArray(recent) ? recent : []);
    } catch (loadError: any) {
      reportUiError({ area: 'PaymentsPlayground', action: 'refresh' }, loadError);
      setError(loadError?.message || 'No se pudo cargar el módulo de pagos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCashSummary = useCallback(async () => {
    setCashSummaryError('');
    setLoadingCashSummary(true);
    try {
      const { startDate, endDate } = getCashDateRange(cashActivePeriod, cashPeriodOffset);
      const data = await CashService.getSummary({ startDate, endDate });
      const nextBalance = data?.balance || {};
      setCashBalance({
        total: Number(nextBalance.total || 0),
        cash: Number(nextBalance.cash || 0),
        digital: Number(nextBalance.digital || 0),
        income: Number(nextBalance.income || 0),
        expense: Number(nextBalance.expense || 0),
      });
      const normalizedMovements: Movement[] = (Array.isArray(data?.movements) ? data.movements : []).map((item: any) => {
        const type = String(item?.type || 'INCOME');
        const normalizedType: Movement['type'] =
          type === 'WITHDRAW' || type === 'REFUND' || type === 'EXPENSE' ? 'EXPENSE' : 'INCOME';
        return {
          id: Number(item?.id || 0),
          date: String(item?.createdAt || ''),
          type: normalizedType,
          amount: Number(item?.amount || 0),
          description: formatMovementConcept(item),
          method: (['CASH', 'TRANSFER', 'CARD'].includes(String(item?.method))
            ? item.method
            : 'CASH') as Movement['method'],
        };
      });
      setCashMovements(normalizedMovements.filter((item) => Number.isFinite(item.id) && item.id > 0));
    } catch (loadError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'loadCashSummary' }, loadError);
      setCashSummaryError(extractErrorMessage(loadError, 'No se pudo cargar el resumen de caja.'));
    } finally {
      setLoadingCashSummary(false);
    }
  }, [cashActivePeriod, cashPeriodOffset]);

  const loadCashShiftContext = useCallback(async () => {
    setCashShiftError('');
    setLoadingCashShift(true);
    try {
      const [shift, registers] = await Promise.all([
        CashService.getCurrentShift(),
        CashService.getCashRegisters(),
      ]);
      setCashCurrentShift(shift || null);
      const normalizedRegisters = Array.isArray(registers) ? registers : [];
      setCashRegisters(normalizedRegisters);
      if (!shift && normalizedRegisters.length > 0) {
        setCashOpenShiftForm((prev) => ({
          ...prev,
          cashRegisterId: prev.cashRegisterId || String(normalizedRegisters[0].id),
        }));
      }
    } catch (loadError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'loadCashShiftContext' }, loadError);
      setCashShiftError(extractErrorMessage(loadError, 'No se pudo cargar el estado del turno de caja.'));
    } finally {
      setLoadingCashShift(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    void refresh();
  }, [authChecked, refresh, user]);

  useEffect(() => {
    if (activeTab !== 'ACCOUNTS') return;
    if (selectedAccountId) return;
    const firstOpen = openAccounts[0]?.id || '';
    const firstClosed = closedAccounts[0]?.id || '';
    const first = firstOpen || firstClosed;
    if (first) setSelectedAccountId(first);
  }, [activeTab, closedAccounts, openAccounts, selectedAccountId]);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    if (activeTab !== 'CASH') return;
    void loadCashSummary();
  }, [activeTab, authChecked, loadCashSummary, user]);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    if (activeTab !== 'CASH') return;
    void loadCashShiftContext();
  }, [activeTab, authChecked, loadCashShiftContext, user]);

  useEffect(() => {
    if (activeTab === 'CASH') return;
    setCashSidebarView('none');
  }, [activeTab]);

  const cashPeriodLabel = useMemo(() => {
    const { rawStart, rawEnd } = getCashDateRange(cashActivePeriod, cashPeriodOffset);
    if (cashActivePeriod === 'hoy') {
      if (cashPeriodOffset === 0) return 'Hoy';
      if (cashPeriodOffset === -1) return 'Ayer';
      return rawStart.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    }
    if (cashActivePeriod === 'semana') {
      return `${rawStart.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} - ${rawEnd.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`;
    }
    return rawStart.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, [cashActivePeriod, cashPeriodOffset]);

  const filteredCashMovements = useMemo(() => {
    const normalizedQuery = cashSearchTerm.trim().toLowerCase();
    return cashMovements.filter((movement) => {
      const matchesType = cashTypeFilter === 'ALL' || movement.type === cashTypeFilter;
      const matchesMethod = cashMethodFilter === 'ALL' || movement.method === cashMethodFilter;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        movement.description.toLowerCase().includes(normalizedQuery) ||
        movementMethodLabel(movement.method).toLowerCase().includes(normalizedQuery);
      return matchesType && matchesMethod && matchesSearch;
    });
  }, [cashMethodFilter, cashMovements, cashSearchTerm, cashTypeFilter]);

  const filteredNetAmount = useMemo(
    () =>
      filteredCashMovements.reduce(
        (total, movement) => total + (movement.type === 'INCOME' ? movement.amount : -movement.amount),
        0
      ),
    [filteredCashMovements]
  );

  const filteredIncomeAmount = useMemo(
    () =>
      filteredCashMovements
        .filter((movement) => movement.type === 'INCOME')
        .reduce((sum, movement) => sum + movement.amount, 0),
    [filteredCashMovements]
  );

  const filteredExpenseAmount = useMemo(
    () =>
      filteredCashMovements
        .filter((movement) => movement.type === 'EXPENSE')
        .reduce((sum, movement) => sum + movement.amount, 0),
    [filteredCashMovements]
  );

  const filteredAverageAmount = useMemo(() => {
    if (filteredCashMovements.length === 0) return 0;
    const absoluteTotal = filteredCashMovements.reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
    return absoluteTotal / filteredCashMovements.length;
  }, [filteredCashMovements]);

  const handleOpenShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setCashShiftError('');
    setCashSuccessMessage('');

    const openingAmount = Number(cashOpenShiftForm.openingAmount);
    if (!cashOpenShiftForm.cashRegisterId) {
      setCashShiftError('Selecciona una caja registradora.');
      return;
    }
    if (!Number.isFinite(openingAmount) || openingAmount < 0) {
      setCashShiftError('Ingresa un monto de apertura valido.');
      return;
    }

    try {
      setOpeningCashShift(true);
      await CashService.openShift({
        cashRegisterId: cashOpenShiftForm.cashRegisterId,
        openingAmount,
      });
      setCashSuccessMessage('Turno de caja abierto correctamente.');
      setCashSidebarView('none');
      await Promise.all([loadCashShiftContext(), loadCashSummary()]);
    } catch (openError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'openShift' }, openError);
      setCashShiftError(extractErrorMessage(openError, 'No se pudo abrir la caja.'));
    } finally {
      setOpeningCashShift(false);
    }
  };

  const handleCloseShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setCashShiftError('');
    setCashSuccessMessage('');

    const countedCash = Number(cashCloseShiftForm.countedCash);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      setCashShiftError('Ingresa un monto contado valido.');
      return;
    }

    try {
      setClosingCashShift(true);
      const closedShift = await CashService.closeCurrentShift({ countedCash });
      if (closedShift?.id) {
        try {
          const report = await CashService.getShiftReport(String(closedShift.id));
          setCashLastCloseReport(report);
        } catch {
          setCashLastCloseReport(null);
        }
      }
      setCashCloseShiftForm({ countedCash: '' });
      setCashSuccessMessage('Turno de caja cerrado correctamente.');
      setCashSidebarView('none');
      await Promise.all([loadCashShiftContext(), loadCashSummary()]);
    } catch (closeError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'closeShift' }, closeError);
      setCashShiftError(extractErrorMessage(closeError, 'No se pudo cerrar la caja.'));
    } finally {
      setClosingCashShift(false);
    }
  };

  const handleCreateMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    setCashMovementError('');
    setCashSuccessMessage('');

    const amount = Number(cashNewMovement.amount);
    if (!cashCurrentShift) {
      setCashMovementError('Primero debes abrir la caja para registrar movimientos.');
      return;
    }
    if (cashNewMovement.description.trim().length < 3) {
      setCashMovementError('Describe el movimiento con al menos 3 caracteres.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashMovementError('Ingresa un monto valido mayor a 0.');
      return;
    }

    try {
      setSubmittingCashMovement(true);
      await CashService.createMovement({
        amount,
        description: cashNewMovement.description.trim(),
        type: cashNewMovement.type,
        method: cashNewMovement.method,
      });
      setCashNewMovement({ type: 'INCOME', description: '', amount: '', method: 'CASH' });
      setCashSuccessMessage('Movimiento registrado correctamente.');
      setCashSidebarView('none');
      await loadCashSummary();
    } catch (movementError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'createMovement' }, movementError);
      setCashMovementError(extractErrorMessage(movementError, 'No se pudo registrar el movimiento.'));
    } finally {
      setSubmittingCashMovement(false);
    }
  };

  const cashActionSidebarOpen = activeTab === 'CASH' && cashSidebarView !== 'none';

  const closeActionSidebar = useCallback(() => {
    if (openingCashShift || closingCashShift || submittingCashMovement) return;
    setCashSidebarView('none');
  }, [closingCashShift, openingCashShift, submittingCashMovement]);

  useEffect(() => {
    if (!cashActionSidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeActionSidebar();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [cashActionSidebarOpen, closeActionSidebar]);

  const allAccounts = useMemo(
    () => [
      ...openAccounts.map((account) => ({ ...account, hasDebt: true })),
      ...closedAccounts.map((account) => ({ ...account, hasDebt: false })),
    ],
    [closedAccounts, openAccounts]
  );

  const accountsWithRefundsIdSet = useMemo(() => {
    const set = new Set<string>();
    recentRefunds.forEach((refund) => {
      const accountId = String(refund.accountId || '').trim();
      if (accountId) set.add(accountId);
    });
    return set;
  }, [recentRefunds]);

  const filteredAccounts = useMemo(() => {
    const search = accountsSearchTerm.trim().toLowerCase();
    return allAccounts.filter((account) => {
      const matchesFilter =
        accountsFilter === 'ALL' ||
        (accountsFilter === 'OPEN' && account.status === 'OPEN') ||
        (accountsFilter === 'CLOSED' && account.status === 'CLOSED') ||
        (accountsFilter === 'WITH_DEBT' && account.hasDebt) ||
        (accountsFilter === 'WITH_REFUNDS' && accountsWithRefundsIdSet.has(account.id));

      if (!matchesFilter) return false;

      if (!search) return true;
      const haystack = [
        account.id,
        account.sourceType,
        account.booking?.clientName || '',
        account.booking?.courtName || '',
        account.booking?.id ? String(account.booking.id) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [accountsFilter, accountsSearchTerm, accountsWithRefundsIdSet, allAccounts]);

  const selectedAccount = useMemo(
    () => allAccounts.find((account) => account.id === selectedAccountId) || null,
    [allAccounts, selectedAccountId]
  );

  const accountCards = useMemo(
    () => [
      { label: 'Cuentas abiertas', value: openAccounts.length, tone: 'text-[#3155df]' },
      { label: 'Con deuda', value: openAccounts.length, tone: 'text-[#9a5a00]' },
      { label: 'Cerradas', value: closedAccounts.length, tone: 'text-[#2f5e46]' },
      { label: 'Con devoluciones', value: accountsWithRefundsIdSet.size, tone: 'text-[#7b3fb4]' },
    ],
    [accountsWithRefundsIdSet.size, closedAccounts.length, openAccounts.length]
  );

  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }
  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenés permiso para acceder al panel de administración." />;
  }

  return (
    <>
      <Head>
        <title>Pagos Playground | TuCancha Admin</title>
      </Head>
      <AdminPlaygroundShell activeItem="Pagos" user={user} contentMuted={cashActionSidebarOpen}>
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
          <header className="rounded-xl border border-[#dce2ee] bg-white px-4 py-3 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#3053e2] text-white shadow-[0_10px_24px_rgba(48,83,226,0.24)]">
                <CreditCard size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold text-[#1f2638]">Pagos Playground</h1>
                <p className="text-[12px] text-[#6f7890]">Módulo unificado de cuentas, caja y devoluciones.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refresh();
                  if (activeTab === 'CASH') {
                    void Promise.all([loadCashSummary(), loadCashShiftContext()]);
                  }
                }}
                className="h-9 rounded-lg border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#48536f] hover:bg-[#f7f9fc]"
              >
                Recargar
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-[#dce2ee] bg-white p-1 inline-flex w-fit gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('ACCOUNTS')}
              className={`h-9 rounded-lg px-3 text-[12px] font-semibold ${
                activeTab === 'ACCOUNTS' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f4f6fb]'
              }`}
            >
              Cuentas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CASH')}
              className={`h-9 rounded-lg px-3 text-[12px] font-semibold ${
                activeTab === 'CASH' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f4f6fb]'
              }`}
            >
              Caja
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REFUNDS')}
              className={`h-9 rounded-lg px-3 text-[12px] font-semibold ${
                activeTab === 'REFUNDS' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f4f6fb]'
              }`}
            >
              Devoluciones
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-[#f2b8c3] bg-[#fff2f5] px-3 py-2 text-[12px] font-semibold text-[#b42346]">
              {error}
            </div>
          )}

          <section className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#dce2ee] bg-white p-4">
            {loading && activeTab !== 'CASH' ? (
              <div className="h-full grid place-items-center">
                <div className="inline-flex items-center gap-2 text-[13px] text-[#6f7890]">
                  <span className="h-4 w-4 rounded-full border-2 border-[#b9c6f4] border-t-[#3053e2] animate-spin" />
                  Cargando módulo de pagos...
                </div>
              </div>
            ) : activeTab === 'ACCOUNTS' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {accountCards.map((card) => (
                    <article key={card.label} className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-[#6f7890]">{card.label}</p>
                      <p className={`mt-1 text-[24px] font-bold ${card.tone}`}>{card.value}</p>
                    </article>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-2">
                  <label className="relative min-w-[280px] flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a5]" />
                    <input
                      type="text"
                      value={accountsSearchTerm}
                      onChange={(event) => setAccountsSearchTerm(event.target.value)}
                      placeholder="Buscar por cliente, cuenta, reserva o cancha"
                      className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#3053e2]"
                    />
                  </label>
                  <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-white p-1">
                    {[
                      { id: 'ALL', label: 'Todas' },
                      { id: 'OPEN', label: 'Abiertas' },
                      { id: 'WITH_DEBT', label: 'Con deuda' },
                      { id: 'WITH_REFUNDS', label: 'Con devolución' },
                    ].map((option) => (
                      <button
                        key={`accounts-filter-${option.id}`}
                        type="button"
                        onClick={() => setAccountsFilter(option.id as AccountsFilter)}
                        className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold transition ${
                          accountsFilter === option.id
                            ? 'bg-[#edf1ff] text-[#3053e2]'
                            : 'text-[#6f7890] hover:bg-[#f4f6fb]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <Link href="/admin/cuentas" className="h-9 rounded-lg bg-[#3053e2] px-3 inline-flex items-center text-[12px] font-semibold text-white hover:bg-[#2748cc]">
                    Nueva cuenta
                  </Link>
                  <Link href="/admin/cuentas" className="h-9 rounded-lg border border-[#dce2ee] bg-white px-3 inline-flex items-center text-[12px] font-semibold text-[#4b5672] hover:bg-[#f7f9fc]">
                    Abrir módulo completo
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-xl border border-[#e1e6f1] bg-white">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_120px_120px_120px_110px_120px] border-b border-[#eef2f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">
                      <p>Cuenta / Cliente</p>
                      <p className="text-right">Total</p>
                      <p className="text-right">Pagado</p>
                      <p className="text-right">Pendiente</p>
                      <p className="text-center">Estado</p>
                      <p className="text-right">Última acción</p>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-[#eef2f8]">
                      {filteredAccounts.map((account) => {
                        const isSelected = selectedAccountId === account.id;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setSelectedAccountId(account.id)}
                            className={`grid w-full grid-cols-[minmax(0,1.2fr)_120px_120px_120px_110px_120px] items-center px-3 py-2 text-left text-[12px] transition ${
                              isSelected ? 'bg-[#eef2ff]' : 'hover:bg-[#f8faff]'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#2a3245]">
                                {account.booking?.clientName || `Cuenta ${shortCode(account.id)}`}
                              </p>
                              <p className="truncate text-[#5f6984]">
                                {accountSourceLabel(account.sourceType)} · {account.booking?.courtName || 'Sin cancha'} · #{shortCode(account.id)}
                              </p>
                            </div>
                            <p className="text-right font-semibold text-[#27314a]">--</p>
                            <p className="text-right font-semibold text-[#1b7b42]">--</p>
                            <p className="text-right font-semibold text-[#9a5a00]">{account.hasDebt ? '--' : '0.00 $'}</p>
                            <div className="text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                account.status === 'OPEN'
                                  ? 'bg-[#edf1ff] text-[#3155df]'
                                  : 'bg-[#e8f8ec] text-[#16733f]'
                              }`}>
                                {account.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                              </span>
                            </div>
                            <p className="text-right text-[11px] text-[#5f6984]">
                              {formatDateTime24(account.createdAt)}
                            </p>
                          </button>
                        );
                      })}
                      {filteredAccounts.length === 0 && (
                        <p className="px-3 py-6 text-center text-[12px] text-[#7a8398]">
                          No hay cuentas para los filtros actuales.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                    <p className="text-[14px] font-semibold text-[#1f2638]">Detalle de cuenta</p>
                    {selectedAccount ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                          <p className="text-[11px] text-[#6f7890]">Cuenta</p>
                          <p className="text-[13px] font-semibold text-[#27314a]">#{shortCode(selectedAccount.id)}</p>
                          <p className="mt-1 text-[12px] text-[#5f6984]">
                            {selectedAccount.booking?.clientName || 'Cliente sin asignar'} · {accountSourceLabel(selectedAccount.sourceType)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                          <p className="text-[12px] font-semibold text-[#27314a]">Conceptos</p>
                          <p className="mt-1 text-[12px] text-[#6f7890]">
                            Cancha, consumos, servicios y ajustes.
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                          <p className="text-[12px] font-semibold text-[#27314a]">Pagos</p>
                          <p className="mt-1 text-[12px] text-[#6f7890]">
                            Pago total/parcial con imputación por participante y por concepto.
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                          <p className="text-[12px] font-semibold text-[#27314a]">Pago dividido</p>
                          <p className="mt-1 text-[12px] text-[#6f7890]">
                            Asignado, pagado y deuda por participante.
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2">
                          <p className="text-[12px] font-semibold text-[#27314a]">Historial</p>
                          <p className="mt-1 text-[12px] text-[#6f7890]">
                            Alta, ediciones, cobros, devoluciones y cierre.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link href="/admin/cuentas" className="h-9 rounded-lg bg-[#3053e2] px-3 inline-flex items-center text-[12px] font-semibold text-white hover:bg-[#2748cc]">
                            Gestionar esta cuenta
                          </Link>
                          <Link href="/admin/devoluciones" className="h-9 rounded-lg border border-[#dce2ee] bg-white px-3 inline-flex items-center text-[12px] font-semibold text-[#4b5672] hover:bg-[#f7f9fc]">
                            Solicitar devolución
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-[#7a8398]">
                        Seleccioná una cuenta para ver detalle.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'CASH' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setCashActiveView('live')}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                        cashActiveView === 'live' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f8f9fd]'
                      }`}
                    >
                      Caja en vivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashActiveView('movements')}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                        cashActiveView === 'movements' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f8f9fd]'
                      }`}
                    >
                      Movimientos
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashActiveView('closures')}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                        cashActiveView === 'closures' ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f8f9fd]'
                      }`}
                    >
                      Cierres
                    </button>
                  </div>

                  <div className="ml-auto flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-1">
                    {(['hoy', 'semana', 'mes'] as CashPeriod[]).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => {
                          setCashActivePeriod(period);
                          setCashPeriodOffset(0);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                          cashActivePeriod === period
                            ? 'bg-white text-[#3053e2] shadow-sm'
                            : 'text-[#6f7890] hover:text-[#4e5870]'
                        }`}
                      >
                        {period === 'hoy' ? 'Hoy' : period === 'semana' ? 'Semana' : 'Mes'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-white px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setCashPeriodOffset((prev) => prev - 1)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb]"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="min-w-[120px] text-center text-[12px] font-semibold text-[#4e5870]">{cashPeriodLabel}</span>
                    <button
                      type="button"
                      onClick={() => setCashPeriodOffset((prev) => prev + 1)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb]"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Saldo Total</p>
                    <p className="mt-2 text-lg font-semibold text-[#1f2638]">{formatMoney(cashBalance.total)}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Ingresos</p>
                    <p className="mt-2 flex items-center gap-1 text-lg font-semibold text-[#15803d]"><ArrowUpRight size={18} />{formatMoney(cashBalance.income)}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Egresos</p>
                    <p className="mt-2 flex items-center gap-1 text-lg font-semibold text-[#b91c1c]"><ArrowDownRight size={18} />{formatMoney(cashBalance.expense)}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Caja Efectivo</p>
                    <p className="mt-2 text-lg font-semibold text-[#1f2638]">{formatMoney(cashBalance.cash)}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Caja Digital</p>
                    <p className="mt-2 text-lg font-semibold text-[#1f2638]">{formatMoney(cashBalance.digital)}</p>
                  </article>
                </div>

                {(cashSummaryError || cashShiftError || cashMovementError || cashSuccessMessage) && (
                  <div className="space-y-2">
                    {cashSuccessMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">{cashSuccessMessage}</div>}
                    {cashSummaryError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashSummaryError}</div>}
                    {cashShiftError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashShiftError}</div>}
                    {cashMovementError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashMovementError}</div>}
                  </div>
                )}

                {cashActiveView === 'live' && (
                  <div className="grid min-h-full grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
                    <div className="space-y-4">
                      <article className="rounded-xl border border-[#dce2ee] bg-white p-4">
                        <h2 className="text-[13px] font-semibold text-[#1f2638]">Turno de caja</h2>
                        {loadingCashShift ? (
                          <p className="mt-3 text-[12px] text-[#6f7890]">Cargando estado de caja...</p>
                        ) : cashCurrentShift ? (
                          <div className="mt-3 space-y-3">
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3 text-[12px] text-[#4e5870]">
                              <p><span className="font-semibold">Caja:</span> {cashCurrentShift.cashRegister?.name || '-'}</p>
                              <p><span className="font-semibold">Apertura:</span> {formatDateTime24(cashCurrentShift.openedAt)}</p>
                              <p><span className="font-semibold">Monto inicial:</span> {formatMoney(cashCurrentShift.openingAmount)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCashCloseShiftForm({ countedCash: '' });
                                setCashSidebarView('close_shift');
                              }}
                              className="h-10 w-full rounded-xl bg-[#3053e2] text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                            >
                              Cerrar caja
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <p className="text-[12px] text-[#6f7890]">No hay turno activo. Abre caja desde el panel lateral.</p>
                            <button
                              type="button"
                              onClick={() => setCashSidebarView('open_shift')}
                              className="h-10 w-full rounded-xl bg-[#3053e2] text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                            >
                              Abrir caja
                            </button>
                          </div>
                        )}
                      </article>
                    </div>

                    <article className="min-h-0 rounded-xl border border-[#dce2ee] bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-[13px] font-semibold text-[#1f2638]">Panel operativo</h2>
                        <span className="text-[12px] text-[#6f7890]">Sin datos duplicados</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Estado actual</p>
                          <p className={`mt-1 inline-flex rounded-full px-2 py-1 text-[12px] font-semibold ${cashCurrentShift ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {cashCurrentShift ? 'Caja abierta' : 'Caja cerrada'}
                          </p>
                          <p className="mt-2 text-[12px] text-[#4e5870]">
                            {cashCurrentShift
                              ? 'Gestiona apertura y cierre aquí; registra movimientos desde la vista Movimientos.'
                              : 'Abre caja para iniciar la operación diaria.'}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                          <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Flujo recomendado</p>
                          <ol className="mt-1 space-y-1 text-[12px] text-[#4e5870]">
                            <li>1. Apertura y monto inicial</li>
                            <li>2. Registrar movimientos puntuales</li>
                            <li>3. Cierre con arqueo final</li>
                          </ol>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCashActiveView('movements');
                            setCashSidebarView('movement_create');
                          }}
                          className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          Registrar movimiento
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashActiveView('movements')}
                          className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          Ir a movimientos
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashActiveView('closures')}
                          className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          Ir a cierres
                        </button>
                      </div>
                    </article>
                  </div>
                )}

                {cashActiveView === 'movements' && (
                  <article className="min-h-0 rounded-xl border border-[#dce2ee] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[13px] font-semibold text-[#1f2638]">Movimientos</h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCashSidebarView('movement_create')}
                          className="h-8 rounded-lg bg-[#3053e2] px-2.5 text-[12px] font-semibold text-white shadow-[0_6px_16px_rgba(48,83,226,0.24)] transition hover:bg-[#2746c9]"
                        >
                          Nuevo movimiento
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashShowFilters((prev) => !prev)}
                          className="h-8 rounded-lg border border-[#dce2ee] bg-white px-2.5 text-[12px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          {cashShowFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        </button>
                        <div className="inline-flex items-center gap-2 text-[12px] text-[#6f7890]">
                          <Landmark size={14} />
                          <span>{loadingCashSummary ? 'Actualizando...' : `${filteredCashMovements.length} de ${cashMovements.length}`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Resultado visible</p>
                        <p className={`mt-1 text-[13px] font-semibold ${filteredNetAmount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {filteredNetAmount >= 0 ? '+' : '-'}{formatMoney(Math.abs(filteredNetAmount))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Ingresos visibles</p>
                        <p className="mt-1 text-[13px] font-semibold text-emerald-700">{formatMoney(filteredIncomeAmount)}</p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Egresos visibles</p>
                        <p className="mt-1 text-[13px] font-semibold text-red-700">{formatMoney(filteredExpenseAmount)}</p>
                      </div>
                      <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Ticket promedio</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{formatMoney(filteredAverageAmount)}</p>
                      </div>
                    </div>

                    {cashShowFilters && (
                      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_160px_auto]">
                        <label className="relative">
                          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a5]" />
                          <input
                            type="text"
                            value={cashSearchTerm}
                            onChange={(event) => setCashSearchTerm(event.target.value)}
                            placeholder="Buscar por concepto o método"
                            className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#3053e2]"
                          />
                        </label>

                        <select
                          value={cashTypeFilter}
                          onChange={(event) => setCashTypeFilter(event.target.value as MovementTypeFilter)}
                          className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                        >
                          <option value="ALL">Todos los tipos</option>
                          <option value="INCOME">Solo ingresos</option>
                          <option value="EXPENSE">Solo egresos</option>
                        </select>

                        <select
                          value={cashMethodFilter}
                          onChange={(event) => setCashMethodFilter(event.target.value as MovementMethodFilter)}
                          className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                        >
                          <option value="ALL">Todos los métodos</option>
                          <option value="CASH">Efectivo</option>
                          <option value="TRANSFER">Transferencia</option>
                          <option value="CARD">Tarjeta</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setCashSearchTerm('');
                            setCashTypeFilter('ALL');
                            setCashMethodFilter('ALL');
                          }}
                          className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[12px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    )}

                    <div className="overflow-auto rounded-xl border border-[#dce2ee] max-h-[68vh]">
                      {filteredCashMovements.length === 0 ? (
                        <div className="p-8 text-center text-[13px] text-[#6f7890]">
                          {cashMovements.length === 0
                            ? 'No hay movimientos para el periodo seleccionado.'
                            : 'No hay coincidencias con los filtros actuales.'}
                        </div>
                      ) : (
                        <table className="w-full min-w-[680px] text-[13px]">
                          <thead className="sticky top-0 bg-[#f8f9fd] text-[12px] uppercase tracking-wide text-[#6f7890]">
                            <tr>
                              <th className="px-3 py-2 text-left">Fecha</th>
                              <th className="px-3 py-2 text-left">Concepto</th>
                              <th className="px-3 py-2 text-left">Método</th>
                              <th className="px-3 py-2 text-left">Tipo</th>
                              <th className="px-3 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCashMovements.map((movement) => (
                              <tr key={movement.id} className="border-t border-[#edf0f6] transition hover:bg-[#f4f6fb]">
                                <td className="px-3 py-1.5 text-[12px] text-[#4e5870]">{formatDateTime24(movement.date)}</td>
                                <td className="px-3 py-1.5 text-[#1f2638]">{movement.description}</td>
                                <td className="px-3 py-1.5 text-[#4e5870]">{movementMethodLabel(movement.method)}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${movement.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {movement.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                                  </span>
                                </td>
                                <td className={`px-3 py-1.5 text-right font-semibold ${movement.type === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {movement.type === 'INCOME' ? '+' : '-'}{formatMoney(movement.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </article>
                )}

                {cashActiveView === 'closures' && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <article className="rounded-xl border border-[#dce2ee] bg-white p-4">
                      <h2 className="text-[13px] font-semibold text-[#1f2638]">Estado de cierre</h2>
                      {cashCurrentShift ? (
                        <div className="mt-3 space-y-2 text-[13px] text-[#4e5870]">
                          <p>Hay una caja abierta. Para cerrar y generar arqueo, usa la vista Caja en vivo.</p>
                          <button
                            type="button"
                            onClick={() => setCashActiveView('live')}
                            className="h-9 rounded-xl bg-[#3053e2] px-3 text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                          >
                            Ir a caja en vivo
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-[13px] text-[#6f7890]">No hay caja abierta en este momento.</p>
                      )}
                    </article>

                    <article className="rounded-xl border border-[#dce2ee] bg-white p-4">
                      <h2 className="text-[13px] font-semibold text-[#1f2638]">Último arqueo generado</h2>
                      {cashLastCloseReport ? (
                        <>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Esperado</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{formatMoney(cashLastCloseReport.expectedCash)}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Contado</p>
                              <p className="mt-1 text-[13px] font-semibold text-[#1f2638]">{formatMoney(cashLastCloseReport.countedCash)}</p>
                            </div>
                            <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[#6f7890]">Diferencia</p>
                              <p className={`mt-1 text-[13px] font-semibold ${Number(cashLastCloseReport.difference || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {Number(cashLastCloseReport.difference || 0) >= 0 ? '+' : '-'}{formatMoney(Math.abs(Number(cashLastCloseReport.difference || 0)))}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCashSidebarView('close_report')}
                            className="mt-3 h-9 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                          >
                            Ver detalle del arqueo
                          </button>
                        </>
                      ) : (
                        <p className="mt-3 text-[13px] text-[#6f7890]">Aún no hay un arqueo generado en esta sesión.</p>
                      )}
                    </article>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <article className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#6f7890]">Pendientes</p>
                    <p className="mt-1 text-[24px] font-bold text-[#3053e2]">{pendingRefunds.length}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#6f7890]">Total recientes</p>
                    <p className="mt-1 text-[24px] font-bold text-[#2f5e46]">{recentRefunds.length}</p>
                  </article>
                  <article className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[#6f7890]">Monto pendiente</p>
                    <p className="mt-1 text-[24px] font-bold text-[#27314a]">
                      {formatMoney(pendingRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0))}
                    </p>
                  </article>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/admin/devoluciones" className="h-9 rounded-lg bg-[#3053e2] px-3 inline-flex items-center text-[12px] font-semibold text-white hover:bg-[#2748cc]">
                    Ir a Devoluciones
                  </Link>
                </div>
                <div className="rounded-xl border border-[#e1e6f1] bg-white">
                  <div className="border-b border-[#eef2f8] px-3 py-2 text-[12px] font-semibold text-[#44506b]">
                    Últimas devoluciones
                  </div>
                  <div className="divide-y divide-[#eef2f8]">
                    {recentRefunds.slice(0, 8).map((refund) => (
                      <div key={refund.id} className="px-3 py-2 text-[12px] text-[#4b5672]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[#2a3245]">{shortCode(refund.displayCode || refund.id)}</p>
                          <span className="rounded-full bg-[#eef1f7] px-2 py-0.5 text-[10px] font-semibold text-[#55617f]">
                            {formatRefundStatus(refund.status)}
                          </span>
                        </div>
                        <p>{formatMoney(refund.amount)} · {formatDateTime24(refund.createdAt)}</p>
                      </div>
                    ))}
                    {recentRefunds.length === 0 && (
                      <p className="px-3 py-4 text-[12px] text-[#7a8398]">No hay devoluciones registradas.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <footer className="grid grid-cols-1 gap-2 text-[12px] text-[#6f7890] md:grid-cols-3">
            <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2 inline-flex items-center gap-2">
              <Receipt size={14} className="text-[#62708f]" />
              Cuentas centralizadas
            </div>
            <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2 inline-flex items-center gap-2">
              <Wallet size={14} className="text-[#62708f]" />
              Caja operativa diaria
            </div>
            <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2 inline-flex items-center gap-2">
              <RotateCcw size={14} className="text-[#62708f]" />
              Gestión de devoluciones
            </div>
          </footer>
        </div>
      </AdminPlaygroundShell>

      <AgendaLikeRightSidebar
        open={cashActionSidebarOpen}
        onClose={closeActionSidebar}
        title={
          <>
            {cashSidebarView === 'open_shift' && 'Abrir caja'}
            {cashSidebarView === 'close_shift' && 'Cerrar caja'}
            {cashSidebarView === 'movement_create' && 'Registrar movimiento'}
            {cashSidebarView === 'close_report' && 'Detalle de arqueo'}
          </>
        }
        subtitle={
          <>
            {cashSidebarView === 'open_shift' && 'Configura caja registradora y monto inicial.'}
            {cashSidebarView === 'close_shift' && 'Ingresa el efectivo contado para cerrar el turno.'}
            {cashSidebarView === 'movement_create' && 'Crea ingresos o egresos sin saturar la vista principal.'}
            {cashSidebarView === 'close_report' && 'Resumen ampliado del último cierre registrado.'}
          </>
        }
        statusChip={cashCurrentShift ? 'Caja abierta' : 'Caja cerrada'}
        statusChipClassName={cashCurrentShift ? 'bg-[#e8f8ec] text-[#16733f]' : 'bg-[#edf1ff] text-[#3155df]'}
      >
        <div>
          {cashSidebarView === 'open_shift' && (
            <form className="space-y-3" onSubmit={handleOpenShift}>
              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Caja registradora</label>
                <select
                  value={cashOpenShiftForm.cashRegisterId}
                  onChange={(event) => setCashOpenShiftForm((prev) => ({ ...prev, cashRegisterId: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                >
                  <option value="">Seleccionar</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Monto inicial</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashOpenShiftForm.openingAmount}
                  onChange={(event) => setCashOpenShiftForm((prev) => ({ ...prev, openingAmount: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </div>

              <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3 text-[12px] text-[#4e5870]">
                Al abrir caja comienza el turno operativo y podrás registrar movimientos.
              </div>

              <button
                type="submit"
                disabled={openingCashShift}
                className="h-10 w-full rounded-xl bg-[#3053e2] text-[13px] font-semibold text-white transition hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {openingCashShift ? 'Abriendo...' : 'Confirmar apertura'}
              </button>
            </form>
          )}

          {cashSidebarView === 'close_shift' && (
            <form className="space-y-3" onSubmit={handleCloseShift}>
              <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3 text-[12px] text-[#4e5870]">
                <p><span className="font-semibold">Caja:</span> {cashCurrentShift?.cashRegister?.name || '-'}</p>
                <p><span className="font-semibold">Apertura:</span> {cashCurrentShift?.openedAt ? formatDateTime24(cashCurrentShift.openedAt) : '-'}</p>
                <p><span className="font-semibold">Monto inicial:</span> {formatMoney(Number(cashCurrentShift?.openingAmount || 0))}</p>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Dinero contado al cierre</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashCloseShiftForm.countedCash}
                  onChange={(event) => setCashCloseShiftForm({ countedCash: event.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </div>

              <button
                type="submit"
                disabled={closingCashShift || !cashCurrentShift}
                className="h-10 w-full rounded-xl bg-[#3053e2] text-[13px] font-semibold text-white transition hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {closingCashShift ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </form>
          )}

          {cashSidebarView === 'movement_create' && (
            <form className="space-y-3" onSubmit={handleCreateMovement}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCashNewMovement((prev) => ({ ...prev, type: 'INCOME' }))}
                  className={`h-10 rounded-xl border text-[12px] font-semibold ${
                    cashNewMovement.type === 'INCOME'
                      ? 'border-[#d4f0dc] bg-[#e8f8ec] text-[#16733f]'
                      : 'border-[#dce2ee] bg-white text-[#4e5870]'
                  }`}
                >
                  Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setCashNewMovement((prev) => ({ ...prev, type: 'EXPENSE' }))}
                  className={`h-10 rounded-xl border text-[12px] font-semibold ${
                    cashNewMovement.type === 'EXPENSE'
                      ? 'border-[#f5c8d0] bg-[#fff0f2] text-[#b42346]'
                      : 'border-[#dce2ee] bg-white text-[#4e5870]'
                  }`}
                >
                  Egreso
                </button>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Concepto</label>
                <input
                  type="text"
                  value={cashNewMovement.description}
                  onChange={(event) => setCashNewMovement((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="Descripción del movimiento"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Monto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashNewMovement.amount}
                  onChange={(event) => setCashNewMovement((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#4e5870]">Método</label>
                <select
                  value={cashNewMovement.method}
                  onChange={(event) =>
                    setCashNewMovement((prev) => ({ ...prev, method: event.target.value as 'CASH' | 'TRANSFER' | 'CARD' }))
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] outline-none focus:border-[#3053e2]"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingCashMovement || !cashCurrentShift}
                className="h-10 w-full rounded-xl bg-[#3053e2] text-[13px] font-semibold text-white transition hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingCashMovement ? 'Registrando...' : 'Registrar movimiento'}
              </button>
              {!cashCurrentShift && (
                <p className="text-[12px] text-[#7a8398]">Abrí caja para habilitar movimientos.</p>
              )}
            </form>
          )}

          {cashSidebarView === 'close_report' && (
            <div className="space-y-3 text-[13px] text-[#4e5870]">
              {cashLastCloseReport ? (
                <>
                  <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
                    <p><span className="font-semibold">Esperado:</span> {formatMoney(cashLastCloseReport.expectedCash)}</p>
                    <p><span className="font-semibold">Contado:</span> {formatMoney(cashLastCloseReport.countedCash)}</p>
                    <p><span className="font-semibold">Diferencia:</span> {formatMoney(cashLastCloseReport.difference)}</p>
                  </div>
                  <p className="text-[12px] text-[#6f7890]">
                    ID cierre: {cashLastCloseReport.shift?.id || '-'}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-[#6f7890]">No hay arqueo disponible en esta sesión.</p>
              )}
            </div>
          )}
        </div>
      </AgendaLikeRightSidebar>
    </>
  );
}
