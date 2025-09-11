import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ShoppingCart 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useSalesStore } from '../store/salesStore';

const DashboardPage: React.FC = () => {
  const { activeBranch } = useAuthStore();
  const { dashboardStats, loadDashboardStats, isLoading } = useSalesStore();
  const [showAllLowStock, setShowAllLowStock] = useState(false);

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
    /* {
      name: 'Producto Top',
      value: dashboardStats?.topProduct?.name || 'N/A',
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }, */
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
    </div>
  );
};

export default DashboardPage;