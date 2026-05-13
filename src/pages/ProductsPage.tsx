import React, { useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ProductForm from '../components/products/ProductForm';
import { DropBadge } from '../components/drops/DropFilter';
import { DiscountPrice, DiscountBadge } from '../components/discounts/DiscountBadge';
import { useProductStore } from '../store/productStore';
import { useDiscountStore } from '../store/discountStore';
import { useAuthStore } from '../store/authStore';
import { CATEGORIES } from '../lib/constants';
import { fmtMoney } from '../lib/formatters';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { dropsService } from '../services/dropsService';
import { productService } from '../services/productService';
import type { Drop } from '../lib/types';
import { useToastStore } from '../store/toastStore';

const ProductsPage: React.FC = () => {
  const { deleteProduct, toggleProductVisibility } = useProductStore();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { loadActiveDiscountsMap, getProductDiscount } = useDiscountStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [showHiddenProducts, setShowHiddenProducts] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [productToToggle, setProductToToggle] = useState<any>(null);
  const [drops, setDrops] = useState<Drop[]>([]);

  const {
    items,
    isInitialLoading,
    isFetchingNextPage,
    error,
    hasMore,
    reload,
    observerRef
  } = usePaginatedProducts({ 
    pageSize: 20, 
    search: searchTerm, 
    category: selectedCategory, 
    enabled: true,
    includeHidden: showHiddenProducts
  });

  const filteredProducts = useMemo(() => items, [items]);

  // Cargar descuentos activos
  React.useEffect(() => {
    loadActiveDiscountsMap();
  }, [loadActiveDiscountsMap]);

  // Cargar drops para mostrar información
  React.useEffect(() => {
    const loadDrops = async () => {
      try {
        const activeDrops = await dropsService.getActiveDrops();
        setDrops(activeDrops);
      } catch (error) {
        console.error('Error loading drops:', error);
      }
    };
    
    loadDrops();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer y eliminará todas las variantes y stock asociados.')) {
      try {
        await deleteProduct(id);
        
        addToast('Producto eliminado exitosamente', 'success');
        reload();
        
      } catch (error: any) {
        console.error('❌ [ProductsPage] Error eliminando producto:', error);
        const errorMessage = error?.message || 'Error desconocido al eliminar el producto';
        addToast(`Error al eliminar el producto: ${errorMessage}`, 'error');
      }
    }
  };

  const getProductDrop = (product: any): Drop | null => {
    if (!product.drop_id) return null;
    return drops.find(drop => drop.id === product.drop_id) || null;
  };

  const handleEdit = async (product: any) => {
    setLoadingEdit(true);
    try {
      // Fetch full product with description before opening form
      const fullProduct = await productService.getProduct(product.id);
      setEditingProduct(fullProduct || product);
    } catch (e) {
      setEditingProduct(product);
    } finally {
      setLoadingEdit(false);
      setShowProductForm(true);
    }
  };

  const handleCloseForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    // Recargar inmediatamente para reflejar los cambios
    reload();
  };

  const handleToggleVisibilityClick = (product: any) => {
    setProductToToggle(product);
    setShowVisibilityModal(true);
  };

  const handleConfirmVisibilityToggle = async () => {
    if (!productToToggle) return;
    
    try {
      await toggleProductVisibility(productToToggle.id);
      // Recargar la lista para reflejar los cambios
      reload();
      setShowVisibilityModal(false);
      setProductToToggle(null);
    } catch (error: any) {
      console.error('Error cambiando visibilidad:', error);
      addToast(`Error al cambiar la visibilidad: ${error?.message || 'Error desconocido'}`, 'error');
    }
  };

  const handleCancelVisibilityToggle = () => {
    setShowVisibilityModal(false);
    setProductToToggle(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        {user?.role === 'admin' && (
          <Button
            onClick={() => setShowProductForm(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Producto</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          {user?.role === 'admin' && (
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHiddenProducts}
                  onChange={(e) => setShowHiddenProducts(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Mostrar productos ocultos</span>
              </label>
            </div>
          )}
        </div>
      </Card>

      {/* Products Grid */}
      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <Button size="sm" onClick={reload}>Reintentar</Button>
          </div>
        </Card>
      )}

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-w-1 aspect-h-1 mb-4 relative">
                {/* Badge de descuento sobre la imagen */}
                {getProductDiscount(product.id) && (
                  <div className="absolute top-2 left-2 z-10">
                    <DiscountBadge percentage={getProductDiscount(product.id)!.percentage} size="md" />
                  </div>
                )}
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                  {!product.is_visible && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      Oculto
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{product.category}</span>
                  <DropBadge drop={getProductDrop(product)} />
                </div>
                {product.variants && product.variants.length > 0 ? (
                  <div className="flex flex-col">
                    {product.variants.map(variant => (
                      <span key={variant.id} className="text-xs font-medium text-gray-900">
                        Talla {variant.size}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Sin tallas</span>
                )}
                <div className="flex justify-between items-center pt-2">
                  {(() => {
                    const discount = getProductDiscount(product.id);
                    if (discount) {
                      return (
                        <DiscountPrice
                          originalPrice={product.price}
                          percentage={discount.percentage}
                          size="md"
                        />
                      );
                    }
                    return (
                      <span className="text-lg font-bold text-blue-600">
                        Bs. {fmtMoney(product.price)}
                      </span>
                    );
                  })()}
                  <div className="flex space-x-2">
                    {user?.role === 'admin' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleVisibilityClick(product)}
                          title={product.is_visible ? 'Ocultar producto' : 'Mostrar producto'}
                          className={product.is_visible ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}
                        >
                          {product.is_visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(product)}
                          isLoading={loadingEdit}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory 
              ? 'No se encontraron productos que coincidan con los filtros.' 
              : 'Comienza agregando tu primer producto.'
            }
          </p>
          {!searchTerm && !selectedCategory && user?.role === 'admin' && (
            <Button onClick={() => setShowProductForm(true)}>
              Agregar Producto
            </Button>
          )}
        </Card>
      )}

      {/* Loading states */}
      {isInitialLoading && (
        <Card className="p-4 text-center">Cargando productos...</Card>
      )}
      {!isInitialLoading && isFetchingNextPage && (
        <Card className="p-4 text-center">Cargando más...</Card>
      )}
      {!isInitialLoading && hasMore && (
        <div ref={(el) => el && observerRef(el)} className="h-4" />
      )}

      {/* Visibility Confirmation Modal */}
      <Modal
        isOpen={showVisibilityModal}
        onClose={handleCancelVisibilityToggle}
        title="Confirmar cambio de visibilidad"
        size="md"
      >
        {productToToggle && (
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  ¿Estás seguro de que quieres {productToToggle.is_visible ? 'ocultar' : 'mostrar'} este producto?
                </h3>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-4">
                {productToToggle.image_url && (
                  <img
                    src={productToToggle.image_url}
                    alt={productToToggle.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
                <div>
                  <h4 className="font-semibold text-gray-900">{productToToggle.name}</h4>
                  <p className="text-sm text-gray-600">{productToToggle.category}</p>
                  <p className="text-sm text-gray-500">Precio: {fmtMoney(productToToggle.price)}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  {productToToggle.is_visible ? (
                    <EyeOff className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    {productToToggle.is_visible ? 'Al ocultar el producto:' : 'Al mostrar el producto:'}
                  </h4>
                  <div className="mt-2 text-sm text-blue-700">
                    {productToToggle.is_visible ? (
                      <ul className="list-disc list-inside space-y-1">
                        <li>No aparecerá en el punto de venta</li>
                        <li>No se podrá vender hasta que se muestre nuevamente</li>
                        <li>Permanecerá en la gestión de productos</li>
                        <li>Se puede mostrar nuevamente cuando sea necesario</li>
                      </ul>
                    ) : (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Aparecerá nuevamente en el punto de venta</li>
                        <li>Estará disponible para ventas</li>
                        <li>Será visible para todos los vendedores</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={handleCancelVisibilityToggle}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmVisibilityToggle}
                className={
                  productToToggle.is_visible 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }
              >
                {productToToggle.is_visible ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Sí, ocultar producto
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Sí, mostrar producto
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Product Form Modal */}
      {user?.role === 'admin' && (
        <Modal
          isOpen={showProductForm}
          onClose={handleCloseForm}
          title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          size="lg"
        >
          <ProductForm
            product={editingProduct}
            onClose={handleCloseForm}
          />
        </Modal>
      )}
    </div>
  );
};

export default ProductsPage;