import type {
  CoreMessage,
  LanguageModel,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
} from 'ai';
import { v2ErrorHandler } from '../error-handling/unified-error-system';
import { FallbackChainManager } from '../routing';
import {
  AIGateway,
  type ModelRequirements,
  type ModelSelection,
} from './gateway';
import { IntelligentRoutingEngine } from '../routing';
import { ProviderMetricsService } from '../providers';
// import { createLogger } from '../logger/unified-logger'; // TODO: Fix logger import

// Create AI gateway middleware logger - temporary fix
const logger = {
  info: (...args: any[]) => console.log('[ai-gateway-middleware]', ...args),
  warn: (...args: any[]) => console.warn('[ai-gateway-middleware]', ...args),
  error: (...args: any[]) => console.error('[ai-gateway-middleware]', ...args),
  debug: (...args: any[]) => console.debug('[ai-gateway-middleware]', ...args),
};

// Middleware configuration
export interface MiddlewareConfig {
  enableCache?: boolean;
  cacheTTL?: number; // milliseconds
  enableRequestLogging?: boolean;
  enableResponseAggregation?: boolean;
  enableMetrics?: boolean;
  enableRetryLogic?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

// Request context
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  requirements: ModelRequirements;
  metadata?: LanguageModelRequestMetadata;
  sessionId?: string;
  userId?: string;
  tags?: string[];
}

// Response aggregation
export interface AggregatedResponse {
  primary: any;
  alternatives?: any[];
  consensus?: any;
  metadata: {
    providerId: string;
    modelId: string;
    latency: number;
    tokens?: {
      prompt: number;
      completion: number;
    };
    cost?: number;
  };
}

// Cache entry
interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hits: number;
  metadata: {
    providerId: string;
    modelId: string;
    requirements: ModelRequirements;
  };
}

// Request interceptor
export type RequestInterceptor = (
  context: RequestContext,
  next: () => Promise<any>
) => Promise<any>;

// Response interceptor
export type ResponseInterceptor = (
  response: any,
  context: RequestContext,
  next: () => Promise<any>
) => Promise<any>;

// Error interceptor
export type ErrorInterceptor = (
  error: Error,
  context: RequestContext,
  next: () => Promise<any>
) => Promise<any>;

// Default configuration
const DEFAULT_CONFIG: MiddlewareConfig = {
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableRequestLogging: true,
  enableResponseAggregation: false,
  enableMetrics: true,
  enableRetryLogic: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60_000, // 1 minute
};

/**
 * Gateway Middleware for request/response processing
 */
export class GatewayMiddleware {
  private static instance: GatewayMiddleware;
  private config: MiddlewareConfig;
  private gateway: AIGateway;
  private routingEngine: IntelligentRoutingEngine;
  private fallbackManager: FallbackChainManager;
  private metricsService: ProviderMetricsService;

  private cache: Map<string, CacheEntry> = new Map();
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  private circuitBreakers: Map<
    string,
    {
      failures: number;
      lastFailure?: Date;
      nextRetry?: Date;
      state: 'closed' | 'open' | 'half-open';
    }
  > = new Map();

  private constructor(config?: MiddlewareConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gateway = AIGateway.getInstance();
    this.routingEngine = IntelligentRoutingEngine.getInstance();
    this.fallbackManager = FallbackChainManager.getInstance();
    this.metricsService = ProviderMetricsService.getInstance();

    // Setup default interceptors
    this.setupDefaultInterceptors();

    // Periodic cache cleanup
    if (this.config.enableCache) {
      setInterval(() => this.cleanupCache(), 60_000); // Every minute
    }

    // Periodic circuit breaker check
    if (this.config.enableCircuitBreaker) {
      setInterval(() => this.checkCircuitBreakers(), 10_000); // Every 10 seconds
    }
  }

  static getInstance(config?: MiddlewareConfig): GatewayMiddleware {
    if (!GatewayMiddleware.instance) {
      GatewayMiddleware.instance = new GatewayMiddleware(config);
    }
    return GatewayMiddleware.instance;
  }

