import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Database, DollarSign, ShoppingCart } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { DataIntegrityChecker, DataIntegrityReport } from '../utils/dataIntegrityCheck';

const DiagnosticPage: React.FC = () => {
  const { activeBranch } = useAuthStore();
  const [report, setReport] = useState<DataIntegrityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesSummary, setSalesSummary] = useState<any>(null);

  useEffect(() => {
    if (activeBranch) {
      runDiagnostic();
    }
  }, [activeBranch, selectedDate]);

  const runDiagnostic = async () => {
    if (!activeBranch) return;
    
    setIsLoading(true);
    try {
      const integrityReport = await DataIntegrityChecker.checkSalesIntegrity(activeBranch.id, selectedDate);
      setReport(integrityReport);

      // Obtener resumen de ventas
      const summary = await DataIntegrityChecker.getSalesSummary(
        activeBranch.id, 
        selectedDate, 
        selectedDate
      );
      setSalesSummary(summary);
    } catch (error) {
      console.error('Error running diagnostic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fixStockIssues = async () => {
    if (!activeBranch) return;
    
    try {
      await DataIntegrityChecker.fixStockIssues(activeBranch.id);
      await runDiagnostic(); // Re-ejecutar diagnóstico
    } catch (error) {
      console.error('Error fixing stock issues:', error);
    }
  };

  if (!activeBranch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin sucursal seleccionada</h3>
          <p className="text-gray-600">
            Selecciona una sucursal para ejecutar el diagnóstico
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnóstico del Sistema</h1>
          <p className="text-gray-600">
            Verificación de integridad de datos para {activeBranch.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Button
            onClick={runDiagnostic}
            isLoading={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Ejecutar Diagnóstico
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <div className="p-6 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p>Ejecutando diagnóstico...</p>
          </div>
        </Card>
      ) : report ? (
        <>
          {/* Resumen de ventas */}
          {salesSummary && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Resumen de Ventas - {selectedDate}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Ventas</p>
                    <p className="text-2xl font-bold text-blue-900">{salesSummary.totalSales}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Monto Total</p>
                    <p className="text-2xl font-bold text-green-900">${salesSummary.totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Efectivo</p>
                    <p className="text-2xl font-bold text-purple-900">${salesSummary.byPaymentType.EFECTIVO.toFixed(2)}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-orange-600 font-medium">QR + Tarjeta</p>
                    <p className="text-2xl font-bold text-orange-900">
                      ${(salesSummary.byPaymentType.QR + salesSummary.byPaymentType.TARJETA).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Estado general */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Estado General del Sistema
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Ventas del día</p>
                    <p className="text-xl font-bold text-gray-900">{report.salesCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Monto total</p>
                    <p className="text-xl font-bold text-gray-900">${report.totalSalesAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Problemas detectados</p>
                    <p className="text-xl font-bold text-gray-900">
                      {report.stockIssues.length + report.orphanedRecords.length + report.dateIssues.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Problemas de stock */}
          {report.stockIssues.length > 0 && (
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Problemas de Stock ({report.stockIssues.length})
                  </h2>
                  <Button onClick={fixStockIssues} variant="danger" size="sm">
                    Corregir Stocks
                  </Button>
                </div>
                <div className="space-y-2">
                  {report.stockIssues.map((issue, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-red-900">{issue.productName}</p>
                        <p className="text-sm text-red-700">{issue.branchName} - {issue.issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Registros huérfanos */}
          {report.orphanedRecords.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                  Registros Huérfanos ({report.orphanedRecords.length})
                </h2>
                <div className="space-y-2">
                  {report.orphanedRecords.map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-900">{record.table}</p>
                        <p className="text-sm text-orange-700">{record.description}</p>
                      </div>
                      <span className="text-orange-900 font-bold">{record.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Problemas de fechas */}
          {report.dateIssues.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  Problemas de Fechas ({report.dateIssues.length})
                </h2>
                <div className="space-y-2">
                  {report.dateIssues.map((issue, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-yellow-900">Venta #{issue.saleId.slice(-8)}</p>
                        <p className="text-sm text-yellow-700">{issue.issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Todo está bien */}
          {report.stockIssues.length === 0 && 
           report.orphanedRecords.length === 0 && 
           report.dateIssues.length === 0 && (
            <Card>
              <div className="p-6 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-700 mb-2">¡Todo está en orden!</h3>
                <p className="text-green-600">
                  No se detectaron problemas de integridad en los datos
                </p>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <div className="p-6 text-center">
            <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sin datos de diagnóstico</h3>
            <p className="text-gray-600">
              Ejecuta el diagnóstico para ver el estado del sistema
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DiagnosticPage;
