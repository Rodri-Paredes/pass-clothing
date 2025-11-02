import { supabase } from '../lib/supabase';
import type { Drop, DropProduct, DropWithProducts, DropStats } from '../lib/types';
import { queryCache, cacheKeys, CACHE_TTL } from '../lib/queryCache';

export const dropsService = {
  // Obtener todos los drops con product_count optimizado
  async getAllDrops(): Promise<Drop[]> {
    return queryCache.withCache(
      cacheKeys.drops(),
      async () => {
        // Primero obtenemos todos los drops
        const { data: drops, error } = await supabase
          .from('drops')
          .select('*')
          .order('launch_date', { ascending: false });

        if (error) throw error;
        if (!drops) return [];

        // Obtener todos los counts en una sola query usando group by
        const { data: counts, error: countsError } = await supabase
          .from('drop_products')
          .select('drop_id')
          .in('drop_id', drops.map(d => d.id));

        if (countsError) throw countsError;

        // Crear un mapa de counts
        const countMap = new Map<string, number>();
        counts?.forEach(item => {
          countMap.set(item.drop_id, (countMap.get(item.drop_id) || 0) + 1);
        });

        // Asignar los counts a los drops
        return drops.map(drop => ({
          ...drop,
          product_count: countMap.get(drop.id) || 0
        }));
      },
      CACHE_TTL.MEDIUM
    );
  },

  // Obtener drops activos con caché
  async getActiveDrops(): Promise<Drop[]> {
    return queryCache.withCache(
      cacheKeys.dropsActive(),
      async () => {
        const { data: drops, error } = await supabase
          .from('drops')
          .select('*')
          .eq('status', 'ACTIVO')
          .order('is_featured', { ascending: false })
          .order('launch_date', { ascending: false });

        if (error) throw error;
        if (!drops) return [];
        
        // Optimización: obtener todos los counts en batch
        const { data: counts, error: countsError } = await supabase
          .from('drop_products')
          .select('drop_id')
          .in('drop_id', drops.map(d => d.id));

        if (countsError) throw countsError;

        const countMap = new Map<string, number>();
        counts?.forEach(item => {
          countMap.set(item.drop_id, (countMap.get(item.drop_id) || 0) + 1);
        });

        return drops.map(drop => ({
          ...drop,
          product_count: countMap.get(drop.id) || 0
        }));
      },
      CACHE_TTL.SHORT // 1 minuto, ya que los drops activos pueden cambiar
    );
  },

  // Obtener drops destacados con caché
  async getFeaturedDrops(): Promise<Drop[]> {
    return queryCache.withCache(
      cacheKeys.dropsFeatured(),
      async () => {
        const { data: drops, error } = await supabase
          .from('drops')
          .select('*')
          .eq('status', 'ACTIVO')
          .eq('is_featured', true)
          .order('launch_date', { ascending: false });

        if (error) throw error;
        if (!drops) return [];
        
        // Optimización: obtener todos los counts en batch
        const { data: counts, error: countsError } = await supabase
          .from('drop_products')
          .select('drop_id')
          .in('drop_id', drops.map(d => d.id));

        if (countsError) throw countsError;

        const countMap = new Map<string, number>();
        counts?.forEach(item => {
          countMap.set(item.drop_id, (countMap.get(item.drop_id) || 0) + 1);
        });

        return drops.map(drop => ({
          ...drop,
          product_count: countMap.get(drop.id) || 0
        }));
      },
      CACHE_TTL.SHORT
    );
  },

  // Obtener un drop por ID con caché
  async getDropById(id: string): Promise<Drop | null> {
    return queryCache.withCache(
      cacheKeys.drop(id),
      async () => {
        const { data, error } = await supabase
          .from('drops')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        return data;
      },
      CACHE_TTL.MEDIUM
    );
  },

  // Obtener productos de un drop específico
  async getDropProducts(dropId: string): Promise<DropProduct[]> {
    const { data, error } = await supabase
      .from('drop_products')
      .select(`
        *,
        product:products(*)
      `)
      .eq('drop_id', dropId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Obtener drop con sus productos con caché
  async getDropWithProducts(dropId: string): Promise<DropWithProducts | null> {
    return queryCache.withCache(
      cacheKeys.dropWithProducts(dropId),
      async () => {
        const { data: drop, error: dropError } = await supabase
          .from('drops')
          .select('*')
          .eq('id', dropId)
          .single();

        if (dropError) throw dropError;
        if (!drop) return null;

        const { data: products, error: productsError } = await supabase
          .from('drop_products')
          .select(`
            *,
            product:products(
              *,
              variants:product_variants(*)
            )
          `)
          .eq('drop_id', dropId)
          .order('sort_order', { ascending: true });

        if (productsError) throw productsError;

        return {
          ...drop,
          products: products?.map(dp => dp.product).filter(Boolean) || [],
          product_count: products?.length || 0
        };
      },
      CACHE_TTL.MEDIUM
    );
  },

  // Crear un nuevo drop
  async createDrop(drop: Omit<Drop, 'id' | 'created_at' | 'updated_at'>): Promise<Drop> {
    const { data, error } = await supabase
      .from('drops')
      .insert(drop)
      .select()
      .single();

    if (error) throw error;
    
    // Invalidar cachés relacionados
    queryCache.invalidatePattern('drops:');
    
    return data;
  },

  // Actualizar un drop
  async updateDrop(id: string, updates: Partial<Drop>): Promise<Drop> {
    const { data, error } = await supabase
      .from('drops')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    // Invalidar cachés relacionados
    queryCache.invalidate(cacheKeys.drop(id));
    queryCache.invalidate(cacheKeys.dropWithProducts(id));
    queryCache.invalidatePattern('drops:');
    
    return data;
  },

  // Eliminar un drop
  async deleteDrop(id: string): Promise<void> {
    const { error } = await supabase
      .from('drops')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    // Invalidar cachés relacionados
    queryCache.invalidate(cacheKeys.drop(id));
    queryCache.invalidate(cacheKeys.dropWithProducts(id));
    queryCache.invalidatePattern('drops:');
  },

  // Agregar producto a un drop
  async addProductToDrop(dropId: string, productId: string, options?: {
    is_featured?: boolean;
    sort_order?: number;
  }): Promise<DropProduct> {
    const { data, error } = await supabase
      .from('drop_products')
      .insert({
        drop_id: dropId,
        product_id: productId,
        is_featured: options?.is_featured || false,
        sort_order: options?.sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;
    
    // Invalidar cachés relacionados
    queryCache.invalidate(cacheKeys.dropWithProducts(dropId));
    queryCache.invalidatePattern('drops:');
    
    return data;
  },

  // Remover producto de un drop
  async removeProductFromDrop(dropId: string, productId: string): Promise<void> {
    const { error } = await supabase
      .from('drop_products')
      .delete()
      .eq('drop_id', dropId)
      .eq('product_id', productId);

    if (error) throw error;
    
    // Invalidar cachés relacionados
    queryCache.invalidate(cacheKeys.dropWithProducts(dropId));
    queryCache.invalidatePattern('drops:');
  },

  // Actualizar producto en drop
  async updateProductInDrop(dropId: string, productId: string, updates: {
    is_featured?: boolean;
    sort_order?: number;
  }): Promise<DropProduct> {
    const { data, error } = await supabase
      .from('drop_products')
      .update(updates)
      .eq('drop_id', dropId)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Obtener estadísticas de drops
  async getDropStats(): Promise<DropStats> {
    const [
      { count: totalDrops },
      { count: activeDrops },
      { count: featuredDrops },
      { count: upcomingDrops },
      { count: totalProductsInDrops }
    ] = await Promise.all([
      supabase.from('drops').select('*', { count: 'exact', head: true }),
      supabase.from('drops').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVO'),
      supabase.from('drops').select('*', { count: 'exact', head: true }).eq('is_featured', true),
      supabase.from('drops').select('*', { count: 'exact', head: true }).eq('status', 'INACTIVO').gt('launch_date', new Date().toISOString()),
      supabase.from('drop_products').select('*', { count: 'exact', head: true })
    ]);

    return {
      total_drops: totalDrops || 0,
      active_drops: activeDrops || 0,
      featured_drops: featuredDrops || 0,
      total_products_in_drops: totalProductsInDrops || 0,
      upcoming_drops: upcomingDrops || 0
    };
  },

  // Buscar drops por nombre o descripción
  async searchDrops(query: string): Promise<Drop[]> {
    const { data, error } = await supabase
      .from('drops')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('launch_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Obtener productos destacados de todos los drops
  async getFeaturedProductsFromDrops(): Promise<DropProduct[]> {
    const { data, error } = await supabase
      .from('drop_products')
      .select(`
        *,
        product:products(
          *,
          variants:product_variants(*)
        ),
        drop:drops(*)
      `)
      .eq('is_featured', true)
      .eq('drop.status', 'ACTIVO')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Actualizar estado de drops basado en fechas
  async updateDropStatuses(): Promise<void> {
    const { error } = await supabase.rpc('update_drop_status');
    if (error) throw error;
  },

  // Obtener drops próximos a lanzar
  async getUpcomingDrops(): Promise<Drop[]> {
    const { data, error } = await supabase
      .from('drops')
      .select('*')
      .eq('status', 'INACTIVO')
      .gt('launch_date', new Date().toISOString())
      .order('launch_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Obtener drops finalizados
  async getFinishedDrops(): Promise<Drop[]> {
    const { data, error } = await supabase
      .from('drops')
      .select('*')
      .eq('status', 'FINALIZADO')
      .order('end_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

