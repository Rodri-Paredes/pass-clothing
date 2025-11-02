/**
 * Sistema de caché simple para reducir llamadas duplicadas a la API
 * Implementa una estrategia de caché con TTL (Time To Live)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // en milisegundos
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto

  /**
   * Obtiene datos del caché si son válidos
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ [Cache HIT] ${key}`);
    return entry.data as T;
  }

  /**
   * Guarda datos en el caché
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
    console.log(`💾 [Cache SET] ${key} (TTL: ${(ttl || this.defaultTTL) / 1000}s)`);
  }

  /**
   * Invalida una entrada específica del caché
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ [Cache INVALIDATE] ${key}`);
    }
  }

  /**
   * Invalida todas las entradas que coincidan con un patrón
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`🗑️ [Cache INVALIDATE PATTERN] ${pattern} (${count} entries)`);
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 [Cache CLEAR] ${size} entries removed`);
  }

  /**
   * Obtiene el tamaño actual del caché
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Limpia entradas expiradas del caché
   */
  cleanup(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl;
      if (isExpired) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      console.log(`🧹 [Cache CLEANUP] ${count} expired entries removed`);
    }
  }

  /**
   * Wrapper para ejecutar una función con caché
   */
  async withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Intentar obtener del caché
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Si no está en caché, ejecutar el fetcher
    console.log(`❌ [Cache MISS] ${key} - Fetching...`);
    const data = await fetcher();
    
    // Guardar en caché
    this.set(key, data, ttl);
    
    return data;
  }
}

// Instancia singleton del caché
export const queryCache = new QueryCache();

// Ejecutar limpieza automática cada 10 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    queryCache.cleanup();
  }, 10 * 60 * 1000);
}

// Constantes para TTL específicos
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minuto
  MEDIUM: 5 * 60 * 1000,     // 5 minutos
  LONG: 15 * 60 * 1000,      // 15 minutos
  VERY_LONG: 60 * 60 * 1000, // 1 hora
  SESSION: Infinity          // Hasta que se invalide manualmente
} as const;

// Funciones helper para generar keys consistentes
export const cacheKeys = {
  // Productos
  products: (includeHidden?: boolean) => 
    `products:all:${includeHidden ? 'with-hidden' : 'visible'}`,
  productsPaginated: (page: number, limit: number, search?: string, category?: string, includeHidden?: boolean) =>
    `products:paginated:${page}:${limit}:${search || ''}:${category || ''}:${includeHidden ? 'with-hidden' : 'visible'}`,
  product: (id: string) => 
    `product:${id}`,
  productStock: (variantId: string) => 
    `product-stock:${variantId}`,
  stockByBranch: (branchId: string) => 
    `stock:branch:${branchId}`,

  // Drops
  drops: () => 
    `drops:all`,
  dropsActive: () => 
    `drops:active`,
  dropsFeatured: () => 
    `drops:featured`,
  dropsStats: () => 
    `drops:stats`,
  drop: (id: string) => 
    `drop:${id}`,
  dropWithProducts: (id: string) => 
    `drop:${id}:with-products`,

  // Dashboard
  dashboardStats: (branchId: string) => 
    `dashboard:stats:${branchId}`,
  monthlyRevenue: (branchId: string, year: number, month: number) =>
    `revenue:monthly:${branchId}:${year}:${month}`,
  previousMonthRevenue: (branchId: string) =>
    `revenue:previous-month:${branchId}`,
  monthlyComparison: (branchId: string) =>
    `revenue:comparison:${branchId}`,
  dateRangeRevenue: (branchId: string, startDate: string, endDate: string) =>
    `revenue:range:${branchId}:${startDate}:${endDate}`,

  // Ventas
  sales: (branchId: string) => 
    `sales:branch:${branchId}`,
  salesWithDiscounts: (branchId: string, date: string) =>
    `sales:discounts:${branchId}:${date}`,
  mixedPayments: (branchId: string, date: string) =>
    `sales:mixed-payments:${branchId}:${date}`,

  // Usuarios
  users: () => 
    `users:all`,
  user: (id: string) => 
    `user:${id}`,

  // Branches
  branches: () => 
    `branches:all`,
  branch: (id: string) => 
    `branch:${id}`,
};
