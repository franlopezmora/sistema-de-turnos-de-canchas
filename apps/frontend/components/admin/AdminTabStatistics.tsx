import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { getApiUrl } from '../../utils/apiUrl';
import { reportUiError } from '../../utils/uiError';
import { AdminPanel, AdminSegmentedControl } from './ui';

const apiBase = () => `${getApiUrl()}/api`;

const COLORS = ['#1f2638', '#3053e2', '#17b26a', '#f79009'];

interface Props {
  slugProp?: string;
}

type Period = 'hoy' | 'semana' | 'mes';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
  BANK_ACCOUNT: 'Cuenta bancaria',
  VIRTUAL_WALLET: 'Billetera virtual',
  CASH_DRAWER: 'Caja',
  CARD_TERMINAL: 'Terminal',
  AUTO: 'Automatico',
};

const periodOptions: Array<{ value: Period; label: string }> = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
];

const toPaymentMethodLabel = (method?: string) => {
  const key = String(method || '').trim().toUpperCase();
  return PAYMENT_METHOD_LABELS[key] || method || 'Otro';
};

export const getDateRange = (period: Period, offset = 0) => {
  const start = new Date();
  const end = new Date();

  if (period === 'hoy') {
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);

    end.setDate(end.getDate() + offset);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'semana') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1 + offset * 7);
    start.setHours(0, 0, 0, 0);

    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'mes') {
    start.setFullYear(start.getFullYear(), start.getMonth() + offset, 1);
    start.setHours(0, 0, 0, 0);

    end.setFullYear(end.getFullYear(), end.getMonth() + offset + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rawStart: start,
    rawEnd: end,
  };
};

function KpiCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#dce2ee] bg-white p-5 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f4ff] text-[#3053e2]">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">{label}</p>
      <p className="mt-1 text-[24px] font-bold text-[#27314a]">{value}</p>
      {detail && <p className="mt-1 text-[12px] text-[#6f7890]">{detail}</p>}
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return <p className="text-sm font-semibold text-[#8b95aa]">{label}</p>;
}

