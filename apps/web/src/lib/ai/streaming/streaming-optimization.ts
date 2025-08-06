import {
  type CoreMessage,
  type LanguageModel,
  streamObject,
  streamText,
} from 'ai';
import { z } from 'zod';
import { responseCache as aiResponseCache } from '../core/caching';
import { createLogger } from '../../logger/unified-logger';

// Create AI streaming optimizer logger
const logger = createLogger({ service: 'ai-streaming-optimizer' });

// Stream optimization configuration with AI SDK v5 compatibility
export interface StreamOptimizationConfig {
  enableChunking: boolean;
  chunkSize: number;
  enableCompression: boolean;
  enableCaching: boolean;
  cacheTTL: number;
  enablePredictiveLoading: boolean;
  maxConcurrentStreams: number;
  bufferSize: number;
  enableMetrics: boolean;
  streamableCompatible?: boolean;
}

// Stream metrics
export interface StreamMetrics {
  totalStreams: number;
  activeStreams: number;
  avgChunkSize: number;
  avgLatency: number;
  compressionRatio: number;
  cacheHitRate: number;
  throughput: number; // chunks per second
  errorRate: number;
}

// Stream chunk with metadata
export interface OptimizedChunk<T = string> {
  data: T;
  index: number;
  timestamp: number;
  size: number;
  compressed: boolean;
  metadata?: Record<string, any>;
}

// Stream state
interface StreamState {
  id: string;
  startTime: number;
  chunksReceived: number;
  totalSize: number;
  errors: number;
  lastChunkTime: number;
}

// Default configuration
const DEFAULT_CONFIG: StreamOptimizationConfig = {
  enableChunking: true,
  chunkSize: 1024, // 1KB chunks
  enableCompression: true,
  enableCaching: true,
  cacheTTL: 300_000, // 5 minutes
  enablePredictiveLoading: false,
  maxConcurrentStreams: 10,
  bufferSize: 4096,
  enableMetrics: true,
};

/**
 * Advanced Streaming Optimizer for AI SDK
 */
export class StreamingOptimizer {
  private static instance: StreamingOptimizer;
  private config: StreamOptimizationConfig;
  private metrics: StreamMetrics;
  private activeStreams: Map<string, StreamState> = new Map();
  private streamBuffer: Map<string, OptimizedChunk[]> = new Map();
  private compressionCache: Map<string, string> = new Map();

  private constructor(config: Partial<StreamOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      totalStreams: 0,
      activeStreams: 0,
      avgChunkSize: 0,
      avgLatency: 0,
      compressionRatio: 1,
      cacheHitRate: 0,
      throughput: 0,
      errorRate: 0,
    };

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  static getInstance(
    config?: Partial<StreamOptimizationConfig>
  ): StreamingOptimizer {
    if (!StreamingOptimizer.instance) {
      StreamingOptimizer.instance = new StreamingOptimizer(config);
    }
    return StreamingOptimizer.instance;
  }

