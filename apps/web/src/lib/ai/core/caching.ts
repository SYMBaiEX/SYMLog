import type { LanguageModelUsage } from 'ai';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';

// Cache configuration
export interface CacheConfig {
  maxSize: number; // Maximum number of items
  maxAge: number; // Maximum age in milliseconds
  sizeCalculation?: (value: any) => number;
  updateAgeOnGet?: boolean;
  stale?: boolean; // Allow stale cache returns while updating
}

// Cache entry metadata
export interface CacheEntryMetadata {
  key: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl: number;
  tags: string[];
  modelId?: string;
  usage?: LanguageModelUsage;
}

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
}

// Base cache key generator
export function generateCacheKey(
  params: Record<string, any>,
  prefix = 'ai'
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, any>
    );

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(sortedParams))
    .digest('hex')
    .substring(0, 16);

  return `${prefix}:${hash}`;
}

// Advanced AI Response Cache
export class AIResponseCache {
  private cache: LRUCache<string, any>;
  private metadata: Map<string, CacheEntryMetadata>;
  private stats: CacheStats;
  private responseTimes: number[] = [];

  constructor(config: CacheConfig) {
    this.cache = new LRUCache({
      max: config.maxSize,
      ttl: config.maxAge,
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      sizeCalculation: config.sizeCalculation,
      dispose: (value, key) => {
        this.stats.evictions++;
        this.metadata.delete(key);
      },
      fetchMethod: config.stale ? this.staleFetch.bind(this) : undefined,
    });

    this.metadata = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Get cached response with metadata
   */
  async getCachedResponse<T>(
    key: string,
    generator: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      modelId?: string;
      force?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();

    // Force refresh if requested
    if (options?.force) {
      this.cache.delete(key);
    }

    // Try to get from cache
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.stats.hits++;
      this.updateMetadata(key, 'access');
      this.recordResponseTime(Date.now() - startTime);
      return cached;
    }

    // Cache miss - generate new response
    this.stats.misses++;
    try {
      const result = await generator();

      // Store in cache
      this.cache.set(key, result, {
        ttl: options?.ttl,
      });

      // Store metadata
      const size = this.calculateSize(result);
      this.metadata.set(key, {
        key,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size,
        ttl: options?.ttl || this.cache.ttl,
        tags: options?.tags || [],
        modelId: options?.modelId,
      });

      this.stats.size = this.cache.size;
      this.recordResponseTime(Date.now() - startTime);

      return result;
    } catch (error) {
      // Even on error, record timing
      this.recordResponseTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Cache streaming responses
   */
  async cacheStreamingResponse(
    key: string,
    streamGenerator: () => AsyncIterable<any>,
    options?: {
      ttl?: number;
      tags?: string[];
      modelId?: string;
    }
  ): Promise<AsyncIterable<any>> {
    // Check if we have a cached version
    const cached = this.cache.get(key);
    if (cached && Array.isArray(cached)) {
      this.stats.hits++;
      // Return cached chunks as async iterable
      return (async function* () {
        for (const chunk of cached) {
          yield chunk;
        }
      })();
    }

    // Stream and cache chunks
    this.stats.misses++;
    const chunks: any[] = [];

    const cachingStream = async function* (this: AIResponseCache) {
      try {
        for await (const chunk of streamGenerator()) {
          chunks.push(chunk);
          yield chunk;
        }

        // Cache the complete response
        this.cache.set(key, chunks, { ttl: options?.ttl });
        this.metadata.set(key, {
          key,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 1,
          size: this.calculateSize(chunks),
          ttl: options?.ttl || this.cache.ttl,
          tags: options?.tags || [],
          modelId: options?.modelId,
        });

        this.stats.size = this.cache.size;
      } catch (error) {
        // Don't cache errors
        throw error;
      }
    }.bind(this);

    return cachingStream();
  }

  /**
   * Cache structured outputs with schema validation
   */
  async cacheStructuredOutput<T>(
    key: string,
    schema: any,
    generator: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      modelId?: string;
      validateOnGet?: boolean;
    }
  ): Promise<T> {
    const cacheKey = `${key}:${this.hashSchema(schema)}`;

    return this.getCachedResponse(
      cacheKey,
      async () => {
        const result = await generator();

        // Optionally validate before caching
        if (options?.validateOnGet && schema.safeParse) {
          const validation = schema.safeParse(result);
          if (!validation.success) {
            throw new Error('Schema validation failed for cached result');
          }
        }

        return result;
      },
      options
    );
  }

  /**
   * Cache with content-based TTL
   */
  async cacheWithDynamicTTL<T>(
    key: string,
    generator: () => Promise<T>,
    ttlCalculator: (result: T) => number,
    options?: {
      tags?: string[];
      modelId?: string;
    }
  ): Promise<T> {
    const result = await generator();
    const ttl = ttlCalculator(result);

    this.cache.set(key, result, { ttl });

    this.metadata.set(key, {
      key,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      size: this.calculateSize(result),
      ttl,
      tags: options?.tags || [],
      modelId: options?.modelId,
    });

    return result;
  }

  /**
   * Invalidate cache entries
   */
  invalidate(pattern?: string | RegExp, tags?: string[]): number {
    let invalidated = 0;

    if (pattern) {
      // Invalidate by pattern
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          this.metadata.delete(key);
          invalidated++;
        }
      }
    }

