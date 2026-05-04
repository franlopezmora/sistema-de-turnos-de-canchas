import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Plus,
  Play,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/router';
import AdminPlaygroundShell from '../../components/admin/AdminPlaygroundShell';
import MetricCard from '../../components/admin/ui/MetricCard';
import CashSummaryCards from '../../modules/caja/components/CashSummaryCards';
import CashMovementsTimeline from '../../modules/caja/components/CashMovementsTimeline';
import CashAccountsList from '../../modules/caja/components/CashAccountsList';
import type { CashAccountItem } from '../../modules/caja/components/CashAccountsList';
import CashAccountDetailPanel from '../../modules/caja/components/CashAccountDetailPanel';
import CashCloseFlow from '../../modules/caja/components/CashCloseFlow';
import CashShiftPanel from '../../modules/caja/components/CashShiftPanel';
import AccountDrawer, {
  type AccountDrawerContext,
  type AccountDrawerInitialView,
  type AccountDrawerSuccessMeta,
} from '../../modules/cuentas/components/AccountDrawer';
import { AdminDrawer, AdminDrawerSection, AdminFilterToolbar, AdminPanel, AdminSegmentedControl } from '../../components/admin/ui';
import AdminAppModal from '../../components/admin/ui/AdminAppModal';
import NotFound from '../../components/NotFound';
import RouteTransitionScreen from '../../components/RouteTransitionScreen';
import { useValidateAuth } from '../../hooks/useValidateAuth';
import { getPendingLogoutRedirect } from '../../services/AuthService';
import {
  getAccountById,
  listAccounts,
  openAccount,
  type AccountStatus,
} from '../../services/AccountService';
import { CashService } from '../../services/CashService';
import { ClubService } from '../../services/ClubService';
import {
  approveRefund,
  cancelRefund,
  executeRefund,
  failRefund,
  listPendingRefunds,
  listRefunds,
  requestPaymentRefund,
  retryRefund,
  type RefundExecutionMethod,
  type RefundReasonType,
  type RefundRecord,
} from '../../services/PaymentService';
import { formatDateTime24 } from '../../utils/dateTime';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../../utils/session';
import { extractErrorMessage, reportUiError } from '../../utils/uiError';

type PaymentsTab = 'SUMMARY' | 'ACCOUNTS' | 'MOVEMENTS' | 'CLOSURE' | 'REFUNDS';
type CashPeriod = 'hoy' | 'semana' | 'mes';
type MovementTypeFilter = 'ALL' | 'INCOME' | 'EXPENSE';
type MovementMethodFilter = 'ALL' | 'CASH' | 'TRANSFER' | 'CARD';
type RefundStatusFilter = 'ALL' | 'REQUESTED' | 'APPROVED' | 'READY_TO_EXECUTE' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
type RefundMethodFilter = 'ALL' | 'CASH' | 'TRANSFER' | 'CARD_REVERSAL' | 'CREDIT_NOTE';
type RefundActionKind = 'approve' | 'approve_execute' | 'execute' | 'retry' | 'fail' | 'cancel';
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

type AccountDetailItem = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  total: number;
  createdAt?: string;
};

type AccountDetailPaymentAllocation = {
  id?: string;
  accountItemId: string;
  amount: number;
};

type AccountDetailPayment = {
  id: string;
  amount: number;
  method: string;
  channel?: string;
  allocations: AccountDetailPaymentAllocation[];
  createdAt?: string;
};

type AccountDetail = {
  id: string;
  status: AccountStatus;
  total: number;
  paid: number;
  remaining: number;
  items: AccountDetailItem[];
  payments: AccountDetailPayment[];
  createdAt?: string;
  updatedAt?: string;
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
const ACCOUNT_PAYMENT_EPSILON = 0.009;
const EMPTY_REFUNDS: RefundRecord[] = [];
const drawerSectionCardClass = 'rounded-2xl border border-[#dce2ee] bg-[#f8f9fd] p-4';

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

const refundCodeLabel = (refund: RefundRecord) => {
  const display = String(refund?.displayCode || '').trim();
  if (display) return display;
  return `DV-${shortId(refund?.id || '') || 'S/N'}`;
};

const refundReasonTypeLabel = (reasonType: string) => {
  const normalized = String(reasonType || '').toUpperCase();
  if (normalized === 'FULL') return 'Total';
  if (normalized === 'PARTIAL_COMMERCIAL') return 'Parcial comercial';
  if (normalized === 'PARTIAL_SERVICE_FAILURE') return 'Parcial por servicio';
  if (normalized === 'PARTIAL_PRICING_ERROR') return 'Parcial por precio';
  return 'Otro';
};

const refundExecutionMethodLabel = (method: string | null | undefined) => {
  const normalized = String(method || '').toUpperCase();
  if (!normalized) return '-';
  if (normalized === 'CASH') return 'Efectivo';
  if (normalized === 'TRANSFER') return 'Transferencia';
  if (normalized === 'CARD_REVERSAL') return 'Reverso tarjeta';
  if (normalized === 'CREDIT_NOTE') return 'Nota de crédito';
  return method || '-';
};

const refundReasonOptions: Array<{ value: RefundReasonType; label: string }> = [
  { value: 'FULL', label: 'Total' },
  { value: 'PARTIAL_COMMERCIAL', label: 'Parcial comercial' },
  { value: 'PARTIAL_SERVICE_FAILURE', label: 'Falla del servicio' },
  { value: 'PARTIAL_PRICING_ERROR', label: 'Error de precio' },
  { value: 'OTHER', label: 'Otro motivo' },
];

const reservedRefundStatuses = new Set(['REQUESTED', 'APPROVED', 'READY_TO_EXECUTE', 'EXECUTED']);

const resolveRefundExecutionMethod = (paymentMethod: string): RefundExecutionMethod => {
  const normalized = String(paymentMethod || '').toUpperCase();
  if (normalized === 'TRANSFER') return 'TRANSFER';
  if (normalized === 'CARD') return 'CARD_REVERSAL';
  return 'CASH';
};

const refundActionCopy = (action: RefundActionKind) => {
  if (action === 'approve') {
    return {
      title: 'Aprobar devolución',
      message: 'La devolución quedará aprobada y lista para ejecutarse según el método.',
      confirm: 'Aprobar',
      needsReason: false,
    };
  }
  if (action === 'approve_execute') {
    return {
      title: 'Aprobar y ejecutar devolución',
      message: 'La devolución se aprobará y se ejecutará ahora. Esto impacta en caja.',
      confirm: 'Aprobar y ejecutar',
      needsReason: false,
    };
  }
  if (action === 'execute') {
    return {
      title: 'Ejecutar devolución',
      message: 'La devolución se registrará como ejecutada e impactará en caja.',
      confirm: 'Ejecutar',
      needsReason: false,
    };
  }
  if (action === 'retry') {
    return {
      title: 'Reintentar devolución',
      message: 'La devolución fallida volverá a intentarse y puede ejecutarse ahora.',
      confirm: 'Reintentar',
      needsReason: false,
    };
  }
  if (action === 'fail') {
    return {
      title: 'Marcar devolución como fallida',
      message: 'Registrá el motivo operativo por el que esta devolución no pudo completarse.',
      confirm: 'Marcar fallida',
      needsReason: true,
    };
  }
  return {
    title: 'Cancelar devolución',
    message: 'La solicitud quedará cancelada y no seguirá avanzando en el flujo.',
    confirm: 'Cancelar devolución',
    needsReason: true,
  };
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

const parsePaymentsTab = (value: unknown): PaymentsTab => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'cash') return 'SUMMARY';
  if (raw === 'summary') return 'SUMMARY';
  if (raw === 'movements') return 'MOVEMENTS';
  if (raw === 'closure') return 'CLOSURE';
  if (raw === 'refunds') return 'REFUNDS';
  if (raw === 'accounts') return 'ACCOUNTS';
  return 'SUMMARY';
};

const toPaymentsTabQuery = (value: PaymentsTab) => {
  if (value === 'SUMMARY') return 'summary';
  if (value === 'MOVEMENTS') return 'movements';
  if (value === 'CLOSURE') return 'closure';
  if (value === 'REFUNDS') return 'refunds';
  return 'accounts';
};

const isCashSectionTab = (value: PaymentsTab) =>
  value === 'SUMMARY' || value === 'MOVEMENTS' || value === 'CLOSURE';

const toCashViewByTab = (value: PaymentsTab): CashView => {
  if (value === 'MOVEMENTS') return 'movements';
  if (value === 'CLOSURE') return 'closures';
  return 'live';
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

const accountDisplayLabel = (account: AccountRow) => {
  const clientName = String(account.booking?.clientName || '').trim();
  const courtName = String(account.booking?.courtName || '').trim();
  if (clientName && courtName) return `${clientName} · ${courtName}`;
  if (clientName) return clientName;
  if (courtName) return courtName;
  return accountSourceLabel(account.sourceType);
};

const paymentMethodLabel = (method: string) => {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'CASH') return 'Efectivo';
  if (normalized === 'TRANSFER') return 'Transferencia';
  if (normalized === 'CARD') return 'Tarjeta';
  return method || '-';
};

const paymentChannelLabel = (channel: string) => {
  const normalized = String(channel || '').toUpperCase();
  if (!normalized) return '-';
  if (normalized === 'BANK_ACCOUNT') return 'Cuenta bancaria';
  if (normalized === 'VIRTUAL_WALLET') return 'Billetera virtual';
  if (normalized === 'CASH_DRAWER') return 'Caja';
  if (normalized === 'CARD_TERMINAL') return 'Terminal';
  return channel;
};

