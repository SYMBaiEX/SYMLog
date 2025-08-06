'use client';

import { mutate } from 'swr';

export class CacheService {
  // Clear all cached data
  static clearAll() {
    mutate(() => true, undefined, { revalidate: false });
  }

  // Clear cache by pattern
  static clearPattern(pattern: string) {
    mutate(
      (key) => typeof key === 'string' && key.includes(pattern),
      undefined,
      { revalidate: false }
    );
  }

  // Clear user-specific cache
  static clearUserCache(userId: string) {
    CacheService.clearPattern(`/api/user/${userId}`);
  }

  // Clear conversation cache
  static clearConversationCache(conversationId: string) {
    mutate(`/api/conversation/${conversationId}`, undefined, {
      revalidate: false,
    });
  }

  // Preload conversation data
  static async preloadConversation(conversationId: string) {
    try {
      return mutate(
        `/api/conversation/${conversationId}`,
        fetch(`/api/conversation/${conversationId}`).then((r) => r.json())
      );
    } catch (error) {
      console.warn('Failed to preload conversation:', conversationId, error);
    }
  }

  // Update cached conversation data
  static updateConversationCache(conversationId: string, data: unknown) {
    mutate(`/api/conversation/${conversationId}`, data, { revalidate: false });
  }

  // Update cached user data
  static updateUserCache(userId: string, data: unknown) {
    mutate(`/api/user/${userId}`, data, { revalidate: false });
  }

  // Invalidate and refetch data
  static refreshCache(key: string) {
    mutate(key);
  }

  // Check if data is cached
  // WARNING: This uses SWR's internal cache API which may change in future versions
  static isCached(key: string): boolean {
    try {
      if (!key || typeof window === 'undefined') return false;

      // This is a workaround since SWR doesn't expose cache directly
      // FRAGILE: May break if SWR changes internal implementation
      return Boolean((window as any).__SWR_CACHE__?.[key]);
    } catch {
      return false;
    }
  }

  // Get cache statistics (for debugging)
  static getCacheStats() {
    if (typeof window === 'undefined') return { size: 0, keys: [] };

    const cache = (window as any).__SWR_CACHE__;
    if (!cache) return { size: 0, keys: [] };

    const keys = Object.keys(cache);
    return {
      size: keys.length,
      keys,
      totalSize: JSON.stringify(cache).length,
    };
  }
}