    if (tags && tags.length > 0) {
      // Invalidate by tags
      for (const [key, meta] of this.metadata.entries()) {
        if (tags.some((tag) => meta.tags.includes(tag))) {
          this.cache.delete(key);
          this.metadata.delete(key);
          invalidated++;
        }
      }
    }

    if (!(pattern || tags)) {
      // Clear all
      invalidated = this.cache.size;
      this.cache.clear();
      this.metadata.clear();
    }

    this.stats.size = this.cache.size;
    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.hitRate =
      this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    this.stats.avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) /
          this.responseTimes.length
        : 0;
    this.stats.memoryUsage = this.calculateMemoryUsage();

    return { ...this.stats };
  }

  /**
   * Get metadata for cached entries
   */
  getMetadata(
    key?: string
  ): CacheEntryMetadata | CacheEntryMetadata[] | undefined {
    if (key) {
      return this.metadata.get(key);
    }
    return Array.from(this.metadata.values());
  }

  /**
   * Prune old entries based on custom criteria
   */
  prune(criteria: {
    maxAge?: number;
    minAccessCount?: number;
    maxSize?: number;
  }): number {
    let pruned = 0;
    const now = Date.now();

    for (const [key, meta] of this.metadata.entries()) {
      let shouldPrune = false;

      if (criteria.maxAge && now - meta.createdAt > criteria.maxAge) {
        shouldPrune = true;
      }

      if (
        criteria.minAccessCount &&
        meta.accessCount < criteria.minAccessCount
      ) {
        shouldPrune = true;
      }

      if (criteria.maxSize && meta.size > criteria.maxSize) {
        shouldPrune = true;
      }

      if (shouldPrune) {
        this.cache.delete(key);
        this.metadata.delete(key);
        pruned++;
      }
    }

    this.stats.size = this.cache.size;
    return pruned;
  }

  /**
   * Warm up cache with predefined entries
   */
  async warmUp(
    entries: Array<{
      key: string;
      generator: () => Promise<any>;
      ttl?: number;
      tags?: string[];
    }>
  ): Promise<void> {
    const promises = entries.map((entry) =>
      this.getCachedResponse(entry.key, entry.generator, {
        ttl: entry.ttl,
        tags: entry.tags,
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metadata.clear();
    this.stats.size = 0;
    this.responseTimes = [];
  }

  // Private helper methods

  private updateMetadata(key: string, action: 'access' | 'update') {
    const meta = this.metadata.get(key);
    if (meta) {
      meta.lastAccessed = Date.now();
      if (action === 'access') {
        meta.accessCount++;
      }
    }
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  private calculateMemoryUsage(): number {
    let total = 0;
    for (const meta of this.metadata.values()) {
      total += meta.size;
    }
    return total;
  }

  private recordResponseTime(time: number) {
    this.responseTimes.push(time);
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  private hashSchema(schema: any): string {
    try {
      const schemaString = JSON.stringify(schema);
      return crypto
        .createHash('sha256')
        .update(schemaString)
        .digest('hex')
        .substring(0, 8);
    } catch {
      return 'unknown';
    }
  }

  private async staleFetch(key: string): Promise<any | undefined> {
    // This method is called when stale cache is enabled
    // It should return stale data while fetching fresh data in background
    const stale = this.cache.get(key);
    if (stale) {
      // Return stale data immediately
      return stale;
    }
    return;
  }
}

// Singleton cache instances for different use cases
export const responseCache = new AIResponseCache({
  maxSize: 1000,
  maxAge: 5 * 60 * 1000, // 5 minutes
  stale: true,
});

export const structuredOutputCache = new AIResponseCache({
  maxSize: 500,
  maxAge: 10 * 60 * 1000, // 10 minutes
  updateAgeOnGet: true,
});

export const embeddingCache = new AIResponseCache({
  maxSize: 10_000,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sizeCalculation: (value) => {
    // Embeddings are arrays of numbers
    if (Array.isArray(value)) {
      return value.length * 8; // 8 bytes per float64
    }
    return 1000; // Default size
  },
});

// Cache decorators for easy use
export function cached(options?: {
  ttl?: number;
  tags?: string[];
  keyGenerator?: (...args: any[]) => string;
}) {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = options?.keyGenerator
        ? options.keyGenerator(...args)
        : generateCacheKey({ method: propertyName, args });

      return responseCache.getCachedResponse(
        key,
        () => method.apply(this, args),
        {
          ttl: options?.ttl,
          tags: options?.tags,
        }
      );
    };

    return descriptor;
  };
}

// Types are already exported as interfaces above
