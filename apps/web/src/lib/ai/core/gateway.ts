import type {
  LanguageModel,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  Provider,
} from 'ai';

// AI SDK v5 Compatible Model ID Types
export type OpenAIModelId = `openai:${string}`;
export type AnthropicModelId = `anthropic:${string}`;
export type SupportedModelId = OpenAIModelId | AnthropicModelId;

// Model ID registry for type safety
export type KnownOpenAIModels =
  | 'openai:gpt-4o-mini'
  | 'openai:gpt-4.1-nano'
  | 'openai:gpt-4.1-2025-04-14';

export type KnownAnthropicModels =
  | 'anthropic:claude-3-haiku-20240307'
  | 'anthropic:claude-3-5-sonnet-20241022'
  | 'anthropic:claude-3-7-sonnet-20250219'
  | 'anthropic:claude-3-opus-20240229';

export type KnownModelIds = KnownOpenAIModels | KnownAnthropicModels;

// Extended metadata interface that includes gateway-specific properties
export interface GatewayRequestMetadata extends LanguageModelRequestMetadata {
  gatewayRequestId?: string;
  providerId?: string;
  modelId?: string;
  timestamp?: string;
}

// import { distributedTracing } from '../telemetry/distributed-tracing'; // TODO: Fix telemetry import
import { v2ErrorHandler } from '../error-handling/unified-error-system';
import { LoadBalancer, type LoadBalancingStrategy } from '../routing';
import {
  type DiscoveredProvider,
  getProviderDiscoveryService,
  type ProviderDiscoveryConfig,
  type ProviderDiscoveryService,
} from '../providers';
import { ProviderMetricsService } from '../providers';
import { registry } from './providers';
// import { createLogger } from '../logger/unified-logger'; // TODO: Fix logger import

// Create AI Gateway logger - temporary fix
const logger = {
  info: (...args: any[]) => console.log('[ai-gateway]', ...args),
  warn: (...args: any[]) => console.warn('[ai-gateway]', ...args),
  error: (...args: any[]) => console.error('[ai-gateway]', ...args),
  debug: (...args: any[]) => console.debug('[ai-gateway]', ...args),
};

// Enhanced Gateway configuration with real-time discovery
export interface GatewayConfig {
  providers: string[];
  fallbackChain: string[];
  loadBalancing: LoadBalancingStrategy;
  maxRetries?: number;
  retryDelay?: number;
  cooldownPeriod?: number;
  costThreshold?: number;
  performanceSLA?: {
    maxLatency: number;
    minSuccessRate: number;
  };
  enableCache?: boolean;
  cacheTTL?: number;

  // Real-time provider discovery settings - NEW!
  enableRealTimeDiscovery?: boolean;
  discoveryConfig?: ProviderDiscoveryConfig;
  autoRegisterDiscoveredProviders?: boolean;
  preferDiscoveredProviders?: boolean;
}

// Model requirements for routing
export interface ModelRequirements {
  task: 'chat' | 'code' | 'analysis' | 'creative' | 'reasoning' | 'vision';
  priority: 'speed' | 'quality' | 'cost';
  complexity?: 'simple' | 'moderate' | 'complex';
  capabilities?: string[];
  maxCost?: number;
  maxLatency?: number;
}

// Provider info with capabilities
export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  health: ProviderHealth;
  capabilities: string[];
  costTier: 'budget' | 'standard' | 'premium';
}

export interface ModelInfo {
  id: string;
  name: string;
  capabilities: string[];
  costPerToken: number;
  maxTokens: number;
  contextWindow: number;
  supportedTasks: string[];
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  successRate: number;
  averageLatency: number;
  lastHealthCheck: Date;
  cooldownUntil?: Date;
}

// Model selection result with proper type constraints
export interface ModelSelection {
  provider: string;
  modelId: SupportedModelId;
  model: LanguageModel;
  reason: string;
  fallbackOptions: SupportedModelId[];
}

/**
 * Enhanced AI Gateway with Real-time Provider Discovery
 * Implements August 2025 best practices for dynamic AI provider management
 */
