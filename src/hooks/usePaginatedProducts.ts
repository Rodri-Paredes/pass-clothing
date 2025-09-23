import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../lib/types';
import { productService } from '../services/productService';

interface UsePaginatedProductsParams {
  pageSize?: number;
  search?: string;
  category?: string;
  enabled?: boolean;
}

interface UsePaginatedProductsResult {
  items: Product[];
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => void;
  fetchNextPage: () => void;
  resetAndRefetch: (opts?: { search?: string; category?: string }) => void;
  observerRef: (node: HTMLElement | null) => void;
}

export function usePaginatedProducts(params: UsePaginatedProductsParams = {}): UsePaginatedProductsResult {
  const { pageSize = 20, search = '', category = '', enabled = true } = params;

  const [page, setPage] = useState<number>(1);
  const [items, setItems] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef(search);
  const categoryRef = useRef(category);

  const loadPage = useCallback(async (targetPage: number, replace: boolean = false) => {
    if (!enabled) return;
    try {
      if (targetPage === 1 && replace) {
        setIsInitialLoading(true);
      } else {
        setIsFetchingNextPage(true);
      }
      setError(null);

      const { items: pageItems, hasMore: pageHasMore } = await productService.getProductsPaginated({
        page: targetPage,
        limit: pageSize,
        search: searchRef.current,
        category: categoryRef.current
      });

      setItems(prev => (replace ? pageItems : [...prev, ...pageItems]));
      setHasMore(pageHasMore);
      setPage(targetPage);
    } catch (e: any) {
      setError(e?.message || 'Error cargando productos');
    } finally {
      setIsInitialLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [enabled, pageSize]);

  const reload = useCallback(() => {
    loadPage(1, true);
  }, [loadPage]);

  const fetchNextPage = useCallback(() => {
    if (isInitialLoading || isFetchingNextPage || !hasMore) return;
    loadPage(page + 1);
  }, [isInitialLoading, isFetchingNextPage, hasMore, loadPage, page]);

  const resetAndRefetch = useCallback((opts?: { search?: string; category?: string }) => {
    if (opts?.search !== undefined) searchRef.current = opts.search;
    if (opts?.category !== undefined) categoryRef.current = opts.category;
    setItems([]);
    setHasMore(true);
    loadPage(1, true);
  }, [loadPage]);

  // initial load
  useEffect(() => {
    if (!enabled) return;
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // intersection observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const observerRef = useCallback((node: HTMLElement | null) => {
    if (!enabled) return;
    if (isInitialLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    }, { rootMargin: '300px' });
    if (node) observer.current.observe(node);
  }, [enabled, isInitialLoading, fetchNextPage]);

  return useMemo(() => ({
    items,
    isInitialLoading,
    isFetchingNextPage,
    error,
    hasMore,
    reload,
    fetchNextPage,
    resetAndRefetch,
    observerRef
  }), [items, isInitialLoading, isFetchingNextPage, error, hasMore, reload, fetchNextPage, resetAndRefetch, observerRef]);
}


