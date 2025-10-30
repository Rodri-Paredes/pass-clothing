import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ShoppingCart,
  CalendarRange
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
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
    } catch (error) {
      console.error('Error loading custom date range report:', error);
    } finally {
      setLoadingCustomReport(false);
    }
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

  const stats = [
    {
      name: 'Ventas del Mes',
      value: `$${dashboardStats?.monthlyTotal?.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'Total Ventas',
      value: dashboardStats?.totalSales || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      name: 'Stock Bajo',
      value: dashboardStats?.lowStockProducts?.length || 0,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Selector de Rango de Fechas Personalizado */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CalendarRange className="h-5 w-5 mr-2 text-blue-600" />
              Reporte por Rango de Fechas
            </h3>
            <Button
              variant="ghost"
              onClick={() => setShowDateRangePicker(!showDateRangePicker)}
            >
              {showDateRangePicker ? 'Ocultar' : 'Seleccionar Fechas'}
            </Button>
          </div>

          {showDateRangePicker && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
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
                    {loadingCustomReport ? 'Cargando...' : 'Generar Reporte'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {customDateRangeReport && (
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
          )}

          {!customDateRangeReport && !showDateRangePicker && (
            <div className="text-center py-8 text-gray-500">
              <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecciona un rango de fechas para ver el reporte</p>
            </div>
          )}
        </div>
      </Card>

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