export default function AdminTabStatistics({ slugProp }: Props) {
  const finalSlug = slugProp;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activePeriod, setActivePeriod] = useState<Period>('mes');
  const [periodOffset, setPeriodOffset] = useState(0);

  const handlePeriodChange = (newPeriod: Period) => {
    setActivePeriod(newPeriod);
    setPeriodOffset(0);
  };

  const getPeriodLabel = useCallback(() => {
    const { rawStart, rawEnd } = getDateRange(activePeriod, periodOffset);

    if (activePeriod === 'mes') {
      return rawStart.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    }
    if (activePeriod === 'hoy') {
      if (periodOffset === 0) return 'Hoy';
      if (periodOffset === -1) return 'Ayer';
      return rawStart.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    }
    if (periodOffset === 0) return 'Esta semana';
    if (periodOffset === -1) return 'Semana pasada';
    return `${rawStart.getDate()} al ${rawEnd.getDate()} ${rawEnd.toLocaleDateString('es-AR', { month: 'short' })}`;
  }, [activePeriod, periodOffset]);

  const loadStats = useCallback(async () => {
    if (!finalSlug) return;
    try {
      setLoading(true);
      setErrorMessage('');
      const { startDate, endDate } = getDateRange(activePeriod, periodOffset);
      const url = `${apiBase()}/clubs/${finalSlug}/admin/stats/dashboard?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetchWithAuth(url);

      if (response.ok) {
        const data = await response.json();
        const normalizedPaymentMethods = Array.isArray(data?.paymentMethods)
          ? data.paymentMethods.map((row: any) => ({
              ...row,
              name: toPaymentMethodLabel(row?.name),
            }))
          : [];
        setStats({
          ...data,
          paymentMethods: normalizedPaymentMethods,
        });
      } else {
        reportUiError({ area: 'AdminTabStatistics', action: 'loadStats' }, new Error(`Error del servidor: ${response.status}`));
        setErrorMessage('No se pudieron cargar las estadisticas para este periodo.');
      }
    } catch (error) {
      reportUiError({ area: 'AdminTabStatistics', action: 'loadStats' }, error);
      setErrorMessage('No se pudo conectar para traer estadisticas.');
    } finally {
      setLoading(false);
    }
  }, [activePeriod, finalSlug, periodOffset]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const averageTicket = useMemo(
    () => (stats?.totalBookings > 0 ? stats.totalRevenue / stats.totalBookings : 0),
    [stats?.totalBookings, stats?.totalRevenue]
  );

  const topProducts = Array.isArray(stats?.products?.top) ? stats.products.top : [];
  const bottomProducts = Array.isArray(stats?.products?.bottom) ? stats.products.bottom : [];
  const unsoldProducts = Array.isArray(stats?.products?.unsold) ? stats.products.unsold : [];

  if (loading && !stats) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#dce2ee] border-t-[#3053e2]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex w-full flex-col gap-4">
        <AdminPanel>
          <p className="text-[12px] text-[#6f7890]">No hay datos disponibles para este periodo.</p>
          <button
            type="button"
            onClick={() => void loadStats()}
            className="mt-3 h-10 rounded-lg bg-[#3053e2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2748cc]"
          >
            Reintentar
          </button>
        </AdminPanel>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">

      <AdminPanel bodyClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center rounded-xl border border-[#dce2ee] bg-[#f8faff]">
          <button
            type="button"
            onClick={() => setPeriodOffset((prev) => prev - 1)}
            className="grid h-10 w-10 place-items-center text-[#46516a] transition hover:text-[#3053e2]"
          >
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <span className="min-w-[140px] px-3 text-center text-[12px] font-semibold text-[#4e5870]">
            {getPeriodLabel()}
          </span>
          <button
            type="button"
            onClick={() => setPeriodOffset((prev) => prev + 1)}
            disabled={periodOffset === 0}
            className="grid h-10 w-10 place-items-center text-[#46516a] transition hover:text-[#3053e2] disabled:text-[#b8c1d4]"
          >
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>

        <AdminSegmentedControl
          ariaLabel="Periodo de informes"
          value={activePeriod}
          options={periodOptions}
          onChange={(value) => handlePeriodChange(value as Period)}
        />
        <button
          type="button"
          onClick={() => void loadStats()}
          className="h-9 rounded-lg border border-[#dce2ee] bg-white px-3 text-[12px] font-semibold text-[#4e5870] transition hover:bg-[#f8f9fd]"
        >
          Actualizar
        </button>
      </AdminPanel>

      {errorMessage && (
        <div className="rounded-xl border border-[#ffd4d4] bg-[#fff5f5] px-4 py-3 text-[12px] font-semibold text-[#b42318]">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          icon={<DollarSign size={22} strokeWidth={2.4} />}
          label="Facturacion total"
          value={`$${Number(stats?.totalRevenue || 0).toLocaleString('es-AR')}`}
          detail={activePeriod === 'hoy' ? 'Periodo diario' : activePeriod === 'semana' ? 'Periodo semanal' : 'Periodo mensual'}
        />
        <KpiCard
          icon={<Calendar size={22} strokeWidth={2.4} />}
          label="Turnos finalizados"
          value={Number(stats?.totalBookings || 0).toLocaleString('es-AR')}
        />
        <KpiCard
          icon={<TrendingUp size={22} strokeWidth={2.4} />}
          label="Ticket promedio"
          value={`$${Number(averageTicket || 0).toLocaleString('es-AR')}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminPanel title="Evolucion: turnos vs bar" description="Comparacion de ingresos por reservas y productos." className="lg:col-span-2">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.dailyEvolution || []} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eaf3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b95aa', fontSize: 11, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b95aa', fontSize: 11, fontWeight: 600 }} tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`} />
                <Tooltip cursor={{ fill: '#f5f7fb' }} contentStyle={{ borderRadius: 12, border: '1px solid #dce2ee', boxShadow: '0 8px 22px rgba(34,42,68,0.08)' }} />
                <Legend />
                <Bar dataKey="turnos" name="Turnos" stackId="a" fill="#1f2638" radius={[0, 0, 0, 0]} barSize={36} />
                <Bar dataKey="bar" name="Consumos" stackId="a" fill="#3053e2" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        <AdminPanel title="Metodos de pago" description="Distribucion de cobros por medio.">
          <div className="relative h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.paymentMethods || []} cx="50%" cy="50%" innerRadius={70} outerRadius={92} paddingAngle={5} dataKey="value" stroke="none">
                  {stats?.paymentMethods?.map((entry: any, index: number) => (
                    <Cell key={`cell-${entry?.name || index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Total']} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8b95aa]">Total</span>
              <span className="text-2xl font-bold text-[#27314a]">${(stats?.totalRevenue || 0) >= 1000 ? `${((stats?.totalRevenue || 0) / 1000).toFixed(0)}k` : (stats?.totalRevenue || 0).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminPanel title="Productos vendidos" description="Resumen comercial de productos en el periodo.">
          <div className="space-y-3">
            <KpiCard
              icon={<ShoppingBag size={20} strokeWidth={2.4} />}
              label="Unidades"
              value={Number(stats?.products?.totals?.quantityAll || 0).toLocaleString('es-AR')}
            />
            <KpiCard
              icon={<DollarSign size={20} strokeWidth={2.4} />}
              label="Facturacion"
              value={`$${Number(stats?.products?.totals?.revenueAll || 0).toLocaleString('es-AR')}`}
            />
            <KpiCard
              icon={<Activity size={20} strokeWidth={2.4} />}
              label="Sin ventas"
              value={Number(stats?.products?.totals?.unsoldCount || 0).toLocaleString('es-AR')}
            />
          </div>
        </AdminPanel>

        <AdminPanel title="Ranking de productos" description={`Periodo activo: ${getPeriodLabel()}`} className="lg:col-span-2">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eaf3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b95aa', fontSize: 11, fontWeight: 600 }} interval={0} height={40} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b95aa', fontSize: 11, fontWeight: 600 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f5f7fb' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #dce2ee', boxShadow: '0 8px 22px rgba(34,42,68,0.08)' }}
                  formatter={(value: any, _name: any, props: any) => {
                    const qty = Number(value || 0);
                    const revenue = Number(props?.payload?.revenue || 0);
                    return [`${qty.toLocaleString('es-AR')} u. ($${revenue.toLocaleString('es-AR')})`, 'Vendidas'];
                  }}
                />
                <Bar dataKey="quantity" name="Unidades" fill="#3053e2" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['Mas vendidos', topProducts, 'top'],
              ['Menos vendidos', bottomProducts, 'bottom'],
              ['Sin ventas', unsoldProducts, 'unsold'],
            ].map(([title, rows, key]) => (
              <div key={String(key)} className="rounded-xl border border-[#e7ebf3] bg-[#fbfcff] p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#46516a]">{String(title)}</p>
                <div className="space-y-2">
                  {(rows as any[]).slice(0, 6).map((row: any, idx: number) => (
                    <div key={`${row?.productId || 'p'}-${key}-${idx}`} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#30384c]">{row?.name || 'Producto'}</span>
                      <span className="shrink-0 text-[12px] font-semibold text-[#3053e2]">{Number(row?.quantity || 0)} u.</span>
                    </div>
                  ))}
                  {(rows as any[]).length === 0 && <EmptyList label="Sin datos." />}
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