  /**
   * Optimize text streaming with chunking and compression
   * Enhanced with proper AsyncGenerator type constraints
   */
  async optimizeTextStream(
    streamFn: () => Promise<AsyncIterable<string>>,
    options?: {
      cacheKey?: string;
      enableCache?: boolean;
      enableCompression?: boolean;
      chunkSize?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<AsyncGenerator<OptimizedChunk<string>, void, unknown>> {
    const streamId = this.generateStreamId();
    const startTime = Date.now();

    // Check cache first if enabled
    if (
      this.config.enableCaching &&
      options?.enableCache &&
      options?.cacheKey
    ) {
      const cached = await this.getCachedStream(options.cacheKey);
      if (cached) {
        logger.debug('Stream cache hit', {
          streamId,
          cacheKey: options.cacheKey,
        });
        return cached;
      }
    }

    // Initialize stream state
    this.activeStreams.set(streamId, {
      id: streamId,
      startTime,
      chunksReceived: 0,
      totalSize: 0,
      errors: 0,
      lastChunkTime: startTime,
    });

    this.metrics.totalStreams++;
    this.metrics.activeStreams++;

    try {
      const stream = await streamFn();
      return this.processTextStream(stream, streamId, options);
    } catch (error) {
      this.handleStreamError(streamId, error);
      throw error;
    }
  }

  /**
   * Optimize object streaming with progressive parsing
   * Enhanced with proper AsyncGenerator type constraints
   */
  async optimizeObjectStream<T>(
    streamFn: () => Promise<AsyncIterable<any>>,
    options?: {
      cacheKey?: string;
      enableCache?: boolean;
      enableCompression?: boolean;
      parser?: (chunk: any) => T;
      validator?: (obj: T) => boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<AsyncGenerator<OptimizedChunk<T>, void, unknown>> {
    const streamId = this.generateStreamId();
    const startTime = Date.now();

    // Check cache first if enabled
    if (
      this.config.enableCaching &&
      options?.enableCache &&
      options?.cacheKey
    ) {
      const cached = await this.getCachedStream(options.cacheKey);
      if (cached) {
        logger.debug('Object stream cache hit', {
          streamId,
          cacheKey: options.cacheKey,
        });
        return cached;
      }
    }

    // Initialize stream state
    this.activeStreams.set(streamId, {
      id: streamId,
      startTime,
      chunksReceived: 0,
      totalSize: 0,
      errors: 0,
      lastChunkTime: startTime,
    });

    this.metrics.totalStreams++;
    this.metrics.activeStreams++;

    try {
      const stream = await streamFn();
      return this.processObjectStream(stream, streamId, options);
    } catch (error) {
      this.handleStreamError(streamId, error);
      throw error;
    }
  }

  /**
   * Create buffered stream for better performance
   * Enhanced with proper AsyncGenerator type constraints
   */
  async createBufferedStream<T>(
    originalStream: AsyncIterable<T>,
    bufferSize?: number
  ): Promise<AsyncGenerator<T[], void, unknown>> {
    const effectiveBufferSize = bufferSize ?? this.config.bufferSize;

    return (async function* () {
      let buffer: T[] = [];

      for await (const chunk of originalStream) {
        buffer.push(chunk);

        if (buffer.length >= effectiveBufferSize) {
          yield [...buffer];
          buffer = [];
        }
      }

      // Yield remaining buffer
      if (buffer.length > 0) {
        yield buffer;
      }
    })();
  }

  /**
   * Create parallel stream processing
   * Enhanced with proper AsyncGenerator type constraints
   */
  async createParallelStream<T, R>(
    streams: AsyncIterable<T>[],
    processor: (chunk: T, streamIndex: number) => Promise<R>
  ): Promise<AsyncGenerator<R, void, unknown>> {
    const maxConcurrent = Math.min(
      streams.length,
      this.config.maxConcurrentStreams
    );

    return (async function* () {
      const activeStreams = streams
        .slice(0, maxConcurrent)
        .map(async function* (stream, index) {
          for await (const chunk of stream) {
            yield await processor(chunk, index);
          }
        });

      // Process streams in parallel
      for await (const result of mergeAsyncIterables(activeStreams)) {
        yield result;
      }
    })();
  }

  /**
   * Get current streaming metrics
   */
  getMetrics(): StreamMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get active stream information
   */
  getActiveStreams(): StreamState[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Clear stream cache and buffers
   */
  clearCache(): void {
    this.streamBuffer.clear();
    this.compressionCache.clear();
    logger.info('Stream cache cleared');
  }

  /**
   * Shutdown optimizer and cleanup
   */
  shutdown(): void {
    this.clearCache();
    this.activeStreams.clear();
    logger.info('Streaming optimizer shutdown');
  }

  // Private helper methods

  private async *processTextStream(
    stream: AsyncIterable<string>,
    streamId: string,
    options?: {
      cacheKey?: string;
      enableCache?: boolean;
      enableCompression?: boolean;
      chunkSize?: number;
      metadata?: Record<string, any>;
    }
  ): AsyncGenerator<OptimizedChunk<string>, void, unknown> {
    const state = this.activeStreams.get(streamId)!;
    const chunks: OptimizedChunk<string>[] = [];
    const chunkSize = options?.chunkSize ?? this.config.chunkSize;

    let buffer = '';
    let chunkIndex = 0;

    try {
      for await (const data of stream) {
        buffer += data;
        state.lastChunkTime = Date.now();

        // Process buffer in chunks
        while (buffer.length >= chunkSize) {
          const chunkData = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);

          const chunk = await this.createOptimizedChunk(
            chunkData,
            chunkIndex++,
            options?.enableCompression ?? this.config.enableCompression,
            options?.metadata
          );

          chunks.push(chunk);
          this.updateStreamState(streamId, chunk);

          yield chunk;
        }
      }

      // Process remaining buffer
      if (buffer.length > 0) {
        const chunk = await this.createOptimizedChunk(
          buffer,
          chunkIndex++,
          options?.enableCompression ?? this.config.enableCompression,
          options?.metadata
        );

        chunks.push(chunk);
        this.updateStreamState(streamId, chunk);

        yield chunk;
      }

      // Cache the complete stream if enabled
      if (
        this.config.enableCaching &&
        options?.enableCache &&
        options?.cacheKey
      ) {
        await this.cacheStream(options.cacheKey, chunks);
      }
    } finally {
      this.finalizeStream(streamId);
    }
  }

  private async *processObjectStream<T>(
    stream: AsyncIterable<any>,
    streamId: string,
    options?: {
      cacheKey?: string;
      enableCache?: boolean;
      enableCompression?: boolean;
      parser?: (chunk: any) => T;
      validator?: (obj: T) => boolean;
      metadata?: Record<string, any>;
    }
  ): AsyncGenerator<OptimizedChunk<T>, void, unknown> {
    const state = this.activeStreams.get(streamId)!;
    const chunks: OptimizedChunk<T>[] = [];
    let chunkIndex = 0;

    try {
      for await (const data of stream) {
        state.lastChunkTime = Date.now();

        // Parse the chunk if parser is provided
        let processedData = data;
        if (options?.parser) {
          try {
            processedData = options.parser(data);
          } catch (error) {
            logger.warn('Failed to parse chunk', { streamId, error });
            state.errors++;
            continue;
          }
        }

        // Validate if validator is provided
        if (options?.validator && !options.validator(processedData)) {
          logger.warn('Chunk failed validation', { streamId });
          state.errors++;
          continue;
        }

        const chunk = await this.createOptimizedChunk(
          processedData,
          chunkIndex++,
          options?.enableCompression ?? this.config.enableCompression,
          options?.metadata
        );

        chunks.push(chunk);
        this.updateStreamState(streamId, chunk);

        yield chunk;
      }

      // Cache the complete stream if enabled
      if (
        this.config.enableCaching &&
        options?.enableCache &&
        options?.cacheKey
      ) {
        await this.cacheStream(options.cacheKey, chunks);
      }
    } finally {
      this.finalizeStream(streamId);
    }
  }

  private async createOptimizedChunk<T>(
    data: T,
    index: number,
    enableCompression: boolean,
    metadata?: Record<string, any>
  ): Promise<OptimizedChunk<T>> {
    const timestamp = Date.now();
    let finalData = data;
    let compressed = false;
    let size = this.calculateSize(data);

    // Apply compression if enabled and beneficial
    if (enableCompression && size > 256) {
      // Only compress larger chunks
      const compressedData = await this.compressData(data);
      const compressedSize = this.calculateSize(compressedData);

      if (compressedSize < size * 0.8) {
        // Use compression if it saves 20%+
        finalData = compressedData as T;
        size = compressedSize;
        compressed = true;
      }
    }

    return {
      data: finalData,
      index,
      timestamp,
      size,
      compressed,
      metadata,
    };
  }

  private async compressData<T>(data: T): Promise<T> {
    // Simple compression simulation - in production, use a real compression library
    if (typeof data === 'string') {
      const compressed = data.replace(/\s+/g, ' ').trim();
      this.updateCompressionRatio(data.length, compressed.length);
      return compressed as T;
    }

    if (typeof data === 'object') {
      const serialized = JSON.stringify(data);
      const compressed = serialized.replace(/\s+/g, '');
      this.updateCompressionRatio(serialized.length, compressed.length);

      try {
        return JSON.parse(compressed) as T;
      } catch {
        return data;
      }
    }

    return data;
  }

  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16 encoding
    }

    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1024; // Default size
    }
  }

  private updateStreamState(
    streamId: string,
    chunk: OptimizedChunk<any>
  ): void {
    const state = this.activeStreams.get(streamId);
    if (state) {
      state.chunksReceived++;
      state.totalSize += chunk.size;
    }
  }

  private updateCompressionRatio(
    originalSize: number,
    compressedSize: number
  ): void {
    const ratio = compressedSize / originalSize;
    this.metrics.compressionRatio = (this.metrics.compressionRatio + ratio) / 2;
  }

  private finalizeStream(streamId: string): void {
    const state = this.activeStreams.get(streamId);
    if (state) {
      const duration = Date.now() - state.startTime;
      const avgChunkSize =
        state.chunksReceived > 0 ? state.totalSize / state.chunksReceived : 0;
      const throughput = state.chunksReceived / (duration / 1000);

      // Update metrics
      this.metrics.avgChunkSize =
        (this.metrics.avgChunkSize + avgChunkSize) / 2;
      this.metrics.avgLatency = (this.metrics.avgLatency + duration) / 2;
      this.metrics.throughput = (this.metrics.throughput + throughput) / 2;
      this.metrics.errorRate = state.errors / Math.max(state.chunksReceived, 1);

      this.activeStreams.delete(streamId);
      this.metrics.activeStreams--;
    }
  }

  private handleStreamError(streamId: string, error: any): void {
    const state = this.activeStreams.get(streamId);
    if (state) {
      state.errors++;
    }

    logger.error('Stream error', { streamId, error });
    this.finalizeStream(streamId);
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCachedStream(
    cacheKey: string
  ): Promise<AsyncGenerator<OptimizedChunk<any>, void, unknown> | null> {
    try {
      const cached = this.streamBuffer.get(cacheKey);
      if (cached) {
        return (async function* () {
          for (const chunk of cached) {
            yield chunk;
          }
        })();
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached stream', { cacheKey, error });
      return null;
    }
  }

  private async cacheStream(
    cacheKey: string,
    chunks: OptimizedChunk<any>[]
  ): Promise<void> {
    try {
      this.streamBuffer.set(cacheKey, chunks);

      // Implement TTL cleanup
      setTimeout(() => {
        this.streamBuffer.delete(cacheKey);
      }, this.config.cacheTTL);

      logger.debug('Stream cached', {
        cacheKey,
        chunks: chunks.length,
      });
    } catch (error) {
      logger.warn('Failed to cache stream', { cacheKey, error });
    }
  }

  private updateMetrics(): void {
    this.metrics.activeStreams = this.activeStreams.size;
  }

  private startMetricsCollection(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.updateMetrics();
    }, 30_000);
  }
}

// Helper function to merge async iterables
async function* mergeAsyncIterables<T>(
  iterables: AsyncIterable<T>[]
): AsyncIterable<T> {
  const promises = iterables.map(async (iterable) => {
    const iterator = iterable[Symbol.asyncIterator]();
    return { iterator, result: await iterator.next() };
  });

  const active = await Promise.all(promises);

  while (active.some(({ result }) => !result.done)) {
    for (let i = 0; i < active.length; i++) {
      const { iterator, result } = active[i];

      if (!result.done) {
        yield result.value;
        active[i] = { iterator, result: await iterator.next() };
      }
    }
  }
}

// Create singleton instance
const streamingOptimizer = StreamingOptimizer.getInstance();

// Export convenience functions
export async function optimizeTextStream(
  streamFn: () => Promise<AsyncIterable<string>>,
  options?: {
    cacheKey?: string;
    enableCache?: boolean;
    enableCompression?: boolean;
    chunkSize?: number;
    metadata?: Record<string, any>;
  }
): Promise<AsyncGenerator<OptimizedChunk<string>, void, unknown>> {
  return streamingOptimizer.optimizeTextStream(streamFn, options);
}

export async function optimizeObjectStream<T>(
  streamFn: () => Promise<AsyncIterable<any>>,
  options?: {
    cacheKey?: string;
    enableCache?: boolean;
    enableCompression?: boolean;
    parser?: (chunk: any) => T;
    validator?: (obj: T) => boolean;
    metadata?: Record<string, any>;
  }
): Promise<AsyncGenerator<OptimizedChunk<T>, void, unknown>> {
  return streamingOptimizer.optimizeObjectStream(streamFn, options);
}

export async function createBufferedStream<T>(
  originalStream: AsyncIterable<T>,
  bufferSize?: number
): Promise<AsyncGenerator<T[], void, unknown>> {
  return streamingOptimizer.createBufferedStream(originalStream, bufferSize);
}

export function getStreamingMetrics(): StreamMetrics {
  return streamingOptimizer.getMetrics();
}

export function clearStreamingCache(): void {
  streamingOptimizer.clearCache();
}

// Export types already exported above
export { streamingOptimizer };
