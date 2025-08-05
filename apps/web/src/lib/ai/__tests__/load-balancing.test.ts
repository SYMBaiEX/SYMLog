import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptiveStrategy,
  CostOptimizedStrategy,
  HealthBasedStrategy,
  LeastLatencyStrategy,
  LoadBalancer,
  type LoadBalancerConfig,
  type ProviderWeight,
  RoundRobinStrategy,
  StickySessionStrategy,
  WeightedStrategy,
} from '../load-balancing';
import { ProviderMetricsService } from '../provider-metrics';

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;
  let metricsService: ProviderMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    metricsService = ProviderMetricsService.getInstance();
    loadBalancer = new LoadBalancer('round-robin');
  });

  describe('RoundRobinStrategy', () => {
    it('should rotate through providers evenly', () => {
      const providers = ['openai', 'anthropic', 'cohere'];
      const strategy = new RoundRobinStrategy();

      const selections = [];
      for (let i = 0; i < 6; i++) {
        selections.push(strategy.selectProvider(providers).providerId);
      }

      expect(selections).toEqual([
        'openai',
        'anthropic',
        'cohere',
        'openai',
        'anthropic',
        'cohere',
      ]);
    });

    it('should handle single provider', () => {
      const strategy = new RoundRobinStrategy();
      const selection = strategy.selectProvider(['openai']);

      expect(selection.providerId).toBe('openai');
      expect(selection.reason).toContain('Round-robin');
    });

    it('should throw error for empty provider list', () => {
      const strategy = new RoundRobinStrategy();

      expect(() => strategy.selectProvider([])).toThrow(
        'No providers available'
      );
    });
  });

  describe('LeastLatencyStrategy', () => {
    it('should select provider with lowest latency', () => {
      const strategy = new LeastLatencyStrategy();

      // Mock metrics
      vi.spyOn(metricsService, 'getProviderMetrics').mockImplementation(
        (providerId) => ({
          providerId,
          totalRequests: 100,
          successCount: 95,
          errorCount: 5,
          averageLatency: providerId === 'fast-provider' ? 200 : 1000,
          p50Latency: providerId === 'fast-provider' ? 150 : 800,
          p95Latency: 300,
          p99Latency: 500,
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
        })
      );

      const selection = strategy.selectProvider([
        'slow-provider',
        'fast-provider',
      ]);

      expect(selection.providerId).toBe('fast-provider');
      expect(selection.reason).toContain('Lowest latency');
      expect(selection.metadata?.latency).toBe(150);
    });
  });

  describe('CostOptimizedStrategy', () => {
    it('should select cheapest provider considering reliability', () => {
      const strategy = new CostOptimizedStrategy();

      // Mock metrics
      vi.spyOn(metricsService, 'getProviderMetrics').mockImplementation(
        (providerId) => ({
          providerId,
          totalRequests: 100,
          successCount: providerId === 'reliable-cheap' ? 98 : 50,
          errorCount: providerId === 'reliable-cheap' ? 2 : 50,
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
            costPerRequest: providerId === 'expensive' ? 0.1 : 0.01,
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
        })
      );

      const selection = strategy.selectProvider([
        'expensive',
        'unreliable-cheap',
        'reliable-cheap',
      ]);

      expect(selection.providerId).toBe('reliable-cheap');
      expect(selection.reason).toContain('Lowest cost');
    });
  });

  describe('WeightedStrategy', () => {
    it('should select based on weights', () => {
      const weights: ProviderWeight[] = [
        { providerId: 'openai', weight: 70 },
        { providerId: 'anthropic', weight: 20 },
        { providerId: 'cohere', weight: 10 },
      ];

      const strategy = new WeightedStrategy(weights);

      // Mock random to test selection
      const mockRandom = vi.spyOn(Math, 'random');

      // Test different random values
      mockRandom.mockReturnValueOnce(0.5); // Should select openai (70%)
      const selection1 = strategy.selectProvider([
        'openai',
        'anthropic',
        'cohere',
      ]);
      expect(selection1.providerId).toBe('openai');

      mockRandom.mockReturnValueOnce(0.85); // Should select anthropic (70-90%)
      const selection2 = strategy.selectProvider([
        'openai',
        'anthropic',
        'cohere',
      ]);
      expect(selection2.providerId).toBe('anthropic');

      mockRandom.mockReturnValueOnce(0.95); // Should select cohere (90-100%)
      const selection3 = strategy.selectProvider([
        'openai',
        'anthropic',
        'cohere',
      ]);
      expect(selection3.providerId).toBe('cohere');
    });

    it('should use equal weights when none configured', () => {
      const strategy = new WeightedStrategy();
      const providers = ['openai', 'anthropic'];

      const selection = strategy.selectProvider(providers);

      expect(providers).toContain(selection.providerId);
      expect(selection.reason).toContain('Equal weight');
    });
  });

  describe('StickySessionStrategy', () => {
    it('should maintain session affinity', () => {
      const config: LoadBalancerConfig = {
        sessionAffinityTTL: 30_000, // 30 seconds
      };
      const strategy = new StickySessionStrategy(config);
      const providers = ['openai', 'anthropic', 'cohere'];

      // First request creates session
      const context1 = { sessionId: 'test-session-123' };
      const selection1 = strategy.selectProvider(providers, context1);

      // Subsequent requests should use same provider
      const selection2 = strategy.selectProvider(providers, context1);
      const selection3 = strategy.selectProvider(providers, context1);

      expect(selection2.providerId).toBe(selection1.providerId);
      expect(selection3.providerId).toBe(selection1.providerId);
      expect(selection3.metadata?.requestCount).toBe(3);
    });

    it('should expire old sessions', () => {
      const config: LoadBalancerConfig = {
        sessionAffinityTTL: 100, // 100ms for testing
      };
      const strategy = new StickySessionStrategy(config);
      const providers = ['openai', 'anthropic'];
      const context = { sessionId: 'test-session' };

      // Create session
      const selection1 = strategy.selectProvider(providers, context);

      // Wait for expiry
      vi.advanceTimersByTime(200);

      // Should create new session
      const selection2 = strategy.selectProvider(providers, context);
      expect(selection2.metadata?.newSession).toBe(true);
    });

    it('should use fallback strategy when no session', () => {
      const strategy = new StickySessionStrategy();
      const providers = ['openai', 'anthropic'];

      // No session ID provided
      const selection = strategy.selectProvider(providers, {});

      expect(providers).toContain(selection.providerId);
      expect(selection.reason).not.toContain('Sticky session');
    });
  });

  describe('HealthBasedStrategy', () => {
    it('should select healthiest provider', () => {
      const strategy = new HealthBasedStrategy();

      // Mock health scores
      vi.spyOn(metricsService, 'calculateHealthScore').mockImplementation(
        (providerId) => {
          const scores: Record<string, number> = {
            healthy: 95,
            degraded: 70,
            unhealthy: 30,
          };
          return scores[providerId] || 50;
        }
      );

      vi.spyOn(metricsService, 'getProviderMetrics').mockReturnValue({
        providerId: 'healthy',
        totalRequests: 100,
        successCount: 95,
        errorCount: 5,
        averageLatency: 300,
        p50Latency: 250,
        p95Latency: 500,
        p99Latency: 800,
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

      const selection = strategy.selectProvider([
        'unhealthy',
        'degraded',
        'healthy',
      ]);

      expect(selection.providerId).toBe('healthy');
      expect(selection.reason).toContain('Highest health score: 95/100');
    });
  });

  describe('AdaptiveStrategy', () => {
    it('should balance multiple factors', () => {
      const config: LoadBalancerConfig = {
        costWeight: 0.3,
        performanceWeight: 0.5,
        reliabilityWeight: 0.2,
      };
      const strategy = new AdaptiveStrategy(config);

      // Mock metrics for different providers
      vi.spyOn(metricsService, 'getProviderMetrics').mockImplementation(
        (providerId) => ({
          providerId,
          totalRequests: 100,
          successCount: providerId === 'reliable' ? 99 : 80,
          errorCount: providerId === 'reliable' ? 1 : 20,
          averageLatency: providerId === 'fast' ? 100 : 500,
          p50Latency: providerId === 'fast' ? 80 : 400,
          p95Latency: 300,
          p99Latency: 500,
          tokenUsage: {
            totalTokens: 10_000,
            promptTokens: 5000,
            completionTokens: 5000,
            averageTokensPerRequest: 100,
          },
          costTracking: {
            totalCost: 1.0,
            costPerRequest: providerId === 'cheap' ? 0.001 : 0.01,
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
        })
      );

      const selection = strategy.selectProvider(['cheap', 'fast', 'reliable']);

      expect(selection.reason).toContain('Adaptive selection');
      expect(selection.metadata?.weights).toEqual(config);
    });

    it('should apply exploration strategy', () => {
      const strategy = new AdaptiveStrategy();
      const providers = ['openai', 'anthropic'];

      // Mock random to force exploration
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.05); // 5% < 10% exploration rate

      // Mock metrics to make openai clearly better
      vi.spyOn(metricsService, 'getProviderMetrics').mockImplementation(
        (providerId) => ({
          providerId,
          totalRequests: 100,
          successCount: providerId === 'openai' ? 100 : 50,
          errorCount: providerId === 'openai' ? 0 : 50,
          averageLatency: providerId === 'openai' ? 100 : 1000,
          p50Latency: 80,
          p95Latency: 300,
          p99Latency: 500,
          tokenUsage: {
            totalTokens: 10_000,
            promptTokens: 5000,
            completionTokens: 5000,
            averageTokensPerRequest: 100,
          },
          costTracking: {
            totalCost: 1.0,
            costPerRequest: 0.001,
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
        })
      );

      const selection = strategy.selectProvider(providers);

      // Due to exploration, might select anthropic despite openai being better
      expect(selection.metadata?.exploration).toBeDefined();
    });
  });

  describe('LoadBalancer Integration', () => {
    it('should switch strategies dynamically', () => {
      const lb = new LoadBalancer('round-robin');

      expect(lb.getCurrentStrategy()).toBe('round-robin');

      lb.setStrategy('least-latency');
      expect(lb.getCurrentStrategy()).toBe('least-latency');

      lb.setStrategy('adaptive');
      expect(lb.getCurrentStrategy()).toBe('adaptive');
    });

    it('should update weights for weighted strategy', () => {
      const lb = new LoadBalancer('weighted');
      const weights: ProviderWeight[] = [
        { providerId: 'openai', weight: 80 },
        { providerId: 'anthropic', weight: 20 },
      ];

      lb.updateWeights(weights);

      // Verify weights are applied by checking selections
      const providers = ['openai', 'anthropic'];
      const selection = lb.selectProvider(providers);

      expect(selection.metadata?.weight).toBeDefined();
    });

    it('should record selection outcomes for adaptive strategy', () => {
      const lb = new LoadBalancer('adaptive');

      lb.recordSelectionOutcome('openai', true);
      lb.recordSelectionOutcome('anthropic', false);

      // Outcomes should influence future selections
      const selection = lb.selectProvider(['openai', 'anthropic']);
      expect(selection).toBeDefined();
    });
  });
});