export class AIGateway {
  private static instance: AIGateway;
  private providers: Map<string, ProviderInfo> = new Map();
  private metricsService: ProviderMetricsService;
  private loadBalancer: LoadBalancer;
  private cache: Map<string, any> = new Map();
  private discoveryService?: ProviderDiscoveryService;
  private discoveredProviders: Map<string, DiscoveredProvider> = new Map();

  constructor(private config: GatewayConfig) {
    this.metricsService = ProviderMetricsService.getInstance();
    this.loadBalancer = new LoadBalancer(config.loadBalancing);
    this.initializeProviders();

    // Initialize real-time provider discovery if enabled
    if (config.enableRealTimeDiscovery) {
      this.initializeProviderDiscovery();
    }
  }

  static getInstance(config?: GatewayConfig): AIGateway {
    if (!AIGateway.instance) {
      if (!config) {
        throw new Error('Gateway configuration required for initialization');
      }
      AIGateway.instance = new AIGateway(config);
    }
    return AIGateway.instance;
  }

  /**
   * Get the provider discovery service instance
   */
  getDiscoveryService(): ProviderDiscoveryService | undefined {
    return this.discoveryService;
  }

  /**
   * Get all discovered providers (real-time discovery)
   */
  getDiscoveredProviders(): Map<string, DiscoveredProvider> {
    return this.discoveredProviders;
  }

  /**
   * Start real-time provider discovery
   */
  async startDiscovery(): Promise<void> {
    if (!this.discoveryService) {
      throw new Error(
        'Provider discovery not enabled. Set enableRealTimeDiscovery: true in gateway config'
      );
    }

    await this.discoveryService.start();
    logger.info('Real-time provider discovery started');
  }

  /**
   * Stop real-time provider discovery
   */
  async stopDiscovery(): Promise<void> {
    if (this.discoveryService) {
      await this.discoveryService.stop();
      logger.info('Real-time provider discovery stopped');
    }
  }

