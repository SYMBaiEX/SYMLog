'use client';

import { useMemo } from 'react';
import useSWR, { type KeyedMutator, type SWRConfiguration } from 'swr';

export interface ApiResponse<T = any> {
  /** The fetched data, undefined if loading or error */
  data: T | undefined;
  /** Error object if request failed, undefined otherwise */
  error: Error | undefined;
  /** True during initial load, false once data is fetched */
  isLoading: boolean;
  /** True when revalidating (background refresh), false otherwise */
  isValidating: boolean;
  /** Function to manually trigger a refetch and update cache */
  mutate: KeyedMutator<T>;
}

/**
 * Custom hook for caching API responses using SWR
 * @param key - Unique key for the cache entry, null to disable
 * @param config - SWR configuration options
 * @returns ApiResponse object with data, error, loading states, and mutate function
 */
export function useApiCache<T = any>(
  key: string | null,
  config?: SWRConfiguration<T>
): ApiResponse<T> {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    key,
    config?.fetcher || null,
    {
      // Default cache options
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2 * 60 * 1000, // 2 minutes
      focusThrottleInterval: 5 * 60 * 1000, // 5 minutes
      errorRetryCount: 2,
      errorRetryInterval: 1000,
      ...config,
    }
  );

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      isValidating,
      mutate,
    }),
    [data, error, isLoading, isValidating, mutate, config]
  );
}

// Hook for caching user data
export function useUserCache(userId: string | null) {
  return useApiCache<{
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  }>(userId ? `/api/user/${userId}` : null, {
    dedupingInterval: 10 * 60 * 1000, // 10 minutes for user data
  });
}

// Hook for caching conversation history
export function useConversationCache(conversationId: string | null) {
  return useApiCache<{
    id: string;
    title: string;
    messages: any[];
    createdAt: string;
    updatedAt: string;
  }>(conversationId ? `/api/conversation/${conversationId}` : null, {
    dedupingInterval: 1 * 60 * 1000, // 1 minute for conversations
  });
}

// Hook for caching model settings
export function useModelSettingsCache(userId: string | null) {
  return useApiCache<{
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    systemPromptType: string;
  }>(userId ? `/api/user/${userId}/settings` : null, {
    dedupingInterval: 5 * 60 * 1000, // 5 minutes for settings
  });
}

// Hook for caching conversation list
export function useConversationListCache(userId: string | null) {
  return useApiCache<
    Array<{
      id: string;
      title: string;
      lastMessage?: string;
      updatedAt: string;
    }>
  >(userId ? `/api/user/${userId}/conversations` : null, {
    dedupingInterval: 30 * 1000, // 30 seconds for conversation list
  });
}

// Hook for prefetching data
export function usePrefetch() {
  const { mutate } = useSWR(() => null); // Get SWR mutate function

  const prefetch = (key: string, fetcher?: () => Promise<any>) => {
    if (fetcher) {
      // For prefetching, we call the fetcher and ignore the result
      fetcher().catch(() => {
        // Silent fail for prefetching
      });
    }
    return mutate(key);
  };

  return { prefetch };
}
