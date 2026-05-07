/**
 * Componentes React optimizados con React.memo
 * Reduce re-renders innecesarios en listas grandes
 */

import { memo } from 'react';
import CachedImage from '../../components/ui/CachedImage';
import type { Product } from '../../lib/types';

// ============================================
// PRODUCT CARD - Optimizado con React.memo
// ============================================

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  onToggleVisibility?: (productId: string, isVisible: boolean) => void;
  onPrefetch?: (productId: string) => void;
}

/**
 * Card de producto optimizado
 * Solo se re-renderiza si las props cambian
 */
export const ProductCard = memo(function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggleVisibility,
  onPrefetch,
}: ProductCardProps) {
  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
      onMouseEnter={() => onPrefetch?.(product.id)}
    >
      {/* Badge de estado */}
      {!product.is_visible && (
        <div className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs z-10">
          🔒 Oculto
        </div>
      )}

      {/* Imagen con lazy loading y caché */}
      <div className="relative h-48 bg-gray-100">
        {product.image_url ? (
          <CachedImage
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Sin imagen
          </div>
        )}
      </div>

      {/* Información del producto */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 truncate">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-blue-600">
            Bs. {product.price.toFixed(2)}
          </span>
          
          {product.category && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {product.category}
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 mt-4">
          {onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(product.id, !product.is_visible)}
              className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              aria-label={product.is_visible ? 'Ocultar' : 'Mostrar'}
            >
              {product.is_visible ? '🙈 Ocultar' : '👁️ Mostrar'}
            </button>
          )}
          
          {onEdit && (
            <button
              onClick={() => onEdit(product)}
              className="flex-1 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 rounded transition-colors"
            >
              ✏️ Editar
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={() => onDelete(product.id)}
              className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 rounded transition-colors"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparación personalizada para optimizar re-renders
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.is_visible === nextProps.product.is_visible &&
    prevProps.product.image_url === nextProps.product.image_url
  );
});

// ============================================
// PRODUCT GRID - Optimizado
// ============================================

interface ProductGridProps {
  products: Product[];
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  onToggleVisibility?: (productId: string, isVisible: boolean) => void;
  onPrefetch?: (productId: string) => void;
  isLoading?: boolean;
}

/**
 * Grid de productos optimizado
 */
export const ProductGrid = memo(function ProductGrid({
  products,
  onEdit,
  onDelete,
  onToggleVisibility,
  onPrefetch,
  isLoading,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No hay productos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleVisibility={onToggleVisibility}
          onPrefetch={onPrefetch}
        />
      ))}
    </div>
  );
});

// ============================================
// SKELETON LOADER
// ============================================

const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-4">
        <div className="h-6 bg-gray-200 rounded mb-2" />
        <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="flex gap-2 mt-4">
          <div className="flex-1 h-10 bg-gray-200 rounded" />
          <div className="flex-1 h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
});
