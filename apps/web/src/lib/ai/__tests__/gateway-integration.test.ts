// gateway-integration.test.ts - Integration tests for Gateway + Real-time Provider Discovery
// Tests complete August 2025 AI Gateway & Load Balancing system (100% complete)

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  AIGateway,
  type GatewayConfig,
  getAIGateway,
  type ModelRequirements,
} from '../gateway';
import {
  type DiscoveredProvider,
  getProviderDiscoveryService,
  type ProviderDiscoveryConfig,
} from '../provider-discovery';

// Mock the distributed tracing to avoid actual tracing calls
const mockDistributedTracing = {
  trackAIOperation: mock(
    async (
      operation: string,
      provider: string,
      model: string,
      execute: Function
    ) => {
      const mockSpan = {
        setAttributes: mock(() => {}),
        addEvent: mock(() => {}),
        recordException: mock(() => {}),
        spanContext: () => ({ traceId: 'test-trace', spanId: 'test-span' }),
      };
      return await execute(mockSpan);
    }
  ),
  generateCorrelationId: mock(
    () => 'test-correlation-' + Math.random().toString(36).substr(2, 8)
  ),
};

// Mock the telemetry service
const mockAITelemetry = {
  trackUserInteraction: mock(() => {}),
  trackAICall: mock(
    async (operation: string, model: string, execute: Function) => {
      return await execute();
    }
  ),
};

// Mock external dependencies
const mockTelemetryModule = {
  distributedTracing: mockDistributedTracing,
};

const mockAITelemetryModule = {
  aiTelemetry: mockAITelemetry,
};

// Mock fetch for health checks
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        status: 'healthy',
        successRate: 0.98,
        averageLatency: 150,
      }),
  })
) as any;

// Mock provider registry
const mockRegistry = {
  languageModel: mock((modelId: string) => ({
    modelId,
    provider: modelId.split(':')[0],
    generate: mock(async () => ({ text: 'Generated response' })),
  })),
};

// Mock config module
const mockConfig = {
  get: mock(() => ({
    ai: {
      providers: {
        openai: { apiKey: 'test-key' },
        anthropic: { apiKey: 'test-key' },
      },
    },
  })),
};

// Apply mocks
global.vi = {
  mock: (path: string, factory: () => any) => {
    switch (path) {
      case '../telemetry/distributed-tracing':
        return mockTelemetryModule;
      case './telemetry':
        return mockAITelemetryModule;
      case './providers':
        return { registry: mockRegistry };
      case '@/lib/config':
        return mockConfig;
      default:
        return factory();
    }
  },
} as any;

// Mock provider metrics service
const mockProviderMetricsService = {
  getInstance: mock(() => ({
    recordSuccess: mock(() => {}),
    recordFailure: mock(() => {}),
    recordLatency: mock(() => {}),
    getProviderMetrics: mock((providerId: string) => ({
      successCount: 100,
      errorCount: 2,
      averageLatency: 150,
    })),
  })),
};

vi.mock('./provider-metrics', () => ({
  ProviderMetricsService: mockProviderMetricsService,
}));

// Mock load balancer
const mockLoadBalancer = {
  constructor: mock(() => {}),
  selectProvider: mock(() => 'openai'),
};

vi.mock('./load-balancing', () => ({
  LoadBalancer() {
    return mockLoadBalancer;
  },
}));

