
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Upload } from 'lucide-react';
import Button from '../ui/Button';
import { useProductStore } from '../../store/productStore';
import { useAuthStore } from '../../store/authStore';
import { dropsService } from '../../services/dropsService';
import type { Drop, ProductFit, ProductStyle } from '../../lib/types';

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  color?: string;
  fit?: ProductFit;
  product_style?: ProductStyle;
  price: number;
  is_visible: boolean;
  drop_id?: string;
  variants: Array<{
    id?: string; // ID opcional para variantes existentes
    size: string;
    stock: { [branchId: string]: number };
  }>;
}

interface ProductFormProps {
  product?: any;
  onClose: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose }) => {
  const { createProduct, updateProduct, uploadImage, updateStock, createProductVariant, getStockByProduct, loadProducts } = useProductStore();
  const { branches } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [selectedDropId, setSelectedDropId] = useState<string>(product?.drop_id || '');
  const [variants, setVariants] = useState<Array<{ id?: string; size: string; stock: { [branchId: string]: number } }>>([
    { size: '', stock: branches.reduce((acc, branch) => { acc[branch.id] = 0; return acc; }, {} as { [branchId: string]: number }) }
  ]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<ProductFormData>({
    defaultValues: product ? {
      name: product.name,
      description: product.description,
      category: product.category,
      color: product.color || '',
      fit: product.fit || undefined,
      product_style: product.product_style || undefined,
      price: product.price ?? 0,
      is_visible: product.is_visible ?? true,
      drop_id: product.drop_id || '',
      variants: product.variants?.map((variant: any) => ({
        size: variant.size,
        stock: branches.reduce((acc: any, branch: any) => {
          acc[branch.id] = 0; // Initialize with 0, will be loaded separately
          return acc;
        }, {})
      })) || []
    } : { 
      price: 0,
      is_visible: true,
      drop_id: '',
      variants: [{ size: '', stock: branches.reduce((acc, branch) => { acc[branch.id] = 0; return acc; }, {} as { [branchId: string]: number }) }] 
    }
  });

  useEffect(() => {
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

  useEffect(() => {
    if (product) {
      setImagePreview(product.image_url || '');
      
      // Load stock for existing variants
      if (product.variants) {
        const loadStockForVariants = async () => {
          const updatedVariants = await Promise.all(
            product.variants.map(async (variant: any) => {
              const stockData = await getStockByProduct(variant.id);
              const stock = branches.reduce((acc: any, branch: any) => {
                const stockItem = stockData.find((s: any) => s.branch_id === branch.id);
                acc[branch.id] = stockItem ? stockItem.quantity : 0;
                return acc;
              }, {});
              
              return {
                id: variant.id, // Agregar el ID de la variante existente
                size: variant.size,
                stock
              };
            })
          );
          setVariants(updatedVariants);
        };
        
        loadStockForVariants();
      }
    }
  }, [product, branches, getStockByProduct]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    setVariants(prev => prev.map((variant, i) => i === index ? { ...variant, [field]: value } : variant));
  };

  const handleStockChange = (variantIndex: number, branchId: string, quantity: number) => {
    // Validaciones adicionales
    if (quantity < 0) {
      quantity = 0; // No permitir valores negativos
    }
    
    // Limitar a un máximo razonable (ej: 999,999)
    if (quantity > 999999) {
      quantity = 999999;
    }
    
    setVariants(prev => prev.map((variant, i) =>
      i === variantIndex ? { ...variant, stock: { ...variant.stock, [branchId]: quantity } } : variant
    ));
  };

  const addVariant = () => {
    setVariants(prev => ([...prev, { size: '', stock: branches.reduce((acc, branch) => { acc[branch.id] = 0; return acc; }, {} as { [branchId: string]: number }) }]));
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      const normalizedVariants = variants.map((variant) => ({
        ...variant,
        size: variant.size.trim()
      }));

      // Validar que todas las variantes tengan talla
      for (const variant of normalizedVariants) {
        if (!variant.size) {
          throw new Error('Todas las variantes deben tener una talla');
        }
      }
      
      // Validar que el stock sea válido para todas las variantes
      for (const variant of normalizedVariants) {
        for (const [branchId, quantity] of Object.entries(variant.stock)) {
          if (quantity < 0) {
            throw new Error(`El stock no puede ser negativo para la talla ${variant.size} en ${branches.find(b => b.id === branchId)?.name}`);
          }
          if (quantity > 999999) {
            throw new Error(`El stock no puede ser mayor a 999,999 para la talla ${variant.size} en ${branches.find(b => b.id === branchId)?.name}`);
          }
        }
      }
      
      let imageUrl = product?.image_url || '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      
      // Create product with the price
      const productData = {
        name: data.name,
        description: data.description,
        category: data.category,
        color: data.color || undefined,
        fit: data.fit || undefined,
        product_style: data.product_style || undefined,
        image_url: imageUrl,
        price: data.price,
        is_visible: data.is_visible,
        drop_id: data.drop_id || undefined
      };
      
      let savedProduct;
      if (product) {
        await updateProduct(product.id, productData);
        savedProduct = { ...product, ...productData };
      } else {
        savedProduct = await createProduct(productData);
      }
      
      // Create/update variants and stock
      console.log('Creating/updating variants:', normalizedVariants);
      for (const variant of normalizedVariants) {
        let variantObj;
        const size = variant.size;
        
        // Check if this variant already exists (for editing)
        if (product && product.variants && variant.id) {
          // Es una variante existente, usarla directamente
          variantObj = product.variants.find((v: any) => v.id === variant.id);
          if (!variantObj) {
            console.log('Creating new variant for existing product:', { product_id: savedProduct.id, size });
            variantObj = await createProductVariant({
              product_id: savedProduct.id,
              size
            });
            console.log('Variant created:', variantObj);
          }
        } else if (product && product.variants) {
          // Buscar si existe una variante con el mismo tamaño
          const existingVariant = product.variants.find((v: any) => v.size?.trim() === size);
          if (existingVariant) {
            variantObj = existingVariant;
          } else {
            console.log('Creating new variant:', { product_id: savedProduct.id, size });
            variantObj = await createProductVariant({
              product_id: savedProduct.id,
              size
            });
            console.log('Variant created:', variantObj);
          }
        } else {
          console.log('Creating new variant (new product):', { product_id: savedProduct.id, size });
          variantObj = await createProductVariant({
            product_id: savedProduct.id,
            size
          });
          console.log('Variant created (new product):', variantObj);
        }
        
        // Actualizar stock para todas las sucursales
        console.log(`🔄 [ProductForm] Iniciando actualización de stock para variante: ${size}`);
        for (const [branchId, quantity] of Object.entries(variant.stock)) {
          console.log(`🔄 [ProductForm] Actualizando stock - Sucursal: ${branchId}, Cantidad: ${quantity}`);
          try {
            await updateStock(variantObj.id, branchId, quantity);
            console.log(`✅ [ProductForm] Stock actualizado exitosamente - Sucursal: ${branchId}, Cantidad: ${quantity}`);
          } catch (error) {
            console.error(`❌ [ProductForm] Error actualizando stock - Sucursal: ${branchId}, Cantidad: ${quantity}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            throw new Error(`Error actualizando stock para sucursal ${branchId}: ${errorMessage}`);
          }
        }
        console.log(`✅ [ProductForm] Stock completado para variante: ${variant.size}`);
      }
      
      // Reload products to reflect changes
      await loadProducts();
      console.log('Product saved successfully, variants:', variants);
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      alert(`Error al guardar el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Imagen del Producto
          </label>
          <div className="flex items-center space-x-4">
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview('');
                    setImageFile(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                Seleccionar Imagen
              </label>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
            </label>
            <input
              {...register('name', { required: 'El nombre es requerido' })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              {...register('category', { required: 'La categoría es requerida' })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
      <option value="">Seleccionar categoría</option>
<option value="Camisas">Camisas</option>
<option value="Pantalones">Pantalones</option>
<option value="Hoodies">Hoodies</option>
<option value="Shorts">Shorts</option>
<option value="Accesorios">Accesorios</option>
<option value="Poleras">Poleras</option>
<option value="Gorras">Gorras</option>
<option value="Tops">Tops</option>
<option value="TrackSuit Basic">TrackSuit Basic</option>

            </select>
            {errors.category && (
              <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <select {...register('color')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Sin especificar</option>
              <option value="Negro">Negro</option><option value="Blanco">Blanco</option><option value="Gris">Gris</option><option value="Beige">Beige</option>
              <option value="Azul">Azul</option><option value="Rojo">Rojo</option><option value="Verde">Verde</option><option value="Rosa">Rosa</option>
              <option value="Marrón">Marrón</option><option value="Amarillo">Amarillo</option><option value="Morado">Morado</option><option value="Multicolor">Multicolor</option><option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fit</label>
            <select {...register('fit')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Sin especificar</option>
              <option value="Oversize">Oversize</option><option value="Regular">Regular</option><option value="Boxy">Boxy</option><option value="Slim">Slim</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo / estilo</label>
            <select {...register('product_style')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Sin especificar</option>
              <option value="Básico">Básico</option><option value="Estampado">Estampado</option><option value="Bordado">Bordado</option><option value="Serigrafía">Serigrafía</option><option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        {/* Drop Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Drop/Colección
          </label>
          <select
            value={selectedDropId}
            onChange={(e) => {
              setSelectedDropId(e.target.value);
              setValue('drop_id', e.target.value);
            }}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Sin drop asignado</option>
            {drops.map((drop) => (
              <option key={drop.id} value={drop.id}>
                {drop.name} {drop.is_featured && '⭐'}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Selecciona el drop o colección al que pertenece este producto
          </p>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('price', { 
              required: 'El precio es requerido',
              min: { value: 0, message: 'El precio debe ser mayor a 0' }
            })}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.price && (
            <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>
          )}
        </div>

        {/* Visibility */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...register('is_visible')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Producto visible en la tienda
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Si está desmarcado, el producto no aparecerá en las ventas ni en la lista principal
          </p>
        </div>

        {/* Variants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tallas y Stock
          </label>
          {variants.map((variant, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Talla
                  </label>
                  <input
                    type="text"
                    value={variant.size}
                    onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: S, M, L, XL"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Eliminar Talla
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {branches.map(branch => (
                  <div key={branch.id} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{branch.name}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={variant.stock[branch.id] || ''}
                      onChange={e => {
                        const value = e.target.value;
                        // Solo permitir números
                        if (value === '' || /^\d+$/.test(value)) {
                          const numValue = value === '' ? 0 : parseInt(value);
                          // Validar que no sea negativo
                          if (numValue >= 0) {
                            handleStockChange(idx, branch.id, numValue);
                          }
                        }
                      }}
                      onBlur={e => {
                        // Asegurar que siempre tenga un valor válido al salir del campo
                        const value = e.target.value;
                        if (value === '' || parseInt(value) < 0) {
                          handleStockChange(idx, branch.id, 0);
                        }
                      }}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-600">unidades</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={addVariant}>
            + Agregar Talla
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            {...register('description', { required: 'La descripción es requerida' })}
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.description && (
            <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : product ? 'Actualizar Producto' : 'Crear Producto'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
