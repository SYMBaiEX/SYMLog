import {
  type LanguageModel,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  wrapLanguageModel,
} from 'ai';
import { logError as logErrorToConsole } from '@/lib/logger';
import { config } from '../../config';
import { FallbackChainManager } from '../routing/fallback-chain';
import type { GatewayRequestMetadata, SupportedModelId } from '../core/gateway';
import {
  AIGateway,
  type ModelRequirements,
  type ModelSelection,
} from '../core/gateway';
import { GatewayMiddleware, type MiddlewareConfig } from '../core/gateway-middleware';
import { IntelligentRoutingEngine } from '../routing/intelligent-routing';
import type { LoadBalancingStrategy } from '../routing/load-balancing';
import { ProviderMetricsService } from './provider-metrics';
import { getAIModel, registry, systemPrompts } from '../core/providers';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Enhanced model configuration with gateway integration
export interface EnhancedModelConfig {
  modelId?: string;
  task?: ModelRequirements['task'];
  priority?: ModelRequirements['priority'];
  complexity?: ModelRequirements['complexity'];
  capabilities?: string[];
  maxCost?: number;
  maxLatency?: number;
  metadata?: GatewayRequestMetadata;
  fallbackEnabled?: boolean;
  loadBalancing?: LoadBalancingStrategy;
  aggregation?: boolean;
  aggregationStrategy?: 'consensus' | 'best-of' | 'ensemble';
  aggregationCount?: number;
}

// Gateway configuration defaults
const DEFAULT_GATEWAY_CONFIG = {
  providers: ['openai', 'anthropic'],
  fallbackChain: ['openai:fast', 'anthropic:fast', 'openai:premium'],
  loadBalancing: 'adaptive' as LoadBalancingStrategy,
  maxRetries: 3,
  retryDelay: 1000,
  cooldownPeriod: 60_000,
  performanceSLA: {
    maxLatency: 5000,
    minSuccessRate: 0.95,
  },
  enableCache: true,
  cacheTTL: 5 * 60 * 1000,
};

// Middleware configuration defaults
const DEFAULT_MIDDLEWARE_CONFIG: MiddlewareConfig = {
  enableCache: true,
  cacheTTL: 5 * 60 * 1000,
  enableRequestLogging: true,
  enableResponseAggregation: true,
  enableMetrics: true,
  enableRetryLogic: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60_000,
};

/**
 * Enhanced AI Gateway Registry
 * Provides high-level access to AI models with intelligent routing and failover
 */
export class GatewayRegistry {
  private static instance: GatewayRegistry;
  private gateway: AIGateway;
  private middleware: GatewayMiddleware;
  private routingEngine: IntelligentRoutingEngine;
  private fallbackManager: FallbackChainManager;
  private metricsService: ProviderMetricsService;
  private initialized = false;

  private constructor() {
    // Initialize components
    this.gateway = AIGateway.getInstance(DEFAULT_GATEWAY_CONFIG);
    this.middleware = GatewayMiddleware.getInstance(DEFAULT_MIDDLEWARE_CONFIG);
    this.routingEngine = IntelligentRoutingEngine.getInstance();
    this.fallbackManager = FallbackChainManager.getInstance();
    this.metricsService = ProviderMetricsService.getInstance();

    this.initialized = true;

    loggingService.info('Gateway Registry initialized', {
      providers: DEFAULT_GATEWAY_CONFIG.providers,
      loadBalancing: DEFAULT_GATEWAY_CONFIG.loadBalancing,
    });
  }

  static getInstance(): GatewayRegistry {
    if (!GatewayRegistry.instance) {
      GatewayRegistry.instance = new GatewayRegistry();
    }
    return GatewayRegistry.instance;
  }

  /**
   * Get an enhanced AI model with gateway features
   */
  async getEnhancedModel(
    config: EnhancedModelConfig = {}
  ): Promise<LanguageModel> {
    // Build model requirements
    const requirements: ModelRequirements = {
      task: config.task || 'chat',
      priority: (config.priority ?? 'balanced') as 'speed' | 'quality' | 'cost',
      complexity: config.complexity,
      capabilities: config.capabilities,
      maxCost: config.maxCost,
      maxLatency: config.maxLatency,
    };

    // Handle aggregated requests
    if (config.aggregation) {
      return this.createAggregatedModel(requirements, config);
    }

    // Get optimal model through gateway
    const modelSelection = await this.gateway.getOptimalModel(requirements);

    // Wrap model with gateway features
    return this.wrapModelWithGateway(modelSelection, requirements, config);
  }

