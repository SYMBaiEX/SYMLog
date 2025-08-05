'use client';

/**
 * Bundle optimization utilities and monitoring
 */

/**
 * Logs bundle loading performance in development
 */
export function logBundlePerformance(componentName: string, startTime: number) {
  if (process.env.NODE_ENV === 'development') {
    const loadTime = performance.now() - startTime;
    console.log(`🚀 ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
  }
}

/**
 * Preloads critical chunks based on route
 */
export function preloadCriticalChunks(route: string) {
  if (typeof window === 'undefined') return;

  const criticalChunks: Record<
    string,
    (() => Promise<any>)[] | (() => (() => Promise<any>)[])
  > = {
    '/chat': [
      () => import('@/components/chat/tree-visualization'),
      () => import('@/components/chat/chat-settings-modal'),
    ],
    '/blog': () => [() => import('@/app/blog/page')],
    '/research': () => [() => import('@/app/research/page')],
    '/contact': () => [() => import('@/app/contact/page')],
  };

  const chunksFactory = criticalChunks[route];
  if (chunksFactory) {
    // Preload with a small delay to not block initial render
    setTimeout(() => {
      const chunks = Array.isArray(chunksFactory)
        ? chunksFactory
        : chunksFactory();
      chunks.forEach((chunk: () => Promise<any>) => {
        chunk().catch(() => {
          // Silent fail for preloading
        });
      });
    }, 500);
  }
}

/**
 * Monitors and reports bundle sizes in development
 */
export class BundleMonitor {
  private static instance: BundleMonitor;
  private loadedChunks = new Set<string>();
  private loadTimes = new Map<string, number>();

  static getInstance(): BundleMonitor {
    if (!BundleMonitor.instance) {
      BundleMonitor.instance = new BundleMonitor();
    }
    return BundleMonitor.instance;
  }

  recordChunkLoad(chunkName: string, loadTime: number) {
    this.loadedChunks.add(chunkName);
    this.loadTimes.set(chunkName, loadTime);

    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Chunk '${chunkName}' loaded in ${loadTime.toFixed(2)}ms`);
    }
  }

  getStats() {
    const totalChunks = this.loadedChunks.size;
    const totalLoadTime = Array.from(this.loadTimes.values()).reduce(
      (sum, time) => sum + time,
      0
    );
    const averageLoadTime = totalChunks > 0 ? totalLoadTime / totalChunks : 0;

    return {
      totalChunks,
      totalLoadTime,
      averageLoadTime,
      loadedChunks: Array.from(this.loadedChunks),
      loadTimes: Object.fromEntries(this.loadTimes),
    };
  }

  printStats() {
    if (process.env.NODE_ENV === 'development') {
      const stats = this.getStats();
      console.group('📊 Bundle Loading Stats');
      console.log(`Total chunks loaded: ${stats.totalChunks}`);
      console.log(`Total load time: ${stats.totalLoadTime.toFixed(2)}ms`);
      console.log(`Average load time: ${stats.averageLoadTime.toFixed(2)}ms`);
      console.log('Load times by chunk:', stats.loadTimes);
      console.groupEnd();
    }
  }
}

/**
 * Creates a performance-optimized dynamic import with monitoring
 */
export function createMonitoredDynamicImport<T>(
  importFn: () => Promise<T>,
  chunkName: string
) {
  return async (): Promise<T> => {
    const startTime = performance.now();

    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;

      BundleMonitor.getInstance().recordChunkLoad(chunkName, loadTime);

      return module;
    } catch (error) {
      console.error(`Failed to load chunk '${chunkName}':`, error);
      throw error;
    }
  };
}

/**
 * Web Vitals tracking for bundle performance
 */
export function trackBundleVitals() {
  if (typeof window === 'undefined') return;

  // Track First Input Delay (FID)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'first-input') {
        const processingStart =
          (entry as any).processingStart ?? entry.startTime;
        const fid = processingStart - entry.startTime;
        if (process.env.NODE_ENV === 'development') {
          console.log(`📏 First Input Delay: ${fid.toFixed(2)}ms`);
        }
      }
    }
  }).observe({ entryTypes: ['first-input'] });

  // Track Largest Contentful Paint (LCP)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (
        entry.entryType === 'largest-contentful-paint' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.log(
          `📏 Largest Contentful Paint: ${entry.startTime.toFixed(2)}ms`
        );
      }
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // Track Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const hadRecentInput = (entry as any).hadRecentInput ?? false;
      if (!hadRecentInput) {
        clsValue += (entry as any).value ?? 0;
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`📏 Cumulative Layout Shift: ${clsValue.toFixed(4)}`);
    }
  }).observe({ entryTypes: ['layout-shift'] });
}

// Initialize bundle monitoring in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  trackBundleVitals();

  // Print stats on page unload
  window.addEventListener('beforeunload', () => {
    BundleMonitor.getInstance().printStats();
  });
}
