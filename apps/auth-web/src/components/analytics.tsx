'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Simple analytics tracking
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Track page views in development/staging
    if (process.env.NODE_ENV === 'development') {
      console.log('Page view:', pathname);
    }

    // Here you can add your preferred analytics service
    // Example integrations:

    // Google Analytics 4
    // if (typeof window !== 'undefined' && window.gtag) {
    //   window.gtag('config', 'GA_MEASUREMENT_ID', {
    //     page_path: pathname,
    //   })
    // }

    // Vercel Analytics
    // if (typeof window !== 'undefined' && window.va) {
    //   window.va('track', 'pageview', { path: pathname })
    // }

    // PostHog
    // if (typeof window !== 'undefined' && window.posthog) {
    //   window.posthog.capture('$pageview', { path: pathname })
    // }
  }, [pathname]);

  return null;
}

// Event tracking utility
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Event tracked:', eventName, properties);
  }

  // Add your analytics service event tracking here
  // Example:
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', eventName, properties)
  // }
}

// Authentication event tracking
export function trackAuthEvent(
  event:
    | 'login_attempt'
    | 'login_success'
    | 'login_error'
    | 'code_generated'
    | 'code_copied'
    | 'deep_link_clicked',
  properties?: Record<string, any>
) {
  trackEvent(`auth_${event}`, {
    timestamp: new Date().toISOString(),
    ...properties,
  });
}
