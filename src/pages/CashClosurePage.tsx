import React, { useEffect, useState } from 'react';
import { Calendar, Printer, DollarSign, ShoppingCart, TrendingUp, FileText, Download } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useSalesStore } from '../store/salesStore';
import { cashClosureService } from '../services/cashClosureService';
import type { DailyReport } from '../lib/types';

// Nuevo: funciones para totales por tipo de pago
import { supabase } from '../lib/supabase';

const CashClosurePage: React.FC = () => {
  const { activeBranch, user } = useAuthStore();
  const { sales } = useSalesStore();
  const getLocalDateString = () => {
    const now = new Date();
    // Obtener la fecha en zona horaria de Bolivia (UTC-4)
    const boliviaTime = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // Restar 4 horas para UTC-4
    return boliviaTime.toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [totalSales, setTotalSales] = useState(0);
  const [totalSalesCash, setTotalSalesCash] = useState(0);
  const [totalSalesQR, setTotalSalesQR] = useState(0);
  const [totalSalesCard, setTotalSalesCard] = useState(0);
  const [numberOfSales, setNumberOfSales] = useState(0);
  const [productsSold, setProductsSold] = useState(0);

  useEffect(() => {
    if (activeBranch && selectedDate) {
      loadDailyReport();
      loadTotals();
    }
  }, [activeBranch, selectedDate]);

  // Nuevo: cargar totales por tipo de pago y fecha por sucursal
const loadTotals = async () => {
  if (!activeBranch) return;
  
  try {
    // Total ventas (todos) por sucursal
    const { data: totalAll } = await supabase.rpc('sum_total_sales', {
      payment_type_param: null,
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setTotalSales(totalAll ?? 0);

    // Total ventas efectivo por sucursal
    const { data: totalCash } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'EFECTIVO',
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setTotalSalesCash(totalCash ?? 0);

    // Total ventas QR por sucursal
    const { data: totalQR } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'QR',
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setTotalSalesQR(totalQR ?? 0);

    // Total ventas tarjeta por sucursal
    const { data: totalCard } = await supabase.rpc('sum_total_sales_card', {
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setTotalSalesCard(totalCard ?? 0);

    // Número de ventas por sucursal
    const { data: numSales } = await supabase.rpc('count_sales', {
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setNumberOfSales(numSales ?? 0);

    // Productos vendidos por sucursal
    const { data: prodSold } = await supabase.rpc('count_products_sold', {
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    setProductsSold(prodSold ?? 0);

  } catch (error) {
    console.error('Error loading payment totals:', error);
  }
};


  const loadDailyReport = async () => {
    if (!activeBranch) return;
    
    setIsLoading(true);
    try {
      const report = await cashClosureService.getDailyReport(activeBranch.id, selectedDate);
      setDailyReport(report);
    } catch (error) {
      console.error('Error loading daily report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReport = () => {
    if (!dailyReport || !activeBranch) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = generatePrintContent(dailyReport, activeBranch, selectedDate, user);
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadReport = async () => {
    if (!dailyReport || !activeBranch) return;
    
    setIsGeneratingReport(true);
    try {
      const csvContent = generateCSVContent(dailyReport);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte-diario-${selectedDate}-${activeBranch.name}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating CSV:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'BOB'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!activeBranch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin sucursal seleccionada</h3>
          <p className="text-gray-600">
            Selecciona una sucursal para ver el cierre de caja
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cierre de Caja</h1>
          <p className="text-gray-600">
            {activeBranch ? `Sucursal: ${activeBranch.name}` : 'Sin sucursal seleccionada'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-auto"
          />
          <div className="flex gap-2">
            <Button
              onClick={handlePrintReport}
              disabled={!dailyReport}
              variant="secondary"
              className="flex items-center space-x-2"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={!dailyReport}
              isLoading={isGeneratingReport}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Descargar</span>
            </Button>
          </div>
        </div>
      </div>

      {dailyReport ? (
        <>
      {/* Resumen del día - Totales por tipo de pago y neto */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-[600px] sm:min-w-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <DollarSign className="h-8 w-8 text-blue-900" />
            </div>
            <span className="text-base font-semibold text-blue-100">Total Ventas</span>
            <span className="text-2xl font-extrabold text-white">{formatCurrency(totalSales)}</span>
          </Card>
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-green-500 to-green-700 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <DollarSign className="h-8 w-8 text-green-900" />
            </div>
            <span className="text-base font-semibold text-green-100">Ventas Efectivo</span>
            <span className="text-2xl font-extrabold text-white">{formatCurrency(totalSalesCash)}</span>
          </Card>
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <DollarSign className="h-8 w-8 text-cyan-900" />
            </div>
            <span className="text-base font-semibold text-cyan-100">Ventas QR</span>
            <span className="text-2xl font-extrabold text-white">{formatCurrency(totalSalesQR)}</span>
          </Card>
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-pink-500 to-pink-700 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <DollarSign className="h-8 w-8 text-pink-900" />
            </div>
            <span className="text-base font-semibold text-pink-100">Ventas Tarjeta</span>
            <span className="text-2xl font-extrabold text-white">{formatCurrency(totalSalesCard)}</span>
          </Card>
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <ShoppingCart className="h-8 w-8 text-purple-900" />
            </div>
            <span className="text-base font-semibold text-purple-100">N° Ventas</span>
            <span className="text-2xl font-extrabold text-white">{numberOfSales}</span>
          </Card>
          <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center">
            <div className="bg-white/30 p-4 rounded-full mb-2">
              <FileText className="h-8 w-8 text-orange-900" />
            </div>
            <span className="text-base font-semibold text-orange-100">Productos Vendidos</span>
            <span className="text-2xl font-extrabold text-white">{productsSold}</span>
          </Card>
        </div>
      </div>

          {/* Detalle de ventas */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Detalle de Ventas - {formatDate(selectedDate)}
              </h3>
              
              {dailyReport.sales.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Venta #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vendedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Artículos
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyReport.sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(sale.sale_date).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{sale.id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.user?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.sale_items?.length || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                             ) : (
                 <div className="text-center py-8">
                   <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                   <p className="text-gray-600">No hay ventas registradas para esta fecha en {activeBranch.name}</p>
                 </div>
               )}
            </div>
          </Card>

          {/* Productos más vendidos */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Productos Más Vendidos
              </h3>
              
              {dailyReport.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {dailyReport.topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
                          #{index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{product.quantity} unidades</p>
                        <p className="text-sm text-gray-600">{formatCurrency(product.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-4">No hay datos de productos para mostrar</p>
              )}
            </div>
          </Card>
        </>
             ) : (
         <Card className="text-center py-12">
           <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
           <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos para esta fecha</h3>
           <p className="text-gray-600">
             No hay ventas registradas para {formatDate(selectedDate)} en {activeBranch.name}
           </p>
         </Card>
       )}
    </div>
  );
};

// Función para generar contenido de impresión
const generatePrintContent = (report: DailyReport, branch: any, date: string, user: any) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'BOB'
    }).format(amount);
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte Diario - ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .summary-item { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .summary-item h3 { margin: 0 0 10px 0; color: #333; }
        .summary-item p { margin: 0; font-size: 24px; font-weight: bold; color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>REPORTE DIARIO DE VENTAS</h1>
        <h2>${branch.name}</h2>
        <p><strong>Fecha:</strong> ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Generado por:</strong> ${user?.name || 'Sistema'}</p>
        <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
      </div>

      <div class="summary">
        <div class="summary-item">
          <h3>Total de Ventas</h3>
          <p>${formatCurrency(report.totalSales)}</p>
        </div>
        <div class="summary-item">
          <h3>Número de Ventas</h3>
          <p>${report.numberOfSales}</p>
        </div>
        <div class="summary-item">
          <h3>Venta Promedio</h3>
          <p>${formatCurrency(report.averageSale)}</p>
        </div>
        <div class="summary-item">
          <h3>Productos Vendidos</h3>
          <p>${report.totalItemsSold}</p>
        </div>
      </div>

      <h3>Detalle de Ventas</h3>
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Venta #</th>
            <th>Vendedor</th>
            <th>Artículos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${report.sales.map(sale => `
            <tr>
              <td>${new Date(sale.sale_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>#${sale.id.slice(-8)}</td>
              <td>${sale.user?.name || 'N/A'}</td>
              <td>${sale.sale_items?.length || 0}</td>
              <td>${formatCurrency(sale.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>Productos Más Vendidos</h3>
      <table>
        <thead>
          <tr>
            <th>Posición</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${report.topProducts.map((product, index) => `
            <tr>
              <td>#${index + 1}</td>
              <td>${product.name}</td>
              <td>${product.quantity} unidades</td>
              <td>${formatCurrency(product.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Este reporte fue generado automáticamente por el sistema ERP</p>
        <p>${branch.address}</p>
      </div>
    </body>
    </html>
  `;
};

// Función para generar contenido CSV
const generateCSVContent = (report: DailyReport) => {
  const headers = ['Hora', 'Venta #', 'Vendedor', 'Artículos', 'Total'];
  const rows = report.sales.map(sale => [
    new Date(sale.sale_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    `#${sale.id.slice(-8)}`,
    sale.user?.name || 'N/A',
    sale.sale_items?.length || 0,
    sale.total.toFixed(2)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

export default CashClosurePage;