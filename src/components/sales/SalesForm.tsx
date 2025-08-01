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

  useEffect(() => {
    loadProducts();
    if (activeBranch) {
      loadStockByBranch(activeBranch.id);
    }
  }, [loadProducts, loadStockByBranch, activeBranch]);

  const availableProducts = products.filter(product => {
    const productStock = stock.find(s => s.product_id === product.id);
    const hasStock = productStock && productStock.quantity > 0;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return hasStock && matchesSearch;
  });

  const addProduct = (product: any) => {
    const productStock = stock.find(s => s.product_id === product.id);
    if (!productStock || productStock.quantity === 0) return;

    const existingItem = saleItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < existingItem.availableStock) {
        setSaleItems(items =>
          items.map(item =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      }
    } else {
      setSaleItems(items => [
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          availableStock: productStock.quantity
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

      await createSale(items, activeBranch.id, user.id);
      onClose();
    } catch (error) {
      console.error('Error creating sale:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Product Search */}
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
        
        {searchTerm && availableProducts.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
            {availableProducts.slice(0, 5).map(product => {
              const productStock = stock.find(s => s.product_id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">${product.price.toFixed(2)}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      Stock: {productStock?.quantity || 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sale Items */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Artículos de la Venta</h3>
        
        {saleItems.length > 0 ? (
          <div className="space-y-3">
            {saleItems.map(item => (
              <Card key={item.productId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.productName}</h4>
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
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
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
                        onChange={(e) => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
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
                      onClick={() => removeProduct(item.productId)}
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

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
  );
};

export default SalesForm;