import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  AIResponseCache,
  generateCacheKey,
  getAICacheMetrics,
  getCachedObjectResponse,
  getCachedTextResponse,
  LRUCache,
} from '../caching';
import {
  getStreamingMetrics,
  optimizeObjectStream,
  optimizeTextStream,
  StreamingOptimizer,
} from '../streaming-optimization';
import {
  getMemoizationMetrics,
  memoizedGenerateObject,
  StructuredMemoizer,
} from '../structured-memoization';
import {
  executeWorkflowWithCaching,
  getWorkflowAnalytics,
  WorkflowCachingEngine,
} from '../workflow-caching';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
  streamText: vi.fn(),
  streamObject: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

describe('LRU Cache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 1024 * 1024, // 1MB
      defaultTTL: 60_000, // 1 minute
      enableCompression: true,
      enableMetrics: true,
      cleanupInterval: 0, // Disable auto-cleanup for tests
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should handle TTL expiry', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used items', () => {
      const smallCache = new LRUCache<string>({
        maxSize: 100, // Small size to force eviction
        defaultTTL: 60_000,
        enableCompression: false,
        enableMetrics: true,
        cleanupInterval: 0,
      });

      // Fill cache beyond capacity
      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, `value${i}`.repeat(10)); // Each value ~60 bytes
      }

      // Check that early items were evicted
      expect(smallCache.get('key0')).toBeUndefined();
      expect(smallCache.get('key9')).toBeDefined();

      smallCache.destroy();
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Access key1 to make it recently used
      cache.get('key1');

      const info = cache.getInfo();
      expect(info.entries).toBe(2);
    });
  });

  describe('compression', () => {
    it('should compress large values when enabled', () => {
      const largeValue = 'x'.repeat(2000);
      cache.set('large', largeValue);

      const retrieved = cache.get('large');
      expect(retrieved).toBe(largeValue);
    });

    it('should not compress small values', () => {
      const smallValue = 'small';
      cache.set('small', smallValue);

      const retrieved = cache.get('small');
      expect(retrieved).toBe(smallValue);
    });
  });

  describe('metrics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      const smallCache = new LRUCache<string>({
        maxSize: 50,
        defaultTTL: 60_000,
        enableCompression: false,
        enableMetrics: true,
        cleanupInterval: 0,
      });

      // Force evictions
      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, `value${i}`.repeat(10));
      }

      const metrics = smallCache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);

      smallCache.destroy();
    });
  });
});

