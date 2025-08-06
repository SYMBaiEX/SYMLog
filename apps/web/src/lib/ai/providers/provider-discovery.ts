// provider-discovery.ts - Real-time Provider Discovery System
// Implements August 2025 service mesh best practices for AI provider discovery
// Features: Dynamic registration, health monitoring, capability detection, distributed tracing

import { EventEmitter } from 'events';
import { distributedTracing } from '../../telemetry/distributed-tracing';
import type { ModelInfo, ProviderHealth, ProviderInfo } from '../core/gateway';
import { aiTelemetry } from '../intelligence/telemetry';

// Type-safe EventEmitter wrapper
type TypedEventEmitter<T extends Record<string, any>> = {
  on<K extends keyof T>(event: K, listener: T[K]): any;
  off<K extends keyof T>(event: K, listener: T[K]): any;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
  once<K extends keyof T>(event: K, listener: T[K]): any;
  removeAllListeners<K extends keyof T>(event?: K): any;
} & EventEmitter;

// Provider discovery configuration
export interface ProviderDiscoveryConfig {
  // Health check settings
  healthCheckInterval: number; // Default: 30000ms (30 seconds)
  healthCheckTimeout: number; // Default: 5000ms (5 seconds)
  unhealthyThreshold: number; // Consecutive failures before marking unhealthy
  recoveryCheckInterval: number; // How often to check unhealthy providers

  // Discovery settings
  discoveryInterval: number; // How often to discover new providers
  capabilityDetectionEnabled: boolean; // Auto-detect provider capabilities

  // Rate limiting compliance
  maxConcurrentHealthChecks: number; // Respect provider rate limits
  healthCheckBackoff: number; // Exponential backoff for failed checks

  // Service mesh integration
  enableServiceMesh: boolean; // Use service mesh for discovery
  serviceMeshEndpoint?: string; // Service mesh registry endpoint

  // Provider endpoints for discovery
  providerEndpoints: {
    [providerId: string]: {
      baseUrl: string;
      healthEndpoint: string;
      modelsEndpoint: string;
      statusEndpoint?: string;
      authentication?: {
        type: 'bearer' | 'api-key' | 'oauth';
        token?: string;
        apiKey?: string;
        oauthConfig?: {
          clientId: string;
          clientSecret: string;
          tokenUrl: string;
        };
      };
    };
  };
}

// Provider discovery event types
export interface ProviderDiscoveryEvents {
  'provider:discovered': (provider: DiscoveredProvider) => void;
  'provider:updated': (provider: DiscoveredProvider) => void;
  'provider:health:changed': (
    providerId: string,
    health: ProviderHealth
  ) => void;
  'provider:unavailable': (providerId: string, reason: string) => void;
  'provider:recovered': (providerId: string, health: ProviderHealth) => void;
  'discovery:error': (error: Error, providerId?: string) => void;
  'discovery:complete': (discoveredCount: number) => void;
}

// Real-time provider capability detection
export interface ProviderCapabilities {
  supportedModels: ModelInfo[];
  features: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    codeGeneration: boolean;
    reasoning: boolean;
    multimodal: boolean;
  };
  limits: {
    maxTokens: number;
    maxRequestsPerMinute: number;
    maxRequestsPerDay: number;
    contextWindow: number;
  };
  pricing: {
    inputTokenCost: number;
    outputTokenCost: number;
    requestBaseCost?: number;
  };
}

// Provider status with discovery metadata
export interface DiscoveredProvider extends Omit<ProviderInfo, 'capabilities'> {
  discoveredAt: Date;
  lastUpdated: Date;
  discoverySource: 'static' | 'service-mesh' | 'api-discovery' | 'manual';
  endpoint: string;
  authentication?: any;
  capabilities: ProviderCapabilities;
  healthHistory: ProviderHealthHistory[];
}

export interface ProviderHealthHistory {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  error?: string;
  details?: any;
}

/**
 * Real-time Provider Discovery Service
 * Implements August 2025 best practices for dynamic AI provider discovery
 */
