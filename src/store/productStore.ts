import { create } from 'zustand';
import type { Product, Stock } from '../lib/types';
import { productService } from '../services/productService';


interface ProductState {
  products: Product[];
  stock: Stock[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;
  loadStockByBranch: (branchId: string) => Promise<void>;
  createProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createProductVariant: (variant: { product_id: string; size: string }) => Promise<any>;
  updateStock: (variantId: string, branchId: string, quantity: number) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  getStockByProduct: (variantId: string) => Promise<Stock[]>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  stock: [],
  isLoading: false,

  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const products = await productService.getProducts();
      set({ products, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadStockByBranch: async (branchId: string) => {
    set({ isLoading: true });
    try {
      const stock = await productService.getStockByBranch(branchId);
      set({ stock, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createProduct: async (productData) => {
    const product = await productService.createProduct(productData);
    set(state => ({ 
      products: [product, ...state.products] 
    }));
    return product;
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    const updatedProduct = await productService.updateProduct(id, updates);
    set(state => ({
      products: state.products.map(p => p.id === id ? updatedProduct : p)
    }));
  },

  deleteProduct: async (id: string) => {
    await productService.deleteProduct(id);
    set(state => ({
      products: state.products.filter(p => p.id !== id)
    }));
  },

  createProductVariant: async (variant) => {
    return await productService.createProductVariant(variant);
  },

  updateStock: async (variantId: string, branchId: string, quantity: number) => {
    await productService.updateStock(variantId, branchId, quantity);
    await get().loadStockByBranch(branchId);
  },

  uploadImage: async (file: File) => {
    return await productService.uploadProductImage(file);
  },

  getStockByProduct: async (variantId: string) => {
    return await productService.getStockByProduct(variantId);
  }
}));