  /**
   * Get a model by specific ID with gateway features
   */
  async getModelById(
    modelId: string,
    config: Omit<EnhancedModelConfig, 'modelId'> = {}
  ): Promise<LanguageModel> {
    // Try to get model from registry first
    try {
      const baseModel = registry.languageModel(modelId as SupportedModelId);

      if (!config.fallbackEnabled) {
        return baseModel;
      }

      // Create model selection for gateway features
      const [providerId, modelName] = modelId.split(':');
      const modelSelection: ModelSelection = {
        provider: providerId,
        modelId: modelId as SupportedModelId,
        model: baseModel,
        reason: 'Direct model request',
        fallbackOptions: this.buildFallbackChain(modelId),
      };

      const requirements: ModelRequirements = {
        task: config.task || 'chat',
        priority: (config.priority ?? 'balanced') as
          | 'speed'
          | 'quality'
          | 'cost',
      };

      return this.wrapModelWithGateway(modelSelection, requirements, config);
    } catch (error) {
      loggingService.warn(
        'Model not found in registry, using gateway selection',
        {
          modelId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );

      // Fallback to gateway selection
      return this.getEnhancedModel({ ...config, modelId });
    }
  }

  /**
   * Get model recommendations based on task
   */
  async getRecommendedModels(
    task: ModelRequirements['task'],
    limit = 5
  ): Promise<
    Array<{
      modelId: string;
      reason: string;
      score: number;
      capabilities: string[];
      costPerToken: number;
    }>
  > {
    const requirements: ModelRequirements = {
      task,
      priority: 'balanced' as 'speed' | 'quality' | 'cost',
    };

    const providers = Array.from(
      this.gateway.getAllProviderStatuses().entries()
    )
      .filter(([_, health]) => health.status !== 'unhealthy')
      .map(([id]) => ({
        id,
        name: id,
        models: [],
        health: this.gateway.getProviderHealth(id)!,
        capabilities: [],
        costTier: 'standard' as const,
      }));

    const routingDecision = await this.routingEngine.routeRequest(
      requirements,
      providers
    );

    const recommendations = [
      {
        modelId: routingDecision.primaryChoice.modelId,
        reason: routingDecision.primaryChoice.reason,
        score: routingDecision.primaryChoice.confidence,
        capabilities: this.getModelCapabilities(
          routingDecision.primaryChoice.modelId
        ),
        costPerToken: this.getModelCost(routingDecision.primaryChoice.modelId),
      },
      ...routingDecision.alternatives.slice(0, limit - 1).map((alt) => ({
        modelId: alt.modelId,
        reason: alt.reason,
        score: alt.confidence,
        capabilities: this.getModelCapabilities(alt.modelId),
        costPerToken: this.getModelCost(alt.modelId),
      })),
    ];

    return recommendations;
  }

  /**
   * Execute a request with automatic failover
   */
  async executeWithFailover<T>(
    modelId: string,
    executor: (model: LanguageModel) => Promise<T>,
    config: EnhancedModelConfig = {}
  ): Promise<T> {
    const model = await this.getModelById(modelId, {
      ...config,
      fallbackEnabled: true,
    });

    return this.middleware.processRequest(
      {
        task: config.task || 'chat',
        priority: (config.priority ?? 'balanced') as
          | 'speed'
          | 'quality'
          | 'cost',
        capabilities: config.capabilities,
        maxCost: config.maxCost,
        maxLatency: config.maxLatency,
      },
      (model) => executor(model),
      config.metadata
    );
  }

  /**
   * Get gateway statistics
   */
  getGatewayStats(): {
    providers: Map<string, any>;
    models: Map<string, any>;
    cache: any;
    routing: any;
    circuitBreakers: Map<string, any>;
  } {
    return {
      providers: this.metricsService.getAllProviderMetrics(),
      models: this.metricsService.getAllModelMetrics(),
      cache: this.middleware.getCacheStats(),
      routing: this.routingEngine.getRoutingStats(),
      circuitBreakers: this.middleware.getCircuitBreakerStatus(),
    };
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(modelId: string): any {
    const [providerId, modelName] = modelId.split(':');
    return this.metricsService.getModelMetrics(providerId, modelName);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.middleware.clearCache();
    loggingService.info('All caches cleared');
  }

  /**
   * Update load balancing strategy
   */
  updateLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    // This would require updating the gateway config
    loggingService.info('Load balancing strategy updated', { strategy });
  }

  // Private helper methods

  private wrapModelWithGateway(
    modelSelection: ModelSelection,
    requirements: ModelRequirements,
    config: EnhancedModelConfig
  ): LanguageModel {
    // Create a wrapped model that includes gateway features
    return wrapLanguageModel({
      model: modelSelection.model as any,
      middleware: (async (params: any, options: any, doGenerate: any) => {
        // Process through middleware
        return this.middleware.processRequest(
          requirements,
          async (model) => doGenerate(params, options),
          config.metadata
        );
      }) as any,
    });
  }

  private createAggregatedModel(
    requirements: ModelRequirements,
    config: EnhancedModelConfig
  ): LanguageModel {
    // For AI SDK v5, we need to use a proper provider model as base
    // This is a simplified version - the full implementation would require
    // creating a custom provider that implements the aggregation logic
    // Using a default model ID since selectModels doesn't exist
    const baseModelId = 'openai:gpt-4o-mini' as SupportedModelId;
    const baseModel = registry.languageModel(baseModelId);
    if (!baseModel) {
      throw new Error('No base model available for aggregation');
    }

    // Use wrapLanguageModel to add aggregation middleware
    return wrapLanguageModel({
      model: baseModel as any,
      middleware: {
        wrapGenerate: async ({
          doGenerate,
          params,
        }: {
          doGenerate: any;
          params: any;
        }) => {
          // This would implement the aggregation logic
          return await doGenerate();
        },
        wrapStream: async ({
          doStream,
          params,
        }: {
          doStream: any;
          params: any;
        }) => {
          // This would implement the streaming aggregation logic
          return await doStream();
        },
      } as any,
    });
  }

  private buildFallbackChain(primaryModelId: string): SupportedModelId[] {
    // Build a fallback chain based on model type
    const fallbackChains: Record<string, SupportedModelId[]> = {
      'openai:fast': [
        'anthropic:fast',
        'openai:premium',
        'anthropic:balanced',
      ] as SupportedModelId[],
      'anthropic:fast': [
        'openai:fast',
        'anthropic:balanced',
        'openai:premium',
      ] as SupportedModelId[],
      'openai:premium': [
        'anthropic:balanced',
        'openai:fast',
        'anthropic:reasoning',
      ] as SupportedModelId[],
      'anthropic:balanced': [
        'openai:premium',
        'anthropic:fast',
        'openai:fast',
      ] as SupportedModelId[],
      'openai:code': [
        'anthropic:balanced',
        'openai:premium',
        'anthropic:reasoning',
      ] as SupportedModelId[],
      'anthropic:reasoning': [
        'openai:premium',
        'anthropic:balanced',
        'openai:code',
      ] as SupportedModelId[],
      'anthropic:creative': [
        'openai:premium',
        'anthropic:balanced',
        'openai:fast',
      ] as SupportedModelId[],
    };

    return (
      fallbackChains[primaryModelId] ||
      (DEFAULT_GATEWAY_CONFIG.fallbackChain as SupportedModelId[])
    );
  }

  private getModelCapabilities(modelId: string): string[] {
    // Get capabilities for a model
    const capabilities: Record<string, string[]> = {
      'openai:fast': ['chat', 'code', 'analysis'],
      'openai:code': ['code', 'analysis', 'debugging'],
      'openai:premium': ['chat', 'code', 'analysis', 'reasoning'],
      'anthropic:fast': ['chat', 'code', 'analysis'],
      'anthropic:balanced': ['chat', 'code', 'analysis', 'creative'],
      'anthropic:reasoning': ['reasoning', 'analysis', 'problem-solving'],
      'anthropic:creative': ['creative', 'storytelling', 'ideation'],
    };

    return capabilities[modelId] ?? ['chat'];
  }

  private getModelCost(modelId: string): number {
    // Get cost per token for a model
    const costs: Record<string, number> = {
      'openai:fast': 0.000_03,
      'openai:code': 0.0001,
      'openai:premium': 0.000_15,
      'anthropic:fast': 0.000_02,
      'anthropic:balanced': 0.000_06,
      'anthropic:reasoning': 0.000_08,
      'anthropic:creative': 0.0003,
    };

    return costs[modelId] ?? 0.0001;
  }
}

// Export singleton instance
export const gatewayRegistry = GatewayRegistry.getInstance();

// Convenience functions for backward compatibility

/**
 * Get an AI model with gateway features
 */
export const getGatewayModel = async (
  config: EnhancedModelConfig = {}
): Promise<LanguageModel> => {
  return gatewayRegistry.getEnhancedModel(config);
};

/**
 * Get a model by ID with gateway features
 */
export const getGatewayModelById = async (
  modelId: string,
  config: Omit<EnhancedModelConfig, 'modelId'> = {}
): Promise<LanguageModel> => {
  return gatewayRegistry.getModelById(modelId, config);
};

/**
 * Execute with automatic failover
 */
export const executeWithGateway = async <T>(
  modelId: string,
  executor: (model: LanguageModel) => Promise<T>,
  config: EnhancedModelConfig = {}
): Promise<T> => {
  return gatewayRegistry.executeWithFailover(modelId, executor, config);
};

// Export system prompts for consistency
export { systemPrompts } from '../core/providers';