describe('AI Response Cache', () => {
  let cache: AIResponseCache;

  beforeEach(() => {
    cache = new AIResponseCache({
      maxSize: 1000,
      maxAge: 5 * 60 * 1000,
      enableCompression: true,
      enableMetrics: true,
      cleanupInterval: 0,
    });
  });

  describe('text response caching', () => {
    it('should cache text responses', async () => {
      const generator = vi.fn().mockResolvedValue('generated text');

      const result1 = await cache.getCachedTextResponse('key1', generator);
      const result2 = await cache.getCachedTextResponse('key1', generator);

      expect(result1).toBe('generated text');
      expect(result2).toBe('generated text');
      expect(generator).toHaveBeenCalledTimes(1); // Should only generate once
    });

    it('should use custom TTL', async () => {
      const generator = vi.fn().mockResolvedValue('generated text');

      const result = await cache.getCachedTextResponse('key1', generator, 100); // 100ms TTL
      expect(result).toBe('generated text');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await cache.getCachedTextResponse('key1', generator, 100);
      expect(generator).toHaveBeenCalledTimes(2); // Should regenerate after TTL
    });
  });

  describe('object response caching', () => {
    it('should cache object responses', async () => {
      const testObject = { name: 'test', value: 42 };
      const generator = vi.fn().mockResolvedValue(testObject);

      const result1 = await cache.getCachedObjectResponse('key1', generator);
      const result2 = await cache.getCachedObjectResponse('key1', generator);

      expect(result1).toEqual(testObject);
      expect(result2).toEqual(testObject);
      expect(generator).toHaveBeenCalledTimes(1);
    });
  });

  describe('streaming response caching', () => {
    it('should cache streaming responses', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const generator = vi.fn().mockResolvedValue(
        (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })()
      );

      const stream1 = await cache.getCachedStreamResponse('key1', generator);
      const result1: string[] = [];
      for await (const chunk of stream1) {
        result1.push(chunk);
      }

      const stream2 = await cache.getCachedStreamResponse('key1', generator);
      const result2: string[] = [];
      for await (const chunk of stream2) {
        result2.push(chunk);
      }

      expect(result1).toEqual(chunks);
      expect(result2).toEqual(chunks);
      expect(generator).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate by pattern', async () => {
      const generator = vi.fn().mockResolvedValue('test');

      await cache.getCachedTextResponse('user:123:data', generator);
      await cache.getCachedTextResponse('user:456:data', generator);
      await cache.getCachedTextResponse('system:config', generator);

      const invalidated = cache.invalidateByPattern('user:');
      expect(invalidated).toBe(2);
      expect(generator).toHaveBeenCalledTimes(3);

      // Should regenerate for user keys but not system key
      await cache.getCachedTextResponse('user:123:data', generator);
      await cache.getCachedTextResponse('system:config', generator);
      expect(generator).toHaveBeenCalledTimes(4); // Only one more call for user:123
    });
  });

  describe('metrics', () => {
    it('should provide comprehensive metrics', async () => {
      const generator = vi.fn().mockResolvedValue('test');

      // Generate some cache activity
      await cache.getCachedTextResponse('key1', generator);
      await cache.getCachedTextResponse('key1', generator); // hit
      await cache.getCachedTextResponse('key2', generator); // miss

      const metrics = cache.getMetrics();
      expect(metrics.total.hits).toBe(1);
      expect(metrics.total.misses).toBe(2);
      expect(metrics.total.hitRate).toBeCloseTo(0.33, 2);
    });
  });
});

