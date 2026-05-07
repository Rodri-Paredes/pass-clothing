/**
 * 📦 CacheManager
 * Sistema simple de caché basado en localStorage con TTL (Time To Live)
 * 
 * Uso:
 * ```typescript
 * // Guardar en caché
 * CacheManager.set('products', productsData, 5); // 5 minutos
 * 
 * // Obtener de caché
 * const cachedProducts = CacheManager.get<Product[]>('products');
 * if (cachedProducts) {
 *   return cachedProducts; // Usar caché
 * }
 * // Si no hay caché, consultar DB...
 * ```
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live en milisegundos
}

export class CacheManager {
  private static readonly PREFIX = 'outsiders_cache_';

  /**
   * Obtiene la clave completa con el prefijo
   */
  private static getCacheKey(key: string): string {
    return `${this.PREFIX}${key}`;
  }

  /**
   * Guarda datos en caché con un tiempo de expiración
   * @param key - Identificador único del caché
   * @param data - Datos a guardar
   * @param ttlMinutes - Tiempo de vida en minutos (default: 5)
   */
  static set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000, // Convertir a milisegundos
      };

      localStorage.setItem(this.getCacheKey(key), JSON.stringify(item));
      console.log(`📦 [Cache] Guardado: ${key} (TTL: ${ttlMinutes}min)`);
    } catch (error) {
      console.warn('⚠️ [Cache] Error guardando en localStorage:', error);
      // Si el localStorage está lleno, limpiar caché antiguo
      this.clearExpired();
    }
  }

  /**
   * Obtiene datos desde caché si no han expirado
   * @param key - Identificador único del caché
   * @returns Los datos si existen y no han expirado, null en caso contrario
   */
  static get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(this.getCacheKey(key));
      if (!cached) {
        console.log(`📭 [Cache] No encontrado: ${key}`);
        return null;
      }

      const item: CacheItem<T> = JSON.parse(cached);
      const isExpired = Date.now() - item.timestamp > item.ttl;

      if (isExpired) {
        console.log(`⏰ [Cache] Expirado: ${key}`);
        this.clear(key);
        return null;
      }

      const remainingMinutes = Math.ceil((item.ttl - (Date.now() - item.timestamp)) / 60000);
      console.log(`✅ [Cache] Hit: ${key} (expira en ${remainingMinutes}min)`);
      return item.data;
    } catch (error) {
      console.warn('⚠️ [Cache] Error leyendo de localStorage:', error);
      this.clear(key); // Limpiar caché corrupto
      return null;
    }
  }

  /**
   * Verifica si existe un caché válido (no expirado) para una clave
   * @param key - Identificador único del caché
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Elimina un elemento específico del caché
   * @param key - Identificador único del caché
   */
  static clear(key: string): void {
    localStorage.removeItem(this.getCacheKey(key));
    console.log(`🗑️ [Cache] Eliminado: ${key}`);
  }

  /**
   * Elimina TODOS los elementos del caché de la aplicación
   */
  static clearAll(): void {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(this.PREFIX)
    );

    keys.forEach((k) => localStorage.removeItem(k));
    console.log(`🗑️ [Cache] Limpiado todo el caché (${keys.length} items)`);
  }

  /**
   * Elimina solo los elementos de caché que han expirado
   */
  static clearExpired(): void {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(this.PREFIX)
    );

    let cleared = 0;
    keys.forEach((fullKey) => {
      try {
        const item = localStorage.getItem(fullKey);
        if (!item) return;

        const parsed: CacheItem<any> = JSON.parse(item);
        const isExpired = Date.now() - parsed.timestamp > parsed.ttl;

        if (isExpired) {
          localStorage.removeItem(fullKey);
          cleared++;
        }
      } catch (error) {
        // Si hay error parseando, eliminar el item corrupto
        localStorage.removeItem(fullKey);
        cleared++;
      }
    });

    if (cleared > 0) {
      console.log(`🗑️ [Cache] Limpiados ${cleared} items expirados`);
    }
  }

  /**
   * Obtiene estadísticas del caché actual
   */
  static getStats(): {
    totalItems: number;
    totalSize: number; // en bytes
    items: Array<{ key: string; size: number; expiresIn: number }>;
  } {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(this.PREFIX)
    );

    let totalSize = 0;
    const items = keys.map((fullKey) => {
      const item = localStorage.getItem(fullKey);
      const size = new Blob([item || '']).size;
      totalSize += size;

      try {
        const parsed: CacheItem<any> = JSON.parse(item || '{}');
        const expiresIn = Math.max(
          0,
          parsed.ttl - (Date.now() - parsed.timestamp)
        );

        return {
          key: fullKey.replace(this.PREFIX, ''),
          size,
          expiresIn: Math.ceil(expiresIn / 60000), // minutos
        };
      } catch {
        return {
          key: fullKey.replace(this.PREFIX, ''),
          size,
          expiresIn: 0,
        };
      }
    });

    return {
      totalItems: keys.length,
      totalSize,
      items,
    };
  }

  /**
   * Wrapper para hacer cacheable cualquier función asíncrona
   * @param key - Clave de caché
   * @param fetcher - Función que obtiene los datos
   * @param ttlMinutes - Tiempo de vida en minutos
   */
  static async cacheable<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMinutes: number = 5
  ): Promise<T> {
    // 1. Intentar obtener de caché
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Si no hay caché, ejecutar fetcher
    console.log(`🌐 [Cache] Miss: ${key}, consultando...`);
    const data = await fetcher();

    // 3. Guardar en caché
    this.set(key, data, ttlMinutes);

    return data;
  }
}

// ====================================
// HOOKS HELPERS (opcional)
// ====================================

/**
 * Hook wrapper para usar CacheManager en componentes React
 * Nota: Este es solo un helper, aún necesitas React Query para gestión de estado completa
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMinutes: number = 5
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await CacheManager.cacheable(key, fetcher, ttlMinutes);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [key]);

  return { data, loading, error };
}

// Importar React solo si estás usando el hook
import * as React from 'react';

// ====================================
// EJEMPLO DE USO
// ====================================

/*
// En tus servicios:
export class ProductService {
  async getProducts(includeHidden: boolean = false): Promise<Product[]> {
    return CacheManager.cacheable(
      `products_${includeHidden}`,
      async () => {
        const { data, error } = await supabase
          .from('products')
          .select('...')
          .eq('is_visible', !includeHidden);
        
        if (error) throw error;
        return data || [];
      },
      5 // 5 minutos de caché
    );
  }
}

// En componentes:
const products = await productService.getProducts();
// Primera llamada: consulta Supabase + guarda en caché
// Siguientes llamadas (dentro de 5 min): devuelve desde caché ⚡

// Limpiar caché cuando se crea/edita un producto:
CacheManager.clear('products_false');
CacheManager.clear('products_true');

// Ver estadísticas de caché:
console.table(CacheManager.getStats().items);
*/
