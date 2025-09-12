import React, { useEffect, useState } from 'react';
import { Calendar, Printer, DollarSign, ShoppingCart, TrendingUp, FileText, Download, BarChart3, CreditCard, QrCode, Wallet, Percent, Users, Plus } from 'lucide-react';
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
    // Obtener fecha actual en zona horaria de Bolivia y formatearla a yyyy-mm-dd
    const laPazNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    const year = laPazNow.getFullYear();
    const month = String(laPazNow.getMonth() + 1).padStart(2, '0');
    const day = String(laPazNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [salesWithDiscounts, setSalesWithDiscounts] = useState(0);
  const [mixedPaymentBreakdown, setMixedPaymentBreakdown] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [showSalesList, setShowSalesList] = useState(false);
  const [showUnitsList, setShowUnitsList] = useState(false);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [isLoadingCashFlow, setIsLoadingCashFlow] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  useEffect(() => {
    if (activeBranch && selectedDate) {
      loadDailyReport();
      loadTotals();
      loadCashFlow();
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

    // Total ventas efectivo por sucursal (solo ventas EFECTIVO)
    const { data: totalCash } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'EFECTIVO',
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    let totalCashWithMixed = totalCash ?? 0;

    // Total ventas QR por sucursal (solo ventas QR)
    const { data: totalQR } = await supabase.rpc('sum_total_sales', {
      payment_type_param: 'QR',
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    let totalQRWithMixed = totalQR ?? 0;

    // Total ventas tarjeta por sucursal (solo ventas TARJETA)
    const { data: totalCard } = await supabase.rpc('sum_total_sales_card', {
      sale_date_param: selectedDate,
      branch_id_param: activeBranch.id,
    });
    let totalCardWithMixed = totalCard ?? 0;

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

    // Cargar información de descuentos por ventas del día (mantener lógica anterior)
    try {
      const { data: dailySales, error: rpcErr } = await supabase.rpc('get_daily_sales_local', {
        p_branch_id: activeBranch.id,
        p_day: selectedDate
      });
      if (rpcErr) throw rpcErr;

      const ids = (dailySales || []).map((s: any) => s.id);
      if (ids.length === 0) {
        setTotalDiscounts(0);
        setSalesWithDiscounts(0);
      } else {
        const { data: discountData, error: discErr } = await supabase
          .from('sales')
          .select('id, discount_amount')
          .eq('branch_id', activeBranch.id)
          .in('id', ids)
          .gt('discount_amount', 0);
        if (discErr) throw discErr;

        if (discountData && discountData.length > 0) {
          const totalDs = discountData.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0);
          setTotalDiscounts(totalDs);
          setSalesWithDiscounts(discountData.length);
        } else {
          setTotalDiscounts(0);
          setSalesWithDiscounts(0);
        }
      }
    } catch (error) {
      console.log('Descuentos no disponibles:', error);
      setTotalDiscounts(0);
      setSalesWithDiscounts(0);
    }

    // Cargar desglose de pagos mixtos como antes pero filtrando ids del día local
    try {
      const { data: dailySales, error: rpcErr } = await supabase.rpc('get_daily_sales_local', {
        p_branch_id: activeBranch.id,
        p_day: selectedDate
      });
      if (rpcErr) throw rpcErr;

      const ids = (dailySales || []).map((s: any) => s.id);
      if (ids.length === 0) {
        setMixedPaymentBreakdown([]);
        setTotalSalesCash(totalCashWithMixed);
        setTotalSalesQR(totalQRWithMixed);
        setTotalSalesCard(totalCardWithMixed);
      } else {
        const { data: mixedData, error: mixErr } = await supabase
          .from('sales')
          .select('payment_type, payment_details, total')
          .eq('branch_id', activeBranch.id)
          .eq('payment_type', 'MIXTO')
          .in('id', ids);
        if (mixErr) throw mixErr;

        if (mixedData && mixedData.length > 0) {
          const breakdown: any[] = [];
          const methods = ['efectivo', 'qr', 'tarjeta'];
          
          let mixedCash = 0;
          let mixedQR = 0;
          let mixedCard = 0;
          
          methods.forEach(method => {
            const total = mixedData.reduce((sum, sale) => sum + (sale.payment_details?.[method] || 0), 0);
            
            if (total > 0) {
              breakdown.push({
                payment_method: method,
                total_amount: total,
                transaction_count: mixedData.length
              });
            }
            if (method === 'efectivo') mixedCash = total;
            if (method === 'qr') mixedQR = total;
            if (method === 'tarjeta') mixedCard = total;
          });
          
          setMixedPaymentBreakdown(breakdown);

          // Sumar componentes mixtos a los totales por método
          totalCashWithMixed += mixedCash;
          totalQRWithMixed += mixedQR;
          totalCardWithMixed += mixedCard;
          setTotalSalesCash(totalCashWithMixed);
          setTotalSalesQR(totalQRWithMixed);
          setTotalSalesCard(totalCardWithMixed);
        } else {
          setMixedPaymentBreakdown([]);
          setTotalSalesCash(totalCashWithMixed);
          setTotalSalesQR(totalQRWithMixed);
          setTotalSalesCard(totalCardWithMixed);
        }
      }
    } catch (error) {
      console.log('Pagos mixtos no disponibles:', error);
      setMixedPaymentBreakdown([]);
      setTotalSalesCash(totalCashWithMixed);
      setTotalSalesQR(totalQRWithMixed);
      setTotalSalesCard(totalCardWithMixed);
    }

  } catch (error) {
    console.error('Error loading payment totals:', error);
  }
};

  const loadCashFlow = async () => {
    if (!activeBranch) return;
    
    setIsLoadingCashFlow(true);
    try {
      const cashFlow = await cashClosureService.getDailyCashFlow(activeBranch.id, selectedDate);
      setCashFlowData(cashFlow);
    } catch (error) {
      console.error('Error loading cash flow:', error);
      setCashFlowData(null);
    } finally {
      setIsLoadingCashFlow(false);
    }
  };

  const handleAddCashMovement = async () => {
    if (!activeBranch || !user || !movementAmount || !movementDescription) return;
    
    try {
      await cashClosureService.addCashMovement(
        activeBranch.id,
        user.id,
        movementType,
        parseFloat(movementAmount),
        movementDescription
      );
      
      // Limpiar formulario
      setMovementAmount('');
      setMovementDescription('');
      setShowCashMovementModal(false);
      
      // Recargar datos
      await loadCashFlow();
      
      alert('Movimiento agregado exitosamente');
    } catch (error) {
      console.error('Error adding cash movement:', error);
      alert('Error al agregar movimiento: ' + (error as Error).message);
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
    // Mostrar fecha en zona horaria de Bolivia
    const date = new Date(dateString + 'T00:00:00-04:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/La_Paz'
    });
  };

  const handleSaleClick = async (sale: any) => {
    try {
      // Obtener los detalles completos de la venta
      const { data: saleDetails, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            variant:product_variants (
              *,
              product:products (
                name,
                description,
                price,
                image_url
              )
            )
          ),
          user:users (name),
          branch:branches (name)
        `)
        .eq('id', sale.id)
        .single();

      if (error) throw error;
      
      setSelectedSale(saleDetails);
      setShowSaleDetails(true);
    } catch (error) {
      console.error('Error loading sale details:', error);
    }
  };

  const getProductNames = (sale: any) => {
    if (!sale.sale_items || sale.sale_items.length === 0) {
      return 'Sin productos';
    }
    
    const productNames = sale.sale_items.map((item: any) => {
      const productName = item.variant?.product?.name || 'Producto desconocido';
      const size = item.variant?.size || '';
      const quantity = item.quantity || 1;
      
      if (size) {
        return `${productName} (${size}) x${quantity}`;
      }
      return `${productName} x${quantity}`;
    });
    
    if (productNames.length === 1) {
      return productNames[0];
    }
    
    return `${productNames[0]} +${productNames.length - 1} más`;
  };

  const handleSalesCardClick = async () => {
    if (!activeBranch) return;
    
    try {
      // Obtener ventas del día (zona America/La_Paz) vía RPC y luego enriquecer
      const { data: dailySales, error: rpcError } = await supabase.rpc('get_daily_sales_local', {
        p_branch_id: activeBranch.id,
        p_day: selectedDate
      });
      if (rpcError) throw rpcError;

      const ids = (dailySales || []).map((s: any) => s.id);
      if (ids.length === 0) {
        setSalesList([]);
        setShowSalesList(true);
        return;
      }

      const { data: detailed, error: qError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            variant:product_variants (
              *,
              product:products (name)
            )
          ),
          user:users (name)
        `)
        .eq('branch_id', activeBranch.id)
        .in('id', ids)
        .order('sale_date', { ascending: false });

      if (qError) throw qError;

      setSalesList(detailed || []);
      setShowSalesList(true);
    } catch (error) {
      console.error('Error loading sales list:', error);
    }
  };

  const handleUnitsCardClick = async () => {
    if (!activeBranch) return;
    
    try {
      // Primero obtener las ventas del día vía RPC (zona local)
      const { data: dailySales, error: rpcError } = await supabase.rpc('get_daily_sales_local', {
        p_branch_id: activeBranch.id,
        p_day: selectedDate
      });
      if (rpcError) throw rpcError;

      if (dailySales && dailySales.length > 0) {
        const saleIds = dailySales.map((sale: any) => sale.id);
        
        // Luego obtener los items de esas ventas
        const { data: units, error: unitsError } = await supabase
          .from('sale_items')
          .select(`
            *,
            variant:product_variants (
              *,
              product:products (name, image_url)
            )
          `)
          .in('sale_id', saleIds);

        if (unitsError) throw unitsError;

        // Combinar la información
        const unitsWithSaleInfo = units?.map(unit => {
          const sale = sales.find(s => s.id === unit.sale_id);
          return {
            ...unit,
            sale: sale || null
          };
        }) || [];

        setUnitsList(unitsWithSaleInfo);
        setShowUnitsList(true);
      } else {
        setUnitsList([]);
        setShowUnitsList(true);
      }
    } catch (error) {
      console.error('Error loading units list:', error);
    }
  };

  if (!activeBranch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Sin sucursal seleccionada</h3>
            <p className="text-gray-600 leading-relaxed">
              Selecciona una sucursal para ver el cierre de caja y los reportes detallados
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Mejorado */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
        <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cierre de Caja</h1>
                    <p className="text-gray-600 font-medium">{activeBranch.name}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Reporte detallado de ventas y transacciones del día
          </p>
        </div>
        
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full sm:w-auto min-w-[200px] bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
                </div>
                <div className="flex gap-3">
            <Button
              onClick={handlePrintReport}
              disabled={!dailyReport}
              variant="secondary"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={!dailyReport}
              isLoading={isGeneratingReport}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Descargar</span>
            </Button>
                </div>
              </div>
          </div>
        </div>
      </div>

        {/* Dashboard Cards - Diseño Compacto y Mejorado */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 mb-8">
          {/* Total Ventas */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Total</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-blue-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{formatCurrency(totalSales)}</p>
            </div>
            </div>

          {/* Ventas Efectivo */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Efectivo</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-green-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{formatCurrency(totalSalesCash)}</p>
        </div>
      </div>

          {/* Ventas QR */}
          <div className="bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">QR</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-cyan-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{formatCurrency(totalSalesQR)}</p>
            </div>
          </div>

          {/* Ventas Tarjeta */}
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Tarjeta</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-pink-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{formatCurrency(totalSalesCard)}</p>
            </div>
          </div>

          {/* Número de Ventas */}
          <div 
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
            onClick={handleSalesCardClick}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Cantidad</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-purple-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{numberOfSales}</p>
            </div>
          </div>

          {/* Productos Vendidos */}
          <div 
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
            onClick={handleUnitsCardClick}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Unidades</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-orange-100">Productos</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{productsSold}</p>
            </div>
          </div>

          {/* Descuentos */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Total</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-red-100">Descuentos</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{formatCurrency(totalDiscounts)}</p>
            </div>
          </div>

          {/* Ventas con Descuento */}
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">Con desc.</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-yellow-100">Ventas</p>
              <p className="text-lg sm:text-xl font-bold leading-tight">{salesWithDiscounts}</p>
            </div>
          </div>
        </div>

        {/* Desglose de Pagos Mixtos - Mejorado */}
        {mixedPaymentBreakdown.length > 0 && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Desglose de Pagos Mixtos</h3>
                  <p className="text-gray-600">Distribución por método de pago</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {mixedPaymentBreakdown.map((payment, index) => (
                  <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900 capitalize">{payment.payment_method}</span>
                      <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full">{payment.transaction_count} trans.</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-700">
                      {formatCurrency(payment.total_amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        {dailyReport ? (
          <div className="space-y-8">
            {/* Detalle de ventas - Mejorado */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Detalle de Ventas</h3>
                </div>
                <p className="text-gray-600">{formatDate(selectedDate)}</p>
              </div>
              
              {dailyReport.sales.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Hora
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Productos
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Vendedor
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Artículos
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dailyReport.sales.map((sale) => (
                        <tr 
                          key={sale.id} 
                          className="hover:bg-blue-50 transition-colors duration-200 cursor-pointer group"
                          onClick={() => handleSaleClick(sale)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(sale.sale_date).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/La_Paz'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-blue-600 group-hover:text-blue-800">
                                {getProductNames(sale)}
                              </span>
                              <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                →
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.user?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {sale.sale_items?.length || 0} items
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                            {formatCurrency(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay ventas registradas</h3>
                  <p className="text-gray-600">No se encontraron ventas para {formatDate(selectedDate)} en {activeBranch.name}</p>
                  </div>
                )}
            </div>

            {/* Productos más vendidos - Mejorado */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Productos Más Vendidos</h3>
                </div>
                <p className="text-gray-600">Top productos por cantidad vendida</p>
              </div>
              
              <div className="p-6 sm:p-8">
              {dailyReport.topProducts.length > 0 ? (
                  <div className="space-y-4">
                  {dailyReport.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center space-x-4 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                            'bg-gradient-to-br from-blue-400 to-blue-500'
                          }`}>
                          #{index + 1}
                        </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                            <p className="text-sm text-gray-600">{product.quantity} unidades vendidas</p>
                      </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCurrency(product.total)}</p>
                          <p className="text-xs text-gray-600">Total</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-600">No hay datos de productos para mostrar</p>
                  </div>
              )}
            </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">No hay datos para esta fecha</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              No hay ventas registradas para {formatDate(selectedDate)} en {activeBranch.name}
            </p>
          </div>
        )}

        {/* Flujo de Caja - Nueva sección */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Flujo de Caja del Día</h3>
              </div>
              <Button
                onClick={() => setShowCashMovementModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Agregar Movimiento
              </Button>
            </div>
            <p className="text-gray-600">{formatDate(selectedDate)}</p>
          </div>
          
          {isLoadingCashFlow ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando flujo de caja...</p>
            </div>
          ) : cashFlowData ? (
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ingreso
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Egreso
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Saldo inicial */}
                  <tr className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
                        timeZone: 'America/La_Paz'
                      })} 00:00
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      Saldo Inicial
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900 text-right">
                      {formatCurrency(0)}
                    </td>
                  </tr>

                  {/* Transacciones del día */}
                  {(() => {
                    // 1) Construir transacciones sin saldo acumulado
                    const transactionsBase: any[] = [];

                    // Ventas (ingresos)
                    cashFlowData.sales.forEach((sale: any) => {
                      transactionsBase.push({
                        type: 'sale',
                        data: sale,
                        amountDelta: sale.total,
                        timestamp: sale.sale_date
                      });
                    });

                    // Ingresos manuales
                    cashFlowData.incomes.forEach((income: any) => {
                      transactionsBase.push({
                        type: 'income',
                        data: income,
                        amountDelta: income.amount,
                        timestamp: income.created_at
                      });
                    });

                    // Egresos manuales
                    cashFlowData.expenses.forEach((expense: any) => {
                      transactionsBase.push({
                        type: 'expense',
                        data: expense,
                        amountDelta: -expense.amount,
                        timestamp: expense.created_at
                      });
                    });

                    // 2) Orden cronológico por timestamp
                    transactionsBase.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    // 3) Calcular saldos acumulados después de ordenar
                    let runningBalance = 0;
                    const transactions = transactionsBase.map(t => {
                      runningBalance += t.amountDelta;
                      return {
                        ...t,
                        balance: runningBalance,
                        time: new Date(t.timestamp).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/La_Paz'
                        })
                      };
                    });

                    // Si no hay transacciones, mostrar mensaje
                    if (transactions.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center">
                              <DollarSign className="h-12 w-12 text-gray-300 mb-2" />
                              <p>No hay transacciones registradas para este día</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return transactions.map((transaction, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.time}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.type === 'sale' && (
                            <div>
                              <span className="font-medium text-green-700">Venta #{transaction.data.id.slice(-8)}</span>
                              <div className="text-xs text-gray-500">
                                {transaction.data.user?.name || 'N/A'}
                              </div>
                            </div>
                          )}
                          {transaction.type === 'income' && (
                            <div>
                              <span className="font-medium text-blue-700">{transaction.data.description}</span>
                              <div className="text-xs text-gray-500">
                                {transaction.data.user?.name || 'N/A'}
                              </div>
                            </div>
                          )}
                          {transaction.type === 'expense' && (
                            <div>
                              <span className="font-medium text-red-700">{transaction.data.description}</span>
                              <div className="text-xs text-gray-500">
                                {transaction.data.user?.name || 'N/A'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {transaction.type === 'sale' || transaction.type === 'income' ? (
                            <span className="text-green-600 font-semibold">
                              {formatCurrency(transaction.type === 'sale' ? transaction.data.total : transaction.data.amount)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {transaction.type === 'expense' ? (
                            <span className="text-red-600 font-semibold">
                              {formatCurrency(transaction.data.amount)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(transaction.balance)}
                        </td>
                      </tr>
                    ));
                  })()}

                  {/* Resumen final */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
                        timeZone: 'America/La_Paz'
                      })} 23:59
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      Saldo Final del Día
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 text-right">
                      {formatCurrency(cashFlowData.totalSales + cashFlowData.totalIncomes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                      {formatCurrency(cashFlowData.totalExpenses)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(cashFlowData.netFlow)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin datos de flujo de caja</h3>
              <p className="text-gray-600">No se pudieron cargar los datos del flujo de caja para esta fecha</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalles de Venta */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Detalles de Venta</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedSale.sale_date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })} - {new Date(selectedSale.sale_date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/La_Paz'
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaleDetails(false)}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <span className="text-gray-600 text-xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Información de la venta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Información de Venta</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Venta #:</span>
                      <span className="font-medium">#{selectedSale.id.slice(-8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vendedor:</span>
                      <span className="font-medium">{selectedSale.user?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sucursal:</span>
                      <span className="font-medium">{selectedSale.branch?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Método de pago:</span>
                      <span className="font-medium capitalize">{selectedSale.payment_type}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Resumen</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedSale.subtotal || selectedSale.total)}</span>
                    </div>
                    {selectedSale.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Descuento:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(selectedSale.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-900 font-semibold">Total:</span>
                      <span className="text-gray-900 font-bold text-lg">{formatCurrency(selectedSale.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Productos vendidos */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Productos Vendidos</h4>
                <div className="space-y-3">
                  {selectedSale.sale_items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      {item.variant?.product?.image_url && (
                        <img 
                          src={item.variant.product.image_url} 
                          alt={item.variant.product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{item.variant?.product?.name || 'Producto desconocido'}</h5>
                        <p className="text-sm text-gray-600">
                          Talla: {item.variant?.size || 'N/A'} | 
                          Cantidad: {item.quantity} | 
                          Precio unitario: {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalles de pago mixto si aplica */}
              {selectedSale.payment_type === 'MIXTO' && selectedSale.payment_details && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Desglose de Pago Mixto</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedSale.payment_details.efectivo > 0 && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Wallet className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Efectivo</span>
                        </div>
                        <p className="text-green-900 font-semibold">{formatCurrency(selectedSale.payment_details.efectivo)}</p>
                      </div>
                    )}
                    {selectedSale.payment_details.qr > 0 && (
                      <div className="bg-cyan-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <QrCode className="h-4 w-4 text-cyan-600" />
                          <span className="font-medium text-cyan-800">QR</span>
                        </div>
                        <p className="text-cyan-900 font-semibold">{formatCurrency(selectedSale.payment_details.qr)}</p>
                      </div>
                    )}
                    {selectedSale.payment_details.tarjeta > 0 && (
                      <div className="bg-pink-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="h-4 w-4 text-pink-600" />
                          <span className="font-medium text-pink-800">Tarjeta</span>
                        </div>
                        <p className="text-pink-900 font-semibold">{formatCurrency(selectedSale.payment_details.tarjeta)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowSaleDetails(false)}
                  variant="secondary"
                  className="px-6 py-2"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lista de Ventas */}
      {showSalesList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Lista de Ventas</h3>
                    <p className="text-sm text-gray-600">
                      {formatDate(selectedDate)} - {numberOfSales} ventas registradas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSalesList(false)}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <span className="text-gray-600 text-xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {salesList.length > 0 ? (
                <div className="space-y-4">
                  {salesList.map((sale) => (
                    <div 
                      key={sale.id} 
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        setSelectedSale(sale);
                        setShowSaleDetails(true);
                        setShowSalesList(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="text-sm font-medium text-gray-600">
                              {new Date(sale.sale_date).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'America/La_Paz'
                              })}
                            </span>
                            <span className="text-sm font-medium text-purple-600">
                              #{sale.id.slice(-8)}
                            </span>
                            <span className="text-sm text-gray-600">
                              {sale.user?.name || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {getProductNames(sale)}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                              {sale.sale_items?.length || 0} items
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCurrency(sale.total)}</p>
                          <p className="text-xs text-gray-600 capitalize">{sale.payment_type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay ventas registradas</h3>
                  <p className="text-gray-600">No se encontraron ventas para {formatDate(selectedDate)}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowSalesList(false)}
                  variant="secondary"
                  className="px-6 py-2"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lista de Unidades */}
      {showUnitsList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Lista de Unidades Vendidas</h3>
                    <p className="text-sm text-gray-600">
                      {formatDate(selectedDate)} - {productsSold} unidades vendidas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUnitsList(false)}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <span className="text-gray-600 text-xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {unitsList.length > 0 ? (
                <div className="space-y-4">
                  {unitsList.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-300">
                      {item.variant?.product?.image_url && (
                        <img 
                          src={item.variant.product.image_url} 
                          alt={item.variant.product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">
                          {item.variant?.product?.name || 'Producto desconocido'}
                        </h5>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>Talla: {item.variant?.size || 'N/A'}</span>
                          <span>Cantidad: {item.quantity}</span>
                          <span>Precio: {formatCurrency(item.unit_price)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Venta: {new Date(item.sale?.sale_date).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/La_Paz'
                            })}
                          </span>
                          <span className="text-xs text-gray-500">
                            Vendedor: {item.sale?.user?.name || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
                        <p className="text-xs text-gray-600">Subtotal</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay unidades vendidas</h3>
                  <p className="text-gray-600">No se encontraron productos vendidos para {formatDate(selectedDate)}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowUnitsList(false)}
                  variant="secondary"
                  className="px-6 py-2"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
        )}

      {/* Modal para Agregar Movimiento de Caja */}
      {showCashMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Agregar Movimiento de Caja</h3>
                    <p className="text-sm text-gray-600">Registrar ingreso o egreso manual</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCashMovementModal(false)}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <span className="text-gray-600 text-xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Movimiento
                  </label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as 'INGRESO' | 'EGRESO')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto (Bs.)
                  </label>
                  <Input
                    type="number"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={movementDescription}
                    onChange={(e) => setMovementDescription(e.target.value)}
                    placeholder="Ej: Pago de servicios, retiro para cambio, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowCashMovementModal(false)}
                  variant="secondary"
                  className="px-6 py-2"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddCashMovement}
                  disabled={!movementAmount || !movementDescription}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                >
                  Agregar Movimiento
                </Button>
              </div>
            </div>
          </div>
        </div>
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