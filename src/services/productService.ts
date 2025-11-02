// Removed duplicate top-level createProductVariant function
import { supabase } from '../lib/supabase';
import type { Product, Stock } from '../lib/types';
import { queryCache, cacheKeys, CACHE_TTL } from '../lib/queryCache';

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

  // Versión con objeto para compatibilidad con hooks
  async getProductsPaginated(params: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    includeHidden?: boolean;
  }): Promise<{ items: Product[]; hasMore: boolean }> {
    const { page, limit, search, category, includeHidden = false } = params;
    
    const result = await this.getProductsPaginatedInternal(
      page,
      limit,
      search,
      category,
      includeHidden
    );
    
    return {
      items: result.products,
      hasMore: result.products.length === limit
    };
  }

  private async getProductsPaginatedInternal(
    page: number,
    pageSize: number,
    searchTerm?: string,
    category?: string,
    includeHidden = false
  ): Promise<{ products: Product[]; total: number }> {
    const cacheKey = cacheKeys.productsPaginated(page, pageSize, searchTerm, category, includeHidden);
    
    return queryCache.withCache(
      cacheKey,
      async () => {
        let query = supabase
          .from('products')
          .select('*, variants:product_variants(*)', { count: 'exact' })
          .order('created_at', { ascending: false });

        if (!includeHidden) {
          query = query.eq('is_visible', true);
        }

        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
        }

        if (category) {
          query = query.eq('category', category);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
          products: data || [],
          total: count || 0,
        };
      },
      CACHE_TTL.SHORT // Shorter TTL for paginated data since it changes more frequently
    );
  }
  async getProducts(includeHidden: boolean = false): Promise<Product[]> {
    const cacheKey = cacheKeys.products(includeHidden);
    
    return queryCache.withCache(
      cacheKey,
      async () => {
        let query = supabase
          .from('products')
          .select(`
            *,
            variants:product_variants(*)
          `)
          .order('created_at', { ascending: false });

        // Filtrar por visibilidad si no se incluyen productos ocultos
        if (!includeHidden) {
          query = query.eq('is_visible', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      CACHE_TTL.MEDIUM
    );
  }

  async getProduct(id: string): Promise<Product | null> {
    return queryCache.withCache(
      cacheKeys.product(id),
      async () => {
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
      },
      CACHE_TTL.MEDIUM
    );
  }

  async createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    
    // Invalidar cachés de productos
    queryCache.invalidatePattern('products:');
    
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
    
    // Invalidar cachés específicos del producto y listados
    queryCache.invalidate(cacheKeys.product(id));
    queryCache.invalidatePattern('products:');
    
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    console.log(`🗑️ [ProductService] Iniciando eliminación de producto: ${id}`);
    
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

      console.log(`📦 [ProductService] Producto encontrado: ${product.name}`);

      // 2. Eliminar imagen del storage si existe
      if (product.image_url) {
        try {
          // Extraer el nombre del archivo de la URL
          const fileName = product.image_url.split('/').pop();
          if (fileName) {
            console.log(`🖼️ [ProductService] Eliminando imagen: ${fileName}`);
            
            const { error: deleteImageError } = await supabase.storage
              .from('products')
              .remove([fileName]);

            if (deleteImageError) {
              console.warn('⚠️ [ProductService] No se pudo eliminar la imagen:', deleteImageError);
              // No lanzar error, solo registrar warning
            } else {
              console.log(`✅ [ProductService] Imagen eliminada exitosamente: ${fileName}`);
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

      console.log(`✅ [ProductService] Producto eliminado exitosamente: ${product.name}`);
      
      // Invalidar cachés del producto eliminado
      queryCache.invalidate(cacheKeys.product(id));
      queryCache.invalidatePattern('products:');

    } catch (error) {
      console.error('❌ [ProductService] Error en eliminación de producto:', error);
      throw error;
    }
  }

  async getStockByBranch(branchId: string): Promise<Stock[]> {
    return queryCache.withCache(
      cacheKeys.stockByBranch(branchId),
      async () => {
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
      },
      CACHE_TTL.SHORT // Stock cambia frecuentemente
    );
  }

  async getStockByProduct(variantId: string): Promise<Stock[]> {
    return queryCache.withCache(
      cacheKeys.productStock(variantId),
      async () => {
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
      },
      CACHE_TTL.SHORT
    );
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
          
          // Invalidar cachés de stock
          queryCache.invalidate(cacheKeys.productStock(variantId));
          queryCache.invalidate(cacheKeys.stockByBranch(branchId));
          queryCache.invalidatePattern('stock:');
          
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

  async toggleProductVisibility(productId: string): Promise<boolean> {
    console.log(`👁️ [ProductService] Alternando visibilidad del producto: ${productId}`);
    
    const { data, error } = await supabase.rpc('toggle_product_visibility', {
      product_id: productId
    });

    if (error) {
      console.error('❌ [ProductService] Error alternando visibilidad:', error);
      throw error;
    }

    console.log(`✅ [ProductService] Visibilidad actualizada: ${data}`);
    return data;
  }

  async updateProductVisibility(productId: string, isVisible: boolean): Promise<boolean> {
    console.log(`👁️ [ProductService] Actualizando visibilidad del producto: ${productId} a ${isVisible}`);
    
    const { data, error } = await supabase.rpc('update_product_visibility', {
      product_id: productId,
      visible: isVisible
    });

    if (error) {
      console.error('❌ [ProductService] Error actualizando visibilidad:', error);
      throw error;
    }

    console.log(`✅ [ProductService] Visibilidad actualizada: ${data}`);
    return data;
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