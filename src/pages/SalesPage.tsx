import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, Calendar, Search, Package, CheckCircle, Edit, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import SalesForm from '../components/sales/SalesForm';
import EditPaymentMethodModal from '../components/sales/EditPaymentMethodModal';
import { useProductStore } from '../store/productStore';
import { useSalesStore } from '../store/salesStore';
import { useAuthStore } from '../store/authStore';
import { useDiscountStore } from '../store/discountStore';
import { useToastStore } from '../store/toastStore';
import { CATEGORIES, SALE_CHANNELS } from '../lib/constants';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { fmtMoney, fmtMoneyRaw } from '../lib/formatters';
import CreateCustomerModal from '../components/customers/CreateCustomerModal';
import PosProductGrid from '../components/sales/PosProductGrid';
import PosCheckoutPanel, { type PosCartItem } from '../components/sales/PosCheckoutPanel';
import { crewService } from '../services/crewService';
import type { CrewContext, CrewSaleQuote, Customer, Product, ProductVariant, Sale } from '../lib/types';

const SalesPage: React.FC = () => {
  const { sales, loadSalesByBranch, createSale, updatePaymentMethod } = useSalesStore();
  const { activeBranch, user } = useAuthStore();
  const { stock, loadStockByBranch } = useProductStore();
  const { activeDiscountsMap, loadActiveDiscountsMap } = useDiscountStore();
  const addToast = useToastStore((s) => s.addToast);
  const notify = useToastStore((s) => s.notify);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO'>('EFECTIVO');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [saleNotes, setSaleNotes] = useState<string>('');
  /* removed unused state: showMixedPaymentModal */
  const [mixedPaymentDetails, setMixedPaymentDetails] = useState({
    efectivo: 0,
    qr: 0,
    tarjeta: 0
  });
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [saleChannel, setSaleChannel] = useState<'TIENDA' | 'WEB'>('TIENDA');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [crewContext, setCrewContext] = useState<CrewContext | null>(null);
  const [saleQuote, setSaleQuote] = useState<CrewSaleQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  // Ref guard: prevents concurrent sale submissions (double-click or rapid retry)
  const isProcessingRef = useRef(false);
  // Conserva la clave entre reintentos de la misma venta si la respuesta se pierde.
  const clientRequestIdRef = useRef<string | null>(null);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);

  useEffect(() => {
    if (activeBranch) {
      loadSalesByBranch(activeBranch.id);
      loadStockByBranch(activeBranch.id);
    }
  }, [activeBranch, loadSalesByBranch, loadStockByBranch]);

  // Recarga manual de productos + stock. Necesario cuando el producto fue
  // creado en otra página/pestaña después de que SalesPage ya estaba montado.
  const handleRefreshProducts = async () => {
    if (!activeBranch || isRefreshingProducts) return;
    setIsRefreshingProducts(true);
    try {
      await Promise.all([
        loadStockByBranch(activeBranch.id),
        new Promise<void>((resolve) => { reload(); resolve(); }),
      ]);
    } finally {
      setIsRefreshingProducts(false);
    }
  };

  // Cargar descuentos activos
  useEffect(() => {
    loadActiveDiscountsMap();
  }, [loadActiveDiscountsMap]);

  const {
    items,
    isInitialLoading,
    isFetchingNextPage,
    error,
    hasMore,
    reload,
    observerRef
  } = usePaginatedProducts({ 
    pageSize: 24, 
    search: searchTerm, 
    category: selectedCategory, 
    enabled: true,
    includeHidden: false // Solo mostrar productos visibles en ventas
  });

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
  const availableProducts = useMemo(() => {
    return items.filter(product => {
      const hasVariantWithStock = (product.variants || []).some((variant: ProductVariant) => {
        const variantStock = stock.find(s => s.variant_id === variant.id);
        return variantStock && variantStock.quantity > 0;
      });
      return hasVariantWithStock;
    });
  }, [items, stock]);

  // Función helper para obtener precio con descuento
  const getDiscountedPrice = (productId: string, originalPrice: number) => {
    const discountInfo = activeDiscountsMap.get(productId);
    if (discountInfo) {
      const discountAmount = originalPrice * (discountInfo.percentage / 100);
      return originalPrice - discountAmount;
    }
    return originalPrice;
  };

  const handleAddToCart = (product: Product & { variant_id: string; size: string }) => {
    // product must have variant_id
    const variantStock = stock.find(s => s.variant_id === product.variant_id);
    if (!variantStock || variantStock.quantity === 0) {
      notify('stock_insufficient', 'Sin stock disponible para esta talla', {
        branchId: activeBranch?.id,
        details: { variant_id: product.variant_id },
      });
      return;
    }

    // Aplicar descuento si existe
    const finalPrice = getDiscountedPrice(product.id, product.price);
    const productWithDiscount = { ...product, finalPrice, originalPrice: product.price };

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
        product: productWithDiscount, 
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
    const subtotal = cart.reduce((total, item) => {
      // Usar el precio final (con descuento si existe)
      const price = item.product.finalPrice || item.product.price;
      return total + (item.quantity * price);
    }, 0);
    return Math.max(0, subtotal - discountAmount);
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => {
      // Usar el precio final (con descuento si existe)
      const price = item.product.finalPrice || item.product.price;
      return total + (item.quantity * price);
    }, 0);
  };

  const getTotalDiscountFromProducts = () => {
    return cart.reduce((total, item) => {
      if (item.product.originalPrice && item.product.finalPrice) {
        const discountPerUnit = item.product.originalPrice - item.product.finalPrice;
        return total + (discountPerUnit * item.quantity);
      }
      return total;
    }, 0);
  };

  const quoteItems = useMemo(() => cart.map(item => ({
    variantId: item.product.variant_id,
    quantity: item.quantity,
    unitPrice: item.product.finalPrice || item.product.price,
  })), [cart]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCustomer) { setCrewContext(null); return; }
    crewService.context(selectedCustomer.id).then(value => { if (!cancelled) setCrewContext(value); }).catch(() => { if (!cancelled) setCrewContext(null); });
    return () => { cancelled = true; };
  }, [selectedCustomer]);

  useEffect(() => {
    let cancelled = false;
    if (quoteItems.length === 0) { setSaleQuote(null); setQuoteLoading(false); return; }
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      crewService.quote(selectedCustomer?.id || null, quoteItems, discountAmount)
        .then(value => { if (!cancelled) setSaleQuote(value); })
        .catch(() => { if (!cancelled) setSaleQuote(null); })
        .finally(() => { if (!cancelled) setQuoteLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [quoteItems, selectedCustomer, discountAmount]);

  const effectiveSubtotal = saleQuote?.subtotal ?? getSubtotal();
  const effectiveTotal = saleQuote?.total ?? getTotalAmount();

  const handleProcessSale = async () => {
    if (cart.length === 0 || !activeBranch || !user) return;
    // Hard guard: block concurrent submissions even if React state hasn't updated yet
    if (isProcessingRef.current) return;

    // Validate MIXTO payment totals before submitting
    if (paymentType === 'MIXTO') {
      const expectedTotal = effectiveTotal;
      const mixedSum =
        (mixedPaymentDetails.efectivo || 0) +
        (mixedPaymentDetails.qr || 0) +
        (mixedPaymentDetails.tarjeta || 0);
      if (Math.abs(mixedSum - expectedTotal) > 0.01) {
        addToast(
      `El total de pago mixto (${fmtMoney(mixedSum)}) no coincide con el total de la venta (${fmtMoney(expectedTotal)})`,
          'error'
        );
        return;
      }
    }

    isProcessingRef.current = true;
    setIsProcessingSale(true);
    try {
      const items = cart.map(item => ({
        variantId: item.product.variant_id,
        quantity: item.quantity,
        unitPrice: item.product.finalPrice || item.product.price // Usar precio con descuento
      }));

      let paymentDetails = undefined;
      if (paymentType === 'MIXTO') {
        paymentDetails = mixedPaymentDetails;
      }

      // Pass paymentType, discountAmount, paymentDetails, and notes to createSale
      const clientRequestId = clientRequestIdRef.current ?? crypto.randomUUID();
      clientRequestIdRef.current = clientRequestId;
      await createSale(items, activeBranch.id, user.id, paymentType, discountAmount, paymentDetails, saleNotes, saleChannel, selectedCustomer?.id || null, clientRequestId);
      setCart([]);
      setDiscountAmount(0);
      setSaleNotes('');
      setMixedPaymentDetails({ efectivo: 0, qr: 0, tarjeta: 0 });
      setSaleChannel('TIENDA');
      setSelectedCustomer(null);
      clientRequestIdRef.current = null;
      // Recargar stock ANTES de mostrar el modal para que el grid
      // refleje el estado real al cerrar la ventana de éxito.
      if (activeBranch) {
        await loadStockByBranch(activeBranch.id);
      }
      setShowSuccessModal(true);
    } catch (error: unknown) {
      console.error('Error processing sale:', error);
        const msg = error instanceof Error ? error.message : 'Error desconocido al procesar la venta';
      const isStockError = msg.toLowerCase().includes('stock');
      notify(
        isStockError ? 'stock_insufficient' : 'sale_failed',
        msg,
        { branchId: activeBranch?.id, userId: user?.id, details: { items: cart.length } }
      );
    } finally {
      isProcessingRef.current = false;
      setIsProcessingSale(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-5 px-1 pb-24 xl:pb-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Operación</p><h1 className="text-3xl font-bold tracking-tight text-surface-950">Punto de Venta</h1></div>
        <div className="text-sm text-gray-600">
          {activeBranch ? `Sucursal: ${activeBranch.name}` : 'Sin sucursal'}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Panel de productos */}
        <div>
          <Card className="border-surface-200 shadow-sm">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Seleccionar Productos</h2>
                <button
                  onClick={handleRefreshProducts}
                  disabled={isRefreshingProducts}
                  title="Recargar productos y stock"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingProducts ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
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

              {/* Errores y recarga */}
              {error && (
                <Card className="p-3 mb-3 bg-red-50 border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700">{error}</span>
                    <Button size="sm" onClick={reload}>Reintentar</Button>
                  </div>
                </Card>
              )}

              {/* Grid de productos con contenedor estable */}
              <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto pr-1">
                {isInitialLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
                        <div className="aspect-square rounded-lg mb-3 animate-pulse bg-gray-200" />
                        <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse mb-3" />
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : availableProducts.length > 0 ? (
                  <div>
                    <PosProductGrid products={availableProducts} stock={stock} onAdd={handleAddToCart} getDisplayPrice={getDiscountedPrice} cartQuantity={(productId, variantId) => cart.find(item => item.product.id === productId && item.product.variant_id === variantId)?.quantity || 0} />
                    {/* Sentinel dentro del grid para evitar saltos visuales */}
                    {hasMore && (
                      <div className="col-span-full"><div ref={(el) => el && observerRef(el)} className="h-4" /></div>
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
                {/* Indicador de carga incremental fijo al final */}
                {!isInitialLoading && isFetchingNextPage && (
                  <div className="py-3 text-center">
                    <div className="mx-auto h-2 w-24 bg-gray-200 rounded overflow-hidden">
                      <div className="h-full w-1/2 bg-gray-400 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <PosCheckoutPanel
          cart={cart}
          customer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          onCreateCustomer={() => setCreateCustomerOpen(true)}
          onQuantityChange={handleQuantityChange}
          onRemove={handleRemoveFromCart}
          discountAmount={discountAmount}
          onDiscountChange={setDiscountAmount}
          productDiscount={getTotalDiscountFromProducts()}
          subtotal={effectiveSubtotal}
          total={effectiveTotal}
          crewContext={crewContext}
          saleQuote={saleQuote}
          quoteLoading={quoteLoading}
          paymentType={paymentType}
          onPaymentTypeChange={setPaymentType}
          mixedPayment={mixedPaymentDetails}
          onMixedPaymentChange={setMixedPaymentDetails}
          notes={saleNotes}
          onNotesChange={setSaleNotes}
          channel={saleChannel}
          onChannelChange={setSaleChannel}
          isProcessing={isProcessingSale}
          onCheckout={handleProcessSale}
          onClear={() => { setCart([]); setDiscountAmount(0); setMixedPaymentDetails({ efectivo: 0, qr: 0, tarjeta: 0 }); setPaymentType('EFECTIVO'); setSaleNotes(''); setSaleChannel('TIENDA'); setSelectedCustomer(null); clientRequestIdRef.current = null; }}
        />
      </div>

      {/* Historial de ventas */}
      <Card className="shadow-md md:shadow-lg">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Historial de Ventas</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Filtrar por canal:</label>
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                {SALE_CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.icon} {channel.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sales.filter(sale => !filterChannel || sale.sale_channel === filterChannel).length > 0 ? (
            <div className="space-y-4 md:space-y-6 max-h-[28rem] md:max-h-[32rem] overflow-y-auto">
              {sales.filter(sale => !filterChannel || sale.sale_channel === filterChannel).map((sale) => (
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
                        {(sale.sale_items && sale.sale_items[0]?.variant?.product?.name)
                          ? sale.sale_items[0].variant.product.name
                          : `Venta #${sale.id.slice(-8)}`}
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
                        {sale.sale_channel && (
                          <span className="px-2 py-1 rounded font-medium text-xs bg-gray-50 border border-gray-200">
                            {SALE_CHANNELS.find(ch => ch.value === sale.sale_channel)?.icon || '🏪'} {SALE_CHANNELS.find(ch => ch.value === sale.sale_channel)?.label || sale.sale_channel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 md:gap-2 text-right">
                    <span className="text-xl md:text-2xl font-extrabold text-blue-600">{fmtMoney(sale.total)}</span>
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


      <CreateCustomerModal open={createCustomerOpen} onClose={() => setCreateCustomerOpen(false)} onCreated={setSelectedCustomer} />
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
                <div className="flex items-center gap-2">
                  <span className={`font-bold px-3 py-1 rounded text-base md:text-lg ${selectedSale.payment_type === 'EFECTIVO' ? 'bg-green-100 text-green-700' : selectedSale.payment_type === 'QR' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>{selectedSale.payment_type}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSaleToEdit(selectedSale);
                      setEditPaymentModalOpen(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Editar método de pago"
                  >
                    <Edit className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
              {selectedSale.sale_channel && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs md:text-sm text-gray-500">Canal</span>
                  <span className="font-semibold px-3 py-1 rounded text-base md:text-lg bg-gray-100">
                    {SALE_CHANNELS.find(ch => ch.value === selectedSale.sale_channel)?.icon || '🏪'} {SALE_CHANNELS.find(ch => ch.value === selectedSale.sale_channel)?.label || selectedSale.sale_channel}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs md:text-sm text-gray-500">Total</span>
                <span className="font-extrabold text-blue-700 text-xl md:text-2xl">{fmtMoney(selectedSale.total)}</span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-700 text-base md:text-lg">Artículos</span>
              <ul className="mt-3 space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto pr-1">
                {selectedSale.sale_items?.map((item, idx: number) => (
                  <li key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base shadow">
                    <span className="font-medium text-gray-900 truncate">
                      {item.variant?.product?.name || '-'}
                      {item.variant?.size ? ` (Talla: ${item.variant.size})` : ''}
                    </span>
                    <span className="text-gray-600">x{item.quantity}</span>
                    <span className="font-bold text-blue-700">Bs. {fmtMoneyRaw(item.unit_price)}</span>
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

      {/* Modal para editar método de pago */}
      {saleToEdit && (
        <EditPaymentMethodModal
          isOpen={editPaymentModalOpen}
          onClose={() => {
            setEditPaymentModalOpen(false);
            setSaleToEdit(null);
          }}
          sale={saleToEdit}
          onSave={async (saleId, newPaymentType, paymentDetails) => {
            await updatePaymentMethod(saleId, newPaymentType, paymentDetails);
            if (activeBranch) {
              await loadSalesByBranch(activeBranch.id);
            }
            setEditPaymentModalOpen(false);
            setSaleToEdit(null);
            setSelectedSale(null);
          }}
        />
      )}
    </div>
  );
};

export default SalesPage;
