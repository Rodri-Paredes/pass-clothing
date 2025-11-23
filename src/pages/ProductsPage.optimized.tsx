/**
 * ProductsPage optimizado con React Query e Infinite Scroll
 * Implementa todas las mejores prácticas de performance
 */

import { useState, useCallback, useMemo } from 'react';
import { useInfiniteProducts, usePrefetchProduct, useToggleProductVisibility } from '../hooks/useProducts';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { ProductGrid } from '../components/products/ProductCard.optimized';

export default function ProductsPageOptimized() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);

  // React Query para datos con caché
  const productsQuery = useInfiniteProducts({
    search: searchTerm,
    category: selectedCategory || undefined,
    includeHidden: showHidden,
  });

  // Infinite scroll automático
  const { ref: sentinelRef, isFetchingNextPage } = useInfiniteScroll(productsQuery);

  // Prefetch de producto al hacer hover
  const prefetchProduct = usePrefetchProduct();

  // Toggle visibility con optimistic update
  const toggleVisibility = useToggleProductVisibility();

  // Combinar todas las páginas en un array plano (memoizado)
  const products = useMemo(() => {
    return productsQuery.data?.pages.flatMap(page => page.items) ?? [];
  }, [productsQuery.data]);

  // Handlers optimizados con useCallback
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  }, []);

  const handleToggleVisibility = useCallback((productId: string, isVisible: boolean) => {
    toggleVisibility.mutate({ id: productId, isVisible });
  }, [toggleVisibility]);

  const handlePrefetch = useCallback((productId: string) => {
    prefetchProduct(productId);
  }, [prefetchProduct]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Productos</h1>
        <p className="text-gray-600">
          Gestiona el catálogo de productos de tu tienda
        </p>
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Búsqueda */}
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Buscar productos..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filtro de categoría */}
        <select
          value={selectedCategory}
          onChange={handleCategoryChange}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          <option value="Poleras">Poleras</option>
          <option value="Hoodies">Hoodies</option>
          <option value="Pantalones">Pantalones</option>
          <option value="Accesorios">Accesorios</option>
        </select>

        {/* Toggle productos ocultos */}
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Mostrar ocultos</span>
        </label>
      </div>

      {/* Estado de carga inicial */}
      {productsQuery.isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Cargando productos...</p>
        </div>
      )}

      {/* Error */}
      {productsQuery.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">
            ❌ Error al cargar productos: {productsQuery.error.message}
          </p>
        </div>
      )}

      {/* Grid de productos */}
      {!productsQuery.isLoading && (
        <>
          <ProductGrid
            products={products}
            onToggleVisibility={handleToggleVisibility}
            onPrefetch={handlePrefetch}
          />

          {/* Sentinel para infinite scroll */}
          <div ref={sentinelRef} className="py-8 text-center">
            {isFetchingNextPage && (
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            )}
            {!productsQuery.hasNextPage && products.length > 0 && (
              <p className="text-gray-500">No hay más productos</p>
            )}
          </div>
        </>
      )}

      {/* Estadísticas */}
      <div className="mt-8 text-center text-sm text-gray-500">
        {products.length > 0 && (
          <p>
            Mostrando {products.length} producto{products.length !== 1 ? 's' : ''}
            {productsQuery.hasNextPage && ' (scroll para cargar más)'}
          </p>
        )}
      </div>
    </div>
  );
}
