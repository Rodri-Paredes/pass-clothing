import React, { useEffect, useState } from 'react';
import { Calendar, Printer, DollarSign, ShoppingCart, TrendingUp, FileText, Download } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useSalesStore } from '../store/salesStore';
import { cashClosureService } from '../services/cashClosureService';
import type { DailyReport } from '../lib/types';

const CashClosurePage: React.FC = () => {
  const { activeBranch, user } = useAuthStore();
  const { sales } = useSalesStore();
  const getLocalDateString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (activeBranch && selectedDate) {
      loadDailyReport();
    }
  }, [activeBranch, selectedDate]);

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
          {/* Resumen del día */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-blue-100 text-sm">Total Ventas</p>
                  <p className="text-2xl font-bold">{formatCurrency(dailyReport.totalSales)}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-green-100 text-sm">Número de Ventas</p>
                  <p className="text-2xl font-bold">{dailyReport.numberOfSales}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Venta Promedio</p>
                  <p className="text-2xl font-bold">{formatCurrency(dailyReport.averageSale)}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Productos Vendidos</p>
                  <p className="text-2xl font-bold">{dailyReport.totalItemsSold}</p>
                </div>
              </div>
            </Card>
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
                  <p className="text-gray-600">No hay ventas registradas para esta fecha</p>
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
            Selecciona una fecha diferente o verifica que haya ventas registradas
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