  /**
   * Initialize providers from configuration
   */
  private initializeProviders(): void {
    // Initialize OpenAI provider
    if (this.config.providers.includes('openai')) {
      this.providers.set('openai', {
        id: 'openai',
        name: 'OpenAI',
        models: [
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4 Omni Mini',
            capabilities: ['chat', 'code', 'analysis'],
            costPerToken: 0.000_03,
            maxTokens: 128_000,
            contextWindow: 128_000,
            supportedTasks: ['chat', 'code', 'analysis'],
          },
          {
            id: 'gpt-4.1-nano',
            name: 'GPT-4.1 Nano',
            capabilities: ['chat', 'code', 'analysis', 'reasoning'],
            costPerToken: 0.000_15,
            maxTokens: 128_000,
            contextWindow: 128_000,
            supportedTasks: ['chat', 'code', 'analysis', 'creative'],
          },
          {
            id: 'gpt-4.1-2025-04-14',
            name: 'GPT-4.1 Code',
            capabilities: ['code', 'analysis'],
            costPerToken: 0.0001,
            maxTokens: 128_000,
            contextWindow: 128_000,
            supportedTasks: ['code'],
          },
        ],
        health: {
          status: 'healthy',
          successRate: 1.0,
          averageLatency: 0,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat', 'code', 'analysis', 'creative'],
        costTier: 'standard',
      });
    }

    // Initialize Anthropic provider
    if (this.config.providers.includes('anthropic')) {
      this.providers.set('anthropic', {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          {
            id: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            capabilities: ['chat', 'code', 'analysis'],
            costPerToken: 0.000_02,
            maxTokens: 200_000,
            contextWindow: 200_000,
            supportedTasks: ['chat', 'code'],
          },
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            capabilities: ['chat', 'code', 'analysis', 'creative'],
            costPerToken: 0.000_06,
            maxTokens: 200_000,
            contextWindow: 200_000,
            supportedTasks: ['chat', 'code', 'analysis', 'creative'],
          },
          {
            id: 'claude-3-7-sonnet-20250219',
            name: 'Claude 3.7 Sonnet',
            capabilities: ['chat', 'code', 'analysis', 'reasoning'],
            costPerToken: 0.000_08,
            maxTokens: 100_000,
            contextWindow: 200_000,
            supportedTasks: ['chat', 'code', 'analysis', 'reasoning'],
          },
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            capabilities: ['chat', 'code', 'analysis', 'creative', 'reasoning'],
            costPerToken: 0.0003,
            maxTokens: 200_000,
            contextWindow: 200_000,
            supportedTasks: ['creative', 'reasoning'],
          },
        ],
        health: {
          status: 'healthy',
          successRate: 1.0,
          averageLatency: 0,
          lastHealthCheck: new Date(),
        },
        capabilities: ['chat', 'code', 'analysis', 'creative', 'reasoning'],
        costTier: 'standard',
      });
    }

    // Log initialized providers
    logger.info('AI Gateway initialized', {
      providers: Array.from(this.providers.keys()),
      loadBalancing: this.config.loadBalancing,
      fallbackChain: this.config.fallbackChain,
      realTimeDiscovery: this.config.enableRealTimeDiscovery,
    });
  }

  /**
   * Get optimal model based on requirements (enhanced with real-time discovery)
   */
  async getOptimalModel(
    requirements: ModelRequirements
  ): Promise<ModelSelection> {
    // TODO: Re-enable distributed tracing when available
    // return distributedTracing.trackAIOperation(
    //   'gateway-model-selection',
    //   'ai-gateway',
    //   'model-routing',
    //   async (span) => {
    const executeModelSelection = async () => {
        // TODO: Re-enable span attributes when distributed tracing is available
        // span.setAttributes({
        //   'gateway.selection.task': requirements.task,
        //   'gateway.selection.priority': requirements.priority,
        //   'gateway.discovery.enabled': this.config.enableRealTimeDiscovery,
        // });

        // Update provider health status
        await this.updateProviderHealth();

        // Get all available providers (static + discovered)
        const allProviders = this.getAllAvailableProviders();

        // Filter healthy providers
        const healthyProviders = this.filterHealthyProviders(allProviders);

        // Find suitable models based on requirements
        const suitableModels = this.findSuitableModels(
          healthyProviders,
          requirements
        );

        if (suitableModels.length === 0) {
          throw new Error('No suitable models found for requirements');
        }

        // Apply routing logic based on priority
        let selectedModel: ModelSelection;

        switch (requirements.priority) {
          case 'speed':
            selectedModel = this.selectFastestModel(
              suitableModels,
              requirements
            );
            break;
          case 'quality':
            selectedModel = this.selectHighestQualityModel(
              suitableModels,
              requirements
            );
            break;
          case 'cost':
            selectedModel = this.selectCheapestModel(
              suitableModels,
              requirements
            );
            break;
          default:
            selectedModel = this.selectBalancedModel(
              suitableModels,
              requirements
            );
        }

        // Get fallback options
        const fallbackOptions = this.getFallbackOptions(
          selectedModel,
          suitableModels
        );

        // TODO: Re-enable span attributes when distributed tracing is available
        // span.setAttributes({
        //   'gateway.selection.selected_provider': selectedModel.provider,
        //   'gateway.selection.selected_model': selectedModel.modelId,
        //   'gateway.selection.fallback_count': fallbackOptions.length,
        //   'gateway.selection.available_providers': allProviders.length,
        //   'gateway.selection.healthy_providers': healthyProviders.length,
        // });

        logger.info('Model selected', {
          selected: selectedModel.modelId,
          provider: selectedModel.provider,
          reason: selectedModel.reason,
          fallbacks: fallbackOptions.length,
          discoveredProviders: this.discoveredProviders.size,
        });

        return {
          ...selectedModel,
          fallbackOptions,
        };
      };
    
    return executeModelSelection();
  }

  /**
   * Execute request with automatic failover
   */
  async executeWithFailover<T>(
    modelSelection: ModelSelection,
    request: (model: LanguageModel) => Promise<T>,
    metadata?: GatewayRequestMetadata
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    const attempts: string[] = [];

    // Try primary model
    try {
      attempts.push(modelSelection.modelId);
      const result = await this.executeRequest(
        modelSelection.model,
        request,
        modelSelection.provider,
        modelSelection.modelId,
        metadata
      );

      // Record success
      this.metricsService.recordSuccess(
        modelSelection.provider,
        modelSelection.modelId,
        Date.now() - startTime
      );

      return result;
    } catch (error) {
      lastError = error as Error;
      this.metricsService.recordFailure(
        modelSelection.provider,
        modelSelection.modelId,
        error as Error
      );

      logger.warn('Primary model failed, attempting failover', {
        model: modelSelection.modelId,
        error: lastError.message,
      });
    }

    // Try fallback models
    for (const fallbackModelId of modelSelection.fallbackOptions) {
      try {
        attempts.push(fallbackModelId);
        const fallbackModel = this.getModelById(fallbackModelId);

        if (!fallbackModel) {
          continue;
        }

        const result = await this.executeRequest(
          fallbackModel.model,
          request,
          fallbackModel.provider,
          fallbackModelId,
          metadata
        );

        // Record success
        this.metricsService.recordSuccess(
          fallbackModel.provider,
          fallbackModelId,
          Date.now() - startTime
        );

        logger.info('Failover successful', {
          original: modelSelection.modelId,
          fallback: fallbackModelId,
          attempts: attempts.length,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        const fallbackModel = this.getModelById(fallbackModelId);
        if (fallbackModel) {
          this.metricsService.recordFailure(
            fallbackModel.provider,
            fallbackModelId,
            error as Error
          );
        }
      }
    }

    // All attempts failed
    logger.error('All failover attempts failed', {
      attempts,
      totalTime: Date.now() - startTime,
    });

    throw lastError || new Error('All model attempts failed');
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.providers.get(providerId)?.health;
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): Map<string, ProviderHealth> {
    const statuses = new Map<string, ProviderHealth>();

    for (const [id, provider] of this.providers) {
      statuses.set(id, provider.health);
    }

    return statuses;
  }

  /**
   * Force health check for a provider
   */
  async checkProviderHealth(providerId: string): Promise<ProviderHealth> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Perform health check
    const health = await this.performHealthCheck(providerId);
    provider.health = health;

    return health;
  }

  // Private helper methods

  /**
   * Initialize real-time provider discovery
   */
  private initializeProviderDiscovery(): void {
    try {
      this.discoveryService = getProviderDiscoveryService(
        this.config.discoveryConfig
      );

      // Set up event listeners for discovered providers
      this.discoveryService.on(
        'provider:discovered',
        (provider: DiscoveredProvider) => {
          if (this.config.autoRegisterDiscoveredProviders) {
            this.registerDiscoveredProvider(provider);
          }
          logger.info('Provider discovered', {
            providerId: provider.id,
            models: provider.models.length,
            capabilities: provider.capabilities,
          });
        }
      );

      this.discoveryService.on(
        'provider:health:changed',
        (providerId: string, health: ProviderHealth) => {
          const provider = this.discoveredProviders.get(providerId);
          if (provider) {
            provider.health = health;
            logger.info('Provider health changed', {
              providerId,
              status: health.status,
              successRate: health.successRate,
            });
          }
        }
      );

      this.discoveryService.on(
        'provider:unavailable',
        (providerId: string, reason: string) => {
          logger.warn('Provider became unavailable', {
            providerId,
            reason,
          });
        }
      );

      this.discoveryService.on(
        'discovery:error',
        (error: Error, providerId?: string) => {
          logger.error('Provider discovery error', {
            providerId,
            error: error.message,
          });
        }
      );
    } catch (error) {
      logger.error('Failed to initialize provider discovery', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Register a discovered provider
   */
  private registerDiscoveredProvider(provider: DiscoveredProvider): void {
    this.discoveredProviders.set(provider.id, provider);

    logger.info('Registered discovered provider', {
      providerId: provider.id,
      source: provider.discoverySource,
      modelCount: provider.models.length,
    });
  }

  /**
   * Get all available providers (static + discovered)
   */
  private getAllAvailableProviders(): ProviderInfo[] {
    const allProviders: ProviderInfo[] = [];

    // Add static providers
    allProviders.push(...Array.from(this.providers.values()));

    // Add discovered providers if enabled and preferred
    if (
      this.config.enableRealTimeDiscovery &&
      this.config.preferDiscoveredProviders
    ) {
      for (const discovered of this.discoveredProviders.values()) {
        // Convert DiscoveredProvider to ProviderInfo format
        const providerInfo: ProviderInfo = {
          id: discovered.id,
          name: discovered.name,
          models: discovered.models,
          health: discovered.health,
          capabilities: Object.keys(discovered.capabilities.features).filter(
            (key) =>
              discovered.capabilities.features[
                key as keyof typeof discovered.capabilities.features
              ]
          ),
          costTier: discovered.costTier,
        };
        allProviders.push(providerInfo);
      }
    }

    return allProviders;
  }

  private async updateProviderHealth(): Promise<void> {
    const now = Date.now();

    // Update static providers
    for (const [providerId, provider] of this.providers) {
      const lastCheck = provider.health.lastHealthCheck.getTime();

      // Check health every 5 minutes
      if (now - lastCheck > 5 * 60 * 1000) {
        provider.health = await this.performHealthCheck(providerId);
      }
    }

    // Discovered providers are updated by the discovery service automatically
  }

  private async performHealthCheck(
    providerId: string
  ): Promise<ProviderHealth> {
    const metrics = this.metricsService.getProviderMetrics(providerId);
    const now = new Date();

    // Calculate health based on recent metrics
    const recentErrors = metrics.errorCount;
    const totalRequests = metrics.successCount + metrics.errorCount;
    const successRate =
      totalRequests > 0 ? metrics.successCount / totalRequests : 1;
    const averageLatency = metrics.averageLatency;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let cooldownUntil: Date | undefined;

    if (successRate < 0.5 || recentErrors > 10) {
      status = 'unhealthy';
      // Apply cooldown period
      cooldownUntil = new Date(
        now.getTime() + (this.config.cooldownPeriod || 60_000)
      );
    } else if (successRate < 0.8 || averageLatency > 5000) {
      status = 'degraded';
    }

    return {
      status,
      successRate,
      averageLatency,
      lastHealthCheck: now,
      cooldownUntil,
    };
  }

  private filterHealthyProviders(providers?: ProviderInfo[]): ProviderInfo[] {
    const now = Date.now();
    const providersToFilter = providers || Array.from(this.providers.values());

    return providersToFilter.filter((provider) => {
      // Skip if in cooldown
      if (
        provider.health.cooldownUntil &&
        provider.health.cooldownUntil.getTime() > now
      ) {
        return false;
      }

      // Include healthy and degraded providers
      return provider.health.status !== 'unhealthy';
    });
  }

  private findSuitableModels(
    providers: ProviderInfo[],
    requirements: ModelRequirements
  ): Array<{ provider: ProviderInfo; model: ModelInfo }> {
    const suitable: Array<{ provider: ProviderInfo; model: ModelInfo }> = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        // Check task support
        if (!model.supportedTasks.includes(requirements.task)) {
          continue;
        }

        // Check capabilities
        if (requirements.capabilities) {
          const hasAllCapabilities = requirements.capabilities.every((cap) =>
            model.capabilities.includes(cap)
          );
          if (!hasAllCapabilities) {
            continue;
          }
        }

        // Check cost threshold
        if (requirements.maxCost && model.costPerToken > requirements.maxCost) {
          continue;
        }

        suitable.push({ provider, model });
      }
    }

    return suitable;
  }

  private selectFastestModel(
    models: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements: ModelRequirements
  ): ModelSelection {
    // Sort by provider average latency
    const sorted = models.sort(
      (a, b) =>
        a.provider.health.averageLatency - b.provider.health.averageLatency
    );

    const selected = sorted[0];
    const modelId =
      `${selected.provider.id}:${selected.model.id}` as SupportedModelId;

    return {
      provider: selected.provider.id,
      modelId,
      model: registry.languageModel(modelId),
      reason: 'Lowest latency provider',
      fallbackOptions: [],
    };
  }

  private selectHighestQualityModel(
    models: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements: ModelRequirements
  ): ModelSelection {
    // Prefer models with more capabilities and higher cost (usually better)
    const sorted = models.sort((a, b) => {
      const scoreA = a.model.capabilities.length * 100 + a.model.costPerToken;
      const scoreB = b.model.capabilities.length * 100 + b.model.costPerToken;
      return scoreB - scoreA;
    });

    const selected = sorted[0];
    const modelId =
      `${selected.provider.id}:${selected.model.id}` as SupportedModelId;

    return {
      provider: selected.provider.id,
      modelId,
      model: registry.languageModel(modelId),
      reason: 'Highest quality model',
      fallbackOptions: [],
    };
  }

  private selectCheapestModel(
    models: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements: ModelRequirements
  ): ModelSelection {
    // Sort by cost per token
    const sorted = models.sort(
      (a, b) => a.model.costPerToken - b.model.costPerToken
    );

    const selected = sorted[0];
    const modelId =
      `${selected.provider.id}:${selected.model.id}` as SupportedModelId;

    return {
      provider: selected.provider.id,
      modelId,
      model: registry.languageModel(modelId),
      reason: 'Lowest cost model',
      fallbackOptions: [],
    };
  }

  private selectBalancedModel(
    models: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements: ModelRequirements
  ): ModelSelection {
    // Balance between cost, quality, and performance
    const sorted = models.sort((a, b) => {
      const scoreA = this.calculateBalancedScore(a.provider, a.model);
      const scoreB = this.calculateBalancedScore(b.provider, b.model);
      return scoreB - scoreA;
    });

    const selected = sorted[0];
    const modelId =
      `${selected.provider.id}:${selected.model.id}` as SupportedModelId;

    return {
      provider: selected.provider.id,
      modelId,
      model: registry.languageModel(modelId),
      reason: 'Balanced selection',
      fallbackOptions: [],
    };
  }

  private calculateBalancedScore(
    provider: ProviderInfo,
    model: ModelInfo
  ): number {
    // Higher is better
    const latencyScore = 1000 / (provider.health.averageLatency + 1);
    const costScore = 1 / (model.costPerToken + 0.000_01);
    const capabilityScore = model.capabilities.length * 10;
    const healthScore = provider.health.successRate * 100;

    return latencyScore + costScore + capabilityScore + healthScore;
  }

  private getFallbackOptions(
    selected: ModelSelection,
    allModels: Array<{ provider: ProviderInfo; model: ModelInfo }>
  ): SupportedModelId[] {
    // Get other suitable models as fallbacks
    return allModels
      .filter((m) => {
        const modelId = `${m.provider.id}:${m.model.id}` as SupportedModelId;
        return modelId !== selected.modelId;
      })
      .sort((a, b) => {
        // Prioritize by health and then cost
        const healthDiff =
          b.provider.health.successRate - a.provider.health.successRate;
        if (Math.abs(healthDiff) > 0.1) {
          return healthDiff;
        }
        return a.model.costPerToken - b.model.costPerToken;
      })
      .slice(0, 3)
      .map((m) => `${m.provider.id}:${m.model.id}` as SupportedModelId);
  }

  private getModelById(
    modelId: SupportedModelId
  ): { provider: string; model: LanguageModel } | undefined {
    try {
      const [providerId] = modelId.split(':');
      const model = registry.languageModel(modelId);
      return { provider: providerId, model };
    } catch {
      return;
    }
  }

  private async executeRequest<T>(
    model: LanguageModel,
    request: (model: LanguageModel) => Promise<T>,
    providerId: string,
    modelId: string,
    metadata?: GatewayRequestMetadata
  ): Promise<T> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Add request metadata
      const enhancedMetadata: GatewayRequestMetadata = {
        ...metadata,
        gatewayRequestId: requestId,
        providerId,
        modelId,
        timestamp: new Date().toISOString(),
      };

      // Execute the request
      const result = await request(model);

      // Record latency
      const latency = Date.now() - startTime;
      this.metricsService.recordLatency(providerId, modelId, latency);

      return result;
    } catch (error) {
      // Let caller handle the error after recording
      throw error;
    }
  }
}

// Export singleton getter
export const getAIGateway = (config?: GatewayConfig): AIGateway => {
  return AIGateway.getInstance(config);
};
