import type { LanguageModel } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AIGateway,
  type GatewayConfig,
  type ModelRequirements,
} from '../gateway';
import { LoadBalancer } from '../load-balancing';
import { ProviderMetricsService } from '../provider-metrics';

// Mock registry
vi.mock('../providers', () => ({
  registry: {
    languageModel: vi.fn((modelId: string) => ({
      id: modelId,
      provider: modelId.split(':')[0],
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    })),
  },
}));

describe('AIGateway', () => {
  let gateway: AIGateway;
  let mockConfig: GatewayConfig;

  beforeEach(() => {
    // Clear singleton instances
    vi.clearAllMocks();

    mockConfig = {
      providers: ['openai', 'anthropic'],
      fallbackChain: ['openai:fast', 'anthropic:fast'],
      loadBalancing: 'round-robin',
      maxRetries: 3,
      retryDelay: 100,
      cooldownPeriod: 1000,
      performanceSLA: {
        maxLatency: 5000,
        minSuccessRate: 0.95,
      },
      enableCache: true,
      cacheTTL: 300_000,
    };

    gateway = new (AIGateway as any)(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOptimalModel', () => {
    it('should return optimal model based on speed priority', async () => {
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'speed',
        capabilities: ['chat'],
      };

      const result = await gateway.getOptimalModel(requirements);

      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(result.modelId).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.reason).toContain('Lowest latency');
    });

    it('should return optimal model based on quality priority', async () => {
      const requirements: ModelRequirements = {
        task: 'reasoning',
        priority: 'quality',
        capabilities: ['reasoning'],
      };

      const result = await gateway.getOptimalModel(requirements);

      expect(result).toBeDefined();
      expect(result.reason).toContain('Highest quality');
    });

    it('should return optimal model based on cost priority', async () => {
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'cost',
        maxCost: 0.0001,
      };

      const result = await gateway.getOptimalModel(requirements);

      expect(result).toBeDefined();
      expect(result.reason).toContain('Lowest cost');
    });

    it('should filter models by capabilities', async () => {
      const requirements: ModelRequirements = {
        task: 'code',
        priority: 'quality',
        capabilities: ['code', 'debugging'],
      };

      const result = await gateway.getOptimalModel(requirements);

      expect(result).toBeDefined();
      expect(result.modelId).toContain('code');
    });

    it('should throw error when no suitable models found', async () => {
      const requirements: ModelRequirements = {
        task: 'vision',
        priority: 'quality',
        capabilities: ['vision', 'image-generation'],
        maxCost: 0.000_001, // Impossibly low cost
      };

      await expect(gateway.getOptimalModel(requirements)).rejects.toThrow(
        'No suitable models found'
      );
    });
  });

  describe('executeWithFailover', () => {
    it('should execute request successfully with primary model', async () => {
      const mockModel: LanguageModel = {
        id: 'openai:fast',
        provider: 'openai',
        doGenerate: vi.fn().mockResolvedValue({ text: 'Success' }),
        doStream: vi.fn(),
      };

      const modelSelection = {
        provider: 'openai',
        modelId: 'openai:fast',
        model: mockModel,
        reason: 'Primary selection',
        fallbackOptions: ['anthropic:fast'],
      };

      const request = vi.fn().mockResolvedValue('Test result');

      const result = await gateway.executeWithFailover(modelSelection, request);

      expect(result).toBe('Test result');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('should failover to backup model on primary failure', async () => {
      const mockModel: LanguageModel = {
        id: 'openai:fast',
        provider: 'openai',
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };

      const modelSelection = {
        provider: 'openai',
        modelId: 'openai:fast',
        model: mockModel,
        reason: 'Primary selection',
        fallbackOptions: ['anthropic:fast'],
      };

      const request = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce('Fallback success');

      const result = await gateway.executeWithFailover(modelSelection, request);

      expect(result).toBe('Fallback success');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should throw error when all models fail', async () => {
      const mockModel: LanguageModel = {
        id: 'openai:fast',
        provider: 'openai',
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };

      const modelSelection = {
        provider: 'openai',
        modelId: 'openai:fast',
        model: mockModel,
        reason: 'Primary selection',
        fallbackOptions: ['anthropic:fast'],
      };

      const request = vi.fn().mockRejectedValue(new Error('All models failed'));

      await expect(
        gateway.executeWithFailover(modelSelection, request)
      ).rejects.toThrow('All models failed');
    });
  });

  describe('checkProviderHealth', () => {
    it('should return healthy status for good metrics', async () => {
      const metricsService = ProviderMetricsService.getInstance();
      vi.spyOn(metricsService, 'getProviderMetrics').mockReturnValue({
        providerId: 'openai',
        totalRequests: 100,
        successCount: 98,
        errorCount: 2,
        averageLatency: 500,
        p50Latency: 400,
        p95Latency: 800,
        p99Latency: 1000,
        tokenUsage: {
          totalTokens: 10_000,
          promptTokens: 5000,
          completionTokens: 5000,
          averageTokensPerRequest: 100,
        },
        costTracking: {
          totalCost: 1.0,
          costPerRequest: 0.01,
          costPerToken: 0.0001,
          dailyCost: 24.0,
          monthlyCost: 720.0,
        },
        rateLimitStatus: {
          remaining: 1000,
          limit: 10_000,
          reset: new Date(),
          isLimited: false,
        },
        lastUpdated: new Date(),
      });

      const health = await gateway.checkProviderHealth('openai');

      expect(health.status).toBe('healthy');
      expect(health.successRate).toBeGreaterThan(0.95);
      expect(health.averageLatency).toBeLessThan(1000);
    });

    it('should return degraded status for poor performance', async () => {
      const metricsService = ProviderMetricsService.getInstance();
      vi.spyOn(metricsService, 'getProviderMetrics').mockReturnValue({
        providerId: 'openai',
        totalRequests: 100,
        successCount: 75,
        errorCount: 25,
        averageLatency: 6000,
        p50Latency: 5000,
        p95Latency: 10_000,
        p99Latency: 15_000,
        tokenUsage: {
          totalTokens: 10_000,
          promptTokens: 5000,
          completionTokens: 5000,
          averageTokensPerRequest: 100,
        },
        costTracking: {
          totalCost: 1.0,
          costPerRequest: 0.01,
          costPerToken: 0.0001,
          dailyCost: 24.0,
          monthlyCost: 720.0,
        },
        rateLimitStatus: {
          remaining: 100,
          limit: 10_000,
          reset: new Date(),
          isLimited: false,
        },
        lastUpdated: new Date(),
      });

      const health = await gateway.checkProviderHealth('openai');

      expect(health.status).toBe('degraded');
      expect(health.successRate).toBeLessThan(0.8);
    });

    it('should return unhealthy status and set cooldown', async () => {
      const metricsService = ProviderMetricsService.getInstance();
      vi.spyOn(metricsService, 'getProviderMetrics').mockReturnValue({
        providerId: 'openai',
        totalRequests: 100,
        successCount: 40,
        errorCount: 60,
        averageLatency: 10_000,
        p50Latency: 8000,
        p95Latency: 20_000,
        p99Latency: 30_000,
        tokenUsage: {
          totalTokens: 10_000,
          promptTokens: 5000,
          completionTokens: 5000,
          averageTokensPerRequest: 100,
        },
        costTracking: {
          totalCost: 1.0,
          costPerRequest: 0.01,
          costPerToken: 0.0001,
          dailyCost: 24.0,
          monthlyCost: 720.0,
        },
        rateLimitStatus: {
          remaining: 0,
          limit: 10_000,
          reset: new Date(),
          isLimited: true,
        },
        lastUpdated: new Date(),
      });

      const health = await gateway.checkProviderHealth('openai');

      expect(health.status).toBe('unhealthy');
      expect(health.successRate).toBeLessThan(0.5);
      expect(health.cooldownUntil).toBeDefined();
    });
  });

  describe('getAllProviderStatuses', () => {
    it('should return all provider health statuses', () => {
      const statuses = gateway.getAllProviderStatuses();

      expect(statuses).toBeInstanceOf(Map);
      expect(statuses.size).toBeGreaterThan(0);
      expect(statuses.has('openai')).toBe(true);
      expect(statuses.has('anthropic')).toBe(true);
    });
  });
});
