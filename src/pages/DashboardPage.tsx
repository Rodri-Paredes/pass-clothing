import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart,
  CalendarRange
} from 'lucide-react';
import { toBoliviaStartOfDay, toBoliviaEndOfDay } from '../lib/constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { salesService } from '../services/salesService';
import { useAuthStore } from '../store/authStore';
import { useSalesStore } from '../store/salesStore';
import FeaturedDropsSection from '../components/drops/FeaturedDropsSection';
import type { MonthlyRevenueReport } from '../lib/types';

const DashboardPage: React.FC = () => {
  const { activeBranch } = useAuthStore();
  const { 
    dashboardStats, 
    loadDashboardStats, 
    isLoading,
    getDateRangeRevenueReport
  } = useSalesStore();
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [customDateRangeReport, setCustomDateRangeReport] = useState<MonthlyRevenueReport | null>(null);
  const [itemsSoldForRange, setItemsSoldForRange] = useState<number | null>(null);
  const [preset, setPreset] = useState<string>('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingCustomReport, setLoadingCustomReport] = useState(false);

  const loadCustomDateRangeReport = async () => {
    if (!activeBranch || !startDate || !endDate) return;
    
    setLoadingCustomReport(true);
    try {
      const report = await getDateRangeRevenueReport(activeBranch.id, startDate, endDate);
      setCustomDateRangeReport(report);
      // traer cantidad de prendas vendidas en el rango
      try {
        // Agregar timezone de Bolivia a las fechas
        const startWithTz = toBoliviaStartOfDay(startDate);
        const endWithTz = toBoliviaEndOfDay(endDate);
        const itemsCount = await salesService.getDateRangeItemsSold(activeBranch.id, startWithTz, endWithTz);
        setItemsSoldForRange(itemsCount);
      } catch (err) {
        console.error('Error fetching items sold for range:', err);
        setItemsSoldForRange(null);
      }
    } catch (error) {
      console.error('Error loading custom date range report:', error);
    } finally {
      setLoadingCustomReport(false);
    }
  };

  // Helpers for common presets
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const getPresetRange = (key: string) => {
    const now = new Date();
    switch (key) {
      case 'today': {
        return { start: fmt(now), end: fmt(now) };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'year': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'pay_current':
        return getCurrentPayrollPeriod();
      case 'pay_previous':
        return getPreviousPayrollPeriod();
      default:
        return null;
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
      // Agregar timezone de Bolivia a las fechas
      const startWithTz = toBoliviaStartOfDay(range.start);
      const endWithTz = toBoliviaEndOfDay(range.end);
      const report = await getDateRangeRevenueReport(activeBranch.id, range.start, range.end);
      setCustomDateRangeReport(report);
      const itemsCount = await salesService.getDateRangeItemsSold(activeBranch.id, startWithTz, endWithTz);
      setItemsSoldForRange(itemsCount);
    } catch (err) {
      console.error('Error applying preset:', err);
    } finally {
      setLoadingCustomReport(false);
    }
  };

  // Calcula el período de pago: del 19 del mes anterior al 18 del mes actual
  const getCurrentPayrollPeriod = (): { start: string; end: string } => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-index

    // Si hoy es >= 18 consideramos periodo que va 19 del mes actual? Usamos convención: periodo vigente es 19 del mes previo -> 18 mes actual
    const end = new Date(year, month, 18);
    const start = new Date(year, month - 1, 19);

    // Formato YYYY-MM-DD
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return { start: fmt(start), end: fmt(end) };
  };

  const getPreviousPayrollPeriod = (): { start: string; end: string } => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Periodo anterior: retroceder un mes completo
    const end = new Date(year, month - 1, 18);
    const start = new Date(year, month - 2, 19);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return { start: fmt(start), end: fmt(end) };
  };

  

  useEffect(() => {
    if (activeBranch) {
      loadDashboardStats(activeBranch.id);
    }
  }, [activeBranch, loadDashboardStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Determinar qué valores mostrar según si hay un rango seleccionado
  const displayRevenue = customDateRangeReport 
    ? customDateRangeReport.total_revenue 
    : (dashboardStats?.monthlyTotal || 0);
  
  const displaySalesCount = customDateRangeReport 
    ? customDateRangeReport.total_sales_count 
    : (dashboardStats?.monthlySalesCount || 0);
  
  const displayItemsSold = customDateRangeReport
    ? (itemsSoldForRange ?? 0)
    : (dashboardStats?.monthlyItemsSold || 0);

  const rangeLabel = customDateRangeReport 
    ? `${new Date(customDateRangeReport.start_date).toLocaleDateString('es-ES')} - ${new Date(customDateRangeReport.end_date).toLocaleDateString('es-ES')}`
    : 'Mes actual';

  const stats = [
    {
      name: 'Total Ingresos',
      value: `$${displayRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      subtitle: rangeLabel
    },
    {
      name: 'Número de Ventas',
      value: displaySalesCount,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      subtitle: rangeLabel
    },
    {
      name: 'Prendas Vendidas',
      value: displayItemsSold,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      subtitle: rangeLabel
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          {activeBranch ? `Sucursal: ${activeBranch.name}` : 'Sin sucursal seleccionada'}
        </p>
      </div>

      {/* Selector de Período */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Seleccionar Período</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={preset === 'month' ? 'primary' : 'ghost'} onClick={() => applyPreset('month')}>
              Mes
            </Button>
            <Button size="sm" variant={preset === 'year' ? 'primary' : 'ghost'} onClick={() => applyPreset('year')}>
              Año
            </Button>
            <Button size="sm" variant={preset === 'pay_current' ? 'primary' : 'ghost'} onClick={() => applyPreset('pay_current')}>
              Período de pago actual
            </Button>
            <Button size="sm" variant={preset === 'pay_previous' ? 'primary' : 'ghost'} onClick={() => applyPreset('pay_previous')}>
              Período de pago anterior
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowDateRangePicker(!showDateRangePicker); }}>
              {showDateRangePicker ? 'Ocultar rango personalizado' : 'Rango personalizado'}
            </Button>
          </div>
          
          {showDateRangePicker && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <Button
                    onClick={loadCustomDateRangeReport}
                    disabled={!startDate || !endDate || loadingCustomReport}
                    className="w-full"
                  >
                    {loadingCustomReport ? 'Cargando...' : 'Aplicar Rango'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Desglose Detallado por Tipo de Pago */}
      {customDateRangeReport && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CalendarRange className="h-5 w-5 mr-2 text-blue-600" />
              Desglose Detallado
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Resumen del Período</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Período:</span>
                      <span className="font-medium">
                        {new Date(customDateRangeReport.start_date).toLocaleDateString('es-ES')} - {new Date(customDateRangeReport.end_date).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total de ingresos:</span>
                      <span className="font-bold text-blue-600 text-lg">
                        ${customDateRangeReport.total_revenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Número de ventas:</span>
                      <span className="font-medium">
                        {customDateRangeReport.total_sales_count}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prendas vendidas (unidades):</span>
                      <span className="font-medium">
                        {itemsSoldForRange != null ? itemsSoldForRange : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Promedio por venta:</span>
                      <span className="font-medium">
                        ${customDateRangeReport.average_sale_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Por Tipo de Pago</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Efectivo:</span>
                      <span className="font-medium text-green-600">
                        ${customDateRangeReport.revenue_by_payment_type.efectivo.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">QR:</span>
                      <span className="font-medium text-blue-600">
                        ${customDateRangeReport.revenue_by_payment_type.qr.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tarjeta:</span>
                      <span className="font-medium text-pink-600">
                        ${customDateRangeReport.revenue_by_payment_type.tarjeta.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mixto:</span>
                      <span className="font-medium text-purple-600">
                        ${customDateRangeReport.revenue_by_payment_type.mixto.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de ventas diarias para el rango personalizado */}
              {customDateRangeReport.daily_revenue && customDateRangeReport.daily_revenue.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Ventas Diarias</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={customDateRangeReport.daily_revenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString('es-ES')}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas de los Últimos 7 Días
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboardStats?.dailySales || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Productos con Stock Bajo
          </h3>
          <div className="space-y-3">
            {dashboardStats?.lowStockProducts?.length ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Mostrando {showAllLowStock ? dashboardStats.lowStockProducts.length : Math.min(5, dashboardStats.lowStockProducts.length)} de {dashboardStats.lowStockProducts.length}
                  </span>
                  {dashboardStats.lowStockProducts.length > 5 && (
                    <button
                      onClick={() => setShowAllLowStock(v => !v)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showAllLowStock ? 'Ver menos' : 'Ver todos'}
                    </button>
                  )}
                </div>
                {(showAllLowStock ? dashboardStats.lowStockProducts : dashboardStats.lowStockProducts.slice(0, 5)).map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="font-medium text-gray-900">{product.name}</span>
                    <span className="text-orange-600 font-semibold">
                      {product.quantity} unidades
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos con stock bajo</p>
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