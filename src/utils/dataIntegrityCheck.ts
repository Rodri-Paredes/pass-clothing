import { supabase } from '../lib/supabase';

export interface DataIntegrityReport {
  salesCount: number;
  totalSalesAmount: number;
  stockIssues: Array<{
    variantId: string;
    productName: string;
    branchName: string;
    issue: string;
  }>;
  orphanedRecords: Array<{
    table: string;
    count: number;
    description: string;
  }>;
  dateIssues: Array<{
    saleId: string;
    issue: string;
  }>;
}

export class DataIntegrityChecker {
  static async checkSalesIntegrity(branchId: string, date: string): Promise<DataIntegrityReport> {
    const report: DataIntegrityReport = {
      salesCount: 0,
      totalSalesAmount: 0,
      stockIssues: [],
      orphanedRecords: [],
      dateIssues: []
    };

    try {
      // Verificar ventas del día
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .eq('branch_id', branchId)
        .gte('sale_date', `${date}T00:00:00`)
        .lte('sale_date', `${date}T23:59:59`);

      if (salesError) throw salesError;

      report.salesCount = sales?.length || 0;
      report.totalSalesAmount = sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;

      // Verificar problemas de stock
      if (sales) {
        for (const sale of sales) {
          if (sale.sale_items) {
            for (const item of sale.sale_items) {
              const { data: stock } = await supabase
                .from('stock')
                .select(`
                  quantity,
                  variant:product_variants(
                    *,
                    product:products(name)
                  ),
                  branch:branches(name)
                `)
                .eq('variant_id', item.variant_id)
                .eq('branch_id', branchId)
                .single();

              if (stock && stock.quantity < 0) {
                report.stockIssues.push({
                  variantId: item.variant_id,
                  productName: stock.variant?.product?.name || 'Desconocido',
                  branchName: stock.branch?.name || 'Desconocida',
                  issue: `Stock negativo: ${stock.quantity}`
                });
              }
            }
          }
        }
      }

      // Verificar registros huérfanos
      const { data: orphanedSaleItems } = await supabase
        .from('sale_items')
        .select('id')
        .is('sale_id', null);

      if (orphanedSaleItems && orphanedSaleItems.length > 0) {
        report.orphanedRecords.push({
          table: 'sale_items',
          count: orphanedSaleItems.length,
          description: 'Items de venta sin venta asociada'
        });
      }

      // Verificar problemas de fechas
      if (sales) {
        for (const sale of sales) {
          const saleDate = new Date(sale.sale_date);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - saleDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 1) {
            report.dateIssues.push({
              saleId: sale.id,
              issue: `Fecha de venta muy antigua: ${sale.sale_date}`
            });
          }
        }
      }

    } catch (error) {
      console.error('Error checking data integrity:', error);
    }

    return report;
  }

  static async fixStockIssues(branchId: string): Promise<void> {
    try {
      // Corregir stocks negativos
      const { data: negativeStocks } = await supabase
        .from('stock')
        .select('*')
        .eq('branch_id', branchId)
        .lt('quantity', 0);

      if (negativeStocks) {
        for (const stock of negativeStocks) {
          await supabase
            .from('stock')
            .update({ quantity: 0, updated_at: new Date().toISOString() })
            .eq('id', stock.id);
        }
      }
    } catch (error) {
      console.error('Error fixing stock issues:', error);
    }
  }

  static async getSalesSummary(branchId: string, startDate: string, endDate: string) {
    try {
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .eq('branch_id', branchId)
        .gte('sale_date', `${startDate}T00:00:00`)
        .lte('sale_date', `${endDate}T23:59:59`)
        .order('sale_date', { ascending: true });

      if (!sales) return null;

      const summary = {
        totalSales: sales.length,
        totalAmount: sales.reduce((sum, sale) => sum + sale.total, 0),
        byPaymentType: {
          EFECTIVO: 0,
          QR: 0,
          TARJETA: 0
        },
        byDate: {} as { [date: string]: { count: number; amount: number } }
      };

      for (const sale of sales) {
        // Contar por tipo de pago
        summary.byPaymentType[sale.payment_type as keyof typeof summary.byPaymentType] += sale.total;

        // Contar por fecha
        const date = sale.sale_date.split('T')[0];
        if (!summary.byDate[date]) {
          summary.byDate[date] = { count: 0, amount: 0 };
        }
        summary.byDate[date].count += 1;
        summary.byDate[date].amount += sale.total;
      }

      return summary;
    } catch (error) {
      console.error('Error getting sales summary:', error);
      return null;
    }
  }
}
