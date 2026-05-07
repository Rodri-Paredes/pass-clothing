/**
 * Hooks optimizados con React Query para productos
 * Implementa caché, infinite scroll y optimistic updates
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import { queryKeys } from '../lib/queryClient';
import type { Product } from '../lib/types';

// ============================================
// QUERIES - Lectura de datos con caché
// ============================================

/**
 * Hook para obtener productos con paginación y caché
 */
export function useProducts(filters?: {
  category?: string;
  search?: string;
  includeHidden?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters || {}),
    queryFn: async () => {
      const { items } = await productService.getProductsPaginated({
        page: 1,
        limit: 50,
        category: filters?.category,
        search: filters?.search,
        includeHidden: filters?.includeHidden,
      });
      return items;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para infinite scroll de productos
 * Carga productos progresivamente conforme el usuario hace scroll
 */
export function useInfiniteProducts(filters?: {
  category?: string;
  search?: string;
  includeHidden?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters || {}),
    queryFn: async ({ pageParam = 1 }) => {
      return await productService.getProductsPaginated({
        page: pageParam,
        limit: 12, // 12 productos por página
        category: filters?.category,
        search: filters?.search,
        includeHidden: filters?.includeHidden,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      // Si hasMore es true, hay más páginas
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para obtener un producto específico
 */
export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId || ''),
    queryFn: () => productService.getProduct(productId!),
    enabled: !!productId, // Solo ejecutar si hay ID
    staleTime: 10 * 60 * 1000, // 10 minutos (detalles cambian menos)
  });
}

/**
 * Hook para prefetch de producto (precarga)
 * Útil para hover en cards o navegación anticipada
 */
export function usePrefetchProduct() {
  const queryClient = useQueryClient();

  return (productId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(productId),
      queryFn: () => productService.getProduct(productId),
      staleTime: 10 * 60 * 1000,
    });
  };
}

// ============================================
// MUTATIONS - Escritura de datos con optimistic updates
// ============================================

/**
 * Hook para crear producto con optimistic update
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) =>
      productService.createProduct(data),
    
    onSuccess: () => {
      // Invalidar lista de productos para que se recargue
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
    
    onError: (error) => {
      console.error('Error creando producto:', error);
    },
  });
}

/**
 * Hook para actualizar producto con optimistic update
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productService.updateProduct(id, data),
    
    onMutate: async ({ id, data }) => {
      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: queryKeys.products.detail(id) });

      // Guardar snapshot del valor anterior
      const previousProduct = queryClient.getQueryData(queryKeys.products.detail(id));

      // Optimistically update
      queryClient.setQueryData(queryKeys.products.detail(id), (old: any) => ({
        ...old,
        ...data,
      }));

      return { previousProduct };
    },
    
    onError: (_error, { id }, context) => {
      // Rollback en caso de error
      if (context?.previousProduct) {
        queryClient.setQueryData(queryKeys.products.detail(id), context.previousProduct);
      }
    },
    
    onSuccess: (_, { id }) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
}

/**
 * Hook para eliminar producto
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productService.deleteProduct(productId),
    
    onMutate: async (productId) => {
      // Cancelar queries
      await queryClient.cancelQueries({ queryKey: queryKeys.products.lists() });

      // Snapshot
      const previousProducts = queryClient.getQueryData(queryKeys.products.lists());

      // Optimistically update - remover de la lista
      queryClient.setQueriesData(
        { queryKey: queryKeys.products.lists() },
        (old: any) => old?.filter((p: Product) => p.id !== productId)
      );

      return { previousProducts };
    },
    
    onError: (_error, _productId, context) => {
      // Rollback
      if (context?.previousProducts) {
        queryClient.setQueriesData(
          { queryKey: queryKeys.products.lists() },
          context.previousProducts
        );
      }
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
}

/**
 * Hook para toggle de visibilidad de producto
 */
export function useToggleProductVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      productService.updateProduct(id, { is_visible: isVisible }),
    
    onMutate: async ({ id, isVisible }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.detail(id) });

      const previousProduct = queryClient.getQueryData(queryKeys.products.detail(id));

      queryClient.setQueryData(queryKeys.products.detail(id), (old: any) => ({
        ...old,
        is_visible: isVisible,
      }));

      return { previousProduct };
    },
    
    onError: (_error, { id }, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(queryKeys.products.detail(id), context.previousProduct);
      }
    },
    
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
}
