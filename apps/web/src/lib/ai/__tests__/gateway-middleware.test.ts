import type { LanguageModel } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelRequirements } from '../gateway';
import {
  GatewayMiddleware,
  type MiddlewareConfig,
  type RequestContext,
} from '../gateway-middleware';

// Mock dependencies
vi.mock('../gateway', () => ({
  AIGateway: {
    getInstance: vi.fn(() => ({
      getOptimalModel: vi.fn().mockResolvedValue({
        provider: 'openai',
        modelId: 'openai:fast',
        model: {
          id: 'openai:fast',
          provider: 'openai',
          doGenerate: vi.fn(),
          doStream: vi.fn(),
        },
        reason: 'Test selection',
        fallbackOptions: [],
      }),
      executeWithFailover: vi.fn().mockResolvedValue('Test result'),
      getAllProviderStatuses: vi.fn().mockReturnValue(
        new Map([
          ['openai', { status: 'healthy' }],
          ['anthropic', { status: 'healthy' }],
        ])
      ),
      getProviderHealth: vi.fn().mockReturnValue({ status: 'healthy' }),
    })),
  },
}));

vi.mock('../intelligent-routing', () => ({
  IntelligentRoutingEngine: {
    getInstance: vi.fn(() => ({
      routeRequest: vi.fn().mockResolvedValue({
        primaryChoice: {
          providerId: 'openai',
          modelId: 'openai:fast',
          reason: 'Test routing',
          confidence: 0.9,
        },
        alternatives: [],
        strategy: 'adaptive',
        metadata: {},
      }),
    })),
  },
}));

vi.mock('../fallback-chain', () => ({
  FallbackChainManager: {
    getInstance: vi.fn(() => ({})),
  },
}));

vi.mock('../provider-metrics', () => ({
  ProviderMetricsService: {
    getInstance: vi.fn(() => ({})),
  },
}));

describe('GatewayMiddleware', () => {
  let middleware: GatewayMiddleware;
  let mockConfig: MiddlewareConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      enableCache: true,
      cacheTTL: 60_000,
      enableRequestLogging: true,
      enableResponseAggregation: true,
      enableMetrics: true,
      enableRetryLogic: true,
      maxRetries: 2,
      retryDelay: 100,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 5000,
    };

    middleware = new (GatewayMiddleware as any)(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should process request through middleware pipeline', async () => {
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'speed',
      };

      const executor = vi.fn().mockResolvedValue('Test response');

      const result = await middleware.processRequest(requirements, executor);

      expect(result).toBe('Test result');
      expect(executor).toHaveBeenCalled();
    });

    it('should return cached result on cache hit', async () => {
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'speed',
      };

      const executor = vi.fn().mockResolvedValue('Test response');

      // First call - should execute
      const result1 = await middleware.processRequest(requirements, executor);
      expect(result1).toBe('Test result');

      // Second call - should return cached
      const result2 = await middleware.processRequest(requirements, executor);
      expect(result2).toBe('Test result');

      // Executor should only be called once due to caching
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should handle errors with retry logic', async () => {
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'speed',
      };

      let callCount = 0;
      const executor = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary error');
        }
        return Promise.resolve('Success after retry');
      });

      const result = await middleware.processRequest(requirements, executor);

      expect(result).toBe('Test result');
      expect(callCount).toBe(1); // Gateway handles retry, not the executor
    });
  });

  describe('processAggregatedRequest', () => {
    it('should aggregate responses from multiple models', async () => {
      const requirements: ModelRequirements = {
        task: 'analysis',
        priority: 'quality',
      };

      const executor = vi.fn().mockResolvedValue('Model response');

      const result = await middleware.processAggregatedRequest(
        requirements,
        executor,
        'consensus',
        3
      );

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.providerId).toBe('ensemble');
    });

    it('should apply different aggregation strategies', async () => {
      const requirements: ModelRequirements = {
        task: 'creative',
        priority: 'quality',
      };

      const executor = vi.fn().mockResolvedValue('Creative response');

      // Test consensus strategy
      const consensusResult = await middleware.processAggregatedRequest(
        requirements,
        executor,
        'consensus',
        2
      );
      expect(consensusResult.consensus).toBeDefined();

      // Test best-of strategy
      const bestOfResult = await middleware.processAggregatedRequest(
        requirements,
        executor,
        'best-of',
        2
      );
      expect(bestOfResult.primary).toBeDefined();

      // Test ensemble strategy
      const ensembleResult = await middleware.processAggregatedRequest(
        requirements,
        executor,
        'ensemble',
        2
      );
      expect(ensembleResult.primary.results).toBeDefined();
    });

    it('should throw error when aggregation is disabled', async () => {
      const disabledMiddleware = new (GatewayMiddleware as any)({
        ...mockConfig,
        enableResponseAggregation: false,
      });

      await expect(
        disabledMiddleware.processAggregatedRequest(
          { task: 'chat', priority: 'speed' },
          vi.fn()
        )
      ).rejects.toThrow('Response aggregation is not enabled');
    });
  });

  describe('interceptors', () => {
    it('should execute request interceptors in order', async () => {
      const callOrder: string[] = [];

      middleware.addRequestInterceptor(async (context, next) => {
        callOrder.push('interceptor1');
        return next();
      });

      middleware.addRequestInterceptor(async (context, next) => {
        callOrder.push('interceptor2');
        return next();
      });

      await middleware.processRequest(
        { task: 'chat', priority: 'speed' },
        vi.fn().mockResolvedValue('Result')
      );

      expect(callOrder).toEqual(['interceptor2', 'interceptor1']);
    });

    it('should execute response interceptors', async () => {
      let responseModified = false;

      middleware.addResponseInterceptor(async (response, context, next) => {
        responseModified = true;
        return next();
      });

      await middleware.processRequest(
        { task: 'chat', priority: 'speed' },
        vi.fn().mockResolvedValue('Result')
      );

      expect(responseModified).toBe(true);
    });

    it('should execute error interceptors on failure', async () => {
      let errorHandled = false;

      middleware.addErrorInterceptor(async (error, context, next) => {
        errorHandled = true;
        throw error; // Re-throw to test error propagation
      });

      const executor = vi.fn().mockRejectedValue(new Error('Test error'));

      try {
        await middleware.processRequest(
          { task: 'chat', priority: 'speed' },
          executor
        );
      } catch (error) {
        // Expected
      }

      expect(errorHandled).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should return cache statistics', () => {
      const stats = middleware.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('topEntries');
    });

    it('should clear cache', async () => {
      // Add something to cache
      await middleware.processRequest(
        { task: 'chat', priority: 'speed' },
        vi.fn().mockResolvedValue('Cached result')
      );

      const statsBefore = middleware.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      middleware.clearCache();

      const statsAfter = middleware.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('circuit breaker', () => {
    it('should track circuit breaker status', () => {
      const status = middleware.getCircuitBreakerStatus();

      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0); // Initially empty
    });

    it('should open circuit breaker after threshold failures', async () => {
      const executor = vi.fn().mockRejectedValue(new Error('Model failure'));

      // Fail multiple times
      for (let i = 0; i < mockConfig.circuitBreakerThreshold!; i++) {
        try {
          await middleware.processRequest(
            { task: 'chat', priority: 'speed' },
            executor,
            { modelId: 'test-model' }
          );
        } catch {
          // Expected
        }
      }

      const status = middleware.getCircuitBreakerStatus();
      expect(status.size).toBeGreaterThan(0);
    });
  });
});
