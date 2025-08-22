import { supabase } from '../lib/supabase';
import type { Sale, SaleItem, DashboardStats } from '../lib/types';

export class SalesService {
  async createSale(
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>,
    branchId: string,
    userId: string,
    paymentType: 'QR' | 'EFECTIVO' | 'TARJETA'
  ): Promise<Sale> {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

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

    // Crear la venta
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: userId,
        branch_id: branchId,
        total,
        sale_date: new Date().toISOString(),
        payment_type: paymentType
      })
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
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        user:users(name),
        branch:branches(name),
        sale_items(
          *,
          variant:product_variants(
            *,
            product:products(name)
          )
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getDashboardStats(branchId: string): Promise<DashboardStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Monthly total
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('sales')
      .select('total')
      .eq('branch_id', branchId)
      .gte('sale_date', startOfMonth.toISOString());

    if (monthlyError) throw monthlyError;

    const monthlyTotal = monthlyData?.reduce((sum, sale) => sum + sale.total, 0) || 0;

    // Total sales count
    const { count: totalSales, error: countError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    if (countError) throw countError;

    // Top product (simplified query)
    const { data: topProductData, error: topProductError } = await supabase
      .from('sale_items')
      .select(`
        variant_id,
        quantity,
        variant:product_variants(
          *,
          product:products(name)
        )
      `)
      .limit(1);

    if (topProductError) throw topProductError;

    // Low stock products
    const { data: lowStockData, error: lowStockError } = await supabase
      .from('stock')
      .select(`
        quantity,
        variant:product_variants(
          *,
          product:products(name)
        )
      `)
      .eq('branch_id', branchId)
      .lt('quantity', 5)
      .order('quantity', { ascending: true });

    if (lowStockError) throw lowStockError;

    // Daily sales for last 7 days
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const { data: dailySalesData, error: dailySalesError } = await supabase
      .from('sales')
      .select('total, sale_date')
      .eq('branch_id', branchId)
      .gte('sale_date', last7Days.toISOString())
      .order('sale_date', { ascending: true });

    if (dailySalesError) throw dailySalesError;

    const dailySales = dailySalesData?.map(sale => ({
      date: new Date(sale.sale_date).toLocaleDateString(),
      total: sale.total
    })) || [];

    return {
      monthlyTotal,
      totalSales: totalSales || 0,
      topProduct: (Array.isArray(topProductData) && topProductData.length > 0 && topProductData[0].variant?.[0]?.product?.[0]?.name)
        ? {
            name: topProductData[0].variant[0].product[0].name,
            total_sold: topProductData[0].quantity
          }
        : undefined,
      lowStockProducts: Array.isArray(lowStockData)
        ? lowStockData.map(item => ({
            name: item.variant?.[0]?.product?.[0]?.name as string || '',
            quantity: item.quantity as number
          }))
        : [],
      dailySales
    };
  }
}

export const salesService = new SalesService();