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
    includeHidden?: boolean;
  }): Promise<{ items: Product[]; hasMore: boolean }> {
    const { page, limit, search, category, includeHidden = false } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ✅ OPTIMIZADO: campos para lista con imagen y tallas
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        category,
        image_url,
        is_visible,
        drop_id,
        created_at,
        variants:product_variants(id, size)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filtrar por visibilidad si no se incluyen productos ocultos
    if (!includeHidden) {
      query = query.eq('is_visible', true);
    }

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
  async getProducts(includeHidden: boolean = false): Promise<Product[]> {
    // ✅ OPTIMIZADO: campos para lista con imagen y tallas
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        category,
        image_url,
        is_visible,
        drop_id,
        created_at,
        variants:product_variants(id, size)
      `)
      .order('created_at', { ascending: false });

    // Filtrar por visibilidad si no se incluyen productos ocultos
    if (!includeHidden) {
      query = query.eq('is_visible', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as any || [];
  }

  async getProduct(id: string): Promise<Product | null> {
    // ✅ Aquí SÍ traemos todo: detalles completos solo cuando se necesitan
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(
          id,
          product_id,
          size,
          created_at
        )
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
    // Strip out undefined values and empty strings that could overwrite real data
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined && v !== null)
    );
    // Preserve empty string for description only if explicitly set to empty
    // (description comes fully loaded from getProduct before edit)
    const { data, error } = await supabase
      .from('products')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    
    try {
      // 1. Obtener información del producto antes de eliminarlo
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ [ProductService] Error obteniendo producto:', fetchError);
        throw fetchError;
      }

      if (!product) {
        throw new Error('Producto no encontrado');
      }

      // 2. Eliminar imagen del storage si existe
      if (product.image_url) {
        try {
          // Extraer el nombre del archivo de la URL
          const fileName = product.image_url.split('/').pop();
          if (fileName) {
            const { error: deleteImageError } = await supabase.storage
              .from('products')
              .remove([fileName]);
            if (deleteImageError) {
              console.warn('⚠️ [ProductService] No se pudo eliminar la imagen:', deleteImageError);
            }
          }
        } catch (imageError) {
          console.warn('⚠️ [ProductService] Error eliminando imagen:', imageError);
          // No lanzar error, solo registrar warning
        }
      }

      // 3. Eliminar el producto (esto debería eliminar en cascada las variantes y stock)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ [ProductService] Error eliminando producto:', deleteError);
        throw deleteError;
      }

    } catch (error) {
      console.error('❌ [ProductService] Error en eliminación de producto:', error);
      throw error;
    }
  }

  async getStockByBranch(branchId: string): Promise<Stock[]> {
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data, error } = await supabase
      .from('stock')
      .select(`
        id,
        variant_id,
        branch_id,
        quantity,
        created_at,
        updated_at,
        variant:product_variants(
          id,
          size,
          product:products(
            id,
            name,
            price,
            category
          )
        ),
        branch:branches(
          id,
          name
        )
      `)
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true });

    if (error) throw error;
    return data as any || [];
  }

  async getStockByProduct(variantId: string): Promise<Stock[]> {
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data, error } = await supabase
      .from('stock')
      .select(`
        id,
        variant_id,
        branch_id,
        quantity,
        created_at,
        updated_at,
        variant:product_variants(
          id,
          size
        ),
        branch:branches(
          id,
          name
        )
      `)
      .eq('variant_id', variantId);

    if (error) throw error;
    return data as any || [];
  }

  async updateStock(variantId: string, branchId: string, quantity: number): Promise<void> {

    // Verificar si ya existe un registro de stock para esta variante/sucursal
    const { data: existing, error: selectError } = await supabase
      .from('stock')
      .select('id')
      .eq('variant_id', variantId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      // Actualizar registro existente
      const { error } = await supabase
        .from('stock')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // Crear nuevo registro de stock
      const { error } = await supabase
        .from('stock')
        .insert({ variant_id: variantId, branch_id: branchId, quantity });
      if (error) throw error;
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

  async toggleProductVisibility(productId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_product_visibility', {
      product_id: productId
    });
    if (error) throw error;
    return data;
  }

  async updateProductVisibility(productId: string, isVisible: boolean): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_product_visibility', {
      product_id: productId,
      visible: isVisible
    });
    if (error) throw error;
    return data;
  }

  // Función para verificar la integridad de los datos de stock
  async verifyStockIntegrity(variantId: string, expectedStock: { [branchId: string]: number }): Promise<any> {
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
        console.warn('⚠️ Stock discrepancy found:', integrityReport.discrepancies);
      }
      return integrityReport;
    } catch (error) {
      throw error;
    }
  }
}

export const productService = new ProductService();