export default function AdminPaymentsPlaygroundPage() {
  const router = useRouter();
  const { authChecked, user } = useValidateAuth({ requireAdmin: true });
  const [activeTab, setActiveTab] = useState<PaymentsTab>(() => parsePaymentsTab(router.query.tab));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openAccounts, setOpenAccounts] = useState<AccountRow[]>([]);
  const [closedAccounts, setClosedAccounts] = useState<AccountRow[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<RefundRecord[]>([]);
  const [recentRefunds, setRecentRefunds] = useState<RefundRecord[]>([]);
  const [accountsSearchTerm, setAccountsSearchTerm] = useState('');
  const [accountsFilter, setAccountsFilter] = useState<AccountsFilter>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountDrawerInitialView, setAccountDrawerInitialView] =
    useState<AccountDrawerInitialView>('overview');
  const [accountDetailById, setAccountDetailById] = useState<Record<string, AccountDetail>>({});
  const [loadingAccountDetailById, setLoadingAccountDetailById] = useState<Record<string, boolean>>({});
  const [accountDetailError, setAccountDetailError] = useState('');
  const [openingAccount, setOpeningAccount] = useState(false);

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
  const [enforceCashShiftCloseWithOpenAccounts, setEnforceCashShiftCloseWithOpenAccounts] = useState(true);
  const [refundSearchTerm, setRefundSearchTerm] = useState('');
  const [refundStatusFilter, setRefundStatusFilter] = useState<RefundStatusFilter>('ALL');
  const [refundMethodFilter, setRefundMethodFilter] = useState<RefundMethodFilter>('ALL');
  const [refundRequestOpen, setRefundRequestOpen] = useState(false);
  const [refundRequestAccountLocked, setRefundRequestAccountLocked] = useState(false);
  const [refundRequestAccountId, setRefundRequestAccountId] = useState('');
  const [refundRequestPaymentId, setRefundRequestPaymentId] = useState('');
  const [refundRequestAmountDraft, setRefundRequestAmountDraft] = useState('');
  const [refundRequestReasonType, setRefundRequestReasonType] = useState<RefundReasonType>('OTHER');
  const [refundRequestNotes, setRefundRequestNotes] = useState('');
  const [refundRequestExecuteNow, setRefundRequestExecuteNow] = useState(false);
  const [refundRequestError, setRefundRequestError] = useState('');
  const [submittingRefundRequest, setSubmittingRefundRequest] = useState(false);
  const [refundsByAccountId, setRefundsByAccountId] = useState<Record<string, RefundRecord[]>>({});
  const [loadingRefundsByAccountId, setLoadingRefundsByAccountId] = useState<Record<string, boolean>>({});
  const [selectedRefundId, setSelectedRefundId] = useState('');
  const [refundActionConfirm, setRefundActionConfirm] = useState<{
    action: RefundActionKind;
    refundId: string;
  } | null>(null);
  const [refundActionReason, setRefundActionReason] = useState('');
  const [refundActionError, setRefundActionError] = useState('');
  const [refundActionBusy, setRefundActionBusy] = useState(false);
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
  const [adminToasts, setAdminToasts] = useState<Array<{ id: number; message: string }>>([]);
  const adminToastIdRef = useRef(1);
  const adminToastTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const paymentsContentScrollRef = useRef<HTMLElement | null>(null);
  const selectedAccountDetailFocusRef = useRef<HTMLDivElement | null>(null);
  const accountDetailRequestSeqRef = useRef<Record<string, number>>({});

  const focusSelectedAccountDetail = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const target = selectedAccountDetailFocusRef.current;
      if (!target) return;
      const scrollParent = paymentsContentScrollRef.current;
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop = scrollParent.scrollTop + targetRect.top - parentRect.top + 36;
        scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      } else {
        const targetTop = target.getBoundingClientRect().top + window.scrollY + 36;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    });
  }, []);

  const showAdminToast = useCallback((message: string) => {
    const text = String(message || '').trim();
    if (!text) return;
    const id = adminToastIdRef.current++;
    setAdminToasts((prev) => [...prev, { id, message: text }].slice(-4));
    const timeout = setTimeout(() => {
      setAdminToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2400);
    adminToastTimeoutsRef.current.push(timeout);
  }, []);

  useEffect(() => {
    if (!authChecked || user) return;
    if (getPendingLogoutRedirect()) return;
    void router.replace(`/login?from=${encodeURIComponent(router.asPath || '/admin/pagos-playground')}`);
  }, [authChecked, router, user]);

  useEffect(() => {
    return () => {
      adminToastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      adminToastTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const nextTab = parsePaymentsTab(router.query.tab);
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [router.query.tab]);

  const cashActiveView = toCashViewByTab(activeTab);

  const navigateToPaymentsTab = useCallback(
    (nextTab: PaymentsTab) => {
      setActiveTab(nextTab);
      void router.replace(
        {
          pathname: '/admin/caja',
          query: { ...router.query, tab: toPaymentsTabQuery(nextTab) },
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

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

  const ensureAccountDetail = useCallback(async (accountId: string, force = false) => {
    const key = String(accountId || '').trim();
    if (!key) return null;
    if (!force && accountDetailById[key]) return accountDetailById[key];
    if (!force && loadingAccountDetailById[key]) return null;

    const requestSeq = (accountDetailRequestSeqRef.current[key] || 0) + 1;
    accountDetailRequestSeqRef.current[key] = requestSeq;
    try {
      setLoadingAccountDetailById((prev) => ({ ...prev, [key]: true }));
      setAccountDetailError('');
      const detail = await getAccountById(key);
      const normalized: AccountDetail = {
        id: String(detail?.id || key),
        status: String(detail?.status || 'OPEN') as AccountStatus,
        total: Number(detail?.total || 0),
        paid: Number(detail?.paid || 0),
        remaining: Number(detail?.remaining || 0),
        items: (Array.isArray(detail?.items) ? detail.items : []).map((item: any) => ({
          id: String(item?.id || ''),
          type: String(item?.type || 'OTHER'),
          description: String(item?.description || 'Concepto'),
          quantity: Number(item?.quantity || 1),
          total: Number(item?.total || 0),
          createdAt: String(item?.createdAt || ''),
        })),
        payments: (Array.isArray(detail?.payments) ? detail.payments : []).map((payment: any) => ({
          id: String(payment?.id || ''),
          amount: Number(payment?.amount || 0),
          method: String(payment?.method || ''),
          channel: String(payment?.channel || ''),
          allocations: (Array.isArray(payment?.allocations) ? payment.allocations : []).map((allocation: any) => ({
            id: allocation?.id ? String(allocation.id) : undefined,
            accountItemId: String(allocation?.accountItemId || ''),
            amount: Number(allocation?.amount || 0),
          })).filter((allocation: AccountDetailPaymentAllocation) => allocation.accountItemId && allocation.amount > ACCOUNT_PAYMENT_EPSILON),
          createdAt: String(payment?.createdAt || ''),
        })),
        createdAt: String(detail?.createdAt || ''),
        updatedAt: String(detail?.updatedAt || ''),
      };
      if (accountDetailRequestSeqRef.current[key] === requestSeq) {
        setAccountDetailById((prev) => ({ ...prev, [key]: normalized }));
      }
      return normalized;
    } catch (detailError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'ensureAccountDetail' }, detailError);
      setAccountDetailError(extractErrorMessage(detailError, 'No se pudo cargar el detalle de la cuenta.'));
      return null;
    } finally {
      if (accountDetailRequestSeqRef.current[key] === requestSeq) {
        setLoadingAccountDetailById((prev) => ({ ...prev, [key]: false }));
      }
    }
  }, [accountDetailById, loadingAccountDetailById]);

  const ensureAccountRefunds = useCallback(async (accountId: string, force = false) => {
    const key = String(accountId || '').trim();
    if (!key) return [];
    if (!force && refundsByAccountId[key]) return refundsByAccountId[key];
    if (loadingRefundsByAccountId[key]) return refundsByAccountId[key] || [];

    try {
      setLoadingRefundsByAccountId((prev) => ({ ...prev, [key]: true }));
      const rows = await listRefunds({ accountId: key, take: 100 });
      const normalized = Array.isArray(rows) ? rows : [];
      setRefundsByAccountId((prev) => ({ ...prev, [key]: normalized }));
      return normalized;
    } catch (refundError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'ensureAccountRefunds' }, refundError);
      setRefundRequestError(extractErrorMessage(refundError, 'No se pudieron cargar las devoluciones de la cuenta.'));
      return [];
    } finally {
      setLoadingRefundsByAccountId((prev) => ({ ...prev, [key]: false }));
    }
  }, [loadingRefundsByAccountId, refundsByAccountId]);

  const closeAccountDrawer = useCallback(() => {
    setAccountDrawerOpen(false);
    setAccountDrawerInitialView('overview');
  }, []);

  const openAccountDrawer = useCallback((accountId: string, initialView: AccountDrawerInitialView = 'overview') => {
    setSelectedAccountId(accountId);
    setAccountDrawerInitialView(initialView);
    setAccountDrawerOpen(true);
  }, []);

  const handleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    void ensureAccountDetail(accountId);
    focusSelectedAccountDetail();
  }, [ensureAccountDetail, focusSelectedAccountDetail]);

  const handleQuickOpenAccount = useCallback(async () => {
    try {
      setOpeningAccount(true);
      const created = await openAccount({ sourceType: 'MANUAL', sourceId: `manual-${Date.now()}` });
      await refresh();
      if (created?.id) {
        openAccountDrawer(created.id, 'add_item');
      }
      showAdminToast('Cuenta creada. Agregá el primer concepto.');
    } catch (error) {
      reportUiError({ area: 'PaymentsPlayground', action: 'handleQuickOpenAccount' }, error);
    } finally {
      setOpeningAccount(false);
    }
  }, [openAccountDrawer, refresh, showAdminToast]);

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
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    const run = async () => {
      try {
        const slug = getActiveClubSlug(normalizeSessionUser(user as any));
        if (!slug) return;
        const club = await ClubService.getClubBySlug(slug);
        setEnforceCashShiftCloseWithOpenAccounts(
          club.enforceCashShiftCloseWithOpenAccounts ?? true
        );
      } catch (error) {
        reportUiError({ area: 'PaymentsPlayground', action: 'loadClubCloseShiftPolicy' }, error);
        setEnforceCashShiftCloseWithOpenAccounts(true);
      }
    };
    void run();
  }, [authChecked, user]);

  useEffect(() => {
    if (activeTab !== 'ACCOUNTS') return;
    if (selectedAccountId) return;
    const firstOpen = openAccounts[0]?.id || '';
    const firstClosed = closedAccounts[0]?.id || '';
    const first = firstOpen || firstClosed;
    if (first) setSelectedAccountId(first);
  }, [activeTab, closedAccounts, openAccounts, selectedAccountId]);

  useEffect(() => {
    if (activeTab !== 'ACCOUNTS') return;
    if (!selectedAccountId) return;
    void ensureAccountDetail(selectedAccountId);
  }, [activeTab, ensureAccountDetail, selectedAccountId]);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    if (!isCashSectionTab(activeTab)) return;
    void loadCashSummary();
  }, [activeTab, authChecked, loadCashSummary, user]);

  useEffect(() => {
    if (!authChecked || !user || !hasAdminAccess(user)) return;
    if (!isCashSectionTab(activeTab)) return;
    void loadCashShiftContext();
  }, [activeTab, authChecked, loadCashShiftContext, user]);

  useEffect(() => {
    if (isCashSectionTab(activeTab)) return;
    setCashSidebarView('none');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ACCOUNTS') return;
    setAccountDrawerOpen(false);
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

  const hasOpenCurrentAccounts = openAccounts.length > 0;
  const shouldBlockCloseShiftWithOpenAccounts =
    enforceCashShiftCloseWithOpenAccounts && hasOpenCurrentAccounts;
  const closeShiftBlockedMessage = shouldBlockCloseShiftWithOpenAccounts
    ? `No podés cerrar caja: hay ${openAccounts.length} cuenta${openAccounts.length === 1 ? '' : 's'} corriente${openAccounts.length === 1 ? '' : 's'} abierta${openAccounts.length === 1 ? '' : 's'}.`
    : '';

  const filteredRecentRefunds = useMemo(() => {
    const { rawStart, rawEnd } = getCashDateRange(cashActivePeriod, cashPeriodOffset);
    const normalizedQuery = refundSearchTerm.trim().toLowerCase();
    return recentRefunds.filter((refund) => {
      const createdAt = new Date(refund.createdAt);
      const matchesDate = Number.isFinite(createdAt.getTime()) && createdAt >= rawStart && createdAt <= rawEnd;
      const normalizedStatus = String(refund.status || '').toUpperCase();
      const normalizedMethod = String(refund.executionMethod || '').toUpperCase();
      const matchesStatus = refundStatusFilter === 'ALL' || normalizedStatus === refundStatusFilter;
      const matchesMethod = refundMethodFilter === 'ALL' || normalizedMethod === refundMethodFilter;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        refundCodeLabel(refund).toLowerCase().includes(normalizedQuery) ||
        String(refund.reason || '').toLowerCase().includes(normalizedQuery) ||
        shortId(refund.accountId).toLowerCase().includes(normalizedQuery) ||
        shortId(refund.paymentId).toLowerCase().includes(normalizedQuery);
      return matchesDate && matchesStatus && matchesMethod && matchesSearch;
    });
  }, [cashActivePeriod, cashPeriodOffset, recentRefunds, refundMethodFilter, refundSearchTerm, refundStatusFilter]);

  const filteredPendingRefunds = useMemo(() => {
    const visibleIds = new Set(filteredRecentRefunds.map((refund) => refund.id));
    return pendingRefunds.filter((refund) => visibleIds.has(refund.id));
  }, [filteredRecentRefunds, pendingRefunds]);

  const filteredPendingRefundAmount = useMemo(
    () => filteredPendingRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0),
    [filteredPendingRefunds]
  );

  const handleOpenShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setCashShiftError('');

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
      showAdminToast('Turno de caja abierto correctamente.');
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

    if (shouldBlockCloseShiftWithOpenAccounts) {
      showAdminToast(closeShiftBlockedMessage);
      return;
    }

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
      showAdminToast('Turno de caja cerrado correctamente.');
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
      showAdminToast('Movimiento registrado correctamente.');
      setCashSidebarView('none');
      await loadCashSummary();
    } catch (movementError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'createMovement' }, movementError);
      setCashMovementError(extractErrorMessage(movementError, 'No se pudo registrar el movimiento.'));
    } finally {
      setSubmittingCashMovement(false);
    }
  };

  const cashActionSidebarOpen = isCashSectionTab(activeTab) && cashSidebarView !== 'none';

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

  useEffect(() => {
    if (activeTab !== 'ACCOUNTS') return;
    if (allAccounts.length === 0) return;
    const missingIds = allAccounts
      .map((account) => account.id)
      .filter((id) => !accountDetailById[id] && !loadingAccountDetailById[id]);
    if (missingIds.length === 0) return;
    void Promise.allSettled(missingIds.map((id) => ensureAccountDetail(id)));
  }, [activeTab, allAccounts, accountDetailById, ensureAccountDetail, loadingAccountDetailById]);

  const accountsWithRefundsIdSet = useMemo(() => {
    const set = new Set<string>();
    recentRefunds.forEach((refund) => {
      const accountId = String(refund.accountId || '').trim();
      if (accountId) set.add(accountId);
    });
    return set;
  }, [recentRefunds]);

  const periodAccounts = useMemo(() => {
    const { rawStart, rawEnd } = getCashDateRange(cashActivePeriod, cashPeriodOffset);
    return allAccounts.filter((account) => {
      const createdAt = new Date(account.createdAt);
      return Number.isFinite(createdAt.getTime()) && createdAt >= rawStart && createdAt <= rawEnd;
    });
  }, [allAccounts, cashActivePeriod, cashPeriodOffset]);

  const filteredAccounts = useMemo(() => {
    const search = accountsSearchTerm.trim().toLowerCase();
    return periodAccounts.filter((account) => {
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
  }, [accountsFilter, accountsSearchTerm, accountsWithRefundsIdSet, periodAccounts]);

  const selectedAccount = useMemo(
    () => allAccounts.find((account) => account.id === selectedAccountId) || null,
    [allAccounts, selectedAccountId]
  );
  const selectedAccountDetail = selectedAccountId ? accountDetailById[selectedAccountId] || null : null;
  const accountDrawerContext = useMemo<AccountDrawerContext | undefined>(() => {
    if (!selectedAccount) return undefined;
    const subtitleParts = [
      accountSourceLabel(selectedAccount.sourceType),
      `#${shortCode(selectedAccount.id)}`,
      selectedAccount.booking?.id ? `Reserva #${selectedAccount.booking.id}` : '',
      selectedAccount.createdAt ? formatDateTime24(selectedAccount.createdAt) : '',
    ].filter(Boolean);
    return {
      title: accountDisplayLabel(selectedAccount),
      subtitle: subtitleParts.join(' · '),
      accountStatus: selectedAccount.status,
    };
  }, [selectedAccount]);

  useEffect(() => {
    if (activeTab !== 'ACCOUNTS') return;
    if (filteredAccounts.length === 0) return;
    if (selectedAccountId && filteredAccounts.some((account) => account.id === selectedAccountId)) return;
    setSelectedAccountId(filteredAccounts[0].id);
  }, [activeTab, filteredAccounts, selectedAccountId]);

  // Derived list for CashAccountsList — merges account rows with lazy-loaded detail.
  const cashAccountItems: CashAccountItem[] = useMemo(
    () =>
      filteredAccounts.map((account) => {
        const d = accountDetailById[account.id];
        return {
          id: account.id,
          status: account.status,
          sourceType: account.sourceType,
          hasDebt: account.hasDebt,
          booking: account.booking ?? null,
          detail: d
            ? {
                total: d.total,
                paid: d.paid,
                remaining: d.remaining,
                lastPaymentAt:
                  d.payments?.length
                    ? d.payments[d.payments.length - 1]?.createdAt ?? null
                    : null,
              }
            : null,
        };
      }),
    [filteredAccounts, accountDetailById]
  );

  const selectedAccountDetailLoading = Boolean(
    selectedAccountId && loadingAccountDetailById[selectedAccountId]
  );
  const selectedAccountVisible = useMemo(
    () => filteredAccounts.some((account) => account.id === selectedAccountId),
    [filteredAccounts, selectedAccountId]
  );
  const visibleOpenAccounts = useMemo(
    () => filteredAccounts.filter((account) => account.status === 'OPEN'),
    [filteredAccounts]
  );
  const visibleClosedAccounts = useMemo(
    () => filteredAccounts.filter((account) => account.status === 'CLOSED'),
    [filteredAccounts]
  );
  const visibleAccountsWithDebtCount = useMemo(
    () =>
      visibleOpenAccounts.filter((account) => {
        const d = accountDetailById[account.id];
        return !d || d.remaining > 0.009;
      }).length,
    [accountDetailById, visibleOpenAccounts]
  );
  const visibleAccountsWithRefundsCount = useMemo(
    () => filteredAccounts.filter((account) => accountsWithRefundsIdSet.has(account.id)).length,
    [accountsWithRefundsIdSet, filteredAccounts]
  );

  const refundRequestAccount = useMemo(
    () => allAccounts.find((account) => account.id === refundRequestAccountId) || null,
    [allAccounts, refundRequestAccountId]
  );
  const refundRequestAccountDetail = refundRequestAccountId ? accountDetailById[refundRequestAccountId] || null : null;
  const refundRequestAccountRefunds = refundRequestAccountId
    ? refundsByAccountId[refundRequestAccountId] || EMPTY_REFUNDS
    : EMPTY_REFUNDS;
  const refundRequestPaymentOptions = useMemo(() => {
    const payments = Array.isArray(refundRequestAccountDetail?.payments) ? refundRequestAccountDetail.payments : [];
    return payments.map((payment) => {
      const reserved = refundRequestAccountRefunds
        .filter((refund) => String(refund.paymentId) === String(payment.id))
        .filter((refund) => reservedRefundStatuses.has(String(refund.status || '').toUpperCase()))
        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
      const available = Number(Math.max(0, Number(payment.amount || 0) - reserved).toFixed(2));
      return {
        ...payment,
        refundedAmount: Number(reserved.toFixed(2)),
        availableAmount: available,
      };
    });
  }, [refundRequestAccountDetail, refundRequestAccountRefunds]);
  const refundRequestSelectedPayment = useMemo(
    () => refundRequestPaymentOptions.find((payment) => payment.id === refundRequestPaymentId) || null,
    [refundRequestPaymentId, refundRequestPaymentOptions]
  );
  const refundRequestAmountNumeric = Number(String(refundRequestAmountDraft || '').replace(',', '.'));
  const refundRequestAmountIsValid =
    Number.isFinite(refundRequestAmountNumeric) &&
    refundRequestAmountNumeric > ACCOUNT_PAYMENT_EPSILON &&
    refundRequestSelectedPayment != null &&
    refundRequestAmountNumeric <= Number(refundRequestSelectedPayment.availableAmount || 0) + ACCOUNT_PAYMENT_EPSILON;
  const selectedRefund = useMemo(
    () => recentRefunds.find((refund) => refund.id === selectedRefundId) ||
      pendingRefunds.find((refund) => refund.id === selectedRefundId) ||
      Object.values(refundsByAccountId).flat().find((refund) => refund.id === selectedRefundId) ||
      null,
    [pendingRefunds, recentRefunds, refundsByAccountId, selectedRefundId]
  );
  const refundActionCopyValue = refundActionConfirm ? refundActionCopy(refundActionConfirm.action) : null;
  const refundQuickActions = useCallback((refund: RefundRecord): Array<{ key: string; label: string; icon: ReactNode; action: RefundActionKind; tone?: 'danger' | 'muted' }> => {
    if (refund.status === 'REQUESTED') {
      return [
        { key: 'approve', label: 'Aprobar', icon: <Check size={12} />, action: 'approve' },
        { key: 'cancel', label: 'Cancelar', icon: <X size={12} />, action: 'cancel', tone: 'danger' },
      ];
    }
    if (refund.status === 'APPROVED' || refund.status === 'READY_TO_EXECUTE') {
      return [
        { key: 'execute', label: 'Ejecutar', icon: <Play size={12} />, action: 'execute' },
        { key: 'fail', label: 'Marcar fallida', icon: <XCircle size={12} />, action: 'fail', tone: 'muted' },
      ];
    }
    if (refund.status === 'FAILED') {
      return [
        { key: 'retry', label: 'Reintentar', icon: <RotateCcw size={12} />, action: 'retry' },
        { key: 'cancel', label: 'Cancelar', icon: <X size={12} />, action: 'cancel', tone: 'danger' },
      ];
    }
    return [];
  }, []);

  const closeRefundRequestDrawer = useCallback(() => {
    if (submittingRefundRequest) return;
    setRefundRequestOpen(false);
    setRefundRequestError('');
  }, [submittingRefundRequest]);

  const openRefundRequestSelector = useCallback(() => {
    setRefundRequestAccountLocked(false);
    setRefundRequestAccountId('');
    setRefundRequestPaymentId('');
    setRefundRequestAmountDraft('');
    setRefundRequestReasonType('OTHER');
    setRefundRequestNotes('');
    setRefundRequestExecuteNow(false);
    setRefundRequestError('');
    setRefundRequestOpen(true);
  }, []);

  const openRefundRequestForAccount = useCallback(async (accountId: string, options?: { lockAccount?: boolean }) => {
    const key = String(accountId || '').trim();
    if (!key) {
      showAdminToast('Seleccioná una cuenta con pagos para solicitar una devolución.');
      return;
    }

    setRefundRequestAccountLocked(options?.lockAccount ?? true);
    setRefundRequestAccountId(key);
    setRefundRequestPaymentId('');
    setRefundRequestAmountDraft('');
    setRefundRequestReasonType('OTHER');
    setRefundRequestNotes('');
    setRefundRequestExecuteNow(false);
    setRefundRequestError('');
    setRefundRequestOpen(true);

    const [detail, refunds] = await Promise.all([
      ensureAccountDetail(key, true),
      ensureAccountRefunds(key, true),
    ]);

    const payments = Array.isArray(detail?.payments) ? detail.payments : [];
    const firstAvailable = payments
      .map((payment) => {
        const reserved = refunds
          .filter((refund) => String(refund.paymentId) === String(payment.id))
          .filter((refund) => reservedRefundStatuses.has(String(refund.status || '').toUpperCase()))
          .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
        return {
          id: String(payment.id),
          available: Number(Math.max(0, Number(payment.amount || 0) - reserved).toFixed(2)),
        };
      })
      .find((payment) => payment.available > ACCOUNT_PAYMENT_EPSILON);

    if (firstAvailable) {
      setRefundRequestPaymentId(firstAvailable.id);
      setRefundRequestAmountDraft(firstAvailable.available.toFixed(2));
      setRefundRequestReasonType('FULL');
    } else if (payments.length > 0) {
      setRefundRequestPaymentId(String(payments[0].id));
      setRefundRequestError('Los pagos de esta cuenta no tienen saldo disponible para devolver.');
    } else {
      setRefundRequestError('Esta cuenta no tiene pagos registrados para devolver.');
    }
  }, [ensureAccountDetail, ensureAccountRefunds, showAdminToast]);

  const submitRefundRequest = useCallback(async () => {
    if (!refundRequestAccountId || !refundRequestSelectedPayment) return;
    const amount = Number(String(refundRequestAmountDraft || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= ACCOUNT_PAYMENT_EPSILON) {
      setRefundRequestError('Ingresá un monto válido mayor a 0.');
      return;
    }
    if (amount > Number(refundRequestSelectedPayment.availableAmount || 0) + ACCOUNT_PAYMENT_EPSILON) {
      setRefundRequestError(`El monto no puede superar ${formatMoney(refundRequestSelectedPayment.availableAmount)}.`);
      return;
    }

    try {
      setSubmittingRefundRequest(true);
      setRefundRequestError('');
      const executionMethod = resolveRefundExecutionMethod(refundRequestSelectedPayment.method);
      const created = await requestPaymentRefund(refundRequestSelectedPayment.id, {
        amount: Number(amount.toFixed(2)),
        reasonType: refundRequestReasonType,
        reason: refundRequestReasonType === 'FULL'
          ? 'Devolución total solicitada desde Caja'
          : 'Devolución solicitada desde Caja',
        executionMethod,
        executionNotes: refundRequestNotes.trim() || undefined,
        executeNow: refundRequestExecuteNow,
      });
      await Promise.all([
        refresh(),
        ensureAccountDetail(refundRequestAccountId, true),
        ensureAccountRefunds(refundRequestAccountId, true),
        loadCashSummary(),
        loadCashShiftContext(),
      ]);
      setSelectedRefundId(created.id);
      setRefundRequestOpen(false);
      navigateToPaymentsTab('REFUNDS');
      showAdminToast(refundRequestExecuteNow ? 'Devolución ejecutada correctamente.' : 'Devolución solicitada correctamente.');
    } catch (refundError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'submitRefundRequest' }, refundError);
      setRefundRequestError(extractErrorMessage(refundError, 'No se pudo solicitar la devolución.'));
    } finally {
      setSubmittingRefundRequest(false);
    }
  }, [
    ensureAccountDetail,
    ensureAccountRefunds,
    loadCashShiftContext,
    loadCashSummary,
    navigateToPaymentsTab,
    refresh,
    refundRequestAccountId,
    refundRequestAmountDraft,
    refundRequestExecuteNow,
    refundRequestNotes,
    refundRequestReasonType,
    refundRequestSelectedPayment,
    showAdminToast,
  ]);

  const closeRefundDetailDrawer = useCallback(() => {
    if (refundActionBusy) return;
    setSelectedRefundId('');
    setRefundActionConfirm(null);
    setRefundActionError('');
    setRefundActionReason('');
  }, [refundActionBusy]);

  const openRefundActionConfirm = useCallback((refund: RefundRecord, action: RefundActionKind) => {
    setRefundActionConfirm({ refundId: refund.id, action });
    setRefundActionReason('');
    setRefundActionError('');
  }, []);

  const runRefundAction = useCallback(async () => {
    if (!refundActionConfirm) return;
    const { refundId, action } = refundActionConfirm;
    const copy = refundActionCopy(action);
    const reason = refundActionReason.trim();
    if (copy.needsReason && reason.length < 3) {
      setRefundActionError('Ingresá un motivo de al menos 3 caracteres.');
      return;
    }

    try {
      setRefundActionBusy(true);
      setRefundActionError('');
      if (action === 'approve') {
        await approveRefund(refundId, { executeNow: false });
      } else if (action === 'approve_execute') {
        await approveRefund(refundId, { executeNow: true });
      } else if (action === 'execute') {
        await executeRefund(refundId);
      } else if (action === 'retry') {
        await retryRefund(refundId, { executeNow: true });
      } else if (action === 'fail') {
        await failRefund(refundId, reason);
      } else {
        await cancelRefund(refundId, reason);
      }
      const accountId = String(selectedRefund?.accountId || '').trim();
      await Promise.all([
        refresh(),
        accountId ? ensureAccountDetail(accountId, true) : Promise.resolve(null),
        accountId ? ensureAccountRefunds(accountId, true) : Promise.resolve([]),
        loadCashSummary(),
        loadCashShiftContext(),
      ]);
      setRefundActionConfirm(null);
      setRefundActionReason('');
      showAdminToast('Devolución actualizada correctamente.');
    } catch (actionError) {
      reportUiError({ area: 'PaymentsPlayground', action: 'runRefundAction' }, actionError);
      setRefundActionError(extractErrorMessage(actionError, 'No se pudo actualizar la devolución.'));
    } finally {
      setRefundActionBusy(false);
    }
  }, [
    ensureAccountDetail,
    ensureAccountRefunds,
    loadCashShiftContext,
    loadCashSummary,
    refresh,
    refundActionConfirm,
    refundActionReason,
    selectedRefund?.accountId,
    showAdminToast,
  ]);


  if (!authChecked || !user) {
    return <RouteTransitionScreen message={authChecked ? 'Redirigiendo...' : 'Validando acceso...'} />;
  }
  if (!hasAdminAccess(user)) {
    return <NotFound message="No tenés permiso para acceder al panel de administración." />;
  }

  return (
    <>
      <Head>
        <title>Caja | TuCancha Admin</title>
      </Head>
      <AdminPlaygroundShell activeItem="Caja" user={user} contentMuted={cashActionSidebarOpen}>
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
          <AdminSegmentedControl
            ariaLabel="Secciones de caja"
            value={activeTab}
            onChange={(nextTab) => navigateToPaymentsTab(nextTab as PaymentsTab)}
            options={[
              { value: 'SUMMARY', label: 'Resumen' },
              { value: 'ACCOUNTS', label: 'Cuentas' },
              { value: 'MOVEMENTS', label: 'Movimientos' },
              { value: 'CLOSURE', label: 'Cierre' },
              { value: 'REFUNDS', label: 'Devoluciones' },
            ]}
            className="w-fit"
          />

          {error && (
            <div className="rounded-xl border border-[#f2b8c3] bg-[#fff2f5] px-3 py-2 text-[12px] font-semibold text-[#b42346]">
              {error}
            </div>
          )}

          <section ref={paymentsContentScrollRef} className="min-h-0 flex-1 overflow-auto">
            {loading && (activeTab === 'ACCOUNTS' || activeTab === 'REFUNDS') ? (
              <div className="h-full grid place-items-center">
                <div className="inline-flex items-center gap-2 text-[13px] text-[#6f7890]">
                  <span className="h-4 w-4 rounded-full border-2 border-[#b9c6f4] border-t-[#3053e2] animate-spin" />
                  Cargando módulo de pagos...
                </div>
              </div>
            ) : activeTab === 'ACCOUNTS' ? (
              <div className="space-y-4">
                <div className="w-full rounded-2xl border border-[#dce2ee] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-1">
                      {(['hoy', 'semana', 'mes'] as CashPeriod[]).map((period) => (
                        <button
                          key={`accounts-${period}`}
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
                        onClick={() => setCashPeriodOffset((prev) => Math.min(0, prev + 1))}
                        disabled={cashPeriodOffset === 0}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:text-[#b8c1d4] disabled:hover:bg-transparent"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MetricCard label="Cuentas abiertas" value={visibleOpenAccounts.length} format="number" />
                  <MetricCard
                    label="Con deuda"
                    value={visibleAccountsWithDebtCount}
                    format="number"
                    valueColor="#9a5a00"
                  />
                  <MetricCard label="Cerradas" value={visibleClosedAccounts.length} format="number" valueColor="#2f5e46" />
                  <MetricCard label="Con devoluciones" value={visibleAccountsWithRefundsCount} format="number" valueColor="#7b3fb4" />
                </div>
                <AdminPanel
                  title="Cuentas"
                  description="Gestión operativa de cuentas abiertas y cerradas."
                  headerClassName="pl-4 pr-2 py-3"
                  actions={(
                    <AdminFilterToolbar className="border-0 bg-transparent p-0 gap-1 sm:flex-nowrap sm:justify-end">
                      <label className="relative w-full sm:w-[300px] sm:flex-none">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a5]" />
                        <input
                          type="text"
                          value={accountsSearchTerm}
                          onChange={(event) => setAccountsSearchTerm(event.target.value)}
                          placeholder="Buscar por cliente, cuenta, reserva o cancha"
                          className="h-8 w-full rounded-xl border border-[#dce2ee] bg-white pl-9 pr-3 text-[12px] outline-none focus:border-[#3053e2]"
                        />
                      </label>
                      <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-white p-1">
                        {[
                          { id: 'ALL', label: 'Todas' },
                          { id: 'OPEN', label: 'Abiertas' },
                          { id: 'CLOSED', label: 'Cerradas' },
                          { id: 'WITH_REFUNDS', label: 'Con devolución' },
                        ].map((option) => (
                          <button
                            key={`accounts-filter-${option.id}`}
                            type="button"
                            onClick={() => setAccountsFilter(option.id as AccountsFilter)}
                            className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition ${
                              accountsFilter === option.id
                                ? 'bg-[#edf1ff] text-[#3053e2]'
                                : 'text-[#6f7890] hover:bg-[#f4f6fb]'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleQuickOpenAccount()}
                        disabled={openingAccount}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3053e2] px-2.5 text-[11px] font-semibold text-white hover:bg-[#2748cc] disabled:opacity-60"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                        {openingAccount ? 'Creando...' : 'Nueva cuenta'}
                      </button>
                    </AdminFilterToolbar>
                  )}
                >
                  {filteredAccounts.length === 0 ? (
                    <div className="rounded-xl border border-[#dce2ee] bg-white px-4 py-10 text-center">
                      <p className="text-[13px] font-semibold text-[#44506b]">No hay cuentas para este período</p>
                      <p className="mt-1 text-[12px] text-[#7a8398]">Cambiá el rango o ajustá los filtros para encontrar registros.</p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="max-h-[560px] overflow-y-auto pr-1">
                      <CashAccountsList
                        accounts={cashAccountItems}
                        selectedId={selectedAccountId}
                        onSelect={handleSelectAccount}
                      />
                    </div>

                    <div
                      ref={selectedAccountDetailFocusRef}
                      tabIndex={-1}
                      className="min-w-0 scroll-mt-4 outline-none"
                    >
                      {selectedAccountVisible && selectedAccount ? (
                        <CashAccountDetailPanel
                          account={selectedAccount}
                          detail={selectedAccountDetail}
                          loading={selectedAccountDetailLoading}
                          error={accountDetailError}
                          onManage={() => openAccountDrawer(selectedAccount.id, 'overview')}
                          onPay={() => openAccountDrawer(selectedAccount.id, 'payment')}
                          onRefund={() => void openRefundRequestForAccount(selectedAccount.id)}
                          onCloseAccount={() => openAccountDrawer(selectedAccount.id, 'close')}
                        />
                      ) : (
                        <div className="rounded-xl border border-[#dce2ee] bg-white px-4 py-10 text-center">
                          <p className="text-[13px] font-semibold text-[#44506b]">Seleccioná una cuenta</p>
                          <p className="mt-1 text-[12px] text-[#7a8398]">Elegí un registro de la lista para ver su detalle y deuda actual.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </AdminPanel>
              </div>
            ) : isCashSectionTab(activeTab) ? (
              <div className="space-y-4">
                {cashActiveView === 'live' && (
                  <>
                    <div className="w-full rounded-2xl border border-[#dce2ee] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-1">
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
                            onClick={() => setCashPeriodOffset((prev) => Math.min(0, prev + 1))}
                            disabled={cashPeriodOffset === 0}
                            className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:text-[#b8c1d4] disabled:hover:bg-transparent"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <CashSummaryCards balance={cashBalance} loading={loadingCashSummary} />
                  </>
                )}

                {cashActiveView === 'movements' && (
                  <div className="w-full rounded-2xl border border-[#dce2ee] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-1">
                        {(['hoy', 'semana', 'mes'] as CashPeriod[]).map((period) => (
                          <button
                            key={`movements-${period}`}
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
                          onClick={() => setCashPeriodOffset((prev) => Math.min(0, prev + 1))}
                          disabled={cashPeriodOffset === 0}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:text-[#b8c1d4] disabled:hover:bg-transparent"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(cashSummaryError || cashShiftError || cashMovementError) && (
                  <div className="space-y-2">
                    {cashSummaryError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashSummaryError}</div>}
                    {cashShiftError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashShiftError}</div>}
                    {cashMovementError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{cashMovementError}</div>}
                  </div>
                )}

                {cashActiveView === 'live' && (
                  <CashShiftPanel
                    shift={cashCurrentShift}
                    loading={loadingCashShift}
                    onToggleShift={() => {
                      if (cashCurrentShift && shouldBlockCloseShiftWithOpenAccounts) {
                        showAdminToast(closeShiftBlockedMessage);
                        return;
                      }
                      setCashSidebarView(cashCurrentShift ? 'close_shift' : 'open_shift');
                    }}
                    onRegisterMovement={() => {
                      navigateToPaymentsTab('MOVEMENTS');
                      setCashSidebarView('movement_create');
                    }}
                    onGoToClosures={() => navigateToPaymentsTab('CLOSURE')}
                  />
                )}

                {cashActiveView === 'movements' && (
                  <AdminPanel
                    title="Movimientos"
                    description="Timeline de ingresos y egresos del período visible."
                    headerClassName="pl-4 pr-2 py-3"
                    actions={(
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCashSidebarView('movement_create')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3053e2] px-2.5 text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(48,83,226,0.24)] transition hover:bg-[#2746c9]"
                        >
                          <Plus size={14} strokeWidth={2.5} />
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
                    )}
                    bodyClassName="p-4"
                  >

                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <MetricCard
                        label="Resultado visible"
                        value={Math.abs(filteredNetAmount)}
                        format="money"
                        valueColor={filteredNetAmount >= 0 ? '#15803d' : '#b91c1c'}
                      />
                      <MetricCard
                        label="Ingresos visibles"
                        value={filteredIncomeAmount}
                        format="money"
                        valueColor="#15803d"
                      />
                      <MetricCard
                        label="Egresos visibles"
                        value={filteredExpenseAmount}
                        format="money"
                        valueColor="#b91c1c"
                      />
                    </div>

                    {cashShowFilters && (
                      <AdminFilterToolbar className="mb-3 grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto]">
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
                  className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                        >
                          <option value="ALL">Todos los tipos</option>
                          <option value="INCOME">Solo ingresos</option>
                          <option value="EXPENSE">Solo egresos</option>
                        </select>

                        <select
                          value={cashMethodFilter}
                          onChange={(event) => setCashMethodFilter(event.target.value as MovementMethodFilter)}
                  className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
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
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dce2ee] bg-white px-3 text-[12px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                        >
                          <X size={13} />
                          Limpiar filtros
                        </button>
                      </AdminFilterToolbar>
                    )}

                    <div className="overflow-auto rounded-xl border border-[#dce2ee] bg-white max-h-[68vh] px-4 py-2">
                      <CashMovementsTimeline movements={filteredCashMovements} />
                    </div>
                  </AdminPanel>
                )}

                {cashActiveView === 'closures' && (
                  <CashCloseFlow
                    shift={cashCurrentShift}
                    lastReport={cashLastCloseReport}
                    onCloseShift={() => {
                      if (shouldBlockCloseShiftWithOpenAccounts) {
                        showAdminToast(closeShiftBlockedMessage);
                        return;
                      }
                      setCashCloseShiftForm({ countedCash: '' });
                      setCashSidebarView('close_shift');
                    }}
                    onViewReport={() => setCashSidebarView('close_report')}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-full rounded-2xl border border-[#dce2ee] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-1">
                      {(['hoy', 'semana', 'mes'] as CashPeriod[]).map((period) => (
                        <button
                          key={`refunds-${period}`}
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
                        onClick={() => setCashPeriodOffset((prev) => Math.min(0, prev + 1))}
                        disabled={cashPeriodOffset === 0}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#6f7890] transition hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:text-[#b8c1d4] disabled:hover:bg-transparent"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MetricCard label="Pendientes (período)" value={filteredPendingRefunds.length} format="number" valueColor="#3053e2" />
                  <MetricCard label="Total recientes (período)" value={filteredRecentRefunds.length} format="number" valueColor="#2f5e46" />
                  <MetricCard label="Monto pendiente (período)" value={filteredPendingRefundAmount} format="money" />
                </div>

                <AdminPanel
                  title="Devoluciones recientes"
                  description="Listado real del período según filtros seleccionados."
                  headerClassName="pl-4 pr-2 py-3"
                  actions={(
                    <AdminFilterToolbar className="border-0 bg-transparent p-0 gap-1 sm:flex-nowrap sm:justify-end">
                      <button
                        type="button"
                        onClick={openRefundRequestSelector}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#3053e2] px-3 text-[12px] font-semibold text-white transition hover:bg-[#2748cc]"
                      >
                        <Plus size={14} strokeWidth={2.4} />
                        Nueva devolución
                      </button>

                      <label className="relative w-full sm:w-[260px] sm:flex-none">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b93a5]" />
                        <input
                          type="text"
                          value={refundSearchTerm}
                          onChange={(event) => setRefundSearchTerm(event.target.value)}
                          placeholder="Buscar por código, motivo o referencia"
                          className="h-8 w-full rounded-xl border border-[#dce2ee] bg-white pl-9 pr-3 text-[12px] outline-none focus:border-[#3053e2]"
                        />
                      </label>

                      <select
                        value={refundStatusFilter}
                        onChange={(event) => setRefundStatusFilter(event.target.value as RefundStatusFilter)}
                        className="h-8 min-w-[145px] rounded-xl border border-[#dce2ee] bg-white px-2.5 text-[12px] outline-none focus:border-[#3053e2]"
                      >
                        <option value="ALL">Todos los estados</option>
                        <option value="REQUESTED">Solicitada</option>
                        <option value="APPROVED">Aprobada</option>
                        <option value="READY_TO_EXECUTE">Lista</option>
                        <option value="EXECUTED">Ejecutada</option>
                        <option value="FAILED">Fallida</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>

                      <select
                        value={refundMethodFilter}
                        onChange={(event) => setRefundMethodFilter(event.target.value as RefundMethodFilter)}
                        className="h-8 min-w-[165px] rounded-xl border border-[#dce2ee] bg-white px-2.5 text-[12px] outline-none focus:border-[#3053e2]"
                      >
                        <option value="ALL">Todos los métodos</option>
                        <option value="CASH">Efectivo</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CARD_REVERSAL">Reverso tarjeta</option>
                        <option value="CREDIT_NOTE">Nota de crédito</option>
                      </select>
                    </AdminFilterToolbar>
                  )}
                  bodyClassName="p-0"
                >
                  {filteredRecentRefunds.length > 0 && (
                    <>
                      <div className="hidden grid-cols-[130px_140px_minmax(0,1fr)_140px_140px_120px_120px_110px] border-b border-[#eef2f8] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6f7890] lg:grid">
                        <p>Código</p>
                        <p>Fecha</p>
                        <p>Motivo</p>
                        <p>Método</p>
                        <p>Pago / Cuenta</p>
                        <p>Estado</p>
                        <p className="text-right">Monto</p>
                        <p className="text-right">Acciones</p>
                      </div>
                      <div className="hidden divide-y divide-[#eef2f8] lg:block">
                        {filteredRecentRefunds.map((refund) => {
                          const isSelected = selectedRefundId === refund.id;
                          return (
                          <button
                            key={`refund-grid-${refund.id}`}
                            type="button"
                            onClick={() => setSelectedRefundId(refund.id)}
                            className={`group relative grid w-full grid-cols-[130px_140px_minmax(0,1fr)_140px_140px_120px_120px_110px] items-center px-4 py-3 text-left text-[13px] transition ${
                              isSelected ? 'bg-[#f3f6ff] text-[#2a3245]' : 'text-[#4b5672] hover:bg-[#f8f9fd]'
                            }`}
                          >
                            {isSelected ? <span className="absolute -inset-y-px left-0 w-0.5 rounded-r-full bg-[#3053e2]" aria-hidden="true" /> : null}
                            <p className="font-semibold text-[#2a3245]">{refundCodeLabel(refund)}</p>
                            <p>{formatDateTime24(refund.createdAt)}</p>
                            <p className="truncate">{refund.reason?.trim() || refundReasonTypeLabel(refund.reasonType)}</p>
                            <p>{refundExecutionMethodLabel(refund.executionMethod)}</p>
                            <p className="truncate text-[#5f6984]">P:{shortId(refund.paymentId)} · C:{shortId(refund.accountId)}</p>
                            <div>
                              <span className="rounded-full bg-[#eef1f7] px-2 py-0.5 text-[11px] font-semibold text-[#55617f]">
                                {formatRefundStatus(refund.status)}
                              </span>
                            </div>
                            <p className="text-right font-semibold text-[#27314a]">{formatMoney(refund.amount)}</p>
                            <div
                              className={`flex min-h-8 items-center justify-end gap-1.5 transition-opacity ${
                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {refundQuickActions(refund).length === 0 ? (
                                <span className="inline-flex h-8 w-8 items-center justify-center opacity-0" aria-hidden="true">
                                  Acción
                                </span>
                              ) : null}
                              {refundQuickActions(refund).map((quickAction) => (
                                <button
                                  key={`${refund.id}-${quickAction.key}`}
                                  type="button"
                                  title={quickAction.label}
                                  aria-label={quickAction.label}
                                  onClick={() => openRefundActionConfirm(refund, quickAction.action)}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                    quickAction.tone === 'danger'
                                      ? 'border-[#ffd6d6] bg-[#fff5f5] text-[#b42318] hover:bg-[#ffecec]'
                                      : quickAction.tone === 'muted'
                                        ? 'border-[#dce2ee] bg-white text-[#6f7890] hover:bg-[#f8f9fd]'
                                        : 'border-[#dce2ee] bg-white text-[#3053e2] hover:bg-[#eef2ff]'
                                  }`}
                                >
                                  {quickAction.icon}
                                </button>
                              ))}
                            </div>
                          </button>
                        )})}
                      </div>
                    </>
                  )}
                  {filteredRecentRefunds.length === 0 && (
                    <div className="hidden px-3 py-8 text-center lg:block">
                      <p className="text-[13px] font-semibold text-[#44506b]">No hay devoluciones para este período</p>
                      <p className="mt-1 text-[12px] text-[#7a8398]">Proba otro rango o ajustá los filtros para ver resultados.</p>
                    </div>
                  )}
                  <div className="divide-y divide-[#eef2f8] lg:hidden">
                    {filteredRecentRefunds.map((refund) => {
                      const isSelected = selectedRefundId === refund.id;
                      return (
                      <button
                        key={refund.id}
                        type="button"
                        onClick={() => setSelectedRefundId(refund.id)}
                        className={`relative block w-full px-4 py-3 text-left text-[13px] transition ${
                          isSelected ? 'bg-[#eef2ff] text-[#2a3245]' : 'text-[#4b5672] hover:bg-[#f8f9fd]'
                        }`}
                      >
                        {isSelected ? <span className="absolute -inset-y-px left-0 w-0.5 rounded-r-full bg-[#3053e2]" aria-hidden="true" /> : null}
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[#2a3245]">{refundCodeLabel(refund)}</p>
                          <span className="rounded-full bg-[#eef1f7] px-2 py-0.5 text-[10px] font-semibold text-[#55617f]">
                            {formatRefundStatus(refund.status)}
                          </span>
                        </div>
                        <p>{formatMoney(refund.amount)} · {formatDateTime24(refund.createdAt)}</p>
                      </button>
                    )})}
                    {filteredRecentRefunds.length === 0 && (
                      <div className="px-3 py-8 text-center">
                        <p className="text-[13px] font-semibold text-[#44506b]">No hay devoluciones para este período</p>
                        <p className="mt-1 text-[12px] text-[#7a8398]">Proba otro rango o ajustá los filtros para ver resultados.</p>
                      </div>
                    )}
                  </div>
                </AdminPanel>
              </div>
            )}
          </section>

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
      </AdminPlaygroundShell>

      <AccountDrawer
        accountId={selectedAccountId || null}
        open={accountDrawerOpen}
        initialView={accountDrawerInitialView}
        context={accountDrawerContext}
        onClose={closeAccountDrawer}
        onSuccess={(event, meta?: AccountDrawerSuccessMeta) => {
          if (event === 'closed') {
            showAdminToast(`${meta?.label || 'Cuenta'} cerrada correctamente.`);
          }
          const accountId = meta?.accountId || selectedAccountId;
          void (async () => {
            await refresh();
            if (accountId) {
              await ensureAccountDetail(accountId, true);
              focusSelectedAccountDetail();
            }
          })();
        }}
        onRefundRequest={(acctId) => void openRefundRequestForAccount(acctId)}
      />


      <AdminDrawer
        open={refundRequestOpen}
        onClose={closeRefundRequestDrawer}
        title="Solicitar devolución"
        subtitle={
          refundRequestAccount
            ? `${refundRequestAccount.booking?.clientName || `Cuenta ${shortCode(refundRequestAccount.id)}`} · #${shortCode(refundRequestAccount.id)}`
            : 'Seleccioná una cuenta y un pago para devolver.'
        }
        statusChip={refundRequestAccount?.status === 'OPEN' ? 'Cuenta abierta' : refundRequestAccount ? 'Cuenta cerrada' : undefined}
        statusChipClassName={refundRequestAccount?.status === 'OPEN' ? 'bg-[#edf1ff] text-[#3155df]' : 'bg-[#e8f8ec] text-[#16733f]'}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeRefundRequestDrawer}
              disabled={submittingRefundRequest}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dce2ee] bg-white px-4 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd] disabled:opacity-60"
            >
              <X size={14} />
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submitRefundRequest()}
              disabled={submittingRefundRequest || !refundRequestAmountIsValid}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3053e2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2748cc] disabled:opacity-60"
            >
              <Check size={14} />
              {submittingRefundRequest
                ? 'Procesando...'
                : refundRequestExecuteNow
                  ? 'Solicitar y ejecutar'
                  : 'Solicitar devolución'}
            </button>
          </div>
        }
      >
        <AdminDrawerSection title="Cuenta" className={drawerSectionCardClass}>
          <div className="space-y-3">
            {refundRequestAccountLocked && refundRequestAccount ? (
              <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a1b3]">Cuenta seleccionada</p>
                <p className="mt-1 text-[13px] font-semibold text-[#27314b]">{accountDisplayLabel(refundRequestAccount)}</p>
                <p className="mt-0.5 text-[11px] text-[#6f7890]">
                  #{shortCode(refundRequestAccount.id)} · {refundRequestAccount.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                </p>
              </div>
            ) : (
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Cuenta asociada</span>
                <select
                  value={refundRequestAccountId}
                  onChange={(event) => {
                    const nextAccountId = event.target.value;
                    if (!nextAccountId) {
                      setRefundRequestAccountLocked(false);
                      setRefundRequestAccountId('');
                      setRefundRequestPaymentId('');
                      setRefundRequestAmountDraft('');
                      setRefundRequestReasonType('OTHER');
                      setRefundRequestError('');
                      return;
                    }
                    void openRefundRequestForAccount(nextAccountId, { lockAccount: false });
                  }}
                  disabled={submittingRefundRequest}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2] disabled:opacity-60"
                >
                  <option value="">Seleccionar cuenta</option>
                  {allAccounts.map((account) => (
                    <option key={`refund-account-option-${account.id}`} value={account.id}>
                      {accountDisplayLabel(account)} · #{shortCode(account.id)} · {account.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!refundRequestAccountId && (
              <p className="text-[12px] text-[#6f7890]">
                Elegí una cuenta para ver sus pagos disponibles y solicitar la devolución sobre un pago concreto.
              </p>
            )}
            {allAccounts.length === 0 && (
              <p className="border-t border-[#edf0f6] pt-3 text-[12px] text-[#6f7890]">
                No hay cuentas cargadas para iniciar una devolución.
              </p>
            )}
          </div>
        </AdminDrawerSection>

        <AdminDrawerSection title="Pago a devolver" className={drawerSectionCardClass}>
          <div className="space-y-2">
            {Boolean(refundRequestAccountId && loadingRefundsByAccountId[refundRequestAccountId]) && (
              <div className="rounded-xl border border-[#dce7ff] bg-[#f4f7ff] px-3 py-2 text-[12px] font-semibold text-[#3053e2]">
                Cargando pagos y devoluciones...
              </div>
            )}
            {refundRequestPaymentOptions.length === 0 ? (
              <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] px-3 py-4 text-center text-[12px] text-[#6f7890]">
                {refundRequestAccountId
                  ? 'Esta cuenta no tiene pagos disponibles para devolver.'
                  : 'Seleccioná una cuenta para ver sus pagos disponibles.'}
              </div>
            ) : (
              refundRequestPaymentOptions.map((payment) => {
                const selected = payment.id === refundRequestPaymentId;
                const disabled = Number(payment.availableAmount || 0) <= ACCOUNT_PAYMENT_EPSILON;
                return (
                  <button
                    key={`refund-payment-${payment.id}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setRefundRequestPaymentId(payment.id);
                      setRefundRequestAmountDraft(Number(payment.availableAmount || 0).toFixed(2));
                      setRefundRequestReasonType(Number(payment.availableAmount || 0) + ACCOUNT_PAYMENT_EPSILON >= Number(payment.amount || 0) ? 'FULL' : 'PARTIAL_COMMERCIAL');
                      setRefundRequestError('');
                    }}
                className={[
                  'w-full rounded-xl border px-3 py-3 text-left transition',
                  selected ? 'border-[#3053e2] bg-[#f4f7ff]' : 'border-[#dce2ee] bg-white hover:bg-[#f8f9fd]',
                  disabled ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#27314b]">Pago #{shortCode(payment.id)}</p>
                        <p className="mt-0.5 text-[11px] text-[#6f7890]">
                          {paymentMethodLabel(payment.method)} · {paymentChannelLabel(payment.channel || '')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-[#27314b]">{formatMoney(payment.amount)}</p>
                        <p className="mt-0.5 text-[11px] text-[#6f7890]">Disponible {formatMoney(payment.availableAmount)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </AdminDrawerSection>

        <AdminDrawerSection title="Datos de la devolución" className={drawerSectionCardClass}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[12px] font-medium text-[#4e5870]">Monto a devolver</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={refundRequestAmountDraft}
                onChange={(event) => {
                  setRefundRequestAmountDraft(event.target.value);
                  setRefundRequestError('');
                }}
                className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                placeholder="0.00"
              />
              <span className="mt-1 block text-[11px] text-[#7a8398]">
                Máximo: {formatMoney(refundRequestSelectedPayment?.availableAmount || 0)}
              </span>
            </label>

            <label className="block">
              <span className="text-[12px] font-medium text-[#4e5870]">Motivo</span>
              <select
                value={refundRequestReasonType}
                onChange={(event) => setRefundRequestReasonType(event.target.value as RefundReasonType)}
                className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
              >
                {refundReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-medium text-[#4e5870]">Nota interna</span>
              <textarea
                value={refundRequestNotes}
                onChange={(event) => setRefundRequestNotes(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full resize-none rounded-xl border border-[#dce2ee] bg-white px-3 py-2 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                placeholder="Detalle operativo"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#dce2ee] bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={refundRequestExecuteNow}
                onChange={(event) => setRefundRequestExecuteNow(event.target.checked)}
                className="h-4 w-4 accent-[#3053e2]"
              />
              <span className="text-[12px] font-semibold text-[#27314b]">Ejecutar ahora</span>
            </label>
          </div>
          {refundRequestError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {refundRequestError}
            </div>
          )}
        </AdminDrawerSection>
      </AdminDrawer>

      <AdminDrawer
        open={Boolean(selectedRefund)}
        onClose={closeRefundDetailDrawer}
        title="Detalle de devolución"
        subtitle={selectedRefund ? `${refundCodeLabel(selectedRefund)} · ${formatMoney(selectedRefund.amount)}` : undefined}
        statusChip={selectedRefund ? formatRefundStatus(selectedRefund.status) : undefined}
        statusChipClassName={
          selectedRefund?.status === 'EXECUTED'
            ? 'bg-[#e8f8ec] text-[#16733f]'
            : selectedRefund?.status === 'FAILED' || selectedRefund?.status === 'CANCELLED'
              ? 'bg-[#fff1f3] text-[#9f1635]'
              : 'bg-[#edf1ff] text-[#3155df]'
        }
        size="md"
        footer={
          selectedRefund ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedRefund.status === 'REQUESTED' && (
                <>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'cancel')}
                    className="h-10 rounded-xl border border-[#ffd6d6] bg-[#fff5f5] px-3 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff0f0]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'approve')}
                    className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'approve_execute')}
                    className="h-10 rounded-xl bg-[#3053e2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                  >
                    Aprobar y ejecutar
                  </button>
                </>
              )}
              {(selectedRefund.status === 'APPROVED' || selectedRefund.status === 'READY_TO_EXECUTE') && (
                <>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'cancel')}
                    className="h-10 rounded-xl border border-[#ffd6d6] bg-[#fff5f5] px-3 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff0f0]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'fail')}
                    className="h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
                  >
                    Marcar fallida
                  </button>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'execute')}
                    className="h-10 rounded-xl bg-[#3053e2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                  >
                    Ejecutar
                  </button>
                </>
              )}
              {selectedRefund.status === 'FAILED' && (
                <>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'cancel')}
                    className="h-10 rounded-xl border border-[#ffd6d6] bg-[#fff5f5] px-3 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff0f0]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => openRefundActionConfirm(selectedRefund, 'retry')}
                    className="h-10 rounded-xl bg-[#3053e2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
                  >
                    Reintentar
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {selectedRefund && (
          <>
            <AdminDrawerSection title="Resumen" className={drawerSectionCardClass}>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a1b3]">Monto</p>
                  <p className="mt-1 text-[18px] font-bold text-[#27314b]">{formatMoney(selectedRefund.amount)}</p>
                </div>
                <div className="rounded-xl border border-[#dce2ee] bg-white px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a1b3]">Método</p>
                  <p className="mt-1 text-[14px] font-bold text-[#27314b]">{refundExecutionMethodLabel(selectedRefund.executionMethod)}</p>
                </div>
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Referencias" className={drawerSectionCardClass}>
              <div className="divide-y divide-[#e8edf5] rounded-xl border border-[#dce2ee] bg-[#fbfcff] px-3 text-[12px] text-[#4e5870]">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span>Pago</span>
                  <span className="font-mono font-semibold text-[#27314b]">{shortCode(selectedRefund.paymentId)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span>Cuenta</span>
                  <span className="font-mono font-semibold text-[#27314b]">{shortCode(selectedRefund.accountId)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span>Turno de caja</span>
                  <span className="font-mono font-semibold text-[#27314b]">{selectedRefund.cashShiftId ? shortCode(selectedRefund.cashShiftId) : '-'}</span>
                </div>
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Trazabilidad" className={drawerSectionCardClass}>
              <div className="divide-y divide-[#e8edf5] rounded-xl border border-[#dce2ee] bg-[#fbfcff] px-3 text-[12px]">
                {[
                  ['Creada', selectedRefund.createdAt],
                  ['Aprobada', selectedRefund.approvedAt],
                  ['Ejecutada', selectedRefund.executedAt],
                  ['Cancelada', selectedRefund.cancelledAt],
                  ['Fallida', selectedRefund.failedAt],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a1b3]">{label}</p>
                    <p className="font-semibold text-[#27314b]">{value ? formatDateTime24(String(value)) : '-'}</p>
                  </div>
                ))}
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Notas" className={drawerSectionCardClass}>
              <div className="divide-y divide-[#e8edf5] rounded-xl border border-[#dce2ee] bg-[#fbfcff] px-3 text-[12px] text-[#4e5870]">
                <p className="py-2.5"><span className="font-semibold text-[#27314b]">Motivo:</span> {selectedRefund.reason?.trim() || refundReasonTypeLabel(selectedRefund.reasonType)}</p>
                <p className="py-2.5"><span className="font-semibold text-[#27314b]">Nota:</span> {selectedRefund.executionNotes?.trim() || '-'}</p>
                <p className="py-2.5"><span className="font-semibold text-[#27314b]">Referencia:</span> {selectedRefund.executionReference?.trim() || '-'}</p>
                <p className="py-2.5"><span className="font-semibold text-[#27314b]">Cancelación:</span> {selectedRefund.cancelReason?.trim() || '-'}</p>
                <p className="py-2.5"><span className="font-semibold text-[#27314b]">Fallo:</span> {selectedRefund.failedReason?.trim() || '-'}</p>
              </div>
            </AdminDrawerSection>
          </>
        )}
      </AdminDrawer>

      <AdminAppModal
        show={Boolean(refundActionConfirm && refundActionCopyValue)}
        onClose={() => {
          if (refundActionBusy) return;
          setRefundActionConfirm(null);
          setRefundActionError('');
          setRefundActionReason('');
        }}
        onCancel={() => {
          if (refundActionBusy) return;
          setRefundActionConfirm(null);
          setRefundActionError('');
          setRefundActionReason('');
        }}
        title={refundActionCopyValue?.title || 'Confirmar acción'}
        message={
          refundActionCopyValue ? (
            <div className="space-y-4">
              <p>{refundActionCopyValue.message}</p>
              {refundActionCopyValue.needsReason && (
                <label className="block">
                  <span className="text-[12px] font-medium text-[#4e5870]">Motivo</span>
                  <textarea
                    value={refundActionReason}
                    onChange={(event) => {
                      setRefundActionReason(event.target.value);
                      setRefundActionError('');
                    }}
                    rows={3}
                    maxLength={500}
                    className="mt-1 w-full resize-none rounded-xl border border-[#dce2ee] bg-white px-3 py-2 text-[13px] text-[#2a3245] outline-none transition focus:border-[#3053e2]"
                    placeholder="Detalle operativo"
                  />
                </label>
              )}
              {refundActionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {refundActionError}
                </div>
              )}
            </div>
          ) : null
        }
        cancelText="Volver"
        confirmText={refundActionBusy ? 'Procesando...' : refundActionCopyValue?.confirm || 'Confirmar'}
        isWarning={refundActionConfirm?.action === 'cancel' || refundActionConfirm?.action === 'fail'}
        confirmDisabled={refundActionBusy}
        closeOnBackdrop={!refundActionBusy}
        closeOnEscape={!refundActionBusy}
        onConfirm={() => void runRefundAction()}
      />


      <AdminDrawer
        open={cashActionSidebarOpen}
        onClose={closeActionSidebar}
        title={
          cashSidebarView === 'open_shift'
            ? 'Abrir caja'
            : cashSidebarView === 'close_shift'
              ? 'Cerrar caja'
              : cashSidebarView === 'movement_create'
                ? 'Registrar movimiento'
                : cashSidebarView === 'close_report'
                  ? 'Detalle de arqueo'
                  : 'Caja'
        }
        subtitle={
          cashSidebarView === 'open_shift'
            ? 'Configura caja registradora y monto inicial.'
            : cashSidebarView === 'close_shift'
              ? 'Ingresa el efectivo contado para cerrar el turno.'
              : cashSidebarView === 'movement_create'
                ? 'Crea ingresos o egresos sin saturar la vista principal.'
                : cashSidebarView === 'close_report'
                  ? 'Resumen ampliado del ultimo cierre registrado.'
                  : undefined
        }
        statusChip={cashCurrentShift ? 'Caja abierta' : 'Caja cerrada'}
        statusChipClassName={cashCurrentShift ? 'border-[#d4f0dc] bg-[#e8f8ec] text-[#16733f]' : 'border-[#dce5ff] bg-[#edf1ff] text-[#3155df]'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeActionSidebar}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dce2ee] bg-white px-4 text-[13px] font-semibold text-[#4e5870] hover:bg-[#f8f9fd]"
            >
              <X size={14} />
              {cashSidebarView === 'close_report' ? 'Cerrar' : 'Cancelar'}
            </button>

            {cashSidebarView === 'open_shift' && (
              <button
                type="submit"
                form="cash-open-shift-form"
                disabled={openingCashShift}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3053e2] px-5 text-[13px] font-semibold text-white hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Landmark size={14} />
                {openingCashShift ? 'Abriendo...' : 'Abrir caja'}
              </button>
            )}

            {cashSidebarView === 'close_shift' && (
              <button
                type="submit"
                form="cash-close-shift-form"
                disabled={closingCashShift || !cashCurrentShift}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3053e2] px-5 text-[13px] font-semibold text-white hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={14} />
                {closingCashShift ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            )}

            {cashSidebarView === 'movement_create' && (
              <button
                type="submit"
                form="cash-new-movement-form"
                disabled={submittingCashMovement || !cashCurrentShift}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3053e2] px-5 text-[13px] font-semibold text-white hover:bg-[#2748cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={14} />
                {submittingCashMovement ? 'Registrando...' : 'Registrar movimiento'}
              </button>
            )}
          </div>
        }
      >
        {cashSidebarView === 'open_shift' && (
          <form id="cash-open-shift-form" className="space-y-5" onSubmit={handleOpenShift}>
            <AdminDrawerSection title="Caja" className={drawerSectionCardClass}>
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Caja registradora</span>
                <select
                  value={cashOpenShiftForm.cashRegisterId}
                  onChange={(event) => setCashOpenShiftForm((prev) => ({ ...prev, cashRegisterId: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                >
                  <option value="">Seleccionar</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </label>
            </AdminDrawerSection>

            <AdminDrawerSection title="Monto inicial" className={drawerSectionCardClass}>
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Monto inicial</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashOpenShiftForm.openingAmount}
                  onChange={(event) => setCashOpenShiftForm((prev) => ({ ...prev, openingAmount: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </label>
            </AdminDrawerSection>
          </form>
        )}

        {cashSidebarView === 'close_shift' && (
          <form id="cash-close-shift-form" className="space-y-5" onSubmit={handleCloseShift}>
            <AdminDrawerSection title="Turno actual" className={drawerSectionCardClass}>
              <div className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3 text-[12px] text-[#4e5870]">
                <p><span className="font-semibold">Caja:</span> {cashCurrentShift?.cashRegister?.name || '-'}</p>
                <p><span className="font-semibold">Apertura:</span> {cashCurrentShift?.openedAt ? formatDateTime24(cashCurrentShift.openedAt) : '-'}</p>
                <p><span className="font-semibold">Monto inicial:</span> {formatMoney(Number(cashCurrentShift?.openingAmount || 0))}</p>
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Arqueo" className={drawerSectionCardClass}>
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Dinero contado al cierre</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashCloseShiftForm.countedCash}
                  onChange={(event) => setCashCloseShiftForm({ countedCash: event.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </label>
            </AdminDrawerSection>
          </form>
        )}

        {cashSidebarView === 'movement_create' && (
          <form id="cash-new-movement-form" className="space-y-5" onSubmit={handleCreateMovement}>
            <AdminDrawerSection title="Tipo" className={drawerSectionCardClass}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCashNewMovement((prev) => ({ ...prev, type: 'INCOME' }))}
                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold ${
                    cashNewMovement.type === 'INCOME'
                      ? 'border-[#d4f0dc] bg-[#e8f8ec] text-[#16733f]'
                      : 'border-[#dce2ee] bg-white text-[#4e5870]'
                  }`}
                >
                  <Plus size={12} />
                  Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setCashNewMovement((prev) => ({ ...prev, type: 'EXPENSE' }))}
                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold ${
                    cashNewMovement.type === 'EXPENSE'
                      ? 'border-[#f5c8d0] bg-[#fff0f2] text-[#b42346]'
                      : 'border-[#dce2ee] bg-white text-[#4e5870]'
                  }`}
                >
                  <X size={12} />
                  Egreso
                </button>
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Detalle" className={drawerSectionCardClass}>
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Concepto</span>
                <input
                  type="text"
                  value={cashNewMovement.description}
                  onChange={(event) => setCashNewMovement((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                  placeholder="Descripción del movimiento"
                />
              </label>

              <label className="mt-3 block">
                <span className="text-[12px] font-medium text-[#4e5870]">Monto</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashNewMovement.amount}
                  onChange={(event) => setCashNewMovement((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                  placeholder="0"
                />
              </label>
            </AdminDrawerSection>

            <AdminDrawerSection title="Método" className={drawerSectionCardClass}>
              <label className="block">
                <span className="text-[12px] font-medium text-[#4e5870]">Método</span>
                <select
                  value={cashNewMovement.method}
                  onChange={(event) =>
                    setCashNewMovement((prev) => ({ ...prev, method: event.target.value as 'CASH' | 'TRANSFER' | 'CARD' }))
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#27314b] outline-none focus:border-[#3053e2]"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                </select>
              </label>

              {!cashCurrentShift && (
                <p className="mt-3 text-[12px] text-[#7a8398]">Abrí caja para habilitar movimientos.</p>
              )}
            </AdminDrawerSection>
          </form>
        )}

        {cashSidebarView === 'close_report' && (
          <AdminDrawerSection title="Arqueo" className={drawerSectionCardClass}>
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
          </AdminDrawerSection>
        )}
      </AdminDrawer>
    </>
  );
}
