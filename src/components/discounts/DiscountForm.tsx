import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Star } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useProductStore } from '../../store/productStore';
import { dropsService } from '../../services/dropsService';
import { discountService } from '../../services/discountService';
import type { Discount, Product, Drop } from '../../lib/types';

interface DiscountFormProps {
  discount?: Discount | null;
  onClose: () => void;
  onSave: () => void;
}

const DiscountForm: React.FC<DiscountFormProps> = ({ discount, onClose, onSave }) => {
  const { products, loadProducts } = useProductStore();

  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState<number>(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedDropIds, setSelectedDropIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'drops'>('products');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [isLoadingDrops, setIsLoadingDrops] = useState(false);

  // Cargar productos al montar
  useEffect(() => {
    const load = async () => {
      setIsLoadingProducts(true);
      try {
        await loadProducts(true);
      } catch (err) {
        console.error('Error loading products:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    load();
  }, [loadProducts]);

  // Cargar drops al montar
  useEffect(() => {
    const loadDropsList = async () => {
      setIsLoadingDrops(true);
      try {
        const dropsData = await dropsService.getAllDrops();
        setDrops(dropsData);
      } catch (err) {
        console.error('Error loading drops:', err);
      } finally {
        setIsLoadingDrops(false);
      }
    };
    loadDropsList();
  }, []);

  // Cargar datos del descuento existente
  useEffect(() => {
    if (discount) {
      setName(discount.name);
      setPercentage(discount.percentage);
      setStartDate(formatDateTimeLocal(discount.start_date));
      setEndDate(formatDateTimeLocal(discount.end_date));
      setIsActive(discount.is_active);

      // Cargar productos asignados
      const loadDiscountProducts = async () => {
        try {
          const dps = await discountService.getDiscountProducts(discount.id);
          setSelectedProductIds(dps.map((dp) => dp.product_id));
        } catch (err) {
          console.error('Error loading discount products:', err);
        }
      };
      loadDiscountProducts();

      // Cargar drops asignados
      const loadDiscountDrops = async () => {
        try {
          const dds = await discountService.getDiscountDrops(discount.id);
          setSelectedDropIds(dds.map((dd) => dd.drop_id));
        } catch (err) {
          console.error('Error loading discount drops:', err);
        }
      };
      loadDiscountDrops();
    } else {
      // Valores por defecto para nuevo descuento
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setStartDate(formatDateTimeLocal(now.toISOString()));
      setEndDate(formatDateTimeLocal(nextWeek.toISOString()));
    }
  }, [discount]);

  const formatDateTimeLocal = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const toggleDrop = useCallback((dropId: string) => {
    setSelectedDropIds((prev) =>
      prev.includes(dropId)
        ? prev.filter((id) => id !== dropId)
        : [...prev, dropId]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (activeTab === 'products') {
      const filtered = getFilteredProducts();
      setSelectedProductIds((prev) => {
        const newIds = new Set(prev);
        filtered.forEach((p) => newIds.add(p.id));
        return Array.from(newIds);
      });
    } else {
      const filtered = getFilteredDrops();
      setSelectedDropIds((prev) => {
        const newIds = new Set(prev);
        filtered.forEach((d) => newIds.add(d.id));
        return Array.from(newIds);
      });
    }
  }, [products, drops, searchTerm, activeTab]);

  const deselectAll = useCallback(() => {
    if (activeTab === 'products') {
      setSelectedProductIds([]);
    } else {
      setSelectedDropIds([]);
    }
  }, [activeTab]);

  const getFilteredProducts = (): Product[] => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  };

  const getFilteredDrops = (): Drop[] => {
    if (!searchTerm.trim()) return drops;
    const term = searchTerm.toLowerCase();
    return drops.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.description?.toLowerCase().includes(term)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validaciones
      if (!name.trim()) throw new Error('El nombre es obligatorio');
      if (percentage <= 0 || percentage > 100) throw new Error('El porcentaje debe estar entre 1 y 100');
      if (!startDate) throw new Error('La fecha de inicio es obligatoria');
      if (!endDate) throw new Error('La fecha de fin es obligatoria');
      if (new Date(endDate) <= new Date(startDate)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      if (selectedProductIds.length === 0 && selectedDropIds.length === 0) {
        throw new Error('Debes seleccionar al menos un producto o un drop');
      }

      const discountData = {
        name: name.trim(),
        percentage,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        is_active: isActive,
      };

      if (discount) {
        await discountService.updateDiscount(discount.id, discountData, selectedProductIds, selectedDropIds);
      } else {
        await discountService.createDiscount(discountData, selectedProductIds, selectedDropIds);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el descuento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = getFilteredProducts();
  const filteredDrops = getFilteredDrops();
  const totalSelected = selectedProductIds.length + selectedDropIds.length;

  // Preview del descuento en un producto seleccionado
  const getPreviewPrice = (price: number): string => {
    const discounted = price - (price * percentage / 100);
    return discounted.toFixed(2);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Nombre y Porcentaje */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre del Descuento"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Descuento Verano"
          required
        />
        <div className="space-y-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700">
            Porcentaje de Descuento
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700">
            Fecha y Hora de Inicio
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700">
            Fecha y Hora de Fin
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      {/* Estado activo */}
      <div className="flex items-center space-x-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
          <span className="text-sm text-gray-700 font-medium">Descuento Activo</span>
        </label>
      </div>

      {/* Preview del descuento */}
      {percentage > 0 && totalSelected > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-800 mb-2">
            Vista previa del descuento (-{percentage}%)
          </h4>
          <div className="space-y-1">
            {selectedProductIds.length > 0 && products
              .filter((p) => selectedProductIds.includes(p.id))
              .slice(0, 3)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-green-700 truncate mr-2">{p.name}</span>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="line-through text-gray-400">${p.price.toFixed(2)}</span>
                    <span className="font-bold text-green-700">${getPreviewPrice(p.price)}</span>
                  </div>
                </div>
              ))}
            {selectedProductIds.length > 3 && (
              <p className="text-xs text-green-600 mt-1">
                ...y {selectedProductIds.length - 3} producto(s) más
              </p>
            )}
            {selectedDropIds.length > 0 && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                + {selectedDropIds.length} drop(s) seleccionado(s)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selector de productos y drops */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Aplicar descuento a ({totalSelected} seleccionados)
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Seleccionar todos
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
            >
              Deseleccionar todos
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setActiveTab('products'); setSearchTerm(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="h-4 w-4 inline mr-1" />
            Productos ({selectedProductIds.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('drops'); setSearchTerm(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'drops'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Star className="h-4 w-4 inline mr-1" />
            Drops ({selectedDropIds.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={`Buscar ${activeTab === 'products' ? 'productos' : 'drops'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {activeTab === 'products' ? (
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {isLoadingProducts ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Cargando productos...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <Package className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                No se encontraron productos
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <label
                    key={product.id}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProduct(product.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                    />
                    <div className="ml-3 flex items-center flex-1 min-w-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="ml-3 min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                      <div className="ml-2 text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          ${product.price.toFixed(2)}
                        </p>
                        {isSelected && percentage > 0 && (
                          <p className="text-xs font-bold text-green-600">
                            → ${getPreviewPrice(product.price)}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {isLoadingDrops ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Cargando drops...
              </div>
            ) : filteredDrops.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <Star className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                No se encontraron drops
              </div>
            ) : (
              filteredDrops.map((drop) => {
                const isSelected = selectedDropIds.includes(drop.id);
                return (
                  <label
                    key={drop.id}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDrop(drop.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                    />
                    <div className="ml-3 flex items-center flex-1 min-w-0">
                      {drop.image_url ? (
                        <img
                          src={drop.image_url}
                          alt={drop.name}
                          className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <Star className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div className="ml-3 min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {drop.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            drop.status === 'ACTIVO' 
                              ? 'bg-green-100 text-green-700'
                              : drop.status === 'FINALIZADO'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {drop.status}
                          </span>
                          {drop.product_count !== undefined && (
                            <span className="text-xs text-gray-500">
                              {drop.product_count} productos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting || totalSelected === 0}
        >
          {discount ? 'Actualizar Descuento' : 'Crear Descuento'}
        </Button>
      </div>
    </form>
  );
};

export default DiscountForm;
