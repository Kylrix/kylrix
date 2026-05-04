'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Query } from 'appwrite';
import Fuse from 'fuse.js';

export interface SearchConfig {
  searchFields: string[]; // Fields to search in
  localSearch?: boolean; // Whether to use frontend search for small datasets
  threshold?: number; // Threshold for switching to backend search
  debounceMs?: number; // Debounce delay for search
}

export interface PaginationConfig {
  pageSize: number;
  cursorsEnabled?: boolean; // Use cursor-based pagination
}

interface UseSearchProps<T> {
  data: T[];
  fetchDataAction: (queries: string[]) => Promise<{ documents: T[]; total: number }>;
  searchConfig: SearchConfig;
  paginationConfig: PaginationConfig;
  dependencies?: any[]; // Dependencies to trigger re-fetch
}

interface SearchResult<T> {
  // Data state
  items: T[];
  totalCount: number;
  isSearching: boolean;
  error: string | null;
  
  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasSearchResults: boolean;
  
  // Pagination state
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  
  // Pagination actions
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  resetPagination: () => void;
  
  // Utility
  refresh: () => void;
  clearSearch: () => void;
}

// Simple debounce utility
function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

export function useSearch<T extends { $id: string; [key: string]: any }>({
  data,
  fetchDataAction,
  searchConfig,
  paginationConfig,
  dependencies = []
}: UseSearchProps<T>): SearchResult<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendData, setBackendData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  
  const {
    searchFields,
    localSearch = false,
    threshold = 100,
    debounceMs = 300
  } = searchConfig;
  
  const { pageSize } = paginationConfig;
  
  // Determine if we should use local search based on data size and config
  const useLocalSearch = useMemo(() => {
    return localSearch || data.length <= threshold;
  }, [localSearch, data.length, threshold]);
  
  // Memoize the Fuse instance to avoid re-creating it on every render
  const fuse = useMemo(() => {
    const fuseOptions = {
      keys: searchFields,
      includeScore: true,
      threshold: 0.4,
      minMatchCharLength: 2,
    };
    return new Fuse(data, fuseOptions);
  }, [data, searchFields]);

  // Local search function using the memoized Fuse instance
  const performLocalSearch = useCallback((query: string) => {
    if (!query.trim()) return data;

    const results = fuse.search(query);
    const uniqueResults = results.map(result => result.item);

    return uniqueResults.filter((item, index, arr) =>
      arr.findIndex(i => i.$id === item.$id) === index
    );
  }, [fuse, data]);
  
  // Backend search function
  const performBackendSearch = useCallback(async (query: string, page: number) => {
    let queries: string[] = [];
    const offset = (page - 1) * pageSize;
    
    if (!query.trim()) {
      // No search query, fetch all data with pagination
      queries = [
        Query.limit(pageSize),
        Query.offset(offset)
      ];
    } else {
      // Build search queries for multiple fields - use the first field
      queries = [
        Query.search(searchFields[0], query),
        Query.limit(pageSize),
        Query.offset(offset)
      ];
    }
    
    try {
      const result = await fetchDataAction(queries);
      return result;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to fetch data');
    }
  }, [fetchDataAction, searchFields, pageSize]);
  
  // Search execution function
  const executeSearch = useCallback(async (query: string, page: number = 1) => {
    setIsSearching(true);
    setError(null);
    
    try {
      if (useLocalSearch) {
        // Use local search
        const filtered = performLocalSearch(query);
        setBackendData(filtered);
        setTotalCount(filtered.length);
      } else {
        // Use backend search
        const result = await performBackendSearch(query, page);
        setBackendData(result.documents);
        setTotalCount(result.total);
      }
    } catch (err: any) {
      setError(err.message);
      setBackendData([]);
      setTotalCount(0);
    } finally {
      setIsSearching(false);
    }
  }, [useLocalSearch, performLocalSearch, performBackendSearch]);
  
  // Debounced search function
  const debouncedSearch = useDebounce(executeSearch, debounceMs);
  
  // Handle search query change
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on new search
    debouncedSearch(query, 1);
  }, [debouncedSearch]);
  
  // Get paginated items for local search
  const paginatedItems = useMemo(() => {
    if (useLocalSearch) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return backendData.slice(startIndex, endIndex);
    }
    return backendData;
  }, [useLocalSearch, backendData, currentPage, pageSize]);
  
  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;
  
  // Pagination actions
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    
    if (!useLocalSearch) {
      executeSearch(searchQuery, page);
    }
  }, [totalPages, useLocalSearch, executeSearch, searchQuery]);
  
  const nextPage = useCallback(() => {
    if (hasNextPage) {
      goToPage(currentPage + 1);
    }
  }, [hasNextPage, goToPage, currentPage]);
  
  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      goToPage(currentPage - 1);
    }
  }, [hasPreviousPage, goToPage, currentPage]);
  
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);
  
  // Utility functions
  const refresh = useCallback(() => {
    executeSearch(searchQuery, currentPage);
  }, [executeSearch, searchQuery, currentPage]);
  
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentPage(1);
    setBackendData(data);
    setTotalCount(data.length);
  }, [data]);
  
  // Sync data to backendData when no search is active
  const dataVersion = JSON.stringify(data.map(i => i.$id));
  useEffect(() => {
    if (!searchQuery) {
      if (useLocalSearch) {
        setBackendData(data);
        setTotalCount(data.length);
      } else {
        // If not using local search and no query, we should ideally re-fetch or trust parent
        // But for notes context, 'data' is our source of truth for the first page
        setBackendData(data);
        setTotalCount(data.length);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, searchQuery, useLocalSearch, data, ...dependencies]);
  
  return {
    // Data state
    items: paginatedItems,
    totalCount,
    isSearching,
    error,
    
    // Search state
    searchQuery,
    setSearchQuery: handleSearchQueryChange,
    hasSearchResults: searchQuery.trim().length > 0,
    
    // Pagination state
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    
    // Pagination actions
    goToPage,
    nextPage,
    previousPage,
    resetPagination,
    
    // Utility
    refresh,
    clearSearch
  };
}