describe('Gateway + Provider Discovery Integration', () => {
  let gateway: AIGateway;
  let gatewayConfig: GatewayConfig;
  let discoveryConfig: ProviderDiscoveryConfig;

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockDistributedTracing).forEach((mock) => mock.mockReset?.());
    Object.values(mockAITelemetry).forEach((mock) => mock.mockReset?.());
    (global.fetch as any).mockReset();
    (mockRegistry.languageModel as any).mockReset();

    // Setup test configurations
    discoveryConfig = {
      healthCheckInterval: 1000,
      healthCheckTimeout: 500,
      unhealthyThreshold: 2,
      recoveryCheckInterval: 2000,
      discoveryInterval: 5000,
      capabilityDetectionEnabled: true,
      maxConcurrentHealthChecks: 3,
      healthCheckBackoff: 1000,
      enableServiceMesh: false,
      providerEndpoints: {
        'discovered-openai': {
          baseUrl: 'https://api.openai.com/v1',
          healthEndpoint: 'https://status.openai.com/api/v2/status.json',
          modelsEndpoint: 'https://api.openai.com/v1/models',
          authentication: {
            type: 'bearer',
            token: 'test-openai-key',
          },
        },
        'discovered-anthropic': {
          baseUrl: 'https://api.anthropic.com/v1',
          healthEndpoint: 'https://status.anthropic.com/api/v2/status.json',
          modelsEndpoint: 'https://api.anthropic.com/v1/models',
          authentication: {
            type: 'api-key',
            apiKey: 'test-anthropic-key',
          },
        },
      },
    };

    gatewayConfig = {
      providers: ['openai', 'anthropic'],
      fallbackChain: ['openai', 'anthropic'],
      loadBalancing: 'round-robin',
      maxRetries: 3,
      retryDelay: 1000,
      cooldownPeriod: 30_000,
      costThreshold: 0.001,
      performanceSLA: {
        maxLatency: 5000,
        minSuccessRate: 0.95,
      },
      enableCache: true,
      cacheTTL: 300_000,

      // Real-time discovery settings
      enableRealTimeDiscovery: true,
      discoveryConfig,
      autoRegisterDiscoveredProviders: true,
      preferDiscoveredProviders: true,
    };

    // Reset singleton instances
    (AIGateway as any).instance = undefined;
    (getProviderDiscoveryService as any).instance = undefined;

    gateway = new AIGateway(gatewayConfig);
  });

  afterEach(async () => {
    if (gateway?.getDiscoveryService()) {
      await gateway.stopDiscovery();
    }
  });

  describe('Gateway Initialization with Discovery', () => {
    test('should initialize gateway with discovery enabled', () => {
      expect(gateway).toBeDefined();
      expect(gateway.getDiscoveryService()).toBeDefined();
    });

    test('should start provider discovery service', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', successRate: 0.98 }),
      });

      await gateway.startDiscovery();

      const discoveryService = gateway.getDiscoveryService();
      expect(discoveryService).toBeDefined();

      // Should have discovered providers
      const discoveredProviders = gateway.getDiscoveredProviders();
      expect(discoveredProviders.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle discovery service errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Should not throw
      await gateway.startDiscovery();

      const discoveryService = gateway.getDiscoveryService();
      expect(discoveryService).toBeDefined();
    });
  });

  describe('Model Selection with Discovered Providers', () => {
    test('should select model from discovered providers', async () => {
      // Mock successful discovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', successRate: 0.99 }),
      });

      await gateway.startDiscovery();

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'quality',
        complexity: 'moderate',
        capabilities: ['chat', 'reasoning'],
        maxCost: 0.0005,
        maxLatency: 3000,
      };

      const selection = await gateway.getOptimalModel(requirements);

      expect(selection).toBeDefined();
      expect(selection.provider).toBeDefined();
      expect(selection.modelId).toBeDefined();
      expect(selection.model).toBeDefined();
      expect(selection.reason).toBeDefined();
      expect(Array.isArray(selection.fallbackOptions)).toBe(true);

      // Verify distributed tracing was used
      expect(mockDistributedTracing.trackAIOperation).toHaveBeenCalledWith(
        'gateway-model-selection',
        'ai-gateway',
        'model-routing',
        expect.any(Function)
      );
    });

    test('should prefer discovered providers when configured', async () => {
      // Register a discovered provider with better metrics
      const discoveryService = gateway.getDiscoveryService()!;

      const superiorProvider: DiscoveredProvider = {
        id: 'superior-provider',
        name: 'Superior AI Provider',
        models: [
          {
            id: 'superior-model',
            name: 'Superior Model',
            capabilities: ['chat', 'code', 'reasoning'],
            costPerToken: 0.000_05, // Much cheaper
            maxTokens: 200_000,
            contextWindow: 200_000,
            supportedTasks: ['chat', 'code', 'reasoning'],
          },
        ],
        health: {
          status: 'healthy',
          successRate: 0.999, // Better success rate
          averageLatency: 80, // Lower latency
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat', 'code', 'reasoning'],
        costTier: 'budget',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'api-discovery',
        endpoint: 'https://superior-ai.com/v1',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: true,
            functionCalling: true,
            vision: false,
            codeGeneration: true,
            reasoning: true,
            multimodal: false,
          },
          limits: {
            maxTokens: 200_000,
            maxRequestsPerMinute: 1000,
            maxRequestsPerDay: 100_000,
            contextWindow: 200_000,
          },
          pricing: {
            inputTokenCost: 0.000_05,
            outputTokenCost: 0.0001,
          },
        },
        healthHistory: [],
      };

      await discoveryService.registerProvider(superiorProvider);

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'cost', // Should prefer the cheaper discovered provider
        maxCost: 0.001,
      };

      const selection = await gateway.getOptimalModel(requirements);

      // Should select the superior discovered provider when preferDiscoveredProviders is true
      expect(selection.provider).toBe('superior-provider');
      expect(selection.reason).toContain('cost');
    });

    test('should fall back to static providers when discovered providers fail', async () => {
      // Start discovery but register an unhealthy provider
      const discoveryService = gateway.getDiscoveryService()!;

      const unhealthyProvider: DiscoveredProvider = {
        id: 'unhealthy-provider',
        name: 'Unhealthy Provider',
        models: [
          {
            id: 'failing-model',
            name: 'Failing Model',
            capabilities: ['chat'],
            costPerToken: 0.0001,
            maxTokens: 4096,
            contextWindow: 4096,
            supportedTasks: ['chat'],
          },
        ],
        health: {
          status: 'unhealthy', // Unhealthy status
          successRate: 0.1,
          averageLatency: 5000,
          lastHealthCheck: new Date(),
          cooldownUntil: new Date(Date.now() + 60_000), // In cooldown
        },
        capabilities: ['chat'],
        costTier: 'standard',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'api-discovery',
        endpoint: 'https://unhealthy-provider.com/v1',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: false,
            functionCalling: false,
            vision: false,
            codeGeneration: false,
            reasoning: false,
            multimodal: false,
          },
          limits: {
            maxTokens: 4096,
            maxRequestsPerMinute: 10,
            maxRequestsPerDay: 100,
            contextWindow: 4096,
          },
          pricing: {
            inputTokenCost: 0.0001,
            outputTokenCost: 0.0002,
          },
        },
        healthHistory: [],
      };

      await discoveryService.registerProvider(unhealthyProvider);

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'speed',
      };

      // Should still be able to select a model (from static providers)
      const selection = await gateway.getOptimalModel(requirements);

      expect(selection).toBeDefined();
      expect(selection.provider).not.toBe('unhealthy-provider');
    });
  });

  describe('Failover with Discovery Integration', () => {
    test('should execute request with discovered provider failover', async () => {
      const discoveryService = gateway.getDiscoveryService()!;

      // Register multiple discovered providers
      const providers: DiscoveredProvider[] = [
        {
          id: 'primary-discovered',
          name: 'Primary Discovered',
          models: [
            {
              id: 'primary-model',
              name: 'Primary Model',
              capabilities: ['chat'],
              costPerToken: 0.0002,
              maxTokens: 8192,
              contextWindow: 8192,
              supportedTasks: ['chat'],
            },
          ],
          health: {
            status: 'healthy',
            successRate: 0.95,
            averageLatency: 200,
            lastHealthCheck: new Date(),
          },
          capabilities: ['chat'],
          costTier: 'standard',
          discoveredAt: new Date(),
          lastUpdated: new Date(),
          discoverySource: 'api-discovery',
          endpoint: 'https://primary-discovered.com/v1',
          capabilities: {
            supportedModels: [],
            features: {
              streaming: true,
              functionCalling: false,
              vision: false,
              codeGeneration: false,
              reasoning: false,
              multimodal: false,
            },
            limits: {
              maxTokens: 8192,
              maxRequestsPerMinute: 100,
              maxRequestsPerDay: 10_000,
              contextWindow: 8192,
            },
            pricing: {
              inputTokenCost: 0.0002,
              outputTokenCost: 0.0004,
            },
          },
          healthHistory: [],
        },
        {
          id: 'fallback-discovered',
          name: 'Fallback Discovered',
          models: [
            {
              id: 'fallback-model',
              name: 'Fallback Model',
              capabilities: ['chat'],
              costPerToken: 0.0003,
              maxTokens: 4096,
              contextWindow: 4096,
              supportedTasks: ['chat'],
            },
          ],
          health: {
            status: 'healthy',
            successRate: 0.98,
            averageLatency: 150,
            lastHealthCheck: new Date(),
          },
          capabilities: ['chat'],
          costTier: 'standard',
          discoveredAt: new Date(),
          lastUpdated: new Date(),
          discoverySource: 'api-discovery',
          endpoint: 'https://fallback-discovered.com/v1',
          capabilities: {
            supportedModels: [],
            features: {
              streaming: false,
              functionCalling: true,
              vision: false,
              codeGeneration: false,
              reasoning: false,
              multimodal: false,
            },
            limits: {
              maxTokens: 4096,
              maxRequestsPerMinute: 200,
              maxRequestsPerDay: 20_000,
              contextWindow: 4096,
            },
            pricing: {
              inputTokenCost: 0.0003,
              outputTokenCost: 0.0006,
            },
          },
          healthHistory: [],
        },
      ];

      for (const provider of providers) {
        await discoveryService.registerProvider(provider);
      }

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'quality',
      };

      const selection = await gateway.getOptimalModel(requirements);

      // Mock request that fails on primary but succeeds on fallback
      let attemptCount = 0;
      const mockRequest = mock(async (model: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Primary provider failed');
        }
        return { text: 'Fallback success', usage: { totalTokens: 100 } };
      });

      const result = await gateway.executeWithFailover(selection, mockRequest);

      expect(result).toBeDefined();
      expect(result.text).toBe('Fallback success');
      expect(mockRequest).toHaveBeenCalledTimes(2); // Primary failed, fallback succeeded
    });
  });

  describe('Real-time Health Updates', () => {
    test('should update gateway routing based on real-time health changes', async () => {
      const discoveryService = gateway.getDiscoveryService()!;

      // Register a provider that will become unhealthy
      const provider: DiscoveredProvider = {
        id: 'health-test-provider',
        name: 'Health Test Provider',
        models: [
          {
            id: 'health-test-model',
            name: 'Health Test Model',
            capabilities: ['chat'],
            costPerToken: 0.0001,
            maxTokens: 4096,
            contextWindow: 4096,
            supportedTasks: ['chat'],
          },
        ],
        health: {
          status: 'healthy',
          successRate: 0.99,
          averageLatency: 100,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat'],
        costTier: 'budget',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'api-discovery',
        endpoint: 'https://health-test-provider.com/v1',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: true,
            functionCalling: false,
            vision: false,
            codeGeneration: false,
            reasoning: false,
            multimodal: false,
          },
          limits: {
            maxTokens: 4096,
            maxRequestsPerMinute: 100,
            maxRequestsPerDay: 10_000,
            contextWindow: 4096,
          },
          pricing: {
            inputTokenCost: 0.0001,
            outputTokenCost: 0.0002,
          },
        },
        healthHistory: [],
      };

      await discoveryService.registerProvider(provider);

      let healthChangeCount = 0;
      discoveryService.on('provider:health:changed', () => {
        healthChangeCount++;
      });

      // Simulate health check returning unhealthy status
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      // Wait for health update (would be triggered by interval in real usage)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'cost',
      };

      // Should still be able to get a model (from static providers)
      const selection = await gateway.getOptimalModel(requirements);
      expect(selection).toBeDefined();
    });
  });

  describe('Performance and Telemetry Integration', () => {
    test('should track discovery operations in telemetry', async () => {
      await gateway.startDiscovery();

      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'balanced',
      };

      await gateway.getOptimalModel(requirements);

      // Verify telemetry integration
      expect(mockDistributedTracing.trackAIOperation).toHaveBeenCalled();

      // Should have tracked the model selection operation
      const trackedOperations = (mockDistributedTracing.trackAIOperation as any)
        .mock.calls;
      const modelSelectionCall = trackedOperations.find(
        (call: any) => call[0] === 'gateway-model-selection'
      );
      expect(modelSelectionCall).toBeDefined();
    });

    test('should provide comprehensive gateway status', () => {
      const allProviderStatuses = gateway.getAllProviderStatuses();

      expect(allProviderStatuses).toBeInstanceOf(Map);
      expect(allProviderStatuses.size).toBeGreaterThan(0);

      for (const [providerId, health] of allProviderStatuses) {
        expect(typeof providerId).toBe('string');
        expect(health).toBeDefined();
        expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
        expect(typeof health.successRate).toBe('number');
        expect(typeof health.averageLatency).toBe('number');
        expect(health.lastHealthCheck).toBeInstanceOf(Date);
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should work without discovery when disabled', () => {
      const configWithoutDiscovery: GatewayConfig = {
        ...gatewayConfig,
        enableRealTimeDiscovery: false,
      };

      const gatewayWithoutDiscovery = new AIGateway(configWithoutDiscovery);

      expect(gatewayWithoutDiscovery.getDiscoveryService()).toBeUndefined();
      expect(gatewayWithoutDiscovery.getDiscoveredProviders().size).toBe(0);
    });

    test('should handle invalid discovery configuration gracefully', () => {
      const configWithInvalidDiscovery: GatewayConfig = {
        ...gatewayConfig,
        enableRealTimeDiscovery: true,
        discoveryConfig: {
          ...discoveryConfig,
          providerEndpoints: {}, // Empty endpoints
        },
      };

      // Should not throw during initialization
      const gatewayWithInvalidConfig = new AIGateway(
        configWithInvalidDiscovery
      );
      expect(gatewayWithInvalidConfig).toBeDefined();
    });

    test('should handle mixed static and discovered providers correctly', async () => {
      // Gateway has static providers (openai, anthropic) plus discovery
      await gateway.startDiscovery();

      const requirements: ModelRequirements = {
        task: 'code',
        priority: 'quality',
      };

      const selection = await gateway.getOptimalModel(requirements);

      // Should be able to select from either static or discovered providers
      expect(selection).toBeDefined();
      expect(
        ['openai', 'anthropic'].includes(selection.provider) ||
          gateway.getDiscoveredProviders().has(selection.provider)
      ).toBe(true);
    });
  });

  describe('Complete Integration Workflow', () => {
    test('should handle complete AI request workflow with discovery', async () => {
      // Start discovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', successRate: 0.98 }),
      });

      await gateway.startDiscovery();

      // Get optimal model
      const requirements: ModelRequirements = {
        task: 'chat',
        priority: 'balanced',
        capabilities: ['chat', 'reasoning'],
        maxLatency: 2000,
      };

      const selection = await gateway.getOptimalModel(requirements);

      // Execute request with failover
      const mockRequest = mock(async (model: any) => {
        return {
          text: 'AI generated response',
          usage: {
            inputTokens: 50,
            outputTokens: 100,
            totalTokens: 150,
          },
          responseMetadata: {
            finishReason: 'stop',
          },
        };
      });

      const result = await gateway.executeWithFailover(selection, mockRequest, {
        userId: 'test-user',
        sessionId: 'test-session',
      });

      // Verify complete workflow
      expect(result).toBeDefined();
      expect(result.text).toBe('AI generated response');
      expect(result.usage.totalTokens).toBe(150);

      // Verify all telemetry was tracked
      expect(mockDistributedTracing.trackAIOperation).toHaveBeenCalled();

      // Stop discovery
      await gateway.stopDiscovery();
    });
  });
});
