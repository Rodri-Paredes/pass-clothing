import { create } from 'zustand';
import type { Discount } from '../lib/types';
import { discountService } from '../services/discountService';

interface DiscountState {
  discounts: Discount[];
  isLoading: boolean;
  error: string | null;
  activeDiscountsMap: Map<string, {
    discount_id: string;
    discount_name: string;
    percentage: number;
    start_date: string;
    end_date: string;
    source: 'product' | 'drop';
  }>;

  loadDiscounts: () => Promise<void>;
  loadActiveDiscountsMap: () => Promise<void>;
  createDiscount: (
    discount: Omit<Discount, 'id' | 'created_at' | 'updated_at' | 'discount_products' | 'discount_drops' | 'product_count' | 'drop_count'>,
    productIds: string[],
    dropIds?: string[]
  ) => Promise<Discount>;
  updateDiscount: (
    id: string,
    updates: Partial<Omit<Discount, 'id' | 'created_at' | 'updated_at' | 'discount_products' | 'discount_drops' | 'product_count' | 'drop_count'>>,
    productIds?: string[],
    dropIds?: string[]
  ) => Promise<void>;
  deleteDiscount: (id: string) => Promise<void>;
  toggleDiscountActive: (id: string) => Promise<void>;
  getProductDiscount: (productId: string) => {
    discount_id: string;
    discount_name: string;
    percentage: number;
    start_date: string;
    end_date: string;
    source: 'product' | 'drop';
  } | undefined;
}

export const useDiscountStore = create<DiscountState>((set, get) => ({
  discounts: [],
  isLoading: false,
  error: null,
  activeDiscountsMap: new Map(),

  loadDiscounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const discounts = await discountService.getAllDiscounts();
      set({ discounts, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  loadActiveDiscountsMap: async () => {
    try {
      const map = await discountService.getActiveDiscountsMap();
      set({ activeDiscountsMap: map });
    } catch (error: any) {
      console.error('Error loading active discounts map:', error);
    }
  },

  createDiscount: async (discountData, productIds, dropIds = []) => {
    set({ isLoading: true, error: null });
    try {
      const discount = await discountService.createDiscount(discountData, productIds, dropIds);
      await get().loadDiscounts();
      await get().loadActiveDiscountsMap();
      set({ isLoading: false });
      return discount;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  updateDiscount: async (id, updates, productIds, dropIds) => {
    set({ isLoading: true, error: null });
    try {
      await discountService.updateDiscount(id, updates, productIds, dropIds);
      await get().loadDiscounts();
      await get().loadActiveDiscountsMap();
      set({ isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  deleteDiscount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await discountService.deleteDiscount(id);
      set((state) => ({
        discounts: state.discounts.filter((d) => d.id !== id),
        isLoading: false,
      }));
      await get().loadActiveDiscountsMap();
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  toggleDiscountActive: async (id) => {
    try {
      await discountService.toggleDiscountActive(id);
      await get().loadDiscounts();
      await get().loadActiveDiscountsMap();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  getProductDiscount: (productId: string) => {
    return get().activeDiscountsMap.get(productId);
  },
}));
