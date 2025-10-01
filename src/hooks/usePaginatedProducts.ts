import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../lib/types';
import { productService } from '../services/productService';

interface UsePaginatedProductsParams {
  pageSize?: number;
  search?: string;
  category?: string;
  enabled?: boolean;
  includeHidden?: boolean;
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
  const { pageSize = 20, search = '', category = '', enabled = true, includeHidden = false } = params;

  const [page, setPage] = useState<number>(1);
  const [items, setItems] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedCategory, setDebouncedCategory] = useState(category);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce category
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCategory(category);
    }, 100);
    return () => clearTimeout(timer);
  }, [category]);

  const loadPage = useCallback(async (targetPage: number, replace: boolean = false, currentSearch?: string, currentCategory?: string) => {
    if (!enabled) return;
    try {
      if (targetPage === 1 && replace) {
        setIsInitialLoading(true);
      } else {
        setIsFetchingNextPage(true);
      }
      setError(null);

      const searchTerm = currentSearch !== undefined ? currentSearch : debouncedSearch;
      const categoryFilter = currentCategory !== undefined ? currentCategory : debouncedCategory;

      console.log('🔍 [usePaginatedProducts] Cargando página:', { 
        targetPage, 
        replace, 
        searchTerm, 
        categoryFilter, 
        debouncedSearch, 
        debouncedCategory 
      });

      const { items: pageItems, hasMore: pageHasMore } = await productService.getProductsPaginated({
        page: targetPage,
        limit: pageSize,
        search: searchTerm,
        category: categoryFilter,
        includeHidden
      });

      console.log('📊 [usePaginatedProducts] Página cargada:', { 
        pageItems: pageItems.length, 
        hasMore: pageHasMore 
      });

      setItems(prev => (replace ? pageItems : [...prev, ...pageItems]));
      setHasMore(pageHasMore);
      setPage(targetPage);
    } catch (e: any) {
      console.error('❌ [usePaginatedProducts] Error:', e);
      setError(e?.message || 'Error cargando productos');
    } finally {
      setIsInitialLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [enabled, pageSize, debouncedSearch, debouncedCategory, includeHidden]);

  const reload = useCallback(() => {
    loadPage(1, true);
  }, [loadPage]);

  const fetchNextPage = useCallback(() => {
    if (isInitialLoading || isFetchingNextPage || !hasMore) return;
    loadPage(page + 1);
  }, [isInitialLoading, isFetchingNextPage, hasMore, loadPage, page]);

  const resetAndRefetch = useCallback((opts?: { search?: string; category?: string }) => {
    setItems([]);
    setHasMore(true);
    loadPage(1, true, opts?.search, opts?.category);
  }, [loadPage]);

  // initial load
  useEffect(() => {
    if (!enabled) return;
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // reset when debounced search or category changes
  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setHasMore(true);
    loadPage(1, true);
  }, [debouncedSearch, debouncedCategory, enabled, loadPage]);

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