export class ProviderDiscoveryService extends EventEmitter {
  private static instance: ProviderDiscoveryService;
  private discoveredProviders: Map<string, DiscoveredProvider> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private discoveryInterval?: NodeJS.Timeout;
  private isStarted = false;
  private concurrentHealthChecks = 0;

  constructor(private config: ProviderDiscoveryConfig) {
    super();
    this.setupEventHandlers();
  }

  // Type-safe emit wrapper
  override emit<K extends keyof ProviderDiscoveryEvents>(
    event: K,
    ...args: Parameters<ProviderDiscoveryEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  static getInstance(
    config?: ProviderDiscoveryConfig
  ): ProviderDiscoveryService {
    if (!ProviderDiscoveryService.instance) {
      if (!config) {
        throw new Error(
          'Provider discovery configuration required for initialization'
        );
      }
      ProviderDiscoveryService.instance = new ProviderDiscoveryService(config);
    }
    return ProviderDiscoveryService.instance;
  }

  /**
   * Start the provider discovery service
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    await distributedTracing.trackAIOperation(
      'provider-discovery-start',
      'discovery-service',
      'provider-discovery-v1',
      async (span) => {
        span.setAttributes({
          'discovery.providers_configured': Object.keys(
            this.config.providerEndpoints
          ).length,
          'discovery.health_check_interval': this.config.healthCheckInterval,
          'discovery.service_mesh_enabled': this.config.enableServiceMesh,
        });

        try {
          // Initial provider discovery
          await this.performInitialDiscovery();

          // Start continuous discovery
          this.startContinuousDiscovery();

          // Start health monitoring
          this.startHealthMonitoring();

          this.isStarted = true;

          span.addEvent('discovery.service.started', {
            discovered_providers: this.discoveredProviders.size,
          });

          console.log(
            `🔍 Provider Discovery Service started - ${this.discoveredProviders.size} providers discovered`
          );
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        }
      }
    );
  }

  /**
   * Stop the provider discovery service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    // Clear all intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    this.isStarted = false;
    console.log('🛑 Provider Discovery Service stopped');
  }

  /**
   * Get all discovered providers
   */
  getDiscoveredProviders(): Map<string, DiscoveredProvider> {
    return new Map(this.discoveredProviders);
  }

  /**
   * Get a specific discovered provider
   */
  getProvider(providerId: string): DiscoveredProvider | undefined {
    return this.discoveredProviders.get(providerId);
  }

  /**
   * Get providers by health status
   */
  getProvidersByHealth(
    status: 'healthy' | 'degraded' | 'unhealthy'
  ): DiscoveredProvider[] {
    return Array.from(this.discoveredProviders.values()).filter(
      (provider) => provider.health.status === status
    );
  }

  /**
   * Get providers with specific capabilities
   */
  getProvidersByCapability(
    capability: keyof ProviderCapabilities['features']
  ): DiscoveredProvider[] {
    return Array.from(this.discoveredProviders.values()).filter(
      (provider) => provider.capabilities.features[capability]
    );
  }

  /**
   * Force discovery of a specific provider
   */
  async discoverProvider(
    providerId: string
  ): Promise<DiscoveredProvider | null> {
    const endpoint = this.config.providerEndpoints[providerId];
    if (!endpoint) {
      throw new Error(
        `No endpoint configuration found for provider: ${providerId}`
      );
    }

    return distributedTracing.trackAIOperation(
      'provider-discovery-single',
      'discovery-service',
      providerId,
      async (span) => {
        span.setAttributes({
          'discovery.provider_id': providerId,
          'discovery.endpoint': endpoint.baseUrl,
        });

        try {
          const provider = await this.discoverSingleProvider(
            providerId,
            endpoint
          );

          if (provider) {
            this.discoveredProviders.set(providerId, provider);
            this.emit('provider:discovered', provider);

            span.addEvent('provider.discovered', {
              provider_id: providerId,
              models_count: provider.models.length,
              capabilities: Object.keys(provider.capabilities.features).length,
            });
          }

          return provider;
        } catch (error) {
          span.recordException(error as Error);
          this.emit('discovery:error', error as Error, providerId);
          return null;
        }
      }
    );
  }

  /**
   * Register a provider manually
   */
  async registerProvider(provider: DiscoveredProvider): Promise<void> {
    await distributedTracing.trackAIOperation(
      'provider-registration',
      'discovery-service',
      provider.id,
      async (span) => {
        span.setAttributes({
          'registration.provider_id': provider.id,
          'registration.source': provider.discoverySource,
        });

        this.discoveredProviders.set(provider.id, {
          ...provider,
          discoveredAt: new Date(),
          lastUpdated: new Date(),
          discoverySource: 'manual',
        });

        // Start health monitoring for the new provider
        this.startProviderHealthMonitoring(provider.id);

        span.addEvent('provider.registered');
        this.emit('provider:discovered', provider);
      }
    );
  }

  /**
   * Deregister a provider
   */
  async deregisterProvider(providerId: string): Promise<void> {
    const provider = this.discoveredProviders.get(providerId);
    if (!provider) {
      return;
    }

    // Stop health monitoring
    const interval = this.healthCheckIntervals.get(providerId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(providerId);
    }

    // Remove from discovered providers
    this.discoveredProviders.delete(providerId);

    this.emit('provider:unavailable', providerId, 'manually deregistered');

    console.log(`🗑️ Provider ${providerId} deregistered`);
  }

  // Private implementation methods

  /**
   * Setup event handlers for telemetry integration
   */
  private setupEventHandlers(): void {
    this.on(
      'provider:health:changed',
      (providerId: string, health: ProviderHealth) => {
        aiTelemetry.trackUserInteraction(
          'system',
          'provider-discovery',
          'health-changed',
          {
            providerId,
            status: health.status,
            successRate: health.successRate,
            averageLatency: health.averageLatency,
          }
        );
      }
    );

    this.on('discovery:error', (error: Error, providerId?: string) => {
      aiTelemetry.trackUserInteraction(
        'system',
        'provider-discovery',
        'discovery-error',
        {
          providerId,
          error: error.message,
          stack: error.stack,
        }
      );
    });
  }

  /**
   * Perform initial discovery of all configured providers
   */
  private async performInitialDiscovery(): Promise<void> {
    const discoveries = Object.entries(this.config.providerEndpoints).map(
      ([providerId, endpoint]) =>
        this.discoverSingleProvider(providerId, endpoint)
    );

    const results = await Promise.allSettled(discoveries);
    let discoveredCount = 0;

    results.forEach((result, index) => {
      const providerId = Object.keys(this.config.providerEndpoints)[index];

      if (result.status === 'fulfilled' && result.value) {
        this.discoveredProviders.set(providerId, result.value);
        this.emit('provider:discovered', result.value);
        discoveredCount++;
      } else if (result.status === 'rejected') {
        // Create proper Error object from rejection reason
        const error =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));
        this.emit('discovery:error', error, providerId);
      }
    });

