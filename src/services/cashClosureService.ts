import { supabase } from '../lib/supabase';
import type { DailyReport, Sale } from '../lib/types';

export class CashClosureService {
  async getDailyReport(branchId: string, date: string): Promise<DailyReport> {
    // Crear fechas en zona horaria local de Bolivia
    const startOfDay = new Date(date + 'T00:00:00-04:00'); // UTC-4 para Bolivia
    const endOfDay = new Date(date + 'T23:59:59.999-04:00');

    // Obtener ventas del día
    const { data: sales, error: salesError } = await supabase
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
      .gte('sale_date', startOfDay.toISOString())
      .lte('sale_date', endOfDay.toISOString())
      .order('sale_date', { ascending: true });

    if (salesError) throw salesError;

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