describe('Streaming Optimizer', () => {
  let optimizer: StreamingOptimizer;

  beforeEach(() => {
    optimizer = StreamingOptimizer.getInstance({
      enableChunking: true,
      chunkSize: 10,
      enableCompression: true,
      enableCaching: true,
      cacheTTL: 60_000,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    optimizer.clearCache();
  });

  describe('text stream optimization', () => {
    it('should optimize text streams with chunking', async () => {
      const mockStream = async function* () {
        yield 'Hello';
        yield ' ';
        yield 'World';
        yield '!';
      };

      const optimizedStream = await optimizer.optimizeTextStream(
        async () => mockStream(),
        { chunkSize: 5 }
      );

      const chunks: any[] = [];
      for await (const chunk of optimizedStream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('data');
      expect(chunks[0]).toHaveProperty('index');
      expect(chunks[0]).toHaveProperty('timestamp');
      expect(chunks[0]).toHaveProperty('size');
    });

    it('should cache optimized streams', async () => {
      const mockStream = vi.fn(async function* () {
        yield 'cached';
        yield 'stream';
      });

      const cacheKey = 'test-stream';

      // First call
      const stream1 = await optimizer.optimizeTextStream(mockStream, {
        cacheKey,
        enableCache: true,
      });

      const result1: string[] = [];
      for await (const chunk of stream1) {
        result1.push(chunk.data);
      }

      // Second call should hit cache
      const stream2 = await optimizer.optimizeTextStream(mockStream, {
        cacheKey,
        enableCache: true,
      });

      const result2: string[] = [];
      for await (const chunk of stream2) {
        result2.push(chunk.data);
      }

      expect(mockStream).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(['cached', 'stream']);
      expect(result2).toEqual(['cached', 'stream']);
    });
  });

  describe('buffered streams', () => {
    it('should create buffered streams', async () => {
      const sourceData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sourceStream = async function* () {
        for (const item of sourceData) {
          yield item;
        }
      };

      const bufferedStream = await optimizer.createBufferedStream(
        sourceStream(),
        3
      );
      const buffers: number[][] = [];

      for await (const buffer of bufferedStream) {
        buffers.push(buffer);
      }

      expect(buffers.length).toBe(4); // 3 full buffers + 1 partial
      expect(buffers[0]).toEqual([1, 2, 3]);
      expect(buffers[1]).toEqual([4, 5, 6]);
      expect(buffers[2]).toEqual([7, 8, 9]);
      expect(buffers[3]).toEqual([10]);
    });
  });

  describe('metrics', () => {
    it('should track streaming metrics', async () => {
      const mockStream = async function* () {
        yield 'test';
        yield 'data';
      };

      await optimizer.optimizeTextStream(async () => mockStream());

      const metrics = optimizer.getMetrics();
      expect(metrics.totalStreams).toBe(1);
      expect(metrics.activeStreams).toBe(0); // Should be 0 after completion
    });
  });
});

describe('Structured Memoizer', () => {
  let memoizer: StructuredMemoizer;

  beforeEach(() => {
    memoizer = StructuredMemoizer.getInstance({
      enableSchemaMemoization: true,
      enableResultMemoization: true,
      enableDependencyTracking: true,
      defaultTTL: 60_000,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    memoizer.clearCaches();
  });

  describe('schema memoization', () => {
    it('should memoize schema optimizations', async () => {
      const mockModel = { modelId: 'test-model' } as any;
      const schema = z.object({ name: z.string(), age: z.number() });

      const mockGenerateObject = vi.fn().mockResolvedValue({
        object: { name: 'John', age: 30 },
      });

      // Mock the AI SDK
      vi.mocked(await import('ai')).generateObject = mockGenerateObject;

      const result1 = await memoizer.memoizedGenerateObject(
        mockModel,
        'Generate a person',
        schema
      );

      const result2 = await memoizer.memoizedGenerateObject(
        mockModel,
        'Generate a person',
        schema
      );

      expect(result1).toEqual({ name: 'John', age: 30 });
      expect(result2).toEqual({ name: 'John', age: 30 });
      expect(mockGenerateObject).toHaveBeenCalledTimes(1); // Should be memoized
    });
  });

  describe('dependency tracking', () => {
    it('should invalidate cache based on dependencies', async () => {
      const mockModel = { modelId: 'test-model' } as any;
      const schema = z.object({ value: z.string() });

      const mockGenerateObject = vi
        .fn()
        .mockResolvedValueOnce({ object: { value: 'first' } })
        .mockResolvedValueOnce({ object: { value: 'second' } });

      vi.mocked(await import('ai')).generateObject = mockGenerateObject;

      // First generation with dependency
      await memoizer.memoizedGenerateObject(
        mockModel,
        'Generate value',
        schema,
        { dependencies: ['user-data'] }
      );

      // Second call should hit cache
      await memoizer.memoizedGenerateObject(
        mockModel,
        'Generate value',
        schema,
        { dependencies: ['user-data'] }
      );

      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      // Invalidate dependency
      memoizer.invalidateByDependencies(['user-data']);

      // Third call should regenerate
      await memoizer.memoizedGenerateObject(
        mockModel,
        'Generate value',
        schema,
        { dependencies: ['user-data'] }
      );

      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulk generation', () => {
    it('should handle bulk memoization efficiently', async () => {
      const mockModel = { modelId: 'test-model' } as any;
      const schema = z.object({ id: z.number() });

      const mockGenerateObject = vi.fn().mockImplementation(() =>
        Promise.resolve({
          object: { id: Math.random() },
        })
      );

      vi.mocked(await import('ai')).generateObject = mockGenerateObject;

      const requests = Array.from({ length: 5 }, (_, i) => ({
        prompt: `Generate object ${i}`,
        schema,
        options: { customKey: `bulk-${i}` },
      }));

      const results = await memoizer.memoizeBulkGeneration(mockModel, requests);

      expect(results).toHaveLength(5);
      expect(mockGenerateObject).toHaveBeenCalledTimes(5);

      // Second bulk call should hit cache
      const results2 = await memoizer.memoizeBulkGeneration(
        mockModel,
        requests
      );

      expect(results2).toHaveLength(5);
      expect(mockGenerateObject).toHaveBeenCalledTimes(5); // No additional calls
    });
  });

  describe('metrics', () => {
    it('should track memoization metrics', async () => {
      const mockModel = { modelId: 'test-model' } as any;
      const schema = z.object({ test: z.string() });

      vi.mocked(await import('ai')).generateObject = vi.fn().mockResolvedValue({
        object: { test: 'value' },
      });

      // Generate cache hit and miss
      await memoizer.memoizedGenerateObject(mockModel, 'test1', schema);
      await memoizer.memoizedGenerateObject(mockModel, 'test1', schema); // hit
      await memoizer.memoizedGenerateObject(mockModel, 'test2', schema); // miss

      const metrics = memoizer.getMetrics();
      expect(metrics.resultHits).toBe(1);
      expect(metrics.resultMisses).toBe(2);
      expect(metrics.totalComputations).toBe(2);
    });
  });
});

describe('Workflow Caching Engine', () => {
  let engine: WorkflowCachingEngine;

  beforeEach(() => {
    engine = WorkflowCachingEngine.getInstance();
  });

  afterEach(() => {
    engine.clearCaches();
  });

  describe('workflow execution', () => {
    it('should execute simple workflow', async () => {
      const mockModel = { modelId: 'test-model' } as any;

      vi.mocked(await import('ai')).generateText = vi.fn().mockResolvedValue({
        text: 'Generated text',
      });

      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Generate Text',
            type: 'text' as const,
            prompt: 'Generate some text',
            dependencies: [],
            cacheStrategy: 'step' as const,
          },
        ],
        cacheConfig: {
          enableStepCaching: true,
          enableChainCaching: true,
          enableSmartCaching: true,
          defaultTTL: 60_000,
          maxCacheSize: 1000,
        },
        executionConfig: {
          maxParallelSteps: 3,
          timeoutMs: 300_000,
          enableRecovery: true,
        },
      };

      const result = await engine.executeWorkflow(workflow, mockModel, {
        variables: { input: 'test' },
      });

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(1);
      expect(result.finalResult).toBe('Generated text');
      expect(result.executionTrace).toHaveLength(1);
    });

    it('should cache workflow steps', async () => {
      const mockModel = { modelId: 'test-model' } as any;
      const mockGenerateText = vi
        .fn()
        .mockResolvedValue({ text: 'Cached result' });

      vi.mocked(await import('ai')).generateText = mockGenerateText;

      const workflow = {
        id: 'cache-test',
        name: 'Cache Test',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Cached Step',
            type: 'text' as const,
            prompt: 'Same prompt',
            dependencies: [],
            cacheStrategy: 'step' as const,
          },
        ],
        cacheConfig: {
          enableStepCaching: true,
          enableChainCaching: false,
          enableSmartCaching: false,
          defaultTTL: 60_000,
          maxCacheSize: 1000,
        },
        executionConfig: {
          maxParallelSteps: 1,
          timeoutMs: 30_000,
          enableRecovery: false,
        },
      };

      // First execution
      const result1 = await engine.executeWorkflow(workflow, mockModel, {
        variables: { input: 'same' },
      });

      // Second execution should hit cache
      const result2 = await engine.executeWorkflow(workflow, mockModel, {
        variables: { input: 'same' },
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.stepsCached).toBe(1);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('workflow analytics', () => {
    it('should provide execution analytics', async () => {
      const mockModel = { modelId: 'test-model' } as any;

      vi.mocked(await import('ai')).generateText = vi.fn().mockResolvedValue({
        text: 'Result',
      });

      const workflow = {
        id: 'analytics-test',
        name: 'Analytics Test',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'text' as const,
            prompt: 'Test',
            dependencies: [],
            cacheStrategy: 'none' as const,
          },
        ],
        cacheConfig: {
          enableStepCaching: false,
          enableChainCaching: false,
          enableSmartCaching: false,
          defaultTTL: 60_000,
          maxCacheSize: 1000,
        },
        executionConfig: {
          maxParallelSteps: 1,
          timeoutMs: 30_000,
          enableRecovery: false,
        },
      };

      // Execute workflow multiple times
      await engine.executeWorkflow(workflow, mockModel);
      await engine.executeWorkflow(workflow, mockModel);

      const analytics = engine.getWorkflowAnalytics('analytics-test');

      expect(analytics.totalExecutions).toBe(2);
      expect(analytics.successRate).toBe(1);
      expect(analytics.avgDuration).toBeGreaterThan(0);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate workflow cache by dependencies', () => {
      // Add some mock cache entries
      const invalidated = engine.invalidateWorkflowCache([
        'dependency1',
        'dependency2',
      ]);

      // Since we don't have real cache entries, expect 0
      expect(typeof invalidated).toBe('number');
    });
  });
});

describe('Integration Tests', () => {
  describe('cache key generation', () => {
    it('should generate consistent cache keys', () => {
      const params1 = { model: 'gpt-4', prompt: 'test', temperature: 0.7 };
      const params2 = { temperature: 0.7, model: 'gpt-4', prompt: 'test' };

      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);

      expect(key1).toBe(key2); // Order shouldn't matter
    });

    it('should generate different keys for different params', () => {
      const params1 = { model: 'gpt-4', prompt: 'test1' };
      const params2 = { model: 'gpt-4', prompt: 'test2' };

      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('convenience functions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use convenience functions for text caching', async () => {
      const mockGenerator = vi.fn().mockResolvedValue('cached text');

      const result = await getCachedTextResponse(
        { model: 'test', prompt: 'test prompt' },
        mockGenerator,
        60_000
      );

      expect(result).toBe('cached text');
      expect(mockGenerator).toHaveBeenCalledTimes(1);
    });

    it('should use convenience functions for object caching', async () => {
      const mockObject = { name: 'test', value: 42 };
      const mockGenerator = vi.fn().mockResolvedValue(mockObject);

      const result = await getCachedObjectResponse(
        { model: 'test', prompt: 'test prompt' },
        mockGenerator,
        60_000
      );

      expect(result).toEqual(mockObject);
      expect(mockGenerator).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics integration', () => {
    it('should provide global cache metrics', () => {
      const metrics = getAICacheMetrics();

      expect(metrics).toHaveProperty('text');
      expect(metrics).toHaveProperty('object');
      expect(metrics).toHaveProperty('stream');
      expect(metrics).toHaveProperty('total');
      expect(metrics.total).toHaveProperty('hits');
      expect(metrics.total).toHaveProperty('misses');
      expect(metrics.total).toHaveProperty('hitRate');
    });

    it('should provide streaming metrics', () => {
      const metrics = getStreamingMetrics();

      expect(metrics).toHaveProperty('totalStreams');
      expect(metrics).toHaveProperty('activeStreams');
      expect(metrics).toHaveProperty('avgChunkSize');
      expect(metrics).toHaveProperty('avgLatency');
      expect(metrics).toHaveProperty('compressionRatio');
    });

    it('should provide memoization metrics', () => {
      const metrics = getMemoizationMetrics();

      expect(metrics).toHaveProperty('schemaHits');
      expect(metrics).toHaveProperty('schemaMisses');
      expect(metrics).toHaveProperty('resultHits');
      expect(metrics).toHaveProperty('resultMisses');
      expect(metrics).toHaveProperty('totalComputations');
    });
  });
});
