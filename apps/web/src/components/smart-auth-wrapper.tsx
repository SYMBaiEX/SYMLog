'use client';

import { useEffect, useState } from 'react';
import { DesktopAuthFallback } from './desktop-auth-fallback';
import { WebAuthFlow } from './web-auth-flow';

export function SmartAuthWrapper() {
  const [useFallback, setUseFallback] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Try to detect if we can use Crossmint
  useEffect(() => {
    const checkCrossmintAvailability = async () => {
      try {
        // Check if we're in a Tauri environment
        const isTauri = typeof window !== 'undefined' && window.__TAURI__;

        // For Tauri apps, we'll use the fallback by default to avoid URL issues
        if (isTauri) {
          console.log('Tauri environment detected, using local auth fallback');
          setUseFallback(true);
          setIsReady(true);
          return;
        }

        // For web, try to use Crossmint but with error handling
        setUseFallback(false);
        setIsReady(true);
      } catch (error) {
        console.warn('Crossmint not available, using fallback auth:', error);
        setUseFallback(true);
        setIsReady(true);
      }
    };

    checkCrossmintAvailability();
  }, []);

  if (!isReady) {
    return null; // or a loading spinner
  }

  if (useFallback) {
    return <DesktopAuthFallback />;
  }

  // Wrap Crossmint with error boundary
  return <CrossmintAuthWithFallback />;
}

function CrossmintAuthWithFallback() {
  const [hasError, setHasError] = useState(false);

  // Monitor for errors in Crossmint auth
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Check if error is related to Crossmint SDK
      if (
        event.filename?.includes('crossmint') ||
        event.error?.stack?.includes('crossmint') ||
        event.message?.toLowerCase().includes('url')
      ) {
        console.warn(
          'Crossmint error detected, switching to fallback:',
          event.error
        );
        setHasError(true);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.stack?.includes('crossmint') ||
        event.reason?.message?.toLowerCase().includes('url')
      ) {
        console.warn(
          'Crossmint promise rejection detected, switching to fallback:',
          event.reason
        );
        setHasError(true);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);

  if (hasError) {
    return <DesktopAuthFallback />;
  }

  try {
    return <WebAuthFlow />;
  } catch (error) {
    console.warn('Crossmint component error, using fallback:', error);
    return <DesktopAuthFallback />;
  }
}
