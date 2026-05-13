import { supabase } from '../lib/supabase';
import type { DailyReport, Sale } from '../lib/types';

export class CashClosureService {
  async addCashMovement(
    branchId: string,
    userId: string,
    movementType: 'INGRESO' | 'EGRESO',
    paymentType: 'EFECTIVO' | 'QR' | 'TARJETA',
    amount: number,
    description: string
  ): Promise<void> {
    // Obtener la caja abierta de la sucursal
    const { data: openRegister, error: registerError } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('branch_id', branchId)
      .eq('status', 'ABIERTA')
      .single();

    if (registerError || !openRegister) {
      throw new Error('No hay caja abierta en esta sucursal');
    }

    // Crear el movimiento
    const { error: movementError } = await supabase
      .from('cash_movements')
      .insert({
        cash_register_id: openRegister.id,
        user_id: userId,
        movement_type: movementType,
        payment_type: paymentType,
        amount,
        description
      });

    if (movementError) throw movementError;
  }
  async getDailyCashFlow(branchId: string, date: string): Promise<{
    sales: any[];
    expenses: any[];
    incomes: any[];
    totalSales: number;
    totalExpenses: number;
    totalIncomes: number;
    netFlow: number;
  }> {
    // Obtener ventas del día con zona horaria local — single query with joins
    const startDate = `${date}T00:00:00-04:00`;
    const endDate = `${date}T23:59:59-04:00`;

    const { data: salesDetailed, error: salesError } = await supabase
      .from('sales')
      .select(`
        id, user_id, branch_id, total, subtotal, discount_amount,
        sale_date, payment_type, payment_details, sale_channel, notes, created_at,
        user:users!left(name),
        sale_items(
          id, variant_id, quantity, unit_price, subtotal,
          variant:product_variants(
            size,
            product:products(name)
          )
        )
      `)
      .eq('branch_id', branchId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true });

    if (salesError) throw salesError;

    // Obtener movimientos de caja del día con usuario incluído en el join
    const { data: cashMovementsBase, error: movementsError } = await supabase
      .from('cash_movements')
      .select(`
        id, user_id, cash_register_id, movement_type, payment_type, amount, description, reference_id, created_at,
        user:users!left(name),
        cash_registers!inner(branch_id)
      `)
      .eq('cash_registers.branch_id', branchId)
      .is('reference_id', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (movementsError) throw movementsError;

    const salesData = salesDetailed || [];
    const movementsData = cashMovementsBase || [];

    // Separar movimientos en ingresos y egresos
    const expensesData = movementsData.filter(movement => movement.movement_type === 'EGRESO');
    const incomesData = movementsData.filter(movement => movement.movement_type === 'INGRESO');

    // Calcular totales
    const totalSales = salesData.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncomes = incomesData.reduce((sum, income) => sum + income.amount, 0);
    const netFlow = totalSales + totalIncomes - totalExpenses;

    return {
      sales: salesData,
      expenses: expensesData,
      incomes: incomesData,
      totalSales,
      totalExpenses,
      totalIncomes,
      netFlow
    };
  }

  async getDailyReport(branchId: string, date: string): Promise<DailyReport> {
    // Obtener ventas del día con zona horaria local via RPC
    const { data: salesIds, error: salesError } = await supabase
      .rpc('get_daily_sales_local', {
        p_branch_id: branchId,
        p_day: date
      });

    if (salesError) throw salesError;

    let sales: any[] = [];
    if (salesIds && salesIds.length > 0) {
      const ids = salesIds.map((s: any) => s.id);
      const { data: salesDetailed, error: detailErr } = await supabase
        .from('sales')
        .select(`
          *,
          user:users!left(name),
          sale_items(
            *,
            variant:product_variants(
              *,
              product:products(name)
            )
          )
        `)
        .eq('branch_id', branchId)
        .in('id', ids)
        .order('sale_date', { ascending: true });
      if (detailErr) throw detailErr;
      sales = salesDetailed || [];
    }

    const salesData = sales || [];
    
    // Calcular estadísticas
    const totalSales = salesData.reduce((sum, sale) => sum + sale.total, 0);
    const numberOfSales = salesData.length;
    const averageSale = numberOfSales > 0 ? totalSales / numberOfSales : 0;
    
    // Calcular total de artículos vendidos
    const totalItemsSold = salesData.reduce((sum, sale) => {
      return sum + (sale.sale_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0);
    }, 0);

    // Calcular productos más vendidos
    const productSales: { [key: string]: { name: string; quantity: number; total: number } } = {};
    
    salesData.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        const productName = item.variant?.product?.name || 'Producto desconocido';
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, total: 0 };
        }
        productSales[productName].quantity += item.quantity;
        productSales[productName].total += item.subtotal;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      date,
      branchId,
      totalSales,
      numberOfSales,
      averageSale,
      totalItemsSold,
      sales: salesData,
      topProducts
    };
  }

  async getWeeklyReport(branchId: string, startDate: string, endDate: string) {
    // Crear fechas en zona horaria local de Bolivia
    const startDateTime = new Date(startDate + 'T00:00:00-04:00'); // UTC-4 para Bolivia
    const endDateTime = new Date(endDate + 'T23:59:59.999-04:00');
    
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        *,
        user:users!left(name),
        sale_items(
          *,
          variant:product_variants(
            *,
            product:products(name)
          )
        )
      `)
      .eq('branch_id', branchId)
      .gte('sale_date', startDateTime.toISOString())
      .lte('sale_date', endDateTime.toISOString())
      .order('sale_date', { ascending: true });

    if (error) throw error;

    return sales || [];
  }

  async getMonthlyReport(branchId: string, year: number, month: number) {
    // Crear fechas en zona horaria local de Bolivia
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    startOfMonth.setHours(startOfMonth.getHours() - 4); // Ajustar a UTC-4
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    endOfMonth.setHours(endOfMonth.getHours() - 4); // Ajustar a UTC-4

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        *,
        user:users!left(name),
        sale_items(
          *,
          variant:product_variants(
            *,
            product:products(name)
          )
        )
      `)
      .eq('branch_id', branchId)
      .gte('sale_date', startOfMonth.toISOString())
      .lte('sale_date', endOfMonth.toISOString())
      .order('sale_date', { ascending: true });

    if (error) throw error;

    return sales || [];
  }
}

export const cashClosureService = new CashClosureService();