  /**
   * Process request through middleware pipeline
   */
  async processRequest<T>(
    requirements: ModelRequirements,
    executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
    metadata?: LanguageModelRequestMetadata,
    options?: { sessionId?: string; userId?: string; tags?: string[] }
  ): Promise<T> {
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
      requirements,
      metadata,
      sessionId: options?.sessionId,
      userId: options?.userId,
      tags: options?.tags,
    };

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.checkCache(context);
      if (cached) {
        logger.info('Cache hit', {
          requestId: context.requestId,
          cacheKey: this.getCacheKey(context),
        });
        return cached;
      }
    }

    // Create middleware chain
    const chain = this.createMiddlewareChain(context, executor);

    try {
      // Execute through middleware chain
      const result = await chain();

      // Cache successful result
      if (this.config.enableCache && result) {
        this.cacheResult(context, result);
      }

      return result;
    } catch (error) {
      // Error will be handled by error interceptors
      throw error;
    }
  }

  /**
   * Process aggregated requests
   */
  async processAggregatedRequest<T>(
    requirements: ModelRequirements,
    executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
    aggregationStrategy: 'consensus' | 'best-of' | 'ensemble' = 'consensus',
    modelCount = 3
  ): Promise<AggregatedResponse> {
    if (!this.config.enableResponseAggregation) {
      throw new Error('Response aggregation is not enabled');
    }

    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
      requirements,
      tags: ['aggregated', aggregationStrategy],
    };

    logger.info('Processing aggregated request', {
      requestId: context.requestId,
      strategy: aggregationStrategy,
      modelCount,
    });

    // Get multiple suitable models
    const availableProviders = Array.from(
      this.gateway.getAllProviderStatuses().keys()
    )
      .map((id) => this.gateway.getProviderHealth(id))
      .filter((health) => health && health.status !== 'unhealthy');

    const routingDecisions = await Promise.all(
      Array(modelCount)
        .fill(null)
        .map(() =>
          this.routingEngine.routeRequest(
            requirements,
            availableProviders as any
          )
        )
    );

    // Execute requests in parallel
    const results = await Promise.allSettled(
      routingDecisions.map(async (decision) => {
        const selection: ModelSelection =
          await this.gateway.getOptimalModel(requirements);
        const startTime = Date.now();

        try {
          const result = await executor(selection.model, context);
          const latency = Date.now() - startTime;

          return {
            result,
            metadata: {
              providerId: decision.primaryChoice.providerId,
              modelId: decision.primaryChoice.modelId,
              latency,
            },
          };
        } catch (error) {
          logger.warn('Model failed in aggregation', {
            model: decision.primaryChoice.modelId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      })
    );

    // Filter successful results
    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (successfulResults.length === 0) {
      throw new Error('All models failed in aggregated request');
    }

    // Apply aggregation strategy
    const aggregated = this.applyAggregationStrategy(
      successfulResults,
      aggregationStrategy
    );

    return aggregated;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    topEntries: Array<{ key: string; hits: number }>;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalRequests = totalHits + entries.length; // Simplified

    return {
      size: this.cache.size,
      hits: totalHits,
      misses: entries.length,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      topEntries: entries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map((e) => ({ key: e.key, hits: e.hits })),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, any> {
    return new Map(this.circuitBreakers);
  }

  // Private helper methods

  private setupDefaultInterceptors(): void {
    // Request logging interceptor
    if (this.config.enableRequestLogging) {
      this.addRequestInterceptor(async (context, next) => {
        logger.info('Processing request', {
          requestId: context.requestId,
          task: context.requirements.task,
          priority: context.requirements.priority,
        });
        return next();
      });
    }

    // Metrics interceptor
    if (this.config.enableMetrics) {
      this.addResponseInterceptor(async (response, context, next) => {
        // Metrics are recorded by the gateway
        return next();
      });
    }

    // Retry logic interceptor
    if (this.config.enableRetryLogic) {
      this.addErrorInterceptor(async (error, context, next) => {
        const handledError = v2ErrorHandler.handleError(error);

        if (handledError.retry && this.config.maxRetries) {
          logger.warn('Retrying request', {
            requestId: context.requestId,
            error: handledError.message,
            severity: handledError.severity,
          });

          // Apply retry delay
          if (this.config.retryDelay) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.retryDelay)
            );
          }

          return next();
        }

        throw error;
      });
    }

    // Circuit breaker interceptor
    if (this.config.enableCircuitBreaker) {
      this.addErrorInterceptor(async (error, context, next) => {
        // Use task-based identification since model property doesn't exist
        const taskId = `${context.requirements.task}-${context.requirements.priority}`;
        this.recordCircuitBreakerFailure(taskId);
        throw error;
      });
    }
  }

  private createMiddlewareChain(
    context: RequestContext,
    executor: Function
  ): () => Promise<any> {
    // Build the chain from interceptors
    let chain = async () => {
      // Get optimal model through gateway
      const modelSelection = await this.gateway.getOptimalModel(
        context.requirements
      );

      // Check circuit breaker
      if (
        this.config.enableCircuitBreaker &&
        this.isCircuitBreakerOpen(modelSelection.modelId)
      ) {
        throw new Error(
          `Circuit breaker open for model: ${modelSelection.modelId}`
        );
      }

      // Execute with failover support
      return this.gateway.executeWithFailover(
        modelSelection,
        (model) => executor(model, context),
        context.metadata
      );
    };

    // Wrap with error interceptors
    for (const interceptor of [...this.errorInterceptors].reverse()) {
      const next = chain;
      chain = async () => {
        try {
          return await next();
        } catch (error) {
          return interceptor(error as Error, context, next);
        }
      };
    }

    // Wrap with response interceptors
    for (const interceptor of [...this.responseInterceptors].reverse()) {
      const next = chain;
      chain = async () => {
        const response = await next();
        return interceptor(response, context, () => Promise.resolve(response));
      };
    }

    // Wrap with request interceptors
    for (const interceptor of [...this.requestInterceptors].reverse()) {
      const next = chain;
      chain = () => interceptor(context, next);
    }

    return chain;
  }

  private getCacheKey(context: RequestContext): string {
    const parts = [
      context.requirements.task,
      context.requirements.priority,
      context.requirements.complexity || 'default',
      ...(context.requirements.capabilities || []),
      context.sessionId || 'no-session',
      ...(context.tags || []),
    ];

    return parts.join(':');
  }

  private checkCache(context: RequestContext): any {
    const key = this.getCacheKey(context);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;

    return entry.value;
  }

  private cacheResult(context: RequestContext, result: any): void {
    const key = this.getCacheKey(context);

    this.cache.set(key, {
      key,
      value: result,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL || DEFAULT_CONFIG.cacheTTL!,
      hits: 0,
      metadata: {
        providerId: 'unknown', // Provider ID not available in AI SDK v5 metadata
        modelId: `${context.requirements.task}-${context.requirements.priority}`,
        requirements: context.requirements,
      },
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.cache.delete(key);
    }

    if (expired.length > 0) {
      logger.debug(
        `Cleaned up ${expired.length} expired cache entries`
      );
    }
  }

  private isCircuitBreakerOpen(modelId: string): boolean {
    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) {
      return false;
    }

    return (
      breaker.state === 'open' &&
      (!breaker.nextRetry || new Date() < breaker.nextRetry)
    );
  }

  private recordCircuitBreakerFailure(modelId: string): void {
    let breaker = this.circuitBreakers.get(modelId);

    if (!breaker) {
      breaker = {
        failures: 0,
        state: 'closed',
      };
      this.circuitBreakers.set(modelId, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    if (
      breaker.failures >=
      (this.config.circuitBreakerThreshold ||
        DEFAULT_CONFIG.circuitBreakerThreshold!)
    ) {
      breaker.state = 'open';
      breaker.nextRetry = new Date(
        Date.now() +
          (this.config.circuitBreakerTimeout ||
            DEFAULT_CONFIG.circuitBreakerTimeout!)
      );

      logger.warn('Circuit breaker opened', {
        modelId,
        failures: breaker.failures,
        nextRetry: breaker.nextRetry,
      });
    }
  }

  private checkCircuitBreakers(): void {
    const now = new Date();

    for (const [modelId, breaker] of this.circuitBreakers) {
      if (
        breaker.state === 'open' &&
        breaker.nextRetry &&
        now >= breaker.nextRetry
      ) {
        breaker.state = 'half-open';
        logger.info('Circuit breaker half-open', { modelId });
      }
    }
  }

  private applyAggregationStrategy(
    results: Array<{ result: any; metadata: any }>,
    strategy: 'consensus' | 'best-of' | 'ensemble'
  ): AggregatedResponse {
    switch (strategy) {
      case 'consensus':
        return this.applyConsensusStrategy(results);

      case 'best-of':
        return this.applyBestOfStrategy(results);

      case 'ensemble':
        return this.applyEnsembleStrategy(results);

      default:
        throw new Error(`Unknown aggregation strategy: ${strategy}`);
    }
  }

  private applyConsensusStrategy(
    results: Array<{ result: any; metadata: any }>
  ): AggregatedResponse {
    // For text responses, find the most common or average response
    // This is a simplified implementation
    const primary = results[0];
    const alternatives = results.slice(1).map((r) => r.result);

    // Calculate average metadata
    const avgLatency =
      results.reduce((sum, r) => sum + r.metadata.latency, 0) / results.length;

    return {
      primary: primary.result,
      alternatives,
      consensus: primary.result, // Simplified - in real implementation, calculate actual consensus
      metadata: {
        ...primary.metadata,
        latency: Math.round(avgLatency),
      },
    };
  }

  private applyBestOfStrategy(
    results: Array<{ result: any; metadata: any }>
  ): AggregatedResponse {
    // Select the best result based on some criteria (e.g., fastest response)
    const best = results.reduce((prev, curr) =>
      curr.metadata.latency < prev.metadata.latency ? curr : prev
    );

    return {
      primary: best.result,
      alternatives: results.filter((r) => r !== best).map((r) => r.result),
      metadata: best.metadata,
    };
  }

  private applyEnsembleStrategy(
    results: Array<{ result: any; metadata: any }>
  ): AggregatedResponse {
    // Combine all results into an ensemble
    const ensemble = {
      results: results.map((r) => ({
        content: r.result,
        model: r.metadata.modelId,
        latency: r.metadata.latency,
      })),
    };

    return {
      primary: ensemble,
      alternatives: results.map((r) => r.result),
      metadata: {
        providerId: 'ensemble',
        modelId: 'ensemble',
        latency: Math.max(...results.map((r) => r.metadata.latency)),
      },
    };
  }
}

// Export singleton getter
export const getGatewayMiddleware = (
  config?: MiddlewareConfig
): GatewayMiddleware => {
  return GatewayMiddleware.getInstance(config);
};
