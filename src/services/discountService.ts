import { supabase } from '../lib/supabase';
import type { Discount, DiscountProduct, DiscountDrop, DiscountStatus } from '../lib/types';

export const discountService = {
  // =============================================
  // CRUD de Descuentos
  // =============================================

  /** Obtener todos los descuentos */
  async getAllDiscounts(): Promise<Discount[]> {
    // ✅ OPTIMIZADO: Una sola query con agregaciones
    // Trae solo campos esenciales + counts en una consulta
    const { data, error } = await supabase
      .from('discounts')
      .select(`
        id,
        name,
        percentage,
        start_date,
        end_date,
        is_active,
        created_at,
        discount_products(count),
        discount_drops(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    // Mapear contadores desde los joins
    return data.map(d => ({
      ...d,
      product_count: d.discount_products?.[0]?.count || 0,
      drop_count: d.discount_drops?.[0]?.count || 0,
      discount_products: [] as any,
      discount_drops: [] as any,
    })) as Discount[];
  },

  /** Obtener un descuento por ID con sus productos y drops */
  async getDiscountById(id: string): Promise<Discount | null> {
    const { data, error } = await supabase
      .from('discounts')
      .select(`
        *,
        discount_products(
          *,
          product:products(id, name, price, image_url, category)
        ),
        discount_drops(
          *,
          drop:drops(id, name, image_url, status)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /** Crear un nuevo descuento */
  async createDiscount(
    discount: Omit<Discount, 'id' | 'created_at' | 'updated_at' | 'discount_products' | 'discount_drops' | 'product_count' | 'drop_count'>,
    productIds: string[],
    dropIds: string[] = []
  ): Promise<Discount> {
    // Validar fechas
    if (new Date(discount.end_date) <= new Date(discount.start_date)) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    // Validar porcentaje
    if (discount.percentage <= 0 || discount.percentage > 100) {
      throw new Error('El porcentaje debe estar entre 1 y 100');
    }

    // Verificar solapamientos antes de insertar
    if (productIds.length > 0 || dropIds.length > 0) {
      await this.checkOverlaps(productIds, dropIds, discount.start_date, discount.end_date);
    }

    // Insertar descuento
    const { data, error } = await supabase
      .from('discounts')
      .insert({
        name: discount.name,
        percentage: discount.percentage,
        start_date: discount.start_date,
        end_date: discount.end_date,
        is_active: discount.is_active,
      })
      .select()
      .single();

    if (error) throw error;

    // Insertar relaciones con productos
    if (productIds.length > 0) {
      const discountProducts = productIds.map((productId) => ({
        discount_id: data.id,
        product_id: productId,
      }));

      const { error: dpError } = await supabase
        .from('discount_products')
        .insert(discountProducts);

      if (dpError) {
        // Rollback: eliminar el descuento si falla la inserción de productos
        await supabase.from('discounts').delete().eq('id', data.id);
        throw new Error(`Error al asignar productos: ${dpError.message}`);
      }
    }

    // Insertar relaciones con drops
    if (dropIds.length > 0) {
      const discountDrops = dropIds.map((dropId) => ({
        discount_id: data.id,
        drop_id: dropId,
      }));

      const { error: ddError } = await supabase
        .from('discount_drops')
        .insert(discountDrops);

      if (ddError) {
        // Rollback: eliminar el descuento si falla la inserción de drops
        await supabase.from('discounts').delete().eq('id', data.id);
        throw new Error(`Error al asignar drops: ${ddError.message}`);
      }
    }

    return data;
  },

  /** Actualizar un descuento existente */
  async updateDiscount(
    id: string,
    updates: Partial<Omit<Discount, 'id' | 'created_at' | 'updated_at' | 'discount_products' | 'discount_drops' | 'product_count' | 'drop_count'>>,
    productIds?: string[],
    dropIds?: string[]
  ): Promise<Discount> {
    // Validar fechas si se proporcionan ambas
    if (updates.start_date && updates.end_date) {
      if (new Date(updates.end_date) <= new Date(updates.start_date)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
    }

    // Validar porcentaje si se proporciona
    if (updates.percentage !== undefined) {
      if (updates.percentage <= 0 || updates.percentage > 100) {
        throw new Error('El porcentaje debe estar entre 1 y 100');
      }
    }

    // Si se actualizan los productos o drops, verificar solapamientos
    if ((productIds !== undefined && productIds.length > 0) || (dropIds !== undefined && dropIds.length > 0)) {
      const currentDiscount = await this.getDiscountById(id);
      const startDate = updates.start_date || currentDiscount?.start_date || '';
      const endDate = updates.end_date || currentDiscount?.end_date || '';
      await this.checkOverlaps(productIds || [], dropIds || [], startDate, endDate, id);
    }

    // Actualizar descuento
    const { data, error } = await supabase
      .from('discounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Actualizar productos asociados si se proporcionan
    if (productIds !== undefined) {
      // Eliminar relaciones existentes
      const { error: deleteError } = await supabase
        .from('discount_products')
        .delete()
        .eq('discount_id', id);

      if (deleteError) throw deleteError;

      // Insertar nuevas relaciones
      if (productIds.length > 0) {
        const discountProducts = productIds.map((productId) => ({
          discount_id: id,
          product_id: productId,
        }));

        const { error: insertError } = await supabase
          .from('discount_products')
          .insert(discountProducts);

        if (insertError) throw insertError;
      }
    }

    // Actualizar drops asociados si se proporcionan
    if (dropIds !== undefined) {
      // Eliminar relaciones existentes
      const { error: deleteError } = await supabase
        .from('discount_drops')
        .delete()
        .eq('discount_id', id);

      if (deleteError) throw deleteError;

      // Insertar nuevas relaciones
      if (dropIds.length > 0) {
        const discountDrops = dropIds.map((dropId) => ({
          discount_id: id,
          drop_id: dropId,
        }));

        const { error: insertError } = await supabase
          .from('discount_drops')
          .insert(discountDrops);

        if (insertError) throw insertError;
      }
    }

    return data;
  },

  /** Eliminar un descuento */
  async deleteDiscount(id: string): Promise<void> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /** Activar/desactivar un descuento */
  async toggleDiscountActive(id: string): Promise<Discount> {
    const current = await this.getDiscountById(id);
    if (!current) throw new Error('Descuento no encontrado');

    const { data, error } = await supabase
      .from('discounts')
      .update({ is_active: !current.is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =============================================
  // Consultas de descuentos activos
  // =============================================

  /** Obtener productos de un descuento */
  async getDiscountProducts(discountId: string): Promise<DiscountProduct[]> {
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data, error } = await supabase
      .from('discount_products')
      .select(`
        id,
        discount_id,
        product_id,
        created_at,
        product:products(
          id,
          name,
          price,
          category
        )
      `)
      .eq('discount_id', discountId);

    if (error) throw error;
    return data as any || [];
  },

  /** Obtener drops de un descuento */
  async getDiscountDrops(discountId: string): Promise<DiscountDrop[]> {
    // ✅ OPTIMIZADO: Solo campos necesarios
    const { data, error } = await supabase
      .from('discount_drops')
      .select(`
        id,
        discount_id,
        drop_id,
        created_at,
        drop:drops(
          id,
          name,
          status
        )
      `)
      .eq('discount_id', discountId);

    if (error) throw error;
    return data as any || [];
  },

  /** Obtener el descuento activo de un producto específico (directo o por drop) */
  async getActiveDiscountForProduct(productId: string): Promise<{
    discount_id: string;
    discount_name: string;
    percentage: number;
    start_date: string;
    end_date: string;
    source: 'product' | 'drop';
  } | null> {
    const now = new Date().toISOString();

    // Primero buscar descuentos directos al producto
    const { data: productDiscounts, error: productError } = await supabase
      .from('discount_products')
      .select(`
        discount:discounts(id, name, percentage, start_date, end_date, is_active)
      `)
      .eq('product_id', productId);

    if (productError) throw productError;
    
    if (productDiscounts && productDiscounts.length > 0) {
      for (const dp of productDiscounts) {
        const d = dp.discount as any;
        if (d && d.is_active && now >= d.start_date && now <= d.end_date) {
          return {
            discount_id: d.id,
            discount_name: d.name,
            percentage: d.percentage,
            start_date: d.start_date,
            end_date: d.end_date,
            source: 'product',
          };
        }
      }
    }

    // Si no hay descuento directo, buscar por drop
    const { data: product } = await supabase
      .from('products')
      .select('drop_id')
      .eq('id', productId)
      .single();

    if (!product || !product.drop_id) return null;

    const { data: dropDiscounts, error: dropError } = await supabase
      .from('discount_drops')
      .select(`
        discount:discounts(id, name, percentage, start_date, end_date, is_active)
      `)
      .eq('drop_id', product.drop_id);

    if (dropError) throw dropError;

    if (dropDiscounts && dropDiscounts.length > 0) {
      for (const dd of dropDiscounts) {
        const d = dd.discount as any;
        if (d && d.is_active && now >= d.start_date && now <= d.end_date) {
          return {
            discount_id: d.id,
            discount_name: d.name,
            percentage: d.percentage,
            start_date: d.start_date,
            end_date: d.end_date,
            source: 'drop',
          };
        }
      }
    }

    return null;
  },

  /** Obtener todos los descuentos activos con sus productos y drops (para mostrar en UI) */
  /** VERSIÓN SIMPLIFICADA: Usa la vista de Supabase que ya tiene todo calculado */
  async getActiveDiscountsMap(): Promise<Map<string, {
    discount_id: string;
    discount_name: string;
    percentage: number;
    discounted_price?: number;
    start_date: string;
    end_date: string;
    source: 'product' | 'drop';
  }>> {
    const map = new Map();

    console.log('🔍 [DiscountService] Usando vista products_with_active_discount...');

    // Usar la vista que ya tiene todo calculado
    const { data, error } = await supabase
      .from('products_with_active_discount')
      .select('*');

    if (error) {
      console.error('❌ Error consultando vista de descuentos:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ La vista no retornó productos con descuento');
      return map;
    }

    console.log(`✅ Productos con descuento encontrados: ${data.length}`);

    // Mapear resultados
    for (const row of data) {
      map.set(row.product_id, {
        discount_id: row.discount_id,
        discount_name: row.discount_name,
        percentage: row.percentage,
        discounted_price: row.discounted_price,
        start_date: row.start_date,
        end_date: row.end_date,
        source: row.discount_source as 'product' | 'drop',
      });
    }

    console.log(`📊 Map final: ${map.size} productos con descuento`);
    return map;
  },

  // =============================================
  // Validaciones
  // =============================================

  /** Verificar si hay solapamiento de descuentos para los productos y drops dados */
  async checkOverlaps(
    productIds: string[],
    dropIds: string[],
    startDate: string,
    endDate: string,
    excludeDiscountId?: string
  ): Promise<void> {
    // Validar productos individuales
    for (const productId of productIds) {
      // Verificar descuentos directos al producto
      let query = supabase
        .from('discount_products')
        .select(`
          discount_id,
          product:products(name),
          discount:discounts(id, name, start_date, end_date, is_active)
        `)
        .eq('product_id', productId);

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        for (const dp of data) {
          const d = dp.discount as any;
          if (!d || !d.is_active) continue;
          if (excludeDiscountId && d.id === excludeDiscountId) continue;

          const overlaps =
            new Date(startDate) < new Date(d.end_date) &&
            new Date(d.start_date) < new Date(endDate);

          if (overlaps) {
            const productName = (dp.product as any)?.name || productId;
            throw new Error(
              `El producto "${productName}" ya tiene el descuento "${d.name}" activo en un periodo que se solapa (${new Date(d.start_date).toLocaleDateString()} - ${new Date(d.end_date).toLocaleDateString()})`
            );
          }
        }
      }

      // Verificar descuentos por drop
      const { data: product } = await supabase
        .from('products')
        .select('drop_id, name')
        .eq('id', productId)
        .single();

      if (product && product.drop_id) {
        const { data: dropDiscounts } = await supabase
          .from('discount_drops')
          .select(`
            discount:discounts(id, name, start_date, end_date, is_active)
          `)
          .eq('drop_id', product.drop_id);

        if (dropDiscounts) {
          for (const dd of dropDiscounts) {
            const d = dd.discount as any;
            if (!d || !d.is_active) continue;
            if (excludeDiscountId && d.id === excludeDiscountId) continue;

            const overlaps =
              new Date(startDate) < new Date(d.end_date) &&
              new Date(d.start_date) < new Date(endDate);

            if (overlaps) {
              throw new Error(
                `El producto "${product.name}" ya tiene un descuento activo a través de su drop en un periodo que se solapa (${new Date(d.start_date).toLocaleDateString()} - ${new Date(d.end_date).toLocaleDateString()})`
              );
            }
          }
        }
      }
    }

    // Validar drops
    for (const dropId of dropIds) {
      // Obtener información del drop
      const { data: drop } = await supabase
        .from('drops')
        .select('name')
        .eq('id', dropId)
        .single();

      const dropName = drop?.name || dropId;

      // Verificar si el drop ya está en otro descuento
      const { data: existingDropDiscounts } = await supabase
        .from('discount_drops')
        .select(`
          discount:discounts(id, name, start_date, end_date, is_active)
        `)
        .eq('drop_id', dropId);

      if (existingDropDiscounts) {
        for (const dd of existingDropDiscounts) {
          const d = dd.discount as any;
          if (!d || !d.is_active) continue;
          if (excludeDiscountId && d.id === excludeDiscountId) continue;

          const overlaps =
            new Date(startDate) < new Date(d.end_date) &&
            new Date(d.start_date) < new Date(endDate);

          if (overlaps) {
            throw new Error(
              `El drop "${dropName}" ya tiene el descuento "${d.name}" activo en un periodo que se solapa (${new Date(d.start_date).toLocaleDateString()} - ${new Date(d.end_date).toLocaleDateString()})`
            );
          }
        }
      }

      // Verificar si algún producto del drop tiene descuento directo
      const { data: dropProducts } = await supabase
        .from('products')
        .select('id, name')
        .eq('drop_id', dropId);

      if (dropProducts) {
        for (const product of dropProducts) {
          const { data: productDiscounts } = await supabase
            .from('discount_products')
            .select(`
              discount:discounts(id, name, start_date, end_date, is_active)
            `)
            .eq('product_id', product.id);

          if (productDiscounts) {
            for (const dp of productDiscounts) {
              const d = dp.discount as any;
              if (!d || !d.is_active) continue;
              if (excludeDiscountId && d.id === excludeDiscountId) continue;

              const overlaps =
                new Date(startDate) < new Date(d.end_date) &&
                new Date(d.start_date) < new Date(endDate);

              if (overlaps) {
                throw new Error(
                  `El producto "${product.name}" del drop "${dropName}" ya tiene un descuento directo "${d.name}" que se solapa (${new Date(d.start_date).toLocaleDateString()} - ${new Date(d.end_date).toLocaleDateString()})`
                );
              }
            }
          }
        }
      }
    }
  },

  // =============================================
  // Helpers
  // =============================================

  /** Determinar el estado de un descuento */
  getDiscountStatus(discount: Discount): DiscountStatus {
    const now = new Date();
    const start = new Date(discount.start_date);
    const end = new Date(discount.end_date);

    if (!discount.is_active) return 'expired';
    if (now < start) return 'scheduled';
    if (now > end) return 'expired';
    return 'active';
  },

  /** Calcular precio con descuento */
  calculateDiscountedPrice(originalPrice: number, percentage: number): number {
    return Math.round((originalPrice - (originalPrice * percentage / 100)) * 100) / 100;
  },
};
