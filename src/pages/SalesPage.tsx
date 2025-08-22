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
  const [paymentType, setPaymentType] = useState<'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO'>('EFECTIVO');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [showMixedPaymentModal, setShowMixedPaymentModal] = useState(false);
  const [mixedPaymentDetails, setMixedPaymentDetails] = useState({
    efectivo: 0,
    qr: 0,
    tarjeta: 0
  });

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
  // Adapt availableProducts to filter by variants with stock
  const availableProducts = products.filter(product => {
    // At least one variant with stock
    const hasVariantWithStock = (product.variants || []).some((variant: any) => {
      const variantStock = stock.find(s => s.variant_id === variant.id);
      return variantStock && variantStock.quantity > 0;
    });
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return hasVariantWithStock && matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: any) => {
    // product must have variant_id
    const variantStock = stock.find(s => s.variant_id === product.variant_id);
    if (!variantStock || variantStock.quantity === 0) return;

    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id && item.product.variant_id === product.variant_id);
      if (existingItem) {
        if (existingItem.quantity < existingItem.availableStock) {
          return prev.map((item) =>
            item.product.id === product.id && item.product.variant_id === product.variant_id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return prev;
      }
      return [...prev, { 
        product, 
        quantity: 1, 
        availableStock: variantStock.quantity 
      }];
    });
  };

  const handleQuantityChange = (productId: string, variantId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId, variantId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.product.variant_id === variantId
          ? { ...item, quantity: Math.min(quantity, item.availableStock) }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string, variantId: string) => {
    setCart((prev) => prev.filter((item) => 
      !(item.product.id === productId && item.product.variant_id === variantId)
    ));
  };

  const getTotalAmount = () => {
    const subtotal = cart.reduce((total, item) => total + (item.quantity * item.product.price), 0);
    return Math.max(0, subtotal - discountAmount);
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + (item.quantity * item.product.price), 0);
  };

  const handleProcessSale = async () => {
    if (cart.length === 0 || !activeBranch || !user) return;

    setIsProcessingSale(true);
    try {
      const items = cart.map(item => ({
        variantId: item.product.variant_id,
        quantity: item.quantity,
        unitPrice: item.product.price
      }));

      let paymentDetails = undefined;
      if (paymentType === 'MIXTO') {
        paymentDetails = mixedPaymentDetails;
      }

      // Pass paymentType, discountAmount, and paymentDetails to createSale
      await createSale(items, activeBranch.id, user.id, paymentType, discountAmount, paymentDetails);
      setCart([]);
      setDiscountAmount(0);
      setMixedPaymentDetails({ efectivo: 0, qr: 0, tarjeta: 0 });
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
                  {availableProducts.flatMap((product) =>
                    (product.variants || []).map((variant: any) => {
                      const variantStock = stock.find(s => s.variant_id === variant.id);
                      const cartItem = cart.find(item => item.product.id === product.id && item.product.variant_id === variant.id);
                      return (
                        <div
                          key={variant.id}
                          className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                          onClick={() => handleAddToCart({ ...product, variant_id: variant.id, size: variant.size, price: product.price })}
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
                          <p className="text-xs text-gray-600 mb-2">{product.category} - Talla: {variant.size}</p>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-600">
                              ${product.price.toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500">
                              Stock: {variantStock?.quantity || 0}
                            </span>
                          </div>
                          {cartItem && (
                            <div className="mt-2 text-xs text-green-600 font-medium">
                              En carrito: {cartItem.quantity}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
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
                              onClick={() => handleQuantityChange(item.product.id, item.product.variant_id, item.quantity - 1)}
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
                              onClick={() => handleQuantityChange(item.product.id, item.product.variant_id, item.quantity + 1)}
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
                            onClick={() => handleRemoveFromCart(item.product.id, item.product.variant_id)}
                            className="w-full mt-1"
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    {/* Sección de descuentos */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-semibold text-gray-700">Descuento:</span>
                        <span className="text-xs text-gray-400">(Opcional)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Bs.</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDiscountAmount(0)}
                          disabled={discountAmount === 0}
                          className="text-red-600 hover:text-red-700"
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>

                    {/* Selector de tipo de pago mejorado */}
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-base font-semibold text-gray-700">Selecciona el tipo de pago:</span>
                        <span className="text-xs text-gray-400">(Obligatorio)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all shadow-sm cursor-pointer
                            ${paymentType === 'EFECTIVO' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'} hover:border-green-400`}
                          onClick={() => setPaymentType('EFECTIVO')}
                        >
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-green-600 mb-1">
                            <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="2" />
                            <circle cx="12" cy="12" r="2" strokeWidth="2" />
                          </svg>
                          <span className="font-semibold text-green-700 text-sm">Efectivo</span>
                        </button>
                        <button
                          type="button"
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all shadow-sm cursor-pointer
                            ${paymentType === 'QR' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'} hover:border-indigo-400`}
                          onClick={() => setPaymentType('QR')}
                        >
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-indigo-600 mb-1">
                            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
                            <path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01" strokeWidth="2" />
                          </svg>
                          <span className="font-semibold text-indigo-700 text-sm">QR</span>
                        </button>
                        <button
                          type="button"
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all shadow-sm cursor-pointer
                            ${paymentType === 'TARJETA' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'} hover:border-pink-400`}
                          onClick={() => setPaymentType('TARJETA')}
                        >
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600 mb-1">
                            <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="2" />
                            <rect x="6" y="10" width="12" height="2" rx="1" strokeWidth="2" />
                          </svg>
                          <span className="font-semibold text-pink-700 text-sm">Tarjeta</span>
                        </button>
                        <button
                          type="button"
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all shadow-sm cursor-pointer
                            ${paymentType === 'MIXTO' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'} hover:border-purple-400`}
                          onClick={() => setPaymentType('MIXTO')}
                        >
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-purple-600 mb-1">
                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="2" />
                          </svg>
                          <span className="font-semibold text-purple-700 text-sm">Mixto</span>
                        </button>
                      </div>
                    </div>

                    {/* Configuración de pago mixto */}
                    {paymentType === 'MIXTO' && (
                      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-3">Configurar Pago Mixto</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-purple-700 w-16">Efectivo:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={mixedPaymentDetails.efectivo}
                              onChange={(e) => setMixedPaymentDetails(prev => ({
                                ...prev,
                                efectivo: Math.max(0, parseFloat(e.target.value) || 0)
                              }))}
                              className="flex-1 px-2 py-1 border border-purple-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-purple-700 w-16">QR:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={mixedPaymentDetails.qr}
                              onChange={(e) => setMixedPaymentDetails(prev => ({
                                ...prev,
                                qr: Math.max(0, parseFloat(e.target.value) || 0)
                              }))}
                              className="flex-1 px-2 py-1 border border-purple-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-purple-700 w-16">Tarjeta:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={mixedPaymentDetails.tarjeta}
                              onChange={(e) => setMixedPaymentDetails(prev => ({
                                ...prev,
                                tarjeta: Math.max(0, parseFloat(e.target.value) || 0)
                              }))}
                              className="flex-1 px-2 py-1 border border-purple-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="pt-2 border-t border-purple-200">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-purple-700">Total ingresado:</span>
                              <span className="font-bold text-purple-800">
                                Bs. {(mixedPaymentDetails.efectivo + mixedPaymentDetails.qr + mixedPaymentDetails.tarjeta).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-purple-700">Total a pagar:</span>
                              <span className="font-bold text-purple-800">Bs. {getTotalAmount().toFixed(2)}</span>
                            </div>
                            {(mixedPaymentDetails.efectivo + mixedPaymentDetails.qr + mixedPaymentDetails.tarjeta) !== getTotalAmount() && (
                              <div className="text-xs text-red-600 mt-1">
                                ⚠️ Los montos deben sumar exactamente el total a pagar
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total y acciones */}
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Subtotal:</span>
                          <span>Bs. {getSubtotal().toFixed(2)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Descuento:</span>
                            <span>- Bs. {discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg px-4 py-3">
                          <span className="text-lg font-bold text-gray-900">Total a pagar:</span>
                          <span className="text-3xl font-extrabold text-blue-700 drop-shadow">Bs. {getTotalAmount().toFixed(2)}</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleProcessSale}
                        isLoading={isProcessingSale}
                        className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 shadow-xl text-lg font-bold py-3 text-white border-none"
                        disabled={cart.length === 0 || (paymentType === 'MIXTO' && (mixedPaymentDetails.efectivo + mixedPaymentDetails.qr + mixedPaymentDetails.tarjeta) !== getTotalAmount())}
                      >
                        <span className="flex items-center gap-2 justify-center">
                          <CheckCircle className="h-6 w-6" /> Procesar Venta
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setCart([]);
                          setDiscountAmount(0);
                          setMixedPaymentDetails({ efectivo: 0, qr: 0, tarjeta: 0 });
                        }}
                        className="w-full border border-gray-200 text-gray-700"
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
      <Card className="shadow-md md:shadow-lg">
        <div className="p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-4">Historial de Ventas</h2>
          {sales.length > 0 ? (
            <div className="space-y-4 md:space-y-6 max-h-[28rem] md:max-h-[32rem] overflow-y-auto">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-6 p-4 md:p-5 bg-white rounded-2xl shadow border border-gray-100 cursor-pointer hover:bg-blue-50 transition-all"
                  onClick={() => setSelectedSale(sale)}
                >
                  <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
                    <div className="bg-blue-100 p-3 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 md:h-7 md:w-7 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-base md:text-lg truncate">
                        Venta #{sale.id.slice(-8)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(sale.sale_date)}
                        </span>
                        {sale.user && (
                          <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">Vendedor: {sale.user.name}</span>
                        )}
                        <span className={`px-2 py-1 rounded font-bold text-xs md:text-sm ${sale.payment_type === 'EFECTIVO' ? 'bg-green-100 text-green-700' : sale.payment_type === 'QR' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>{sale.payment_type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 md:gap-2 text-right">
                    <span className="text-xl md:text-2xl font-extrabold text-blue-600">${sale.total.toFixed(2)}</span>
                    {sale.sale_items && (
                      <span className="text-xs md:text-sm text-gray-600 font-medium">
                        {sale.sale_items.length} artículo{sale.sale_items.length !== 1 ? 's' : ''}
                      </span>
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


      <Modal
        isOpen={showSalesForm}
        onClose={() => setShowSalesForm(false)}
        title="Nueva Venta"
        size="lg"
      >
        <SalesForm onClose={() => setShowSalesForm(false)} />
      </Modal>

      {/* Modal de detalle de venta */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title={selectedSale ? `Detalle Venta #${selectedSale.id.slice(-8)}` : ''}
        size="md"
      >
        {selectedSale && (
          <div className="space-y-6 md:space-y-8 p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-xs md:text-sm text-gray-500">Fecha</span>
                <span className="font-semibold text-gray-700 text-base md:text-lg">{formatDate(selectedSale.sale_date)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs md:text-sm text-gray-500">Vendedor</span>
                <span className="font-semibold text-gray-700 text-base md:text-lg">{selectedSale.user?.name || '-'}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs md:text-sm text-gray-500">Tipo de Pago</span>
                <span className={`font-bold px-3 py-1 rounded text-base md:text-lg ${selectedSale.payment_type === 'EFECTIVO' ? 'bg-green-100 text-green-700' : selectedSale.payment_type === 'QR' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>{selectedSale.payment_type}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs md:text-sm text-gray-500">Total</span>
                <span className="font-extrabold text-blue-700 text-xl md:text-2xl">${selectedSale.total.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-700 text-base md:text-lg">Artículos</span>
              <ul className="mt-3 space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto pr-1">
                {selectedSale.sale_items?.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base shadow">
                    <span className="font-medium text-gray-900 truncate">{item.product?.name || '-'}</span>
                    <span className="text-gray-600">x{item.quantity}</span>
                    <span className="font-bold text-blue-700">${item.unit_price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
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