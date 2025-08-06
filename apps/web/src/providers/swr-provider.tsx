'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

interface SWRProviderProps {
  children: ReactNode;
}

// Default fetcher function for SWR with validation
const fetcher = async (url: string) => {
  // Basic URL validation
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided to fetcher');
  }

  // Only allow API endpoints from same origin for security
  if (!(url.startsWith('/api/') || url.startsWith('http'))) {
    throw new Error('Only API endpoints are allowed');
  }

  const response = await fetch(url, {
    // Add security headers
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data');
    error.message = response.statusText;
    throw error;
  }

  const data = await response.json();

  // Basic data validation - ensure response is an object
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response format');
  }

  return data;
};

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Cache data for 5 minutes by default
        dedupingInterval: 5 * 60 * 1000,
        // Refresh data every 30 seconds when tab is focused
        focusThrottleInterval: 30 * 1000,
        // Refresh data when the user returns to the tab
        revalidateOnFocus: true,
        // Refresh data when the network is reconnected
        revalidateOnReconnect: true,
        // Refresh data when the browser comes back online
        revalidateOnMount: true,
        // Retry failed requests up to 3 times
        errorRetryCount: 3,
        // Exponential backoff for retries
        errorRetryInterval: 2000,
        // Global error handler with environment awareness
        onError: (error) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('SWR error:', error);
          } else {
            // In production, log minimal error info without sensitive data
            console.warn('SWR error occurred:', error.name || 'Unknown error');
          }
        },
        // Global success handler for debugging in development only
        onSuccess: (data, key) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              'SWR cache hit:',
              typeof key === 'string' ? key.split('/')[2] || 'cache' : 'cache'
            );
          }
        },
        // Cache provider using Map for better performance
        provider: () => new Map(),
      }}
    >
      {children}
    </SWRConfig>
  );
}
