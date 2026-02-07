import React, { useEffect, useState, useMemo } from 'react';
import { Plus, X, Search, Star, Package, Grid } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { dropsService } from '../../services/dropsService';
import { useProductStore } from '../../store/productStore';
import type { DropProduct } from '../../lib/types';

interface DropProductManagerProps {
  dropId: string;
  dropName: string;
  onClose?: () => void;
}

export const DropProductManager: React.FC<DropProductManagerProps> = ({
  dropId,
  dropName,
  onClose
}) => {
  const { products, loadProducts } = useProductStore();
  const [dropProducts, setDropProducts] = useState<DropProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchAvailable, setSearchAvailable] = useState('');
  const [searchInDrop, setSearchInDrop] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Cargar productos del drop
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await loadProducts(true);
        const dpProducts = await dropsService.getDropProducts(dropId);
        setDropProducts(dpProducts);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [dropId, loadProducts]);

  // Productos disponibles (que no están en el drop)
  const availableProducts = useMemo(() => {
    const dropProductIds = new Set(dropProducts.map(dp => dp.product_id));
    return products.filter(p => !dropProductIds.has(p.id));
  }, [products, dropProducts]);

  // Filtrar productos disponibles
  const filteredAvailableProducts = useMemo(() => {
    if (!searchAvailable.trim()) return availableProducts;
    const term = searchAvailable.toLowerCase();
    return availableProducts.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  }, [availableProducts, searchAvailable]);

  // Filtrar productos en el drop
  const filteredDropProducts = useMemo(() => {
    if (!searchInDrop.trim()) return dropProducts;
    const term = searchInDrop.toLowerCase();
    return dropProducts.filter(dp => 
      dp.product?.name.toLowerCase().includes(term) ||
      dp.product?.category.toLowerCase().includes(term)
    );
  }, [dropProducts, searchInDrop]);

  // Agregar producto al drop
  const handleAddProduct = async (productId: string) => {
    try {
      setIsSaving(true);
      await dropsService.addProductToDrop(dropId, productId, {
        is_featured: false,
        sort_order: dropProducts.length
      });
      
      // Recargar productos del drop
      const updated = await dropsService.getDropProducts(dropId);
      setDropProducts(updated);
    } catch (error: any) {
      console.error('Error adding product:', error);
      if (error.message?.includes('duplicate key')) {
        alert('Este producto ya está en el drop');
      } else {
        alert('Error al agregar producto al drop');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Remover producto del drop
  const handleRemoveProduct = async (productId: string) => {
    try {
      setIsSaving(true);
      await dropsService.removeProductFromDrop(dropId, productId);
      
      // Actualizar estado local
      setDropProducts(prev => prev.filter(dp => dp.product_id !== productId));
    } catch (error) {
      console.error('Error removing product:', error);
      alert('Error al remover producto del drop');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle featured
  const handleToggleFeatured = async (dropProductId: string, productId: string, currentFeatured: boolean) => {
    try {
      setIsSaving(true);
      await dropsService.updateProductInDrop(dropId, productId, {
        is_featured: !currentFeatured
      });
      
      // Actualizar estado local
      setDropProducts(prev => prev.map(dp => 
        dp.id === dropProductId 
          ? { ...dp, is_featured: !currentFeatured }
          : dp
      ));
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error al actualizar producto');
    } finally {
      setIsSaving(false);
    }
  };

  // Actualizar orden
  const handleUpdateOrder = async (dropProductId: string, productId: string, newOrder: number) => {
    try {
      setIsSaving(true);
      await dropsService.updateProductInDrop(dropId, productId, {
        sort_order: newOrder
      });
      
      // Actualizar estado local
      setDropProducts(prev => prev.map(dp => 
        dp.id === dropProductId 
          ? { ...dp, sort_order: newOrder }
          : dp
      ));
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Error al actualizar orden');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Gestionar Productos
          </h3>
          <p className="text-sm text-gray-600">
            Drop: <span className="font-medium text-gray-900">{dropName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {dropProducts.length} producto{dropProducts.length !== 1 ? 's' : ''} en el drop
          </span>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: Productos disponibles */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Grid className="h-4 w-4" />
                Productos Disponibles
              </h4>
              <span className="text-xs text-gray-500">
                {filteredAvailableProducts.length} disponible{filteredAvailableProducts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Lista de productos */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAvailableProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchAvailable ? 'No se encontraron productos' : 'Todos los productos están en el drop'}
                </div>
              ) : (
                filteredAvailableProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {product.image_url ? (
                      <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.category} • ${product.price.toFixed(2)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddProduct(product.id)}
                      disabled={isSaving}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Columna derecha: Productos en el drop */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                En el Drop
              </h4>
              <span className="text-xs text-gray-500">
                {filteredDropProducts.length} producto{filteredDropProducts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar en el drop..."
                value={searchInDrop}
                onChange={(e) => setSearchInDrop(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Lista de productos */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredDropProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchInDrop ? 'No se encontraron productos' : 'No hay productos en este drop'}
                </div>
              ) : (
                filteredDropProducts
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((dropProduct) => {
                    const product = dropProduct.product;
                    if (!product) return null;

                    return (
                      <div
                        key={dropProduct.id}
                        className="flex items-center gap-3 p-2 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        {product.image_url ? (
                          <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </p>
                            {dropProduct.is_featured && (
                              <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {product.category} • ${product.price.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <label className="text-xs text-gray-600">Orden:</label>
                            <input
                              type="number"
                              value={dropProduct.sort_order}
                              onChange={(e) => handleUpdateOrder(dropProduct.id, product.id, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              disabled={isSaving}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleFeatured(dropProduct.id, product.id, dropProduct.is_featured)}
                            disabled={isSaving}
                            className={dropProduct.is_featured ? 'text-yellow-600' : 'text-gray-400'}
                            title={dropProduct.is_featured ? 'Quitar destacado' : 'Marcar como destacado'}
                          >
                            <Star className={`h-4 w-4 ${dropProduct.is_featured ? 'fill-current' : ''}`} />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveProduct(product.id)}
                            disabled={isSaving}
                            className="text-red-600 hover:text-red-700"
                            title="Remover del drop"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Footer con instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Usa el campo "Orden" para controlar la secuencia de productos.
          Marca productos como destacados con la estrella ⭐ para resaltarlos en la página principal.
        </p>
      </div>
    </div>
  );
};

export default DropProductManager;
