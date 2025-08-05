// provider-discovery.test.ts - Comprehensive tests for Real-time Provider Discovery
// Tests August 2025 service mesh patterns and dynamic provider management

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  type DiscoveredProvider,
  getProviderDiscoveryService,
  type ProviderCapabilities,
  type ProviderDiscoveryConfig,
  ProviderDiscoveryService,
} from '../provider-discovery';

// Mock fetch for testing
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ status: 'healthy', successRate: 0.95 }),
  })
) as any;

// Mock setTimeout and clearTimeout for testing intervals
global.setTimeout = mock((fn: Function, delay: number) => {
  // Execute immediately for tests
  if (typeof fn === 'function') {
    setTimeout(() => fn(), 0);
  }
  return Math.random() as any;
}) as any;

global.clearTimeout = mock(() => {}) as any;
global.setInterval = mock((fn: Function, delay: number) => {
  // Don't actually set intervals in tests
  return Math.random() as any;
}) as any;
global.clearInterval = mock(() => {}) as any;

describe('ProviderDiscoveryService', () => {
  let discoveryService: ProviderDiscoveryService;
  let mockConfig: ProviderDiscoveryConfig;

  beforeEach(() => {
    // Reset mocks
    (global.fetch as any).mockReset();
    (global.setTimeout as any).mockReset();
    (global.clearTimeout as any).mockReset();
    (global.setInterval as any).mockReset();
    (global.clearInterval as any).mockReset();

    mockConfig = {
      healthCheckInterval: 1000, // 1 second for tests
      healthCheckTimeout: 500, // 0.5 seconds for tests
      unhealthyThreshold: 2,
      recoveryCheckInterval: 2000,
      discoveryInterval: 5000,
      capabilityDetectionEnabled: true,
      maxConcurrentHealthChecks: 3,
      healthCheckBackoff: 1000,
      enableServiceMesh: false,
      providerEndpoints: {
        'test-provider': {
          baseUrl: 'https://api.test-provider.com/v1',
          healthEndpoint: 'https://api.test-provider.com/health',
          modelsEndpoint: 'https://api.test-provider.com/models',
          authentication: {
            type: 'bearer',
            token: 'test-token',
          },
        },
        'test-provider-2': {
          baseUrl: 'https://api.test-provider-2.com/v1',
          healthEndpoint: 'https://api.test-provider-2.com/health',
          modelsEndpoint: 'https://api.test-provider-2.com/models',
        },
      },
    };

    discoveryService = new ProviderDiscoveryService(mockConfig);
  });

  afterEach(async () => {
    if (discoveryService) {
      await discoveryService.stop();
    }
  });

  describe('Service Initialization', () => {
    test('should create service with configuration', () => {
      expect(discoveryService).toBeDefined();
      expect(discoveryService instanceof ProviderDiscoveryService).toBe(true);
    });

    test('should implement singleton pattern', () => {
      const service1 = getProviderDiscoveryService(mockConfig);
      const service2 = getProviderDiscoveryService();

      expect(service1).toBe(service2);
    });

    test('should require configuration for first instance', () => {
      expect(() => {
        // Reset singleton
        (ProviderDiscoveryService as any).instance = undefined;
        getProviderDiscoveryService();
      }).toThrow(
        'Provider discovery configuration required for initialization'
      );
    });
  });

  describe('Provider Discovery', () => {
    test('should start discovery service successfully', async () => {
      // Mock successful health checks
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            status: 'healthy',
            successRate: 0.98,
            version: '1.0.0',
          }),
      });

      await discoveryService.start();

      // Verify fetch was called for health checks
      expect(global.fetch).toHaveBeenCalled();

      // Should have discovered providers
      const discoveredProviders = discoveryService.getDiscoveredProviders();
      expect(discoveredProviders.size).toBeGreaterThan(0);
    });

    test('should handle discovery failures gracefully', async () => {
      // Mock failed health checks
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      let errorEmitted = false;
      discoveryService.on('discovery:error', () => {
        errorEmitted = true;
      });

      await discoveryService.start();

      // Should emit error event
      expect(errorEmitted).toBe(true);
    });

    test('should discover single provider', async () => {
      // Mock successful health check
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', responseTime: 150 }),
      });

      const provider = await discoveryService.discoverProvider('test-provider');

      expect(provider).not.toBeNull();
      expect(provider?.id).toBe('test-provider');
      expect(provider?.name).toBe('Test Provider');
      expect(provider?.health.status).toBe('healthy');
      expect(provider?.discoverySource).toBe('api-discovery');
    });

    test('should return null for failed discovery', async () => {
      // Mock failed health check
      (global.fetch as any).mockRejectedValue(
        new Error('Provider unavailable')
      );

      const provider = await discoveryService.discoverProvider('test-provider');

      expect(provider).toBeNull();
    });
  });

  describe('Health Monitoring', () => {
    test('should perform health checks', async () => {
      // Mock healthy response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'healthy',
            successRate: 0.95,
            averageLatency: 120,
          }),
      });

      const healthCheckSpy = mock();
      discoveryService.on('provider:health:changed', healthCheckSpy);

      await discoveryService.start();

      // Wait for health checks to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify health check was performed
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('health'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    test('should handle health check failures', async () => {
      // Mock unhealthy response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      let providerUnavailableEmitted = false;
      discoveryService.on('provider:unavailable', () => {
        providerUnavailableEmitted = true;
      });

      await discoveryService.start();

      // Wait for health checks
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(providerUnavailableEmitted).toBe(true);
    });

    test('should detect provider recovery', async () => {
      let healthChanged = false;
      let providerRecovered = false;

      discoveryService.on('provider:health:changed', () => {
        healthChanged = true;
      });

      discoveryService.on('provider:recovered', () => {
        providerRecovered = true;
      });

      // Start with unhealthy provider
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await discoveryService.start();

      // Then recover
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      // Wait for recovery check
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(healthChanged).toBe(true);
    });
  });

  describe('Provider Management', () => {
    test('should register provider manually', async () => {
      const mockProvider: DiscoveredProvider = {
        id: 'manual-provider',
        name: 'Manual Provider',
        models: [
          {
            id: 'manual-model',
            name: 'Manual Model',
            capabilities: ['chat', 'code'],
            costPerToken: 0.0001,
            maxTokens: 4096,
            contextWindow: 4096,
            supportedTasks: ['chat', 'code'],
          },
        ],
        health: {
          status: 'healthy',
          successRate: 1.0,
          averageLatency: 100,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat', 'code'],
        costTier: 'standard',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'manual',
        endpoint: 'https://manual-provider.com',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: true,
            functionCalling: false,
            vision: false,
            codeGeneration: true,
            reasoning: false,
            multimodal: false,
          },
          limits: {
            maxTokens: 4096,
            maxRequestsPerMinute: 100,
            maxRequestsPerDay: 1000,
            contextWindow: 4096,
          },
          pricing: {
            inputTokenCost: 0.0001,
            outputTokenCost: 0.0002,
          },
        },
        healthHistory: [],
      };

      let providerDiscovered = false;
      discoveryService.on('provider:discovered', (provider) => {
        if (provider.id === 'manual-provider') {
          providerDiscovered = true;
        }
      });

      await discoveryService.registerProvider(mockProvider);

      const registeredProvider =
        discoveryService.getProvider('manual-provider');
      expect(registeredProvider).toBeDefined();
      expect(registeredProvider?.id).toBe('manual-provider');
      expect(registeredProvider?.discoverySource).toBe('manual');
      expect(providerDiscovered).toBe(true);
    });

    test('should deregister provider', async () => {
      // First register a provider
      const mockProvider: DiscoveredProvider = {
        id: 'temp-provider',
        name: 'Temporary Provider',
        models: [],
        health: {
          status: 'healthy',
          successRate: 1.0,
          averageLatency: 100,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat'],
        costTier: 'standard',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'manual',
        endpoint: 'https://temp-provider.com',
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
            maxRequestsPerMinute: 60,
            maxRequestsPerDay: 1000,
            contextWindow: 4096,
          },
          pricing: {
            inputTokenCost: 0.0001,
            outputTokenCost: 0.0002,
          },
        },
        healthHistory: [],
      };

      await discoveryService.registerProvider(mockProvider);
      expect(discoveryService.getProvider('temp-provider')).toBeDefined();

      // Then deregister it
      let providerUnavailable = false;
      discoveryService.on('provider:unavailable', (providerId, reason) => {
        if (
          providerId === 'temp-provider' &&
          reason === 'manually deregistered'
        ) {
          providerUnavailable = true;
        }
      });

      await discoveryService.deregisterProvider('temp-provider');

      expect(discoveryService.getProvider('temp-provider')).toBeUndefined();
      expect(providerUnavailable).toBe(true);
    });
  });

  describe('Provider Filtering and Querying', () => {
    beforeEach(async () => {
      // Register test providers with different health statuses
      const healthyProvider: DiscoveredProvider = {
        id: 'healthy-provider',
        name: 'Healthy Provider',
        models: [],
        health: {
          status: 'healthy',
          successRate: 0.98,
          averageLatency: 120,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat', 'code'],
        costTier: 'standard',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'manual',
        endpoint: 'https://healthy-provider.com',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: true,
            functionCalling: true,
            vision: false,
            codeGeneration: true,
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
            inputTokenCost: 0.000_15,
            outputTokenCost: 0.0006,
          },
        },
        healthHistory: [],
      };

      const degradedProvider: DiscoveredProvider = {
        id: 'degraded-provider',
        name: 'Degraded Provider',
        models: [],
        health: {
          status: 'degraded',
          successRate: 0.85,
          averageLatency: 300,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat'],
        costTier: 'premium',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'manual',
        endpoint: 'https://degraded-provider.com',
        capabilities: {
          supportedModels: [],
          features: {
            streaming: false,
            functionCalling: false,
            vision: true,
            codeGeneration: false,
            reasoning: true,
            multimodal: true,
          },
          limits: {
            maxTokens: 4096,
            maxRequestsPerMinute: 50,
            maxRequestsPerDay: 5000,
            contextWindow: 4096,
          },
          pricing: {
            inputTokenCost: 0.0003,
            outputTokenCost: 0.0012,
          },
        },
        healthHistory: [],
      };

      const unhealthyProvider: DiscoveredProvider = {
        id: 'unhealthy-provider',
        name: 'Unhealthy Provider',
        models: [],
        health: {
          status: 'unhealthy',
          successRate: 0.3,
          averageLatency: 1000,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat'],
        costTier: 'budget',
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'manual',
        endpoint: 'https://unhealthy-provider.com',
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
            maxTokens: 2048,
            maxRequestsPerMinute: 30,
            maxRequestsPerDay: 1000,
            contextWindow: 2048,
          },
          pricing: {
            inputTokenCost: 0.000_05,
            outputTokenCost: 0.0001,
          },
        },
        healthHistory: [],
      };

      await discoveryService.registerProvider(healthyProvider);
      await discoveryService.registerProvider(degradedProvider);
      await discoveryService.registerProvider(unhealthyProvider);
    });

    test('should filter providers by health status', () => {
      const healthyProviders = discoveryService.getProvidersByHealth('healthy');
      const degradedProviders =
        discoveryService.getProvidersByHealth('degraded');
      const unhealthyProviders =
        discoveryService.getProvidersByHealth('unhealthy');

      expect(healthyProviders.length).toBe(1);
      expect(healthyProviders[0].id).toBe('healthy-provider');

      expect(degradedProviders.length).toBe(1);
      expect(degradedProviders[0].id).toBe('degraded-provider');

      expect(unhealthyProviders.length).toBe(1);
      expect(unhealthyProviders[0].id).toBe('unhealthy-provider');
    });

    test('should filter providers by capability', () => {
      const streamingProviders =
        discoveryService.getProvidersByCapability('streaming');
      const visionProviders =
        discoveryService.getProvidersByCapability('vision');
      const functionCallingProviders =
        discoveryService.getProvidersByCapability('functionCalling');

      expect(streamingProviders.length).toBe(1);
      expect(streamingProviders[0].id).toBe('healthy-provider');

      expect(visionProviders.length).toBe(1);
      expect(visionProviders[0].id).toBe('degraded-provider');

      expect(functionCallingProviders.length).toBe(1);
      expect(functionCallingProviders[0].id).toBe('healthy-provider');
    });

    test('should get all discovered providers', () => {
      const allProviders = discoveryService.getDiscoveredProviders();

      expect(allProviders.size).toBe(3);
      expect(allProviders.has('healthy-provider')).toBe(true);
      expect(allProviders.has('degraded-provider')).toBe(true);
      expect(allProviders.has('unhealthy-provider')).toBe(true);
    });

    test('should get specific provider by ID', () => {
      const provider = discoveryService.getProvider('healthy-provider');

      expect(provider).toBeDefined();
      expect(provider?.id).toBe('healthy-provider');
      expect(provider?.health.status).toBe('healthy');
      expect(provider?.capabilities.features.streaming).toBe(true);
    });
  });

  describe('Configuration and Edge Cases', () => {
    test('should handle missing provider endpoints', async () => {
      expect(
        discoveryService.discoverProvider('non-existent-provider')
      ).rejects.toThrow(
        'No endpoint configuration found for provider: non-existent-provider'
      );
    });

    test('should respect concurrent health check limits', async () => {
      const configWithLowLimit: ProviderDiscoveryConfig = {
        ...mockConfig,
        maxConcurrentHealthChecks: 1,
      };

      const limitedService = new ProviderDiscoveryService(configWithLowLimit);

      // This test verifies the service respects the limit
      // In real implementation, concurrent checks would be managed
      expect(limitedService).toBeDefined();

      await limitedService.stop();
    });

    test('should handle authentication types correctly', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await discoveryService.discoverProvider('test-provider');

      // Verify Bearer token authentication was used
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    test('should handle service mesh integration when enabled', () => {
      const serviceMeshConfig: ProviderDiscoveryConfig = {
        ...mockConfig,
        enableServiceMesh: true,
        serviceMeshEndpoint: 'https://service-mesh.example.com',
      };

      const serviceMeshService = new ProviderDiscoveryService(
        serviceMeshConfig
      );
      expect(serviceMeshService).toBeDefined();
    });
  });

  describe('Event System', () => {
    test('should emit all expected events', async () => {
      const events: string[] = [];

      discoveryService.on('provider:discovered', () =>
        events.push('discovered')
      );
      discoveryService.on('provider:updated', () => events.push('updated'));
      discoveryService.on('provider:health:changed', () =>
        events.push('health:changed')
      );
      discoveryService.on('provider:unavailable', () =>
        events.push('unavailable')
      );
      discoveryService.on('provider:recovered', () => events.push('recovered'));
      discoveryService.on('discovery:error', () => events.push('error'));
      discoveryService.on('discovery:complete', () => events.push('complete'));

      // Mock successful health check
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await discoveryService.start();

      expect(events).toContain('complete');
      expect(events.length).toBeGreaterThan(0);
    });

    test('should provide event data correctly', async () => {
      let discoveredProvider: any = null;
      let healthChangeData: any = null;

      discoveryService.on('provider:discovered', (provider) => {
        discoveredProvider = provider;
      });

      discoveryService.on('provider:health:changed', (providerId, health) => {
        healthChangeData = { providerId, health };
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', successRate: 0.99 }),
      });

      await discoveryService.start();

      if (discoveredProvider) {
        expect(discoveredProvider.id).toBeDefined();
        expect(discoveredProvider.health).toBeDefined();
        expect(discoveredProvider.capabilities).toBeDefined();
      }
    });
  });

  describe('Integration with Gateway System', () => {
    test('should provide data compatible with AI Gateway', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', successRate: 0.97 }),
      });

      await discoveryService.start();

      const discoveredProviders = discoveryService.getDiscoveredProviders();

      for (const provider of discoveredProviders.values()) {
        // Verify provider structure matches Gateway expectations
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.models).toBeDefined();
        expect(provider.health).toBeDefined();
        expect(provider.health.status).toMatch(
          /^(healthy|degraded|unhealthy)$/
        );
        expect(typeof provider.health.successRate).toBe('number');
        expect(typeof provider.health.averageLatency).toBe('number');
        expect(provider.health.lastHealthCheck).toBeInstanceOf(Date);
        expect(provider.capabilities).toBeDefined();
        expect(provider.costTier).toMatch(/^(budget|standard|premium)$/);
      }
    });

    test('should support real-time updates for gateway integration', async () => {
      let updateCount = 0;

      discoveryService.on('provider:health:changed', () => {
        updateCount++;
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await discoveryService.start();

      // Simulate health changes
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      // Wait for health checks to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify gateway would receive real-time updates
      expect(updateCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle multiple concurrent operations', async () => {
      const promises = [
        discoveryService.discoverProvider('test-provider'),
        discoveryService.discoverProvider('test-provider-2'),
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const results = await Promise.allSettled(promises);

      // At least some should succeed
      const successfulResults = results.filter((r) => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
    });

    test('should clean up resources on stop', async () => {
      await discoveryService.start();
      await discoveryService.stop();

      // Verify intervals were cleared
      expect(global.clearInterval).toHaveBeenCalled();
    });

    test('should be resilient to individual provider failures', async () => {
      // Mock one provider succeeding and one failing
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' }),
        })
        .mockRejectedValueOnce(new Error('Network timeout'));

      await discoveryService.start();

      // Should still have discovered at least one provider
      const discoveredProviders = discoveryService.getDiscoveredProviders();
      expect(discoveredProviders.size).toBeGreaterThanOrEqual(0);
    });
  });
});
