// Removed duplicate top-level createProductVariant function
import { supabase } from '../lib/supabase';
import type { Product, Stock } from '../lib/types';

export class ProductService {
  async createProductVariant(variant: { product_id: string; size: string }): Promise<any> {
    const { data, error } = await supabase
      .from('product_variants')
      .insert(variant)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getProductsPaginated(params: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
  }): Promise<{ items: Product[]; hasMore: boolean }> {
    const { page, limit, search, category } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},description.ilike.${term}`);
    }

    if (category && category.trim()) {
      query = query.eq('category', category.trim());
    }

    const { data, error } = await query;
    if (error) throw error;
    const items = (data as Product[]) || [];
    const hasMore = items.length === limit; // heurística sin count
    return { items, hasMore };
  }
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getStockByBranch(branchId: string): Promise<Stock[]> {
    const { data, error } = await supabase
      .from('stock')
      .select(`
        *,
        variant:product_variants(*),
        branch:branches(*)
      `)
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getStockByProduct(variantId: string): Promise<Stock[]> {
    const { data, error } = await supabase
      .from('stock')
      .select(`
        *,
        variant:product_variants(*),
        branch:branches(*)
      `)
      .eq('variant_id', variantId);

    if (error) throw error;
    return data || [];
  }

  async updateStock(variantId: string, branchId: string, quantity: number): Promise<void> {
    console.log(`🔄 [ProductService] Iniciando actualización de stock - Variante: ${variantId}, Sucursal: ${branchId}, Cantidad: ${quantity}`);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [ProductService] Intento ${attempts}/${maxAttempts} - Actualizando stock`);
      
      try {
        // Usar transacción explícita para garantizar atomicidad
        const { error: transactionError } = await supabase.rpc('update_stock_safe', {
          p_variant_id: variantId,
          p_branch_id: branchId,
          p_quantity: quantity
        });

        if (transactionError) {
          console.error(`❌ [ProductService] Error en transacción de stock (intento ${attempts}):`, transactionError);
          throw transactionError;
        }
        
        // Verificación inmediata después de la actualización
        console.log(`🔍 [ProductService] Verificando stock actualizado...`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Pausa más larga para asegurar que la BD se actualice
        
        const { data: verificationData, error: verificationError } = await supabase
          .from('stock')
          .select('quantity')
          .eq('variant_id', variantId)
          .eq('branch_id', branchId)
          .single();
        
        if (verificationError) {
          console.error(`❌ [ProductService] Error verificando stock (intento ${attempts}):`, verificationError);
          throw verificationError;
        }
        
        const actualQuantity = verificationData?.quantity || 0;
        console.log(`📊 [ProductService] Stock verificado - Esperado: ${quantity}, Actual: ${actualQuantity}`);
        
        if (actualQuantity === quantity) {
          console.log(`✅ [ProductService] Stock actualizado exitosamente - Variante: ${variantId}, Sucursal: ${branchId}, Cantidad: ${quantity}`);
          return; // Éxito, salir del bucle
        } else {
          console.warn(`⚠️ [ProductService] Discrepancia detectada - Esperado: ${quantity}, Actual: ${actualQuantity} (intento ${attempts})`);
          
          if (attempts === maxAttempts) {
            // Último intento falló, lanzar error
            throw new Error(`No se pudo actualizar el stock correctamente después de ${maxAttempts} intentos. Esperado: ${quantity}, Actual: ${actualQuantity}`);
          }
          
          // Esperar antes del siguiente intento
          console.log(`⏳ [ProductService] Esperando antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ [ProductService] Error en intento ${attempts}:`, error);
        
        if (attempts === maxAttempts) {
          throw error; // Re-lanzar error en el último intento
        }
        
        // Esperar antes del siguiente intento
        console.log(`⏳ [ProductService] Esperando antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async uploadProductImage(file: File): Promise<string> {
    const fileName = `${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // Función para verificar la integridad de los datos de stock
  async verifyStockIntegrity(variantId: string, expectedStock: { [branchId: string]: number }): Promise<any> {
    console.log(`🔍 [ProductService] Verificando integridad de stock para variante: ${variantId}`);
    try {
      const actualStock = await this.getStockByProduct(variantId);
      const integrityReport = {
        variantId,
        expected: expectedStock,
        actual: actualStock.reduce((acc, stock) => {
          acc[stock.branch_id] = stock.quantity;
          return acc;
        }, {} as { [branchId: string]: number }),
        discrepancies: [] as Array<{ branchId: string; expected: number; actual: number }>
      };

      // Verificar discrepancias
      for (const [branchId, expectedQuantity] of Object.entries(expectedStock)) {
        const actualQuantity = integrityReport.actual[branchId] || 0;
        if (expectedQuantity !== actualQuantity) {
          integrityReport.discrepancies.push({
            branchId,
            expected: expectedQuantity,
            actual: actualQuantity
          });
        }
      }

      if (integrityReport.discrepancies.length > 0) {
        console.warn(`⚠️ [ProductService] Discrepancias encontradas en stock:`, integrityReport.discrepancies);
      } else {
        console.log(`✅ [ProductService] Integridad de stock verificada correctamente`);
      }

      return integrityReport;
    } catch (error) {
      console.error(`❌ [ProductService] Error verificando integridad de stock:`, error);
      throw error;
    }
  }
}

export const productService = new ProductService();