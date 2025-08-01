import React, { useEffect, useState } from 'react';
import { Plus, ShoppingCart, Calendar, Search, Package, Minus, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import SalesForm from '../components/sales/SalesForm';
import { useProductStore } from '../store/productStore';
import { useSalesStore } from '../store/salesStore';
import { useAuthStore } from '../store/authStore';
import { CATEGORIES } from '../lib/constants';

interface CartItem {
  product: any;
  quantity: number;
  availableStock: number;
}

const SalesPage: React.FC = () => {
  const { sales, loadSalesByBranch, createSale } = useSalesStore();
  const { activeBranch, user } = useAuthStore();
  const { products, stock, loadProducts, loadStockByBranch } = useProductStore();
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (activeBranch) {
      loadSalesByBranch(activeBranch.id);
      loadStockByBranch(activeBranch.id);
    }
    loadProducts();
  }, [activeBranch, loadSalesByBranch, loadProducts, loadStockByBranch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filtrar productos disponibles con stock
  const availableProducts = products.filter(product => {
    const productStock = stock.find(s => s.product_id === product.id);
    const hasStock = productStock && productStock.quantity > 0;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return hasStock && matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: any) => {
    const productStock = stock.find(s => s.product_id === product.id);
    if (!productStock || productStock.quantity === 0) return;

    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < existingItem.availableStock) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return prev;
      }
      return [...prev, { 
        product, 
        quantity: 1, 
        availableStock: productStock.quantity 
      }];
    });
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId 
          ? { ...item, quantity: Math.min(quantity, item.availableStock) }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.quantity * item.product.price), 0);
  };

  const handleProcessSale = async () => {
    if (cart.length === 0 || !activeBranch || !user) return;

    setIsProcessingSale(true);
    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price
      }));

      await createSale(items, activeBranch.id, user.id);
      setCart([]);
      // Recargar stock después de la venta
      if (activeBranch) {
        loadStockByBranch(activeBranch.id);
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error processing sale:', error);
    } finally {
      setIsProcessingSale(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Punto de Venta</h1>
        <div className="text-sm text-gray-600">
          {activeBranch ? `Sucursal: ${activeBranch.name}` : 'Sin sucursal'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de productos */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Seleccionar Productos</h2>
              
              {/* Filtros */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
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

              {/* Grid de productos */}
              {availableProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {availableProducts.map((product) => {
                    const productStock = stock.find(s => s.product_id === product.id);
                    const cartItem = cart.find(item => item.product.id === product.id);
                    
                    return (
                      <div
                        key={product.id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                        onClick={() => handleAddToCart(product)}
                      >
                        <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-600 mb-2">{product.category} - {product.size}</p>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-600">
                            ${product.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Stock: {productStock?.quantity || 0}
                          </span>
                        </div>
                        {cartItem && (
                          <div className="mt-2 text-xs text-green-600 font-medium">
                            En carrito: {cartItem.quantity}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay productos disponibles</p>
                  {searchTerm || selectedCategory ? (
                    <p className="text-sm">Intenta cambiar los filtros</p>
                  ) : (
                    <p className="text-sm">No hay productos con stock en esta sucursal</p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Panel del carrito mejorado visualmente */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 shadow-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6 text-blue-900 flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-blue-500" /> Carrito de Venta
              </h3>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingCart className="h-14 w-14 mx-auto mb-4 opacity-40" />
                  <p className="font-semibold">Carrito vacío</p>
                  <p className="text-sm">Selecciona productos para agregar</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6 max-h-72 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between bg-white rounded-xl shadow p-4 border border-gray-100 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            {item.product.image_url ? (
                              <img src={item.product.image_url} alt={item.product.name} className="w-10 h-10 object-cover rounded-full" />
                            ) : (
                              <Package className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-base truncate">{item.product.name}</h4>
                            <p className="text-xs text-gray-500">${item.product.price.toFixed(2)} c/u</p>
                            <p className="text-xs text-gray-400">Stock: {item.availableStock}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                              className="h-8 w-8 p-0 border border-gray-200"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center text-base font-bold bg-gray-50 rounded px-2 border border-gray-200">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.availableStock}
                              className="h-8 w-8 p-0 border border-gray-200"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Subtotal:</span>
                            <span className="font-semibold text-blue-700 text-base">
                              ${(item.quantity * item.product.price).toFixed(2)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="w-full mt-1"
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-gray-900">Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        ${getTotalAmount().toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={handleProcessSale}
                        isLoading={isProcessingSale}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg text-lg font-semibold"
                        disabled={cart.length === 0}
                      >
                        Procesar Venta
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCart([])}
                        className="w-full border border-gray-200"
                        disabled={cart.length === 0}
                      >
                        Limpiar Carrito
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Historial de ventas */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Historial de Ventas</h2>
          
          {sales.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <ShoppingCart className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Venta #{sale.id.slice(-8)}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(sale.sale_date)}</span>
                        </div>
                        {sale.user && (
                          <span>Vendedor: {sale.user.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">
                      ${sale.total.toFixed(2)}
                    </p>
                    {sale.sale_items && (
                      <p className="text-sm text-gray-600">
                        {sale.sale_items.length} artículo{sale.sale_items.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay ventas registradas</p>
              <p className="text-sm">Las ventas aparecerán aquí una vez que proceses la primera</p>
            </div>
          )}
        </div>
      </Card>

      {/* Modal para formulario de venta (mantenido para compatibilidad) */}
      <Modal
        isOpen={showSalesForm}
        onClose={() => setShowSalesForm(false)}
        title="Nueva Venta"
        size="lg"
      >
        <SalesForm onClose={() => setShowSalesForm(false)} />
      </Modal>

      {/* Modal de éxito al registrar venta */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Venta registrada"
        size="sm"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-16 w-16 text-green-500 animate-bounce mb-4" />
          <h3 className="text-xl font-bold text-green-700 mb-2">¡Venta registrada exitosamente!</h3>
          <Button className="mt-4" onClick={() => setShowSuccessModal(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default SalesPage;