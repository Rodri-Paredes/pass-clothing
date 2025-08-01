import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Upload, X } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useProductStore } from '../../store/productStore';
import { useAuthStore } from '../../store/authStore';
import { CATEGORIES, SIZES } from '../../lib/constants';

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  size: string;
  price: number;
}

interface ProductFormProps {
  product?: any;
  onClose: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose }) => {
  const { createProduct, updateProduct, uploadImage, getStockByProduct, updateStock } = useProductStore();
  const { branches, activeBranch } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [stockData, setStockData] = useState<{ [branchId: string]: number }>({});

  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormData>({
    defaultValues: product ? {
      name: product.name,
      description: product.description,
      category: product.category,
      size: product.size,
      price: product.price
    } : {}
  });

  useEffect(() => {
    if (product) {
      setImagePreview(product.image_url || '');
      loadStockData();
    } else {
      // Initialize stock data for new products
      const initialStock: { [branchId: string]: number } = {};
      branches.forEach(branch => {
        initialStock[branch.id] = 0;
      });
      setStockData(initialStock);
    }
  }, [product, branches]);

  const loadStockData = async () => {
    if (!product) return;
    
    try {
      const stockByProduct = await getStockByProduct(product.id);
      const stockMap: { [branchId: string]: number } = {};
      
      branches.forEach(branch => {
        const branchStock = stockByProduct.find(s => s.branch_id === branch.id);
        stockMap[branch.id] = branchStock?.quantity || 0;
      });
      
      setStockData(stockMap);
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  };

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

  const handleStockChange = (branchId: string, quantity: number) => {
    setStockData(prev => ({
      ...prev,
      [branchId]: Math.max(0, quantity)
    }));
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    
    try {
      let imageUrl = product?.image_url || '';
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        ...data,
        price: Number(data.price),
        image_url: imageUrl
      };

      let savedProduct;
      if (product) {
        await updateProduct(product.id, productData);
        savedProduct = { ...product, ...productData };
      } else {
        savedProduct = await createProduct(productData);
      }

      // Update stock for all branches
      for (const [branchId, quantity] of Object.entries(stockData)) {
        await updateStock(savedProduct.id, branchId, quantity);
      }

      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
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
          <Input
            label="Nombre del Producto"
            {...register('name', { required: 'El nombre es requerido' })}
            error={errors.name?.message}
          />

          <Input
            label="Precio"
            type="number"
            step="0.01"
            {...register('price', { 
              required: 'El precio es requerido',
              min: { value: 0, message: 'El precio debe ser mayor a 0' }
            })}
            error={errors.price?.message}
          />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              {...register('category', { required: 'La categoría es requerida' })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Seleccionar categoría</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Talla
            </label>
            <select
              {...register('size', { required: 'La talla es requerida' })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Seleccionar talla</option>
              {SIZES.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            {errors.size && (
              <p className="text-sm text-red-600 mt-1">{errors.size.message}</p>
            )}
          </div>
        </div>

        {/* Stock by Branch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Stock por Sucursal
          </label>
          <div className="space-y-3">
            {branches.map(branch => (
              <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{branch.name}</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={stockData[branch.id] || 0}
                    onChange={(e) => handleStockChange(branch.id, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-sm text-gray-600">unidades</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
          >
            {product ? 'Actualizar' : 'Crear'} Producto
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;