'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { preloadCriticalChunks } from '@/lib/bundle-optimization';

/**
 * Component that preloads critical chunks based on the current route
 */
export function RoutePreloader() {
  const pathname = usePathname();

  useEffect(() => {
    // Preload chunks for the current route
    preloadCriticalChunks(pathname);
  }, [pathname]);

  // This component doesn't render anything
  return null;
}
