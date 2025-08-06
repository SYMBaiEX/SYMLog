import { generateObject, type LanguageModel, streamObject } from 'ai';
import { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import { structuredOutputCache } from './caching';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Memoization configuration
export interface MemoizationConfig {
  enableSchemaMemoization: boolean;
  enableResultMemoization: boolean;
  enableDependencyTracking: boolean;
  maxSchemaCache: number;
  maxResultCache: number;
  defaultTTL: number;
  enableMetrics: boolean;
  enableCompression: boolean;
}

// Schema fingerprint for efficient comparison
export interface SchemaFingerprint {
  hash: string;
  structure: string;
  fields: string[];
  complexity: number;
  nullable: boolean;
  optional: boolean;
}

// Memoization metadata
export interface MemoizationMetadata {
  schemaFingerprint: SchemaFingerprint;
  dependencies: string[];
  computationCost: number;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
  size: number;
}

// Memoization metrics
export interface MemoizationMetrics {
  schemaHits: number;
  schemaMisses: number;
  resultHits: number;
  resultMisses: number;
  totalComputations: number;
  avgComputationTime: number;
  cacheSizeMB: number;
  compressionRatio: number;
  dependencyUpdates: number;
}

// Dependency node for tracking relationships
interface DependencyNode {
  id: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  lastModified: number;
  dirty: boolean;
}

// Default configuration
const DEFAULT_CONFIG: MemoizationConfig = {
  enableSchemaMemoization: true,
  enableResultMemoization: true,
  enableDependencyTracking: true,
  maxSchemaCache: 1000,
  maxResultCache: 5000,
  defaultTTL: 600_000, // 10 minutes
  enableMetrics: true,
  enableCompression: true,
};

/**
 * Advanced Structured Output Memoization System
 */
export class StructuredMemoizer {
  private static instance: StructuredMemoizer;
  private config: MemoizationConfig;
  private schemaCache: Map<string, z.ZodSchema<any>> = new Map();
  private resultCache: Map<string, any> = new Map();
  private metadataCache: Map<string, MemoizationMetadata> = new Map();
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private metrics: MemoizationMetrics;
  private computationTimes: number[] = [];

  private constructor(config: Partial<MemoizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      schemaHits: 0,
      schemaMisses: 0,
      resultHits: 0,
      resultMisses: 0,
      totalComputations: 0,
      avgComputationTime: 0,
      cacheSizeMB: 0,
      compressionRatio: 1,
      dependencyUpdates: 0,
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<MemoizationConfig>): StructuredMemoizer {
    if (!StructuredMemoizer.instance) {
      StructuredMemoizer.instance = new StructuredMemoizer(config);
    }
    return StructuredMemoizer.instance;
  }

  /**
   * Memoized object generation with schema optimization
   */
  async memoizedGenerateObject<T>(
    model: LanguageModel,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      temperature?: number;
      dependencies?: string[];
      computationCost?: number;
      customKey?: string;
      ttl?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();

    // Generate cache keys
    const schemaKey = this.generateSchemaKey(schema);
    const resultKey =
      options?.customKey ||
      this.generateResultKey({
        model:
          typeof model === 'string'
            ? model
            : (model as any).modelId ||
              (model as any).specificationVersion ||
              'unknown',
        prompt,
        schemaKey,
        temperature: options?.temperature,
      });

    // Check schema cache
    let optimizedSchema = schema;
    if (this.config.enableSchemaMemoization) {
      const cachedSchema = this.schemaCache.get(schemaKey);
      if (cachedSchema) {
        optimizedSchema = cachedSchema;
        this.metrics.schemaHits++;
        loggingService.debug('Schema cache hit', { schemaKey });
      } else {
        // Optimize and cache schema
        optimizedSchema = this.optimizeSchema(schema);
        this.schemaCache.set(schemaKey, optimizedSchema);
        this.metrics.schemaMisses++;
        loggingService.debug('Schema cached', { schemaKey });
      }
    }

    // Check result cache
    if (this.config.enableResultMemoization) {
      const cached = this.getCachedResult<T>(resultKey, options?.dependencies);
      if (cached) {
        this.metrics.resultHits++;
        this.updateUsageStats(resultKey, Date.now() - startTime);
        loggingService.debug('Result cache hit', { resultKey });
        return cached;
      }
    }

    // Generate new result
    this.metrics.resultMisses++;
    this.metrics.totalComputations++;

    try {
      const generateParams: any = {
        model,
        prompt,
        schema: optimizedSchema,
      };

      if (options?.temperature !== undefined) {
        generateParams.temperature = options.temperature;
      }

      const result = await generateObject(generateParams);

      const computationTime = Date.now() - startTime;
      this.recordComputationTime(computationTime);

      // Cache the result
      if (this.config.enableResultMemoization) {
        await this.cacheResult(resultKey, result.object, schema, {
          dependencies: options?.dependencies || [],
          computationCost: options?.computationCost || computationTime,
          ttl: options?.ttl,
        });
      }

      return result.object as T;
    } catch (error) {
      const computationTime = Date.now() - startTime;
      this.recordComputationTime(computationTime);
      throw error;
    }
  }

  /**
   * Memoized streaming object generation
   */
  async memoizedStreamObject<T>(
    model: LanguageModel,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      temperature?: number;
      dependencies?: string[];
      computationCost?: number;
      customKey?: string;
      ttl?: number;
    }
  ): Promise<AsyncIterable<Partial<T>>> {
    const resultKey =
      options?.customKey ||
      this.generateResultKey({
        model:
          typeof model === 'string'
            ? model
            : (model as any).modelId ||
              (model as any).specificationVersion ||
              'unknown',
        prompt,
        schemaKey: this.generateSchemaKey(schema),
        temperature: options?.temperature,
        streaming: true,
      });

    // Check for cached stream
    if (this.config.enableResultMemoization) {
      const cached = this.getCachedStream<T>(resultKey, options?.dependencies);
      if (cached) {
        this.metrics.resultHits++;
        loggingService.debug('Stream cache hit', { resultKey });
        return cached;
      }
    }

    // Generate new stream
    this.metrics.resultMisses++;
    this.metrics.totalComputations++;

    const startTime = Date.now();
    const streamChunks: Partial<T>[] = [];

    try {
      const streamParams: any = {
        model,
        prompt,
        schema,
      };

      if (options?.temperature !== undefined) {
        streamParams.temperature = options.temperature;
      }

      const stream = await streamObject(streamParams);

      // Create caching stream
      return this.createCachingStream(
        stream.partialObjectStream as AsyncIterable<Partial<T>>,
        resultKey,
        streamChunks,
        {
          dependencies: options?.dependencies || [],
          computationCost: options?.computationCost || 0,
          ttl: options?.ttl,
          startTime,
        }
      );
    } catch (error) {
      const computationTime = Date.now() - startTime;
      this.recordComputationTime(computationTime);
      throw error;
    }
  }

  /**
   * Bulk memoization for multiple objects
   */
  async memoizeBulkGeneration<T>(
    model: LanguageModel,
    requests: Array<{
      prompt: string;
      schema: z.ZodSchema<T>;
      options?: {
        temperature?: number;
        dependencies?: string[];
        customKey?: string;
      };
    }>
  ): Promise<T[]> {
    // Group requests by schema for optimization
    const schemaGroups = this.groupRequestsBySchema(requests);
    const results: T[] = [];

    for (const [schemaKey, groupedRequests] of schemaGroups) {
      // Process group in parallel with concurrency limit
      const groupResults = await this.processBulkGroup(model, groupedRequests);
      results.push(...groupResults);
    }

    return results;
  }

  /**
   * Invalidate cache by dependencies
   */
  invalidateByDependencies(dependencies: string[]): number {
    if (!this.config.enableDependencyTracking) {
      return 0;
    }

    let invalidated = 0;
    const toInvalidate = new Set<string>();

    // Find all cache entries affected by dependency changes
    for (const dependency of dependencies) {
      const node = this.dependencyGraph.get(dependency);
      if (node) {
        // Mark as dirty and collect dependents
        node.dirty = true;
        node.lastModified = Date.now();

        for (const dependent of node.dependents) {
          toInvalidate.add(dependent);
        }
      }
    }

    // Invalidate affected entries
    for (const key of toInvalidate) {
      if (this.resultCache.has(key)) {
        this.resultCache.delete(key);
        this.metadataCache.delete(key);
        invalidated++;
      }
    }

    this.metrics.dependencyUpdates += dependencies.length;
    loggingService.info('Cache invalidated by dependencies', {
      dependencies,
      invalidated,
    });

    return invalidated;
  }

  /**
   * Precompute and cache common schemas
   */
  async precomputeSchemas(
    schemas: Array<{
      schema: z.ZodSchema<any>;
      weight?: number;
      ttl?: number;
    }>
  ): Promise<void> {
    const tasks = schemas.map(async ({ schema, weight = 1, ttl }) => {
      const schemaKey = this.generateSchemaKey(schema);

      if (!this.schemaCache.has(schemaKey)) {
        const optimizedSchema = this.optimizeSchema(schema);
        this.schemaCache.set(schemaKey, optimizedSchema);

        // Set custom TTL if provided
        if (ttl) {
          setTimeout(() => {
            this.schemaCache.delete(schemaKey);
          }, ttl);
        }
      }
    });

    await Promise.all(tasks);
    loggingService.info('Schema precomputation completed', {
      schemas: schemas.length,
    });
  }

  /**
   * Get comprehensive memoization metrics
   */
  getMetrics(): MemoizationMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    schemas: number;
    results: number;
    dependencies: number;
    totalSizeMB: number;
    hitRates: {
      schema: number;
      result: number;
      overall: number;
    };
  } {
    const totalRequests =
      this.metrics.schemaHits +
      this.metrics.schemaMisses +
      this.metrics.resultHits +
      this.metrics.resultMisses;

    return {
      schemas: this.schemaCache.size,
      results: this.resultCache.size,
      dependencies: this.dependencyGraph.size,
      totalSizeMB: this.metrics.cacheSizeMB,
      hitRates: {
        schema:
          totalRequests > 0
            ? this.metrics.schemaHits /
              (this.metrics.schemaHits + this.metrics.schemaMisses)
            : 0,
        result:
          totalRequests > 0
            ? this.metrics.resultHits /
              (this.metrics.resultHits + this.metrics.resultMisses)
            : 0,
        overall:
          totalRequests > 0
            ? (this.metrics.schemaHits + this.metrics.resultHits) /
              totalRequests
            : 0,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.schemaCache.clear();
    this.resultCache.clear();
    this.metadataCache.clear();
    this.dependencyGraph.clear();
    this.computationTimes = [];

    // Reset metrics
    this.metrics = {
      schemaHits: 0,
      schemaMisses: 0,
      resultHits: 0,
      resultMisses: 0,
      totalComputations: 0,
      avgComputationTime: 0,
      cacheSizeMB: 0,
      compressionRatio: 1,
      dependencyUpdates: 0,
    };

    loggingService.info('All memoization caches cleared');
  }

  // Private helper methods

  private generateSchemaKey(schema: z.ZodSchema<any>): string {
    const fingerprint = this.generateSchemaFingerprint(schema);
    return `schema:${fingerprint.hash}`;
  }

  private generateResultKey(params: {
    model: string;
    prompt: string;
    schemaKey: string;
    temperature?: number;
    streaming?: boolean;
  }): string {
    const keyData = {
      model: params.model,
      prompt: this.hashString(params.prompt),
      schema: params.schemaKey,
      temp: params.temperature || 0.7,
      tokens: 1000,
      stream: params.streaming,
    };

    return `result:${this.hashString(JSON.stringify(keyData))}`;
  }

  private generateSchemaFingerprint(
    schema: z.ZodSchema<any>
  ): SchemaFingerprint {
    // Simplified schema fingerprinting - in production, use more sophisticated analysis
    const schemaStr = schema.description || schema.constructor.name;
    const hash = this.hashString(schemaStr);

    return {
      hash,
      structure: schemaStr,
      fields: [], // Would extract actual fields in production
      complexity: schemaStr.length, // Simplified complexity measure
      nullable: false, // Would analyze schema structure
      optional: false, // Would analyze schema structure
    };
  }

  private optimizeSchema<T>(schema: z.ZodSchema<T>): z.ZodSchema<T> {
    // In production, implement actual schema optimization
    // For now, return the original schema
    return schema;
  }

  private getCachedResult<T>(key: string, dependencies?: string[]): T | null {
    if (!this.resultCache.has(key)) {
      return null;
    }

    // Check dependency freshness
    if (this.config.enableDependencyTracking && dependencies) {
      for (const dependency of dependencies) {
        const node = this.dependencyGraph.get(dependency);
        if (node?.dirty) {
          // Dependency is dirty, invalidate cache
          this.resultCache.delete(key);
          this.metadataCache.delete(key);
          return null;
        }
      }
    }

    // Check TTL
    const metadata = this.metadataCache.get(key);
    if (metadata) {
      const age = Date.now() - metadata.createdAt;
      if (age > this.config.defaultTTL) {
        this.resultCache.delete(key);
        this.metadataCache.delete(key);
        return null;
      }
    }

    return this.resultCache.get(key) || null;
  }

  private getCachedStream<T>(
    key: string,
    dependencies?: string[]
  ): AsyncIterable<Partial<T>> | null {
    const cached = this.getCachedResult<Partial<T>[]>(key, dependencies);
    if (!(cached && Array.isArray(cached))) {
      return null;
    }

    // Convert cached array back to async iterable
    return (async function* () {
      for (const chunk of cached) {
        yield chunk;
      }
    })();
  }

  private async cacheResult<T>(
    key: string,
    result: T,
    schema: z.ZodSchema<any>,
    options: {
      dependencies: string[];
      computationCost: number;
      ttl?: number;
    }
  ): Promise<void> {
    // Store result
    this.resultCache.set(key, result);

    // Store metadata
    const metadata: MemoizationMetadata = {
      schemaFingerprint: this.generateSchemaFingerprint(schema),
      dependencies: options.dependencies,
      computationCost: options.computationCost,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      size: this.calculateSize(result),
    };

    this.metadataCache.set(key, metadata);

    // Update dependency graph
    if (this.config.enableDependencyTracking) {
      this.updateDependencyGraph(key, options.dependencies);
    }

    // Implement custom TTL
    if (options.ttl) {
      setTimeout(() => {
        this.resultCache.delete(key);
        this.metadataCache.delete(key);
      }, options.ttl);
    }

    // Cleanup if cache is too large
    this.enforceMemoryLimits();
  }

  private async *createCachingStream<T>(
    originalStream: AsyncIterable<Partial<T>>,
    cacheKey: string,
    chunks: Partial<T>[],
    options: {
      dependencies: string[];
      computationCost: number;
      ttl?: number;
      startTime: number;
    }
  ): AsyncIterable<Partial<T>> {
    try {
      for await (const chunk of originalStream) {
        chunks.push(chunk);
        yield chunk;
      }

      // Cache the complete stream
      const computationTime = Date.now() - options.startTime;
      this.recordComputationTime(computationTime);

      await this.cacheResult(
        cacheKey,
        chunks,
        z.any(), // Placeholder schema for streams
        {
          dependencies: options.dependencies,
          computationCost: options.computationCost || computationTime,
          ttl: options.ttl,
        }
      );
    } catch (error) {
      const computationTime = Date.now() - options.startTime;
      this.recordComputationTime(computationTime);
      throw error;
    }
  }

  private groupRequestsBySchema<T>(
    requests: Array<{
      prompt: string;
      schema: z.ZodSchema<T>;
      options?: any;
    }>
  ): Map<string, typeof requests> {
    const groups = new Map<string, typeof requests>();

    for (const request of requests) {
      const schemaKey = this.generateSchemaKey(request.schema);

      if (!groups.has(schemaKey)) {
        groups.set(schemaKey, []);
      }

      groups.get(schemaKey)!.push(request);
    }

    return groups;
  }

  private async processBulkGroup<T>(
    model: LanguageModel,
    requests: Array<{
      prompt: string;
      schema: z.ZodSchema<T>;
      options?: any;
    }>
  ): Promise<T[]> {
    // Process with limited concurrency
    const concurrency = Math.min(requests.length, 5);
    const results: T[] = [];

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map((request) =>
        this.memoizedGenerateObject(
          model,
          request.prompt,
          request.schema,
          request.options
        )
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private updateDependencyGraph(
    resultKey: string,
    dependencies: string[]
  ): void {
    for (const dependency of dependencies) {
      if (!this.dependencyGraph.has(dependency)) {
        this.dependencyGraph.set(dependency, {
          id: dependency,
          dependencies: new Set(),
          dependents: new Set(),
          lastModified: Date.now(),
          dirty: false,
        });
      }

      const node = this.dependencyGraph.get(dependency)!;
      node.dependents.add(resultKey);
    }
  }

  private updateUsageStats(key: string, responseTime: number): void {
    const metadata = this.metadataCache.get(key);
    if (metadata) {
      metadata.lastUsed = Date.now();
      metadata.usageCount++;
    }
  }

  private recordComputationTime(time: number): void {
    this.computationTimes.push(time);

    // Keep only recent times
    if (this.computationTimes.length > 1000) {
      this.computationTimes.shift();
    }

    // Update average
    this.metrics.avgComputationTime =
      this.computationTimes.reduce((a, b) => a + b, 0) /
      this.computationTimes.length;
  }

  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 encoding
    } catch {
      return 1024; // Default size
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private enforceMemoryLimits(): void {
    // Remove oldest entries if cache is too large
    while (this.resultCache.size > this.config.maxResultCache) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.resultCache.delete(oldestKey);
        this.metadataCache.delete(oldestKey);
      } else {
        break;
      }
    }

    while (this.schemaCache.size > this.config.maxSchemaCache) {
      const firstKey = this.schemaCache.keys().next().value;
      if (firstKey) {
        this.schemaCache.delete(firstKey);
      } else {
        break;
      }
    }
  }

  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, metadata] of this.metadataCache.entries()) {
      if (metadata.lastUsed < oldestTime) {
        oldestTime = metadata.lastUsed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private updateMetrics(): void {
    let totalSize = 0;
    for (const metadata of this.metadataCache.values()) {
      totalSize += metadata.size;
    }
    this.metrics.cacheSizeMB = totalSize / (1024 * 1024);
  }

  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 300_000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, metadata] of this.metadataCache.entries()) {
      const age = now - metadata.createdAt;
      if (age > this.config.defaultTTL) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.resultCache.delete(key);
      this.metadataCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      loggingService.debug('Cleaned up expired memoization entries', {
        expired: expiredKeys.length,
      });
    }
  }
}

// Create singleton instance
const structuredMemoizer = StructuredMemoizer.getInstance();

// Export convenience functions
export async function memoizedGenerateObject<T>(
  model: LanguageModel,
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: {
    temperature?: number;
    dependencies?: string[];
    computationCost?: number;
    customKey?: string;
    ttl?: number;
  }
): Promise<T> {
  return structuredMemoizer.memoizedGenerateObject(
    model,
    prompt,
    schema,
    options
  );
}

export async function memoizedStreamObject<T>(
  model: LanguageModel,
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: {
    temperature?: number;
    dependencies?: string[];
    computationCost?: number;
    customKey?: string;
    ttl?: number;
  }
): Promise<AsyncIterable<Partial<T>>> {
  return structuredMemoizer.memoizedStreamObject(
    model,
    prompt,
    schema,
    options
  );
}

export function invalidateMemoizationByDependencies(
  dependencies: string[]
): number {
  return structuredMemoizer.invalidateByDependencies(dependencies);
}

export function getMemoizationMetrics(): MemoizationMetrics {
  return structuredMemoizer.getMetrics();
}

export function clearMemoizationCaches(): void {
  structuredMemoizer.clearCaches();
}

// Export singleton
export { structuredMemoizer };
