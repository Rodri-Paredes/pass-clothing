import { supabase } from '../lib/supabase';
import type { Sale, DashboardStats, MixedPaymentBreakdown, SalesWithDiscounts, MonthlyRevenueReport, MonthlyRevenueComparison } from '../lib/types';
import { toBoliviaStartOfDay, toBoliviaEndOfDay } from '../lib/constants';

export class SalesService {
  async createSale(
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>,
    branchId: string,
    userId: string,
    paymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    discountAmount: number = 0,
    paymentDetails?: {
      efectivo?: number;
      qr?: number;
      tarjeta?: number;
    },
    notes?: string,
    saleChannel: 'TIENDA' | 'WEB' = 'TIENDA'
  ): Promise<Sale> {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const total = Math.max(0, subtotal - discountAmount);

    // Verificar stock antes de crear la venta
    for (const item of items) {
      const { data: currentStock, error: stockError } = await supabase
        .from('stock')
        .select('quantity')
        .eq('variant_id', item.variantId)
        .eq('branch_id', branchId)
        .single();

      if (stockError) throw stockError;
      if (!currentStock || currentStock.quantity < item.quantity) {
        throw new Error(`Stock insuficiente para el producto`);
      }
    }

    // Crear la venta con timestamp correcto de Bolivia
    // Usar una función más simple y directa
    const now = new Date();
    const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    
    // Crear timestamp ISO manualmente con offset de Bolivia
    const year = boliviaTime.getFullYear();
    const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
    const day = String(boliviaTime.getDate()).padStart(2, '0');
    const hours = String(boliviaTime.getHours()).padStart(2, '0');
    const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
    const seconds = String(boliviaTime.getSeconds()).padStart(2, '0');
    
    const saleDateISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-04:00`;
    
    console.log('Creating sale with Bolivia time:', saleDateISO);

    const saleData: any = {
      user_id: userId,
      branch_id: branchId,
      subtotal,
      discount_amount: discountAmount,
      total,
      sale_date: saleDateISO,
      payment_type: paymentType,
      sale_channel: saleChannel
    };

    // Agregar notas si existen
    if (notes && notes.trim()) {
      saleData.notes = notes.trim();
    }

    // Agregar detalles de pago mixto si es necesario
    if (paymentType === 'MIXTO' && paymentDetails) {
      saleData.payment_details = paymentDetails;
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) throw saleError;

    // Crear los items de la venta
    const saleItems = items.map(item => ({
      sale_id: sale.id,
      variant_id: item.variantId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.quantity * item.unitPrice
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // Actualizar stock después de crear la venta
    for (const item of items) {
      await this.updateStockAfterSale(item.variantId, branchId, item.quantity);
    }

    return sale;
  }

  private async updateStockAfterSale(variantId: string, branchId: string, soldQuantity: number): Promise<void> {
    // Usar una consulta más robusta para actualizar el stock
    const { data: currentStock, error: stockError } = await supabase
      .from('stock')
      .select('quantity')
      .eq('variant_id', variantId)
      .eq('branch_id', branchId)
      .single();

    if (stockError) {
      console.error('Error getting stock:', stockError);
      throw new Error('Error al obtener el stock del producto');
    }

    if (!currentStock) {
      throw new Error('No se encontró stock para este producto en esta sucursal');
    }

    const newQuantity = Math.max(0, currentStock.quantity - soldQuantity);

    const { error: updateError } = await supabase
      .from('stock')
      .update({ 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('variant_id', variantId)
      .eq('branch_id', branchId)
      .gte('quantity', soldQuantity); // Solo actualizar si hay suficiente stock

    if (updateError) {
      console.error('Error updating stock:', updateError);
      throw new Error('Error al actualizar el stock del producto');
    }
  }

  async getSalesByBranch(branchId: string): Promise<Sale[]> {
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        user_id,
        branch_id,
        subtotal,
        discount_amount,
        total,
        sale_date,
        payment_type,
        payment_details,
        sale_channel,
        notes,
        created_at,
        user:users!left(id, name),
        branch:branches!left(id, name),
        sale_items(
          id,
          sale_id,
          variant_id,
          quantity,
          unit_price,
          subtotal,
          variant:product_variants(
            id,
            size,
            product:products(id, name, price, category)
          )
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as any || [];
  }

  async getSalesWithDiscounts(branchId: string, date: string): Promise<SalesWithDiscounts> {
    const { data, error } = await supabase.rpc('get_sales_with_discounts', {
      branch_id_param: branchId,
      sale_date_param: date
    });

    if (error) throw error;
    return data || {
      total_sales: 0,
      total_discounts: 0,
      net_sales: 0,
      number_of_sales: 0,
      sales_with_discounts: 0
    };
  }

  async getMixedPaymentBreakdown(branchId: string, date: string): Promise<MixedPaymentBreakdown[]> {
    const { data, error } = await supabase.rpc('get_mixed_payment_breakdown', {
      branch_id_param: branchId,
      sale_date_param: date
    });

    if (error) throw error;
    return data || [];
  }

  async getDashboardStats(branchId: string): Promise<DashboardStats> {
    // Usar zona horaria de Bolivia para calcular inicio de mes
    const laPazNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    const year = laPazNow.getFullYear();
    const month = laPazNow.getMonth(); // 0-indexed
    
    // Formato: YYYY-MM-01T00:00:00-04:00
    const startOfMonthDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const startOfMonthStr = toBoliviaStartOfDay(startOfMonthDate);

    // Monthly total revenue
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('sales')
      .select('total')
      .eq('branch_id', branchId)
      .gte('sale_date', startOfMonthStr);

    if (monthlyError) throw monthlyError;

    const monthlyTotal = monthlyData?.reduce((sum, sale) => sum + sale.total, 0) || 0;

    // Monthly sales count (del mes actual, no histórico)
    const { count: monthlySalesCount, error: monthlyCountError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .gte('sale_date', startOfMonthStr);

    if (monthlyCountError) throw monthlyCountError;

    // Total sales count (histórico - para referencia)
    const { count: totalSales, error: countError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    if (countError) throw countError;

    // Monthly items sold (prendas vendidas del mes)
    const { data: monthlySalesIds, error: monthlySalesIdsError } = await supabase
      .from('sales')
      .select('id')
      .eq('branch_id', branchId)
      .gte('sale_date', startOfMonthStr);

    if (monthlySalesIdsError) throw monthlySalesIdsError;

    let monthlyItemsSold = 0;
    if (monthlySalesIds && monthlySalesIds.length > 0) {
      const saleIds = monthlySalesIds.map(s => s.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('quantity')
        .in('sale_id', saleIds);

      if (!itemsError && itemsData) {
        monthlyItemsSold = itemsData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      }
    }

    // Top product (simplified query)
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data: topProductData, error: topProductError } = await supabase
      .from('sale_items')
      .select(`
        variant_id,
        quantity,
        variant:product_variants(
          id,
          size,
          product:products(id, name)
        )
      `)
      .limit(1);

    if (topProductError) throw topProductError;

    // Low stock products
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data: lowStockData, error: lowStockError } = await supabase
      .from('stock')
      .select(`
        id,
        variant_id,
        quantity,
        variant:product_variants(
          id,
          size,
          product:products(id, name, price)
        )
      `)
      .eq('branch_id', branchId)
      .lt('quantity', 5)
      .order('quantity', { ascending: true });

    if (lowStockError) throw lowStockError;

    // Daily sales for last 7 days (usando zona horaria de Bolivia)
    const laPazNow7 = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    laPazNow7.setDate(laPazNow7.getDate() - 7);
    const year7 = laPazNow7.getFullYear();
    const month7 = String(laPazNow7.getMonth() + 1).padStart(2, '0');
    const day7 = String(laPazNow7.getDate()).padStart(2, '0');
    const last7DaysDate = `${year7}-${month7}-${day7}`;
    const last7DaysStr = toBoliviaStartOfDay(last7DaysDate);

    const { data: dailySalesData, error: dailySalesError } = await supabase
      .from('sales')
      .select('total, sale_date')
      .eq('branch_id', branchId)
      .gte('sale_date', last7DaysStr)
      .order('sale_date', { ascending: true });

    if (dailySalesError) throw dailySalesError;

    const dailySales = dailySalesData?.map(sale => ({
      date: new Date(sale.sale_date).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' }),
      total: sale.total
    })) || [];

    const getFirst = (value: any) => Array.isArray(value) ? (value[0] ?? undefined) : value;

    return {
      monthlyTotal,
      monthlySalesCount: monthlySalesCount || 0,
      monthlyItemsSold,
      totalSales: totalSales || 0,
      topProduct: (Array.isArray(topProductData) && topProductData.length > 0 && topProductData[0].variant?.[0]?.product?.[0]?.name)
        ? {
            name: topProductData[0].variant[0].product[0].name,
            total_sold: topProductData[0].quantity
          }
        : undefined,
      lowStockProducts: Array.isArray(lowStockData)
        ? lowStockData.map(item => {
            const variant = getFirst(item.variant);
            const product = getFirst(variant?.product);
            return {
              name: (product?.name as string) || 'Producto',
              quantity: item.quantity as number
            };
          })
        : [],
      dailySales
    };
  }

  async getPreviousMonthRevenueReport(branchId: string): Promise<MonthlyRevenueReport> {
    const { data, error } = await supabase.rpc('get_previous_month_revenue_report', {
      branch_id_param: branchId
    });

    if (error) throw error;
    
    // La función devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      start_date: result.start_date,
      end_date: result.end_date,
      total_revenue: parseFloat(result.total_revenue) || 0,
      total_sales_count: parseInt(result.total_sales_count) || 0,
      average_sale_amount: parseFloat(result.average_sale_amount) || 0,
      revenue_by_payment_type: result.revenue_by_payment_type || {
        efectivo: 0,
        qr: 0,
        tarjeta: 0,
        mixto: 0
      }
    };
  }

  async getMonthlyRevenueReport(branchId: string, year: number, month: number): Promise<MonthlyRevenueReport> {
    const { data, error } = await supabase.rpc('get_monthly_revenue_report', {
      branch_id_param: branchId,
      year_param: year,
      month_param: month
    });

    if (error) throw error;
    
    // La función devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      start_date: result.start_date,
      end_date: result.end_date,
      total_revenue: parseFloat(result.total_revenue) || 0,
      total_sales_count: parseInt(result.total_sales_count) || 0,
      average_sale_amount: parseFloat(result.average_sale_amount) || 0,
      revenue_by_payment_type: result.revenue_by_payment_type || {
        efectivo: 0,
        qr: 0,
        tarjeta: 0,
        mixto: 0
      },
      daily_revenue: result.daily_revenue || []
    };
  }

  async getMonthlyRevenueComparison(branchId: string): Promise<MonthlyRevenueComparison> {
    const { data, error } = await supabase.rpc('get_monthly_revenue_comparison', {
      branch_id_param: branchId
    });

    if (error) throw error;
    
    // La función devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      current_month_start: result.current_month_start,
      current_month_end: result.current_month_end,
      current_month_revenue: parseFloat(result.current_month_revenue) || 0,
      current_month_sales_count: parseInt(result.current_month_sales_count) || 0,
      previous_month_start: result.previous_month_start,
      previous_month_end: result.previous_month_end,
      previous_month_revenue: parseFloat(result.previous_month_revenue) || 0,
      previous_month_sales_count: parseInt(result.previous_month_sales_count) || 0,
      revenue_change: parseFloat(result.revenue_change) || 0,
      revenue_change_percentage: parseFloat(result.revenue_change_percentage) || 0,
      sales_count_change: parseInt(result.sales_count_change) || 0,
      sales_count_change_percentage: parseFloat(result.sales_count_change_percentage) || 0
    };
  }

  async getDateRangeRevenueReport(branchId: string, startDate: string, endDate: string): Promise<MonthlyRevenueReport> {
    const { data, error } = await supabase.rpc('get_date_range_revenue_report', {
      branch_id_param: branchId,
      start_date_param: startDate,
      end_date_param: endDate
    });

    if (error) throw error;
    
    // La función devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      start_date: result.start_date,
      end_date: result.end_date,
      total_revenue: parseFloat(result.total_revenue) || 0,
      total_sales_count: parseInt(result.total_sales_count) || 0,
      average_sale_amount: parseFloat(result.average_sale_amount) || 0,
      revenue_by_payment_type: result.revenue_by_payment_type || {
        efectivo: 0,
        qr: 0,
        tarjeta: 0,
        mixto: 0
      },
      daily_revenue: result.daily_revenue || []
    };
  }

  /**
   * Devuelve la cantidad total de unidades vendidas (sumatoria de sale_items.quantity)
   * para una sucursal en un rango de fechas (inclusive).
   */
  async getDateRangeItemsSold(branchId: string, startDate: string, endDate: string): Promise<number> {
    // Agregar timezone de Bolivia si no lo tiene
    const startWithTz = startDate.includes('T') ? startDate : toBoliviaStartOfDay(startDate);
    const endWithTz = endDate.includes('T') ? endDate : toBoliviaEndOfDay(endDate);
    
    // Primero obtener todas las ventas del rango y sucursal
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id')
      .eq('branch_id', branchId)
      .gte('sale_date', startWithTz)
      .lte('sale_date', endWithTz);

    if (salesError) throw salesError;
    if (!salesData || salesData.length === 0) return 0;

    // Extraer los IDs de las ventas
    const saleIds = salesData.map(s => s.id);

    // Ahora obtener los items de esas ventas
    const { data: itemsData, error: itemsError } = await supabase
      .from('sale_items')
      .select('quantity')
      .in('sale_id', saleIds);

    if (itemsError) throw itemsError;
    if (!itemsData || !Array.isArray(itemsData)) return 0;

    // Sumar las cantidades
    const totalItems = itemsData.reduce((sum: number, item: any) => {
      const qty = Number(item.quantity) || 0;
      return sum + qty;
    }, 0);

    return totalItems;
  }

  /**
   * Actualiza el método de pago de una venta existente
   */
  async updatePaymentMethod(
    saleId: string,
    newPaymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    paymentDetails?: {
      efectivo?: number;
      qr?: number;
      tarjeta?: number;
    }
  ): Promise<Sale> {
    // Obtener la venta actual
    const { data: currentSale, error: getSaleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (getSaleError) throw getSaleError;
    if (!currentSale) throw new Error('Venta no encontrada');

    // Preparar los datos de actualización
    const updateData: any = {
      payment_type: newPaymentType,
      updated_at: new Date().toISOString()
    };

    // Si es pago mixto, agregar los detalles
    if (newPaymentType === 'MIXTO' && paymentDetails) {
      updateData.payment_details = paymentDetails;
    } else {
      // Si cambia de MIXTO a otro tipo, limpiar payment_details
      updateData.payment_details = null;
    }

    // Actualizar la venta
    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleId)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedSale;
  }
}

export const salesService = new SalesService();