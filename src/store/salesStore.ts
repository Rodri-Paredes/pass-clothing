import { create } from 'zustand';
import type { Sale, DashboardStats } from '../lib/types';
import { salesService } from '../services/salesService';

interface SalesState {
  sales: Sale[];
  dashboardStats: DashboardStats | null;
  isLoading: boolean;
  
  loadSalesByBranch: (branchId: string) => Promise<void>;
  loadDashboardStats: (branchId: string) => Promise<void>;
  createSale: (
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>,
    branchId: string,
    userId: string,
    paymentType: 'QR' | 'EFECTIVO' | 'TARJETA'
  ) => Promise<Sale>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  dashboardStats: null,
  isLoading: false,

  loadSalesByBranch: async (branchId: string) => {
    set({ isLoading: true });
    try {
      const sales = await salesService.getSalesByBranch(branchId);
      set({ sales, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadDashboardStats: async (branchId: string) => {
    set({ isLoading: true });
    try {
      const dashboardStats = await salesService.getDashboardStats(branchId);
      set({ dashboardStats, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createSale: async (items, branchId, userId, paymentType) => {
    const sale = await salesService.createSale(items, branchId, userId, paymentType);
    set(state => ({
      sales: [sale, ...state.sales]
    }));
    return sale;
  }
}));