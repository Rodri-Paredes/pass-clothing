import { supabase } from '../lib/supabase';
import type { Sale, DashboardStats, MixedPaymentBreakdown, SalesWithDiscounts, MonthlyRevenueReport, MonthlyRevenueComparison } from '../lib/types';

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

    // Bolivia timestamp
    const now = new Date();
    const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    const year = boliviaTime.getFullYear();
    const month = String(boliviaTime.getMonth() + 1).padStart(2, '0');
    const day = String(boliviaTime.getDate()).padStart(2, '0');
    const hours = String(boliviaTime.getHours()).padStart(2, '0');
    const minutes = String(boliviaTime.getMinutes()).padStart(2, '0');
    const seconds = String(boliviaTime.getSeconds()).padStart(2, '0');
    const saleDateISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-04:00`;

    // Attempt: single atomic transaction via create_sale_atomic RPC.
    // This locks stock rows, inserts sale + items, and decrements stock
    // inside one SERIALIZABLE transaction — no orphaned sales possible.
    const rpcItems = items.map((i) => ({
      variantId: i.variantId,
      quantity:  i.quantity,
      unitPrice: i.unitPrice,
    }));

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_sale_atomic', {
      p_branch_id:       branchId,
      p_user_id:         userId,
      p_items:           rpcItems,
      p_payment_type:    paymentType,
      p_subtotal:        subtotal,
      p_discount_amount: discountAmount,
      p_total:           total,
      p_sale_date:       saleDateISO,
      p_payment_details: paymentType === 'MIXTO' && paymentDetails ? paymentDetails : null,
      p_notes:           notes && notes.trim() ? notes.trim() : null,
      p_sale_channel:    saleChannel,
    });

    // If the atomic RPC is not yet deployed, fall back to the legacy multi-step flow.
    // REMOVE this fallback once create_sale_atomic migration has been executed in DB.
    if (rpcErr && (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('does not exist') || rpcErr.message?.includes('function'))) {
      return this._createSaleLegacy(
        items, branchId, userId, paymentType,
        discountAmount, paymentDetails, notes, saleChannel,
        subtotal, total, saleDateISO
      );
    }

    if (rpcErr) throw rpcErr;
    return rpcResult as Sale;
  }

  /** Legacy multi-step sale creation — used as fallback until create_sale_atomic is deployed. */
  private async _createSaleLegacy(
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>,
    branchId: string,
    userId: string,
    paymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    discountAmount: number,
    paymentDetails: { efectivo?: number; qr?: number; tarjeta?: number } | undefined,
    notes: string | undefined,
    saleChannel: 'TIENDA' | 'WEB',
    subtotal: number,
    total: number,
    saleDateISO: string,
  ): Promise<Sale> {
    // Client-side pre-check (best-effort; DB atomic decrement is the real guard)
    const variantIds = items.map((i) => i.variantId);
    const { data: stockRows, error: stockBatchError } = await supabase
      .from('stock')
      .select('variant_id, quantity')
      .eq('branch_id', branchId)
      .in('variant_id', variantIds);

    if (stockBatchError) throw stockBatchError;

    const stockMap = new Map(
      (stockRows || []).map((r) => [r.variant_id, r.quantity as number])
    );
    for (const item of items) {
      const available = stockMap.get(item.variantId) ?? 0;
      if (available < item.quantity) {
        throw new Error('Stock insuficiente para el producto');
      }
    }

    const saleData: any = {
      user_id:         userId,
      branch_id:       branchId,
      subtotal,
      discount_amount: discountAmount,
      total,
      sale_date:       saleDateISO,
      payment_type:    paymentType,
      sale_channel:    saleChannel,
    };
    if (notes && notes.trim())                       saleData.notes = notes.trim();
    if (paymentType === 'MIXTO' && paymentDetails)   saleData.payment_details = paymentDetails;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) throw saleError;

    const saleItems = items.map((item) => ({
      sale_id:    sale.id,
      variant_id: item.variantId,
      quantity:   item.quantity,
      unit_price: item.unitPrice,
      subtotal:   item.quantity * item.unitPrice,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) throw itemsError;

    for (const item of items) {
      await this.updateStockAfterSale(item.variantId, branchId, item.quantity);
    }

    return sale;
  }

  private async updateStockAfterSale(variantId: string, branchId: string, soldQuantity: number): Promise<void> {
    // ATOMIC decrement — prevents race conditions between concurrent sales.
    // The RPC runs: UPDATE stock SET quantity = quantity - N WHERE quantity >= N
    // returning true if successful, false if stock was insufficient.
    const { data: result, error: rpcError } = await supabase.rpc('decrement_stock_atomic', {
      p_variant_id: variantId,
      p_branch_id: branchId,
      p_quantity: soldQuantity
    });

    if (rpcError) {
      console.error('Error updating stock atomically:', rpcError);
      throw new Error('Error al actualizar el stock del producto');
    }

    if (!result) {
      throw new Error('Stock insuficiente al momento de confirmar la venta');
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
      .order('created_at', { ascending: false })
      .limit(200); // Prevent unbounded payload — paginate incrementally if more needed

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
    // Single server-side aggregation via RPC (replaces 7 sequential queries)
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_branch_id: branchId,
    });

    if (error) throw error;

    const raw = data as any;
    return {
      monthlyTotal:      raw?.monthlyTotal      ?? 0,
      monthlySalesCount: raw?.monthlySalesCount ?? 0,
      monthlyItemsSold:  raw?.monthlyItemsSold  ?? 0,
      totalSales:        raw?.totalSales        ?? 0,
      topProduct:        raw?.topProduct        ?? undefined,
      lowStockProducts:  raw?.lowStockProducts  ?? [],
      // RPC returns DATE strings; format for UI locale
      dailySales: (raw?.dailySales ?? []).map((d: any) => ({
        date: new Date(d.date + 'T12:00:00-04:00').toLocaleDateString('es-ES', {
          timeZone: 'America/La_Paz',
        }),
        total: Number(d.total) || 0,
      })),
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