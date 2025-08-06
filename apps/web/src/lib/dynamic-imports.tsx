'use client';

import dynamic from 'next/dynamic';
import React, { type ComponentType, Suspense } from 'react';

/**
 * Optimized loading component for dynamic imports
 */
export const OptimizedLoader = ({
  size = 'default',
}: {
  size?: 'small' | 'default' | 'large';
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const containerClasses = {
    small: 'p-2',
    default: 'p-4',
    large: 'p-6',
  };

  return (
    <div
      className={`flex items-center justify-center ${containerClasses[size]}`}
    >
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-periwinkle border-t-transparent`}
      />
    </div>
  );
};

/**
 * Creates an optimized dynamic import with consistent loading states
 * @param importFn - Function that returns the dynamic import
 * @param options - Configuration options
 */
export function createOptimizedDynamicImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  options: {
    loading?: ComponentType<any>;
    ssr?: boolean;
    preload?: boolean;
    loadingSize?: 'small' | 'default' | 'large';
  } = {}
) {
  const loadingComponent = options.loading
    ? () => React.createElement(options.loading!)
    : () => <OptimizedLoader size={options.loadingSize} />;

  const DynamicComponent = dynamic(
    () =>
      Promise.resolve(importFn()).then((mod) => {
        // Handle both default exports and named exports
        return 'default' in mod ? mod : { default: mod as T };
      }),
    {
      loading: loadingComponent,
      ssr: options.ssr ?? false, // Default to client-side rendering for better performance
    }
  );

  // Preload component when requested
  if (options.preload && typeof window !== 'undefined') {
    const preloadTimer = setTimeout(() => {
      if (
        'preload' in DynamicComponent &&
        typeof DynamicComponent.preload === 'function'
      ) {
        DynamicComponent.preload();
      }
    }, 100); // Small delay to not block initial render

    // Cleanup
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => clearTimeout(preloadTimer));
    }
  }

  return DynamicComponent;
}

/**
 * Wraps a component with Suspense boundary for additional error resilience
 */
export function withSuspense<T extends ComponentType<any>>(
  Component: T,
  fallback?: ComponentType<any>
): ComponentType<React.ComponentProps<T>> {
  const FallbackComponent = fallback || OptimizedLoader;

  return function SuspenseWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<FallbackComponent />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

/**
 * Preloads a dynamic component based on user interaction or viewport entry
 */
export function preloadOnInteraction(componentPromise: () => Promise<any>) {
  if (typeof window === 'undefined') return;

  const preload = () => {
    componentPromise().catch(() => {
      // Silent fail for preloading
    });
  };

  // Preload on mouseover for desktop
  document.addEventListener('mouseover', preload, {
    once: true,
    passive: true,
  });

  // Preload on touchstart for mobile
  document.addEventListener('touchstart', preload, {
    once: true,
    passive: true,
  });

  // Preload on focus for keyboard users
  document.addEventListener('focusin', preload, { once: true, passive: true });
}