    this.emit('discovery:complete', discoveredCount);
  }

  /**
   * Discover a single provider
   */
  private async discoverSingleProvider(
    providerId: string,
    endpoint: any
  ): Promise<DiscoveredProvider | null> {
    try {
      // Perform health check
      const healthCheck = await this.performProviderHealthCheck(
        providerId,
        endpoint
      );

      if (!healthCheck.isHealthy) {
        console.warn(
          `⚠️ Provider ${providerId} failed initial health check:`,
          healthCheck.error
        );
        return null;
      }

      // Detect capabilities if enabled
      let capabilities: ProviderCapabilities = {
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
      };

      if (this.config.capabilityDetectionEnabled) {
        capabilities = await this.detectProviderCapabilities(
          providerId,
          endpoint
        );
      }

      // Create discovered provider
      const discoveredProvider: DiscoveredProvider = {
        id: providerId,
        name: this.getProviderDisplayName(providerId),
        models: capabilities.supportedModels,
        health: {
          status: 'healthy',
          successRate: 1.0,
          averageLatency: healthCheck.responseTime,
          lastHealthCheck: new Date(),
        },
        costTier: this.determineProviderCostTier(capabilities),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        discoverySource: 'api-discovery',
        endpoint: endpoint.baseUrl,
        authentication: endpoint.authentication,
        capabilities,
        healthHistory: [
          {
            timestamp: new Date(),
            status: 'healthy',
            responseTime: healthCheck.responseTime,
          },
        ],
      };

      return discoveredProvider;
    } catch (error) {
      console.error(`❌ Failed to discover provider ${providerId}:`, error);
      return null;
    }
  }

  /**
   * Start continuous discovery process
   */
  private startContinuousDiscovery(): void {
    this.discoveryInterval = setInterval(async () => {
      await distributedTracing.trackAIOperation(
        'provider-discovery-continuous',
        'discovery-service',
        'scheduled-discovery',
        async (span) => {
          span.addEvent('discovery.cycle.started');

          // Re-discover all providers to check for updates
          for (const providerId of Object.keys(this.config.providerEndpoints)) {
            try {
              const updated = await this.discoverProvider(providerId);
              if (updated) {
                span.addEvent('provider.updated', { provider_id: providerId });
              }
            } catch (error) {
              // Individual provider failures shouldn't stop the discovery cycle
              console.warn(`Discovery update failed for ${providerId}:`, error);
            }
          }

          span.addEvent('discovery.cycle.completed', {
            active_providers: this.discoveredProviders.size,
          });
        }
      );
    }, this.config.discoveryInterval);
  }

  /**
   * Start health monitoring for all providers
   */
  private startHealthMonitoring(): void {
    for (const providerId of this.discoveredProviders.keys()) {
      this.startProviderHealthMonitoring(providerId);
    }
  }

  /**
   * Start health monitoring for a specific provider
   */
  private startProviderHealthMonitoring(providerId: string): void {
    // Clear existing interval if any
    const existingInterval = this.healthCheckIntervals.get(providerId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(async () => {
      await this.performProviderHealthCheckAndUpdate(providerId);
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(providerId, interval);
  }

  /**
   * Perform health check and update provider status
   */
  private async performProviderHealthCheckAndUpdate(
    providerId: string
  ): Promise<void> {
    const provider = this.discoveredProviders.get(providerId);
    if (!provider) {
      return;
    }

    // Rate limiting - don't exceed concurrent health checks
    if (this.concurrentHealthChecks >= this.config.maxConcurrentHealthChecks) {
      return;
    }

    this.concurrentHealthChecks++;

    try {
      const endpoint = this.config.providerEndpoints[providerId];
      if (!endpoint) {
        return;
      }

      const healthResult = await this.performProviderHealthCheck(
        providerId,
        endpoint
      );
      const previousHealth = provider.health.status;

      // Update provider health
      provider.health = {
        status: healthResult.isHealthy ? 'healthy' : 'unhealthy',
        successRate: healthResult.successRate ?? 0,
        averageLatency: healthResult.responseTime,
        lastHealthCheck: new Date(),
        cooldownUntil: healthResult.isHealthy
          ? undefined
          : new Date(Date.now() + this.config.healthCheckBackoff),
      };

      // Add to health history
      provider.healthHistory.push({
        timestamp: new Date(),
        status: provider.health.status,
        responseTime: healthResult.responseTime,
        error: healthResult.error,
        details: healthResult.details,
      });

      // Keep only last 100 health checks
      if (provider.healthHistory.length > 100) {
        provider.healthHistory = provider.healthHistory.slice(-100);
      }

      provider.lastUpdated = new Date();

      // Emit events if health status changed
      if (previousHealth !== provider.health.status) {
        this.emit('provider:health:changed', providerId, provider.health);

        if (
          provider.health.status === 'healthy' &&
          previousHealth === 'unhealthy'
        ) {
          this.emit('provider:recovered', providerId, provider.health);
        } else if (provider.health.status === 'unhealthy') {
          this.emit(
            'provider:unavailable',
            providerId,
            healthResult.error || 'Health check failed'
          );
        }
      }
    } catch (error) {
      this.emit('discovery:error', error as Error, providerId);
    } finally {
      this.concurrentHealthChecks--;
    }
  }

  /**
   * Perform a health check on a provider
   */
  private async performProviderHealthCheck(
    providerId: string,
    endpoint: any
  ): Promise<{
    isHealthy: boolean;
    responseTime: number;
    successRate?: number;
    error?: string;
    details?: any;
  }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.healthCheckTimeout
      );

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SYMLog-Discovery/1.0',
      };

      // Add authentication headers
      if (endpoint.authentication) {
        switch (endpoint.authentication.type) {
          case 'bearer':
            headers['Authorization'] =
              `Bearer ${endpoint.authentication.token}`;
            break;
          case 'api-key':
            headers['X-API-Key'] = endpoint.authentication.apiKey;
            break;
        }
      }

      const response = await fetch(
        endpoint.healthEndpoint || `${endpoint.baseUrl}/health`,
        {
          method: 'GET',
          headers,
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          isHealthy: true,
          responseTime,
          successRate: data.successRate || 1.0,
          details: data,
        };
      }
      return {
        isHealthy: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect provider capabilities through API introspection
   */
  private async detectProviderCapabilities(
    providerId: string,
    endpoint: any
  ): Promise<ProviderCapabilities> {
    try {
      // This would make API calls to discover models and capabilities
      // For now, return default capabilities
      return {
        supportedModels: [],
        features: {
          streaming: true,
          functionCalling: false,
          vision: false,
          codeGeneration: true,
          reasoning: true,
          multimodal: false,
        },
        limits: {
          maxTokens: 128_000,
          maxRequestsPerMinute: 100,
          maxRequestsPerDay: 10_000,
          contextWindow: 128_000,
        },
        pricing: {
          inputTokenCost: 0.000_15,
          outputTokenCost: 0.0006,
        },
      };
    } catch (error) {
      console.warn(`Failed to detect capabilities for ${providerId}:`, error);
      // Return minimal default capabilities
      return {
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
      };
    }
  }

  /**
   * Get display name for provider
   */
  private getProviderDisplayName(providerId: string): string {
    const displayNames: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      cohere: 'Cohere',
      huggingface: 'Hugging Face',
      azure: 'Azure OpenAI',
      aws: 'AWS Bedrock',
      'test-provider': 'Test Provider',
      'test-provider-2': 'Test Provider 2',
    };
    return (
      displayNames[providerId] ||
      providerId.charAt(0).toUpperCase() + providerId.slice(1)
    );
  }

  /**
   * Determine provider cost tier based on capabilities
   */
  private determineProviderCostTier(
    capabilities: ProviderCapabilities
  ): 'budget' | 'standard' | 'premium' {
    const avgCost =
      (capabilities.pricing.inputTokenCost +
        capabilities.pricing.outputTokenCost) /
      2;

    if (avgCost < 0.000_05) return 'budget';
    if (avgCost < 0.0002) return 'standard';
    return 'premium';
  }
}

