/**
 * Hook de infinite scroll optimizado con React Query
 * Carga automática de más datos al llegar al final de la lista
 */

import { useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';

interface UseInfiniteScrollOptions {
  threshold?: number; // Umbral de visibilidad (0-1)
  rootMargin?: string; // Margen antes de disparar (ej: '200px')
  enabled?: boolean; // Habilitar/deshabilitar
}

/**
 * Hook que detecta cuando el usuario llega al final de la lista
 * y dispara la carga de más datos automáticamente
 */
export function useInfiniteScroll(
  query: UseInfiniteQueryResult<any, Error>,
  options: UseInfiniteScrollOptions = {}
) {
  const {
    threshold = 0.5,
    rootMargin = '100px',
    enabled = true,
  } = options;

  const { ref, inView } = useInView({
    threshold,
    rootMargin,
  });

  // Cargar más cuando el sentinel está visible
  useEffect(() => {
    if (
      inView &&
      enabled &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage();
    }
  }, [inView, enabled, query]);

  return {
    ref, // Ref para el sentinel (elemento al final de la lista)
    inView,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
  };
}

/**
 * Hook simplificado que combina infinite scroll con prefetch
 */
export function useOptimizedInfiniteScroll<T>(
  query: UseInfiniteQueryResult<any, Error>,
  onPrefetch?: (item: T) => void
) {
  const scroll = useInfiniteScroll(query);

  // Prefetch al hacer hover sobre items
  const handlePrefetch = useCallback(
    (item: T) => {
      if (onPrefetch) {
        onPrefetch(item);
      }
    },
    [onPrefetch]
  );

  return {
    ...scroll,
    handlePrefetch,
  };
}
