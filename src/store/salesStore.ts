import { create } from 'zustand';
import type { Sale, DashboardStats, MixedPaymentBreakdown, SalesWithDiscounts, MonthlyRevenueReport, MonthlyRevenueComparison } from '../lib/types';
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
    paymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    discountAmount?: number,
    paymentDetails?: {
      efectivo?: number;
      qr?: number;
      tarjeta?: number;
    },
    notes?: string
  ) => Promise<Sale>;
  updatePaymentMethod: (
    saleId: string,
    newPaymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    paymentDetails?: {
      efectivo?: number;
      qr?: number;
      tarjeta?: number;
    }
  ) => Promise<Sale>;
  getSalesWithDiscounts: (branchId: string, date: string) => Promise<SalesWithDiscounts>;
  getMixedPaymentBreakdown: (branchId: string, date: string) => Promise<MixedPaymentBreakdown[]>;
  getPreviousMonthRevenueReport: (branchId: string) => Promise<MonthlyRevenueReport>;
  getMonthlyRevenueReport: (branchId: string, year: number, month: number) => Promise<MonthlyRevenueReport>;
  getMonthlyRevenueComparison: (branchId: string) => Promise<MonthlyRevenueComparison>;
  getDateRangeRevenueReport: (branchId: string, startDate: string, endDate: string) => Promise<MonthlyRevenueReport>;
}

export const useSalesStore = create<SalesState>((set) => ({
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

  createSale: async (items, branchId, userId, paymentType, discountAmount = 0, paymentDetails, notes) => {
    const sale = await salesService.createSale(items, branchId, userId, paymentType, discountAmount, paymentDetails, notes);
    set(state => ({
      sales: [sale, ...state.sales]
    }));
    return sale;
  },

  updatePaymentMethod: async (saleId, newPaymentType, paymentDetails) => {
    const updatedSale = await salesService.updatePaymentMethod(saleId, newPaymentType, paymentDetails);
    set(state => ({
      sales: state.sales.map(sale => 
        sale.id === saleId ? updatedSale : sale
      )
    }));
    return updatedSale;
  },

  getSalesWithDiscounts: async (branchId: string, date: string) => {
    return await salesService.getSalesWithDiscounts(branchId, date);
  },

  getMixedPaymentBreakdown: async (branchId: string, date: string) => {
    return await salesService.getMixedPaymentBreakdown(branchId, date);
  },

  getPreviousMonthRevenueReport: async (branchId: string) => {
    return await salesService.getPreviousMonthRevenueReport(branchId);
  },

  getMonthlyRevenueReport: async (branchId: string, year: number, month: number) => {
    return await salesService.getMonthlyRevenueReport(branchId, year, month);
  },

  getMonthlyRevenueComparison: async (branchId: string) => {
    return await salesService.getMonthlyRevenueComparison(branchId);
  },

  getDateRangeRevenueReport: async (branchId: string, startDate: string, endDate: string) => {
    return await salesService.getDateRangeRevenueReport(branchId, startDate, endDate);
  }
}));