import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  CalendarRange,
  ArrowUpRight,
  AlertTriangle,
  BarChart2,
  Zap,
} from 'lucide-react';
import { toBoliviaStartOfDay, toBoliviaEndOfDay } from '../lib/constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { fmtMoney, fmtMoneyRaw, fmtQty } from '../lib/formatters';
import { SkeletonStatGrid } from '../components/ui/Skeleton';
import { salesService } from '../services/salesService';
import { useAuthStore } from '../store/authStore';
import { useSalesStore } from '../store/salesStore';
import FeaturedDropsSection from '../components/drops/FeaturedDropsSection';
import type { MonthlyRevenueReport } from '../lib/types';

/* ─── Stat card ─────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  gradient: string;
  delay?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon: Icon, gradient, delay = '0ms' }) => (
  <div
    className={`${gradient} rounded-2xl p-5 text-white shadow-md animate-in`}
    style={{ animationDelay: delay }}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="p-2 bg-white/15 rounded-xl">
        <Icon className="h-5 w-5" />
      </div>
      <ArrowUpRight className="h-4 w-4 opacity-50" />
    </div>
    <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-3xl font-bold tracking-tight leading-none">{value}</p>
    <p className="text-white/60 text-xs mt-1.5">{sub}</p>
  </div>
);

/* ─── Custom chart tooltip ───────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-surface-500 text-xs mb-1">{label}</p>
      <p className="font-semibold text-surface-900">{fmtMoney(Number(payload[0].value))}</p>
    </div>
  );
};

/* ─── Page ───────────────────────────────────────────────── */
const DashboardPage: React.FC = () => {
  const { activeBranch } = useAuthStore();
  const { dashboardStats, loadDashboardStats, isLoading, getDateRangeRevenueReport } = useSalesStore();
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [customDateRangeReport, setCustomDateRangeReport] = useState<MonthlyRevenueReport | null>(null);
  const [itemsSoldForRange, setItemsSoldForRange] = useState<number | null>(null);
  const [preset, setPreset] = useState<string>('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingCustomReport, setLoadingCustomReport] = useState(false);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const getPresetRange = (key: string) => {
    const now = new Date();
    switch (key) {
      case 'today': return { start: fmt(now), end: fmt(now) };
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'year': {
        return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: fmt(new Date(now.getFullYear(), 11, 31)) };
      }
      case 'pay_current': {
        const end   = new Date(now.getFullYear(), now.getMonth(), 18);
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 19);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'pay_previous': {
        const end   = new Date(now.getFullYear(), now.getMonth() - 1, 18);
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 19);
        return { start: fmt(start), end: fmt(end) };
      }
      default: return null;
    }
  };

  const applyPreset = async (key: string) => {
    if (!activeBranch) return;
    const range = getPresetRange(key);
    if (!range) return;
    setStartDate(range.start);
    setEndDate(range.end);
    setPreset(key);
    setLoadingCustomReport(true);
    try {
      const s = toBoliviaStartOfDay(range.start);
      const e = toBoliviaEndOfDay(range.end);
      const report = await getDateRangeRevenueReport(activeBranch.id, range.start, range.end);
      setCustomDateRangeReport(report);
      const items = await salesService.getDateRangeItemsSold(activeBranch.id, s, e);
      setItemsSoldForRange(items);
    } catch {}
    finally { setLoadingCustomReport(false); }
  };

  const loadCustomDateRangeReport = async () => {
    if (!activeBranch || !startDate || !endDate) return;
    setLoadingCustomReport(true);
    try {
      const s = toBoliviaStartOfDay(startDate);
      const e = toBoliviaEndOfDay(endDate);
      const report = await getDateRangeRevenueReport(activeBranch.id, startDate, endDate);
      setCustomDateRangeReport(report);
      const items = await salesService.getDateRangeItemsSold(activeBranch.id, s, e);
      setItemsSoldForRange(items);
    } catch {}
    finally { setLoadingCustomReport(false); }
  };

  useEffect(() => {
    if (activeBranch) loadDashboardStats(activeBranch.id);
  }, [activeBranch, loadDashboardStats]);

  const displayRevenue     = customDateRangeReport ? customDateRangeReport.total_revenue    : (dashboardStats?.monthlyTotal       || 0);
  const displaySalesCount  = customDateRangeReport ? customDateRangeReport.total_sales_count : (dashboardStats?.monthlySalesCount  || 0);
  const displayItemsSold   = customDateRangeReport ? (itemsSoldForRange ?? 0)               : (dashboardStats?.monthlyItemsSold   || 0);
  const displayTotalSales  = dashboardStats?.totalSales || 0;

  const rangeLabel = customDateRangeReport
    ? `${new Date(customDateRangeReport.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${new Date(customDateRangeReport.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
    : 'Mes actual';

  const PRESETS = [
    { key: 'month',       label: 'Este mes' },
    { key: 'year',        label: 'Este año' },
    { key: 'pay_current', label: 'Período pago' },
    { key: 'pay_previous',label: 'Período anterior' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-200 rounded-lg" />
        <SkeletonStatGrid />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-80 bg-surface-200 rounded-xl" />
          <div className="h-80 bg-surface-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const lowStockList = dashboardStats?.lowStockProducts ?? [];
  const visibleLowStock = showAllLowStock ? lowStockList : lowStockList.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{activeBranch?.name}</p>
        </div>
        {dashboardStats?.topProduct && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-xl">
            <Zap className="h-4 w-4 text-brand-600" />
            <span className="text-xs font-medium text-brand-700">Top: <strong>{dashboardStats.topProduct.name}</strong></span>
          </div>
        )}
      </div>

      {/* Period selector */}
      <Card padding="sm">
        <div className="p-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-surface-500 px-2">Período:</span>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  preset === p.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowDateRangePicker(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showDateRangePicker ? 'bg-surface-800 text-white' : 'text-surface-600 hover:bg-surface-100'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Personalizado
            </button>
          </div>

          {showDateRangePicker && (
            <div className="mt-3 pt-3 border-t border-surface-100 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 px-3 text-sm border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 px-3 text-sm border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                />
              </div>
              <Button
                size="sm"
                onClick={loadCustomDateRangeReport}
                disabled={!startDate || !endDate}
                isLoading={loadingCustomReport}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ingresos"
          value={fmtMoney(displayRevenue)}
          sub={rangeLabel}
          icon={TrendingUp}
          gradient="bg-gradient-green"
          delay="0ms"
        />
        <StatCard
          label="Ventas"
          value={displaySalesCount}
          sub={rangeLabel}
          icon={ShoppingCart}
          gradient="bg-gradient-brand"
          delay="50ms"
        />
        <StatCard
          label="Prendas"
          value={displayItemsSold}
          sub={rangeLabel}
          icon={Package}
          gradient="bg-gradient-blue"
          delay="100ms"
        />
        <StatCard
          label="Total histórico"
          value={displayTotalSales}
          sub="Todas las ventas"
          icon={BarChart2}
          gradient="bg-gradient-amber"
          delay="150ms"
        />
      </div>

      {/* Payment breakdown for custom range */}
      {customDateRangeReport && (
        <Card padding="none" className="animate-in">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-100">
            <CalendarRange className="h-4 w-4 text-brand-600" />
            <h3 className="font-semibold text-surface-900 text-sm">Desglose del período</h3>
            <Badge variant="primary" size="sm">{rangeLabel}</Badge>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Resumen</h4>
              {[
                { label: 'Total ingresos',    value: fmtMoney(customDateRangeReport.total_revenue),                       bold: true },
                { label: 'Ventas',            value: fmtQty(customDateRangeReport.total_sales_count) },
                { label: 'Prendas vendidas',  value: itemsSoldForRange != null ? fmtQty(itemsSoldForRange) : '—' },
                { label: 'Promedio/venta',    value: fmtMoney(customDateRangeReport.average_sale_amount) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-surface-50">
                  <span className="text-sm text-surface-600">{row.label}</span>
                  <span className={`text-sm ${row.bold ? 'font-bold text-brand-700 text-base' : 'font-medium text-surface-900'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Por tipo de pago</h4>
              {[
                { label: 'Efectivo', value: fmtMoneyRaw(customDateRangeReport.revenue_by_payment_type.efectivo), color: 'text-emerald-600' },
                { label: 'QR',       value: fmtMoneyRaw(customDateRangeReport.revenue_by_payment_type.qr),       color: 'text-blue-600'   },
                { label: 'Tarjeta',  value: fmtMoneyRaw(customDateRangeReport.revenue_by_payment_type.tarjeta),  color: 'text-pink-600'   },
                { label: 'Mixto',    value: fmtMoneyRaw(customDateRangeReport.revenue_by_payment_type.mixto),    color: 'text-purple-600' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-surface-50">
                  <span className="text-sm text-surface-600">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {customDateRangeReport.daily_revenue?.length > 0 && (
            <div className="px-5 pb-5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Ventas diarias</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={customDateRangeReport.daily_revenue}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => new Date(v).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} fill="url(#g1)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="none">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Ventas — últimos 7 días</h3>
          </div>
          <div className="p-5">
            {(dashboardStats?.dailySales?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dashboardStats!.dailySales}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} fill="url(#g2)" dot={{ fill: '#10b981', r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-surface-400">
                <BarChart2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Sin datos para esta semana</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Stock bajo</h3>
            {lowStockList.length > 0 && (
              <Badge variant="warning" dot size="sm">{lowStockList.length} productos</Badge>
            )}
          </div>
          <div className="p-5">
            {lowStockList.length > 0 ? (
              <div className="space-y-2">
                {visibleLowStock.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-surface-800 truncate">{p.name}</span>
                    </div>
                    <span className={`text-xs font-bold flex-shrink-0 ml-2 ${p.quantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {p.quantity === 0 ? 'Sin stock' : `${p.quantity} un.`}
                    </span>
                  </div>
                ))}
                {lowStockList.length > 5 && (
                  <button
                    onClick={() => setShowAllLowStock(v => !v)}
                    className="w-full mt-1 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
                  >
                    {showAllLowStock ? 'Ver menos' : `Ver ${lowStockList.length - 5} más`}
                  </button>
                )}
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-surface-400">
                <Package className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Stock en buen estado</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Featured Drops Section */}
      <FeaturedDropsSection />
    </div>
  );
};

export default DashboardPage;
