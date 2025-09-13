import { supabase } from '../lib/supabase';
import type { DailyReport, Sale } from '../lib/types';

export class CashClosureService {
  async addCashMovement(
    branchId: string,
    userId: string,
    movementType: 'INGRESO' | 'EGRESO',
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
        payment_type: 'EFECTIVO', // Los movimientos manuales son siempre en efectivo
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
    // Obtener ventas del día con zona horaria local - consulta directa
    const { data: dailySales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('branch_id', branchId)
      .gte('sale_date', `${date}T00:00:00-04:00`)
      .lt('sale_date', `${date}T23:59:59-04:00`)
      .order('sale_date', { ascending: true });

    console.log('Direct query result:', { dailySales, error: salesError, date, branchId });

    if (salesError) throw salesError;

    // Enriquecer ventas con usuario (y cualquier otro campo necesario)
    let salesDetailed: any[] = [];
    if (dailySales && dailySales.length > 0) {
      const saleIds = dailySales.map((s: any) => s.id);
      const { data: detailed, error: detailErr } = await supabase
        .from('sales')
        .select(`
          *,
          user:users(name)
        `)
        .eq('branch_id', branchId)
        .in('id', saleIds)
        .order('sale_date', { ascending: true });
      if (detailErr) throw detailErr;
      salesDetailed = detailed || [];
    }

    // Obtener movimientos de caja del día (solo movimientos manuales, NO ventas) - consulta directa
    const { data: cashMovementsBase, error: movementsError } = await supabase
      .from('cash_movements')
      .select(`
        *,
        cash_registers!inner(branch_id)
      `)
      .eq('cash_registers.branch_id', branchId)
      .is('reference_id', null)
      .gte('created_at', `${date}T00:00:00-04:00`)
      .lt('created_at', `${date}T23:59:59-04:00`)
      .order('created_at', { ascending: true });

    if (movementsError) throw movementsError;

    // Enriquecer movimientos con usuario
    let cashMovements: any[] = [];
    if (cashMovementsBase && cashMovementsBase.length > 0) {
      const userIds = [...new Set(cashMovementsBase.map((m: any) => m.user_id))];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);
      
      if (usersError) throw usersError;
      
      const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
      cashMovements = cashMovementsBase.map(m => ({
        ...m,
        user: { name: userMap.get(m.user_id) || 'Usuario desconocido' }
      }));
    }

    const salesData = salesDetailed || [];
    const movementsData = cashMovements || [];

    // Separar movimientos en ingresos y egresos
    const expensesData = movementsData.filter(movement => movement.movement_type === 'EGRESO');
    const incomesData = movementsData.filter(movement => movement.movement_type === 'INGRESO');

    // Calcular totales
    const totalSales = salesData.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncomes = incomesData.reduce((sum, income) => sum + income.amount, 0);
    const netFlow = totalSales + totalIncomes - totalExpenses;

    // Debug: mostrar los datos
    console.log('Cash Flow Debug:', {
      sales: salesData.length,
      totalSales,
      expenses: expensesData.length,
      totalExpenses,
      incomes: incomesData.length,
      totalIncomes,
      netFlow,
      salesData: salesData.map(s => ({ id: s.id, sale_date: s.sale_date, total: s.total }))
    });

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
          user:users(name),
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
        user:users(name),
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
        user:users(name),
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