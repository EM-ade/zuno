/**
 * Optimized Navigation Hook
 * Implements prefetching, preloading, and smooth transitions
 */

import { useRouter } from 'next/navigation';
import { useEffect, useCallback, useRef, useState } from 'react';

interface NavigationOptions {
  prefetch?: boolean;
  preload?: boolean;
  transition?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
}

// Cache for prefetched data
const prefetchCache = new Map<string, unknown>();
const preloadedLinks = new Set<string>();

export function useOptimizedNavigation(options: NavigationOptions = {}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Prefetch data for a route
   */
  const prefetchRoute = useCallback(async (href: string) => {
    if (prefetchCache.has(href) || preloadedLinks.has(href)) {
      return;
    }

    try {
      // Mark as preloaded to avoid duplicate requests
      preloadedLinks.add(href);

      // Prefetch the route
      router.prefetch(href);

      // For API routes, prefetch data
      if (href.startsWith('/mint/') || href.startsWith('/marketplace')) {
        const apiUrl = href.replace('/mint/', '/api/mint/').replace('/marketplace', '/api/marketplace/collections');
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-Prefetch': 'true',
          },
        });

        if (response.ok) {
          const data = await response.json();
          prefetchCache.set(href, data);
        }
      }
    } catch (error) {
      console.error('Prefetch error:', error);
      preloadedLinks.delete(href);
    }
  }, [router]);

  /**
   * Navigate with optimization
   */
  const navigate = useCallback(async (href: string) => {
    // Cancel any ongoing navigation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    setIsNavigating(true);
    options.onStart?.();

    try {
      // Check if we have prefetched data
      const cachedData = prefetchCache.get(href);
      
      if (cachedData) {
        // Use cached data for instant navigation
        sessionStorage.setItem(`nav-cache-${href}`, JSON.stringify(cachedData));
      }

      // Perform navigation
      router.push(href);

      // Clean up transition
      setTimeout(() => { // Keep the timeout to allow for animation to complete before marking navigation as complete
        // document.body.classList.remove('page-transition'); // Removed as framer-motion handles it
        // No longer need to remove the class, framer-motion handles unmounting
        
        // Ensure isNavigating is set to false after the transition duration.
        // The duration here should ideally match the framer-motion transition duration (0.3s).
        setIsNavigating(false);
        options.onComplete?.();
      }, 300);

    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Navigation error:', error);
      }
      setIsNavigating(false);
    }
  }, [router, options]);

  /**
   * Prefetch visible links
   */
  useEffect(() => {
    if (options.prefetch === false) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            const href = link.getAttribute('href');
            
            if (href && href.startsWith('/')) {
              prefetchRoute(href);
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    // Observe all internal links
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => observer.observe(link));

    return () => {
      links.forEach(link => observer.unobserve(link));
      observer.disconnect();
    };
  }, [prefetchRoute, options.prefetch]);

  /**
   * Preload on hover
   */
  useEffect(() => {
    if (options.preload === false) return;

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href^="/"]') as HTMLAnchorElement;
      
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          prefetchRoute(href);
        }
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
    };
  }, [prefetchRoute, options.preload]);

  /**
   * Clean up old cache entries
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const maxCacheSize = 50;
      const maxAge = 5 * 60 * 1000; // 5 minutes

      if (prefetchCache.size > maxCacheSize) {
        const entriesToDelete = prefetchCache.size - maxCacheSize;
        const keys = Array.from(prefetchCache.keys());
        
        for (let i = 0; i < entriesToDelete; i++) {
          prefetchCache.delete(keys[i]);
        }
      }

      // Clear old session storage entries
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('nav-cache-')) {
          try {
            const data = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (Date.now() - (data.timestamp || 0) > maxAge) {
              sessionStorage.removeItem(key);
            }
          } catch {
            sessionStorage.removeItem(key!);
          }
        }
      }
    }, 60000); // Run every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    navigate,
    prefetchRoute,
    isNavigating,
    clearCache: () => {
      prefetchCache.clear();
      preloadedLinks.clear();
    },
  };
}

/**
 * Hook to get cached navigation data
 */
export function useNavigationCache(key: string) {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    const cachedData = sessionStorage.getItem(`nav-cache-${key}`);
    if (cachedData) {
      try {
        setData(JSON.parse(cachedData));
        // Clear after use
        sessionStorage.removeItem(`nav-cache-${key}`);
      } catch {
        // Invalid cache data
      }
    }
  }, [key]);

  return data;
}

/**
 * Optimized Link component
 */
import Link from 'next/link';
import { forwardRef, MouseEvent } from 'react';

interface OptimizedLinkProps extends React.ComponentProps<typeof Link> {
  prefetch?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const OptimizedLink = forwardRef<HTMLAnchorElement, OptimizedLinkProps>(
  ({ prefetch = true, className, children, ...props }, ref) => {
    const { navigate, prefetchRoute } = useOptimizedNavigation();

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const href = props.href.toString();
      navigate(href);
    }, [navigate, props.href]);

    const handleMouseEnter = useCallback(() => {
      const href = props.href.toString();
      prefetchRoute(href);
    }, [prefetchRoute, props.href]);

    return (
      <Link
        {...props}
        ref={ref}
        className={className}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        prefetch={prefetch}
      >
        {children}
      </Link>
    );
  }
);

OptimizedLink.displayName = 'OptimizedLink';
