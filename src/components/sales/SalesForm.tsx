import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2, Search } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { useProductStore } from '../../store/productStore';
import { useSalesStore } from '../../store/salesStore';
import { useAuthStore } from '../../store/authStore';

interface SaleItem {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
}

interface SalesFormProps {
  onClose: () => void;
}

const SalesForm: React.FC<SalesFormProps> = ({ onClose }) => {
  const { products, stock, loadProducts, loadStockByBranch } = useProductStore();
  const { createSale } = useSalesStore();
  const { activeBranch, user } = useAuthStore();
  
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'QR' | 'TARJETA'>('EFECTIVO');

  useEffect(() => {
    loadProducts();
    if (activeBranch) {
      loadStockByBranch(activeBranch.id);
    }
  }, [loadProducts, loadStockByBranch, activeBranch]);

  // Helper para obtener variantes y stock por producto
  function getProductVariantsWithStock(product: any, stock: any[], branchId: string) {
    if (!product.variants) return [];
    return product.variants.map((variant: any) => {
      const variantStock = stock.find((s: any) => s.variant_id === variant.id && s.branch_id === branchId);
      return {
        ...variant,
        variant_id: variant.id,
        stock: variantStock ? variantStock.quantity : 0,
        productId: product.id,
        productName: product.name
      };
    });
  }

  const branchId = activeBranch?.id ?? '';
  const availableVariants = products.flatMap((product: any) => {
    if (!product.variants) return [];
    return getProductVariantsWithStock(product, stock, branchId).map((variant: any) => ({
      ...variant,
      matchesSearch: product.name.toLowerCase().includes(searchTerm.toLowerCase())
    }));
  }).filter((v: any) => v.stock > 0 && v.matchesSearch);

  // Agregar variante específica al carrito
  const addVariantToSale = (variant: any) => {
    if (!variant || variant.stock === 0) return;
    const existingItem = saleItems.find(item => item.variantId === variant.variant_id);
    if (existingItem) {
      if (existingItem.quantity < variant.stock) {
        setSaleItems(items =>
          items.map(item =>
            item.variantId === variant.variant_id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      }
    } else {
      setSaleItems(items => [
        ...items,
        {
          productId: variant.productId,
          productName: variant.productName,
          variantId: variant.variant_id,
          size: variant.size,
          quantity: 1,
          unitPrice: variant.price,
          availableStock: variant.stock
        }
      ]);
    }
    setSearchTerm('');
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeProduct(productId);
      return;
    }

    setSaleItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, quantity: Math.min(newQuantity, item.availableStock) }
          : item
      )
    );
  };

  const removeProduct = (productId: string) => {
    setSaleItems(items => items.filter(item => item.productId !== productId));
  };

  const updatePrice = (productId: string, newPrice: number) => {
    setSaleItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, unitPrice: Math.max(0, newPrice) }
          : item
      )
    );
  };

  const getTotalAmount = () => {
    return saleItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = async () => {
    if (saleItems.length === 0 || !activeBranch || !user) return;

    setIsLoading(true);
    try {
      const items = saleItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }));

      await createSale(items, activeBranch.id, user.id, paymentMethod);
      onClose();
    } catch (error) {
      console.error('Error creating sale:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Product & Variant Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar Productos
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar productos para agregar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchTerm && availableVariants.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
            {availableVariants.slice(0, 8).map(variant => (
              <button
                key={variant.variant_id}
                onClick={() => addVariantToSale(variant)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{variant.productName} <span className="text-xs text-gray-500">({variant.size})</span></p>
                    <p className="text-sm text-gray-600">${variant.price.toFixed(2)}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    Stock: {variant.stock}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sale Items */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Artículos de la Venta</h3>
        
        {saleItems.length > 0 ? (
          <div className="space-y-3">
            {saleItems.map(item => (
              <Card key={item.variantId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.productName} <span className="text-xs text-gray-500">({item.size})</span></h4>
                    <p className="text-sm text-gray-600">
                      Stock disponible: {item.availableStock}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        disabled={item.quantity >= item.availableStock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Price Input */}
                    <div className="w-24">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updatePrice(item.variantId, parseFloat(e.target.value) || 0)}
                        className="text-center"
                      />
                    </div>
                    {/* Subtotal */}
                    <div className="w-20 text-right font-medium">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    {/* Remove Button */}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeProduct(item.variantId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No hay artículos agregados a la venta</p>
            <p className="text-sm">Busca productos arriba para agregarlos</p>
          </div>
        )}
      </div>

      {/* Total */}
      {saleItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total:</span>
            <span className="text-2xl font-bold text-blue-600">
              ${getTotalAmount().toFixed(2)}
            </span>
          </div>
        </Card>
      )}

      {/* Método de pago */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700">Método de pago:</label>
        <select
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value as 'EFECTIVO' | 'QR' | 'TARJETA')}
          className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="QR">QR</option>
          <option value="TARJETA">Tarjeta</option>
        </select>
        <div className="flex justify-end flex-1 space-x-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={saleItems.length === 0}
          >
            Confirmar Venta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;