// Export singleton getter with default configuration
export const getProviderDiscoveryService = (
  config?: ProviderDiscoveryConfig
): ProviderDiscoveryService => {
  const defaultConfig: ProviderDiscoveryConfig = {
    healthCheckInterval: 30_000, // 30 seconds
    healthCheckTimeout: 5000, // 5 seconds
    unhealthyThreshold: 3, // 3 consecutive failures
    recoveryCheckInterval: 60_000, // 1 minute
    discoveryInterval: 300_000, // 5 minutes
    capabilityDetectionEnabled: true,
    maxConcurrentHealthChecks: 5,
    healthCheckBackoff: 60_000, // 1 minute
    enableServiceMesh: false,
    providerEndpoints: {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        healthEndpoint: 'https://status.openai.com/api/v2/status.json',
        modelsEndpoint: 'https://api.openai.com/v1/models',
        authentication: {
          type: 'bearer',
          token: process.env.OPENAI_API_KEY,
        },
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com/v1',
        healthEndpoint: 'https://status.anthropic.com/api/v2/status.json',
        modelsEndpoint: 'https://api.anthropic.com/v1/models',
        authentication: {
          type: 'api-key',
          apiKey: process.env.ANTHROPIC_API_KEY,
        },
      },
    },
  };

  return ProviderDiscoveryService.getInstance({ ...defaultConfig, ...config });
};
