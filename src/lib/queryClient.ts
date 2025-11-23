/**
 * Configuración de React Query para caché optimizado
 * Reduce llamadas a Supabase y mejora performance
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caché por defecto
      staleTime: 5 * 60 * 1000, // 5 minutos - datos considerados frescos
      gcTime: 10 * 60 * 1000, // 10 minutos - tiempo antes de garbage collection
      
      // Retry configuration
      retry: 1, // Solo reintentar 1 vez en caso de error
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch configuration
      refetchOnWindowFocus: false, // No refetch al cambiar de pestaña
      refetchOnReconnect: true, // Refetch al reconectar internet
      refetchOnMount: true, // Refetch al montar componente si stale
      
      // Network mode
      networkMode: 'online', // Solo ejecutar queries cuando hay internet
    },
    mutations: {
      // Retry configuration para mutations
      retry: 0, // No reintentar mutations automáticamente
      networkMode: 'online',
    },
  },
});

// Keys para queries (para invalidación y caché)
export const queryKeys = {
  // Productos
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    infinite: (filters: Record<string, any>) => [...queryKeys.products.all, 'infinite', filters] as const,
  },
  
  // Drops
  drops: {
    all: ['drops'] as const,
    lists: () => [...queryKeys.drops.all, 'list'] as const,
    active: () => [...queryKeys.drops.lists(), 'active'] as const,
    featured: () => [...queryKeys.drops.lists(), 'featured'] as const,
    detail: (id: string) => [...queryKeys.drops.all, 'detail', id] as const,
  },
  
  // Stock
  stock: {
    all: ['stock'] as const,
    byProduct: (productId: string) => [...queryKeys.stock.all, 'product', productId] as const,
    byBranch: (branchId: string) => [...queryKeys.stock.all, 'branch', branchId] as const,
  },
  
  // Sales
  sales: {
    all: ['sales'] as const,
    byBranch: (branchId: string) => [...queryKeys.sales.all, 'branch', branchId] as const,
    byDate: (branchId: string, date: string) => [...queryKeys.sales.all, 'date', branchId, date] as const,
  },
  
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: (branchId: string) => [...queryKeys.dashboard.all, 'stats', branchId] as const,
    revenue: (branchId: string, startDate: string, endDate: string) => 
      [...queryKeys.dashboard.all, 'revenue', branchId, startDate, endDate] as const,
  },
};
