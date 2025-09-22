"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";

// ============================================
// 1. DEBOUNCED SEARCH HOOK
// ============================================
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// 2. OPTIMIZED API HOOK WITH CACHING
// ============================================
interface UseOptimizedApiOptions<T> {
  cacheTime?: number; // Cache duration in milliseconds
  staleTime?: number; // Time before data is considered stale
  retryCount?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

const apiCache = new Map<string, CacheEntry<unknown>>();

export function useOptimizedApi<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseOptimizedApiOptions<T> = {}
) {
  const {
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 30 * 1000, // 30 seconds
    retryCount = 3,
    retryDelay = 1000,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (retries = 0): Promise<void> => {
      // Check cache first
      const cached = apiCache.get(key);
      const now = Date.now();

      if (cached && now - cached.timestamp < cacheTime) {
        setData(cached.data as T);
        if (now - cached.timestamp < staleTime) {
          // Data is fresh, no need to fetch
          return;
        }
        // Data is stale but usable, fetch in background
      }

      setLoading(true);
      setError(null);

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const result = await fetcher();

        // Update cache
        apiCache.set(key, {
          data: result,
          timestamp: now,
          isStale: false,
        });

        setData(result);
        onSuccess?.(result);
      } catch (err) {
        const error = err as Error;

        if (error.name === "AbortError") {
          return; // Request was cancelled
        }

        if (retries < retryCount) {
          retryTimeoutRef.current = setTimeout(() => {
            fetchData(retries + 1);
          }, retryDelay * Math.pow(2, retries)); // Exponential backoff
          return;
        }

        setError(error);
        onError?.(error);

        // Use stale data if available
        if (cached) {
          setData(cached.data as T);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      key,
      fetcher,
      cacheTime,
      staleTime,
      retryCount,
      retryDelay,
      onError,
      onSuccess,
    ]
  );

  const refetch = useCallback(() => {
    // Clear cache for this key
    apiCache.delete(key);
    return fetchData();
  }, [key, fetchData]);

  const mutate = useCallback(
    (newData: T) => {
      setData(newData);
      apiCache.set(key, {
        data: newData,
        timestamp: Date.now(),
        isStale: false,
      });
    },
    [key]
  );

  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    mutate,
  };
}

// ============================================
// 3. INFINITE SCROLL HOOK
// ============================================
export function useInfiniteScroll<T>(
  fetchMore: (
    cursor?: string
  ) => Promise<{ items: T[]; nextCursor?: string; hasNextPage: boolean }>,
  options: { threshold?: number; rootMargin?: string } = {}
) {
  const { threshold = 0.1, rootMargin = "100px" } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage) return;

    setLoading(true);
    try {
      const result = await fetchMore(cursor);
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      console.error("Failed to load more items:", error);
      toast.error("Failed to load more items");
    } finally {
      setLoading(false);
    }
  }, [fetchMore, cursor, loading, hasNextPage]);

  const reset = useCallback(() => {
    setItems([]);
    setCursor(undefined);
    setHasNextPage(true);
  }, []);

  useEffect(() => {
    if (!loadingRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(loadingRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, threshold, rootMargin]);

  return {
    items,
    loading,
    hasNextPage,
    loadMore,
    reset,
    loadingRef,
  };
}

// ============================================
// 4. OPTIMIZED SEARCH HOOK
// ============================================
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs: number = 300
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, debounceMs);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchResults = await searchFn(searchQuery);
        setResults(searchResults);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchFn]
  );

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return {
    query,
    setQuery,
    results,
    loading,
  };
}

// ============================================
// 5. REAL-TIME DATA HOOK
// ============================================
export function useRealtimeData<T>(
  initialData: T,
  subscriptionKey: string,
  updateFn?: (data: T, update: unknown) => T
) {
  const [data, setData] = useState<T>(initialData);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      wsRef.current?.send(
        JSON.stringify({
          type: "subscribe",
          key: subscriptionKey,
        })
      );
    };

    wsRef.current.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.key === subscriptionKey) {
          setData((prevData) =>
            updateFn ? updateFn(prevData, update.data) : update.data
          );
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [subscriptionKey, updateFn]);

  return data;
}

// ============================================
// 6. BATCH REQUEST HOOK
// ============================================
export function useBatchRequests(
  batchSize: number = 10,
  batchDelay: number = 100
) {
  const [queue, setQueue] = useState<
    Array<{
      id: string;
      request: () => Promise<unknown>;
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }>
  >([]);

  const processBatch = useCallback(async () => {
    if (queue.length === 0) return;

    const batch = queue.splice(0, batchSize);
    const promises = batch.map(async (item) => {
      try {
        const result = await item.request();
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      }
    });

    await Promise.allSettled(promises);
  }, [queue, batchSize]);

  useEffect(() => {
    if (queue.length >= batchSize) {
      processBatch();
    } else if (queue.length > 0) {
      const timeout = setTimeout(processBatch, batchDelay);
      return () => clearTimeout(timeout);
    }
  }, [queue, batchSize, batchDelay, processBatch]);

  const addRequest = useCallback(<T>(request: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 11);
      setQueue((prev) => [
        ...prev,
        {
          id,
          request: request as () => Promise<unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
        },
      ]);
    });
  }, []);

  return { addRequest };
}
