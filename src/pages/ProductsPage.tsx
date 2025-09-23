import React, { useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ProductForm from '../components/products/ProductForm';
import { useProductStore } from '../store/productStore';
import { useAuthStore } from '../store/authStore';
import { CATEGORIES } from '../lib/constants';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';

const ProductsPage: React.FC = () => {
  const { deleteProduct } = useProductStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const {
    items,
    isInitialLoading,
    isFetchingNextPage,
    error,
    hasMore,
    reload,
    observerRef
  } = usePaginatedProducts({ pageSize: 20, search: searchTerm, category: selectedCategory, enabled: true });

  const filteredProducts = useMemo(() => items, [items]);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleCloseForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
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
              <div className="aspect-w-1 aspect-h-1 mb-4">
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
                <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{product.category}</span>
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
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold text-blue-600">
                    ${product.price.toFixed(2)}
                  </span>
                  <div className="flex space-x-2">
                    {user?.role === 'admin' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(product)}
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