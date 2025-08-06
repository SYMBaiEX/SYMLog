import {
  type LanguageModel,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  wrapLanguageModel,
} from 'ai';
import { config } from '../../config';
import { unifiedErrorSystem, type UnifiedErrorInfo } from '../error-handling/unified-error-system';
import { registry as providerRegistry, systemPrompts } from '../core/providers';

// Re-export the original registry for backward compatibility
export { registry } from '../core/providers';

// Unified model identifiers
export type SupportedModelId = 
  | 'openai:fast' 
  | 'openai:code'
  | 'openai:premium'
  | 'anthropic:fast'
  | 'anthropic:balanced' 
  | 'anthropic:reasoning'
  | 'anthropic:creative';

// Unified provider health status
export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  successRate: number;
  lastChecked: number;
  errorCount: number;
  consecutiveFailures: number;
}

// Unified load balancing strategies
export type LoadBalancingStrategy = 
  | 'round-robin' 
  | 'least-latency' 
  | 'least-cost'
  | 'adaptive'
  | 'failover';

// Model requirements for optimal selection
export interface ModelRequirements {
  task: 'chat' | 'code' | 'analysis' | 'creative' | 'reasoning' | 'embedding' | 'image';
  priority: 'speed' | 'quality' | 'cost';
  complexity?: 'simple' | 'moderate' | 'complex';
  capabilities?: string[];
  maxCost?: number;
  maxLatency?: number;
  minAccuracy?: number;
}

// Model selection result
export interface ModelSelection {
  provider: string;
  modelId: SupportedModelId;
  model: LanguageModel;
  reason: string;
  confidence: number;
  fallbackOptions: SupportedModelId[];
  estimatedCost: number;
  estimatedLatency: number;
}

// Gateway request metadata
export interface GatewayRequestMetadata extends LanguageModelRequestMetadata {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  priority?: number;
  features?: string[];
}

// Unified gateway configuration
export interface UnifiedGatewayConfig {
  providers: string[];
  fallbackChain: SupportedModelId[];
  loadBalancing: LoadBalancingStrategy;
  maxRetries: number;
  retryDelay: number;
  cooldownPeriod: number;
  costThreshold?: number;
  performanceSLA: {
    maxLatency: number;
    minSuccessRate: number;
  };
  enableCache: boolean;
  cacheTTL: number;
  enableMetrics: boolean;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Request context for middleware
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: GatewayRequestMetadata;
  performance: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

// Middleware configuration
export interface MiddlewareConfig {
  enableCache: boolean;
  cacheTTL: number;
  enableRequestLogging: boolean;
  enableResponseAggregation: boolean;
  enableMetrics: boolean;
  enableRetryLogic: boolean;
  maxRetries: number;
  retryDelay: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Enhanced model configuration
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

// Provider metrics data
export interface ProviderMetrics {
  requests: number;
  successes: number;
  failures: number;
  totalLatency: number;
  totalCost: number;
  averageLatency: number;
  averageCost: number;
  successRate: number;
  lastRequest: number;
  lastSuccess: number;
  lastFailure: number;
}

// Circuit breaker state
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Default configurations
const DEFAULT_GATEWAY_CONFIG: UnifiedGatewayConfig = {
  providers: ['openai', 'anthropic'],
  fallbackChain: ['openai:fast', 'anthropic:fast', 'openai:premium'],
  loadBalancing: 'adaptive',
  maxRetries: 3,
  retryDelay: 1000,
  cooldownPeriod: 60_000,
  costThreshold: 0.01,
  performanceSLA: {
    maxLatency: 5000,
    minSuccessRate: 0.95,
  },
  enableCache: true,
  cacheTTL: 5 * 60 * 1000,
  enableMetrics: true,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60_000,
};

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
 * Unified Provider Management System
 * Consolidates gateway, registry, and middleware functionality
 */
export class UnifiedProviderSystem {
  private static instance: UnifiedProviderSystem;
  private config: UnifiedGatewayConfig;
  private middlewareConfig: MiddlewareConfig;
  private providerHealth = new Map<string, ProviderHealth>();
  private providerMetrics = new Map<string, ProviderMetrics>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private cache = new Map<string, CacheEntry<any>>();
  private requestInterceptors: Array<(context: RequestContext) => void> = [];
  private responseInterceptors: Array<(context: RequestContext, response: any) => void> = [];
  private errorInterceptors: Array<(context: RequestContext, error: UnifiedErrorInfo) => void> = [];

  private constructor(
    gatewayConfig?: Partial<UnifiedGatewayConfig>,
    middlewareConfig?: Partial<MiddlewareConfig>
  ) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...gatewayConfig };
    this.middlewareConfig = { ...DEFAULT_MIDDLEWARE_CONFIG, ...middlewareConfig };
    this.initializeProviderHealth();
  }

  static getInstance(
    gatewayConfig?: Partial<UnifiedGatewayConfig>,
    middlewareConfig?: Partial<MiddlewareConfig>
  ): UnifiedProviderSystem {
    if (!UnifiedProviderSystem.instance) {
      UnifiedProviderSystem.instance = new UnifiedProviderSystem(gatewayConfig, middlewareConfig);
    }
    return UnifiedProviderSystem.instance;
  }

  /**
   * Get optimal model based on requirements
   */
  async getOptimalModel(requirements: ModelRequirements): Promise<ModelSelection> {
    // Get healthy providers
    const healthyProviders = Array.from(this.providerHealth.entries())
      .filter(([_, health]) => health.status !== 'unhealthy')
      .map(([id]) => id);

    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Score models based on requirements
    const scoredModels = await this.scoreModels(requirements, healthyProviders);
    
    if (scoredModels.length === 0) {
      throw new Error('No suitable models found for requirements');
    }

    // Return best match
    const bestModel = scoredModels[0];
    const model = providerRegistry.languageModel(bestModel.modelId);
    
    return {
      provider: bestModel.provider,
      modelId: bestModel.modelId,
      model,
      reason: bestModel.reason,
      confidence: bestModel.confidence,
      fallbackOptions: this.buildFallbackChain(bestModel.modelId),
      estimatedCost: bestModel.estimatedCost,
      estimatedLatency: bestModel.estimatedLatency,
    };
  }

  /**
   * Get model by ID with enhanced features
   */
  async getEnhancedModel(config: EnhancedModelConfig = {}): Promise<LanguageModel> {
    if (config.modelId) {
      const model = providerRegistry.languageModel(config.modelId as SupportedModelId);
      
      if (!config.fallbackEnabled) {
        return model;
      }

      return this.wrapModelWithFeatures(model, config);
    }

    // Use optimal model selection
    const requirements: ModelRequirements = {
      task: config.task || 'chat',
      priority: config.priority || 'speed',
      complexity: config.complexity,
      capabilities: config.capabilities,
      maxCost: config.maxCost,
      maxLatency: config.maxLatency,
    };

    const selection = await this.getOptimalModel(requirements);
    return this.wrapModelWithFeatures(selection.model, config);
  }

  /**
   * Execute request with full middleware pipeline
   */
  async processRequest<T>(
    requirements: ModelRequirements,
    executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
    metadata?: GatewayRequestMetadata
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const context: RequestContext = {
      requestId,
      timestamp: new Date(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata,
      performance: {
        startTime: performance.now(),
      },
    };

    try {
      // Run request interceptors
      this.requestInterceptors.forEach(interceptor => interceptor(context));

      // Check cache if enabled
      if (this.middlewareConfig.enableCache) {
        const cacheKey = this.generateCacheKey(requirements, metadata);
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) {
          context.performance.endTime = performance.now();
          context.performance.duration = context.performance.endTime - context.performance.startTime;
          return cached;
        }
      }

      // Get model and execute
      const model = await this.getOptimalModel(requirements);
      const result = await this.executeWithRetryAndCircuitBreaker(
        model.modelId,
        () => executor(model.model, context)
      );

      // Update performance metrics
      context.performance.endTime = performance.now();
      context.performance.duration = context.performance.endTime - context.performance.startTime;

      // Cache result if enabled
      if (this.middlewareConfig.enableCache) {
        const cacheKey = this.generateCacheKey(requirements, metadata);
        this.setCache(cacheKey, result, this.middlewareConfig.cacheTTL);
      }

      // Run response interceptors
      this.responseInterceptors.forEach(interceptor => interceptor(context, result));

      // Update metrics
      this.updateProviderMetrics(model.provider, true, context.performance.duration!, model.estimatedCost);

      return result;
    } catch (error) {
      const errorInfo = unifiedErrorSystem.handleError(error, { requestId, requirements });
      
      // Run error interceptors
      this.errorInterceptors.forEach(interceptor => interceptor(context, errorInfo));

      // Update provider health and metrics
      const modelId = (error as any).modelId || 'unknown';
      const [provider] = modelId.split(':');
      this.updateProviderHealth(provider, false);
      this.updateProviderMetrics(provider, false, context.performance.duration, 0);

      throw error;
    }
  }

  /**
   * Execute aggregated request with multiple models
   */
  async processAggregatedRequest<T>(
    requirements: ModelRequirements,
    executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
    strategy: 'consensus' | 'best-of' | 'ensemble' = 'consensus',
    modelCount = 3
  ): Promise<T> {
    const healthyProviders = this.getHealthyProviders();
    const selectedModels = await this.selectMultipleModels(requirements, healthyProviders, modelCount);
    
    const promises = selectedModels.map(async (modelSelection, index) => {
      const context: RequestContext = {
        requestId: `${this.generateRequestId()}_${index}`,
        timestamp: new Date(),
        performance: {
          startTime: performance.now(),
        },
      };

      try {
        return await executor(modelSelection.model, context);
      } catch (error) {
        console.warn(`Aggregated request failed for model ${modelSelection.modelId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);

    if (validResults.length === 0) {
      throw new Error('All aggregated requests failed');
    }

    // Apply aggregation strategy
    switch (strategy) {
      case 'consensus':
        return this.applyConsensusStrategy(validResults);
      case 'best-of':
        return this.applyBestOfStrategy(validResults);
      case 'ensemble':
        return this.applyEnsembleStrategy(validResults);
      default:
        return validResults[0];
    }
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): ProviderHealth | null {
    return this.providerHealth.get(providerId) || null;
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): Map<string, ProviderHealth> {
    return new Map(this.providerHealth);
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(providerId: string): ProviderMetrics | null {
    return this.providerMetrics.get(providerId) || null;
  }

  /**
   * Get all provider metrics
   */
  getAllProviderMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.providerMetrics);
  }

  /**
   * Get model metrics
   */
  getModelMetrics(providerId: string, modelName: string): ProviderMetrics | null {
    return this.providerMetrics.get(`${providerId}:${modelName}`) || null;
  }

  /**
   * Get all model metrics
   */
  getAllModelMetrics(): Map<string, ProviderMetrics> {
    return new Map(Array.from(this.providerMetrics.entries())
      .filter(([key]) => key.includes(':')));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: number;
  } {
    const now = Date.now();
    let validEntries = 0;
    let totalEntries = this.cache.size;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp <= entry.ttl) {
        validEntries++;
      } else {
        this.cache.delete(key);
        totalEntries--;
      }
    }

    return {
      size: totalEntries,
      hitRate: validEntries / Math.max(totalEntries, 1),
      entries: validEntries,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Add middleware interceptors
   */
  addRequestInterceptor(interceptor: (context: RequestContext) => void): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: (context: RequestContext, response: any) => void): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: (context: RequestContext, error: UnifiedErrorInfo) => void): void {
    this.errorInterceptors.push(interceptor);
  }

  // Private helper methods

  private initializeProviderHealth(): void {
    for (const providerId of this.config.providers) {
      this.providerHealth.set(providerId, {
        status: 'healthy',
        responseTime: 0,
        successRate: 1.0,
        lastChecked: Date.now(),
        errorCount: 0,
        consecutiveFailures: 0,
      });

      this.providerMetrics.set(providerId, {
        requests: 0,
        successes: 0,
        failures: 0,
        totalLatency: 0,
        totalCost: 0,
        averageLatency: 0,
        averageCost: 0,
        successRate: 1.0,
        lastRequest: 0,
        lastSuccess: 0,
        lastFailure: 0,
      });

      this.circuitBreakers.set(providerId, {
        state: 'closed',
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }

  private async scoreModels(
    requirements: ModelRequirements,
    healthyProviders: string[]
  ): Promise<Array<{
    provider: string;
    modelId: SupportedModelId;
    reason: string;
    confidence: number;
    estimatedCost: number;
    estimatedLatency: number;
  }>> {
    const scored: Array<{
      provider: string;
      modelId: SupportedModelId;
      reason: string;
      confidence: number;
      estimatedCost: number;
      estimatedLatency: number;
    }> = [];

    // Model scoring logic based on requirements
    const modelConfigs: Record<SupportedModelId, {
      provider: string;
      capabilities: string[];
      speed: number;
      quality: number;
      cost: number;
      specialties: string[];
    }> = {
      'openai:fast': {
        provider: 'openai',
        capabilities: ['chat', 'code', 'analysis'],
        speed: 0.9,
        quality: 0.7,
        cost: 0.5,
        specialties: ['speed', 'general'],
      },
      'openai:code': {
        provider: 'openai',
        capabilities: ['code', 'analysis', 'debugging'],
        speed: 0.7,
        quality: 0.9,
        cost: 0.7,
        specialties: ['code', 'programming'],
      },
      'openai:premium': {
        provider: 'openai',
        capabilities: ['chat', 'code', 'analysis', 'reasoning'],
        speed: 0.6,
        quality: 0.95,
        cost: 0.9,
        specialties: ['quality', 'reasoning'],
      },
      'anthropic:fast': {
        provider: 'anthropic',
        capabilities: ['chat', 'analysis'],
        speed: 0.85,
        quality: 0.8,
        cost: 0.4,
        specialties: ['speed', 'chat'],
      },
      'anthropic:balanced': {
        provider: 'anthropic',
        capabilities: ['chat', 'code', 'analysis', 'creative'],
        speed: 0.7,
        quality: 0.85,
        cost: 0.6,
        specialties: ['balanced', 'creative'],
      },
      'anthropic:reasoning': {
        provider: 'anthropic',
        capabilities: ['reasoning', 'analysis', 'problem-solving'],
        speed: 0.5,
        quality: 0.95,
        cost: 0.8,
        specialties: ['reasoning', 'complex'],
      },
      'anthropic:creative': {
        provider: 'anthropic',
        capabilities: ['creative', 'storytelling', 'ideation'],
        speed: 0.6,
        quality: 0.9,
        cost: 0.7,
        specialties: ['creative', 'writing'],
      },
    };

    for (const [modelId, modelConfig] of Object.entries(modelConfigs) as Array<[SupportedModelId, any]>) {
      if (!healthyProviders.includes(modelConfig.provider)) {
        continue;
      }

      // Check if model supports required task
      if (!modelConfig.capabilities.includes(requirements.task)) {
        continue;
      }

      // Calculate score based on priority
      let score = 0;
      switch (requirements.priority) {
        case 'speed':
          score = modelConfig.speed * 0.7 + modelConfig.quality * 0.2 + (1 - modelConfig.cost) * 0.1;
          break;
        case 'quality':
          score = modelConfig.quality * 0.7 + modelConfig.speed * 0.2 + (1 - modelConfig.cost) * 0.1;
          break;
        case 'cost':
          score = (1 - modelConfig.cost) * 0.7 + modelConfig.speed * 0.2 + modelConfig.quality * 0.1;
          break;
      }

      // Bonus for specialty match
      if (modelConfig.specialties.includes(requirements.task) || 
          modelConfig.specialties.includes(requirements.priority)) {
        score += 0.1;
      }

      // Apply capability requirements
      if (requirements.capabilities) {
        const capabilityMatch = requirements.capabilities.every(cap => 
          modelConfig.capabilities.includes(cap));
        if (!capabilityMatch) {
          score *= 0.5;
        }
      }

      // Apply complexity requirements
      if (requirements.complexity === 'complex' && modelConfig.quality < 0.8) {
        score *= 0.7;
      }

      scored.push({
        provider: modelConfig.provider,
        modelId,
        reason: this.getSelectionReason(requirements, modelConfig),
        confidence: Math.min(score, 1.0),
        estimatedCost: modelConfig.cost * 0.001, // Base cost estimate
        estimatedLatency: (1 - modelConfig.speed) * 2000, // Latency estimate in ms
      });
    }

    return scored.sort((a, b) => b.confidence - a.confidence);
  }

  private getSelectionReason(requirements: ModelRequirements, modelConfig: any): string {
    const reasons: string[] = [];
    
    if (requirements.priority === 'speed' && modelConfig.speed > 0.8) {
      reasons.push('optimized for speed');
    }
    if (requirements.priority === 'quality' && modelConfig.quality > 0.8) {
      reasons.push('high quality output');
    }
    if (requirements.priority === 'cost' && modelConfig.cost < 0.5) {
      reasons.push('cost effective');
    }
    if (modelConfig.specialties.includes(requirements.task)) {
      reasons.push(`specialized for ${requirements.task}`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'best available option';
  }

  private buildFallbackChain(primaryModelId: SupportedModelId): SupportedModelId[] {
    const fallbackChains: Record<SupportedModelId, SupportedModelId[]> = {
      'openai:fast': ['anthropic:fast', 'openai:premium', 'anthropic:balanced'],
      'anthropic:fast': ['openai:fast', 'anthropic:balanced', 'openai:premium'],
      'openai:premium': ['anthropic:balanced', 'openai:fast', 'anthropic:reasoning'],
      'anthropic:balanced': ['openai:premium', 'anthropic:fast', 'openai:fast'],
      'openai:code': ['anthropic:balanced', 'openai:premium', 'anthropic:reasoning'],
      'anthropic:reasoning': ['openai:premium', 'anthropic:balanced', 'openai:code'],
      'anthropic:creative': ['openai:premium', 'anthropic:balanced', 'openai:fast'],
    };

    return fallbackChains[primaryModelId] || this.config.fallbackChain;
  }

  private wrapModelWithFeatures(model: LanguageModel, config: EnhancedModelConfig): LanguageModel {
    if (!config.fallbackEnabled && !config.aggregation) {
      return model;
    }

    return wrapLanguageModel({
      model: model as any,
      middleware: {
        wrapGenerate: async ({ doGenerate, params }) => {
          try {
            return await doGenerate(params);
          } catch (error) {
            if (config.fallbackEnabled) {
              // Implement fallback logic
              console.warn('Primary model failed, attempting fallback:', error);
              // This would use fallback chain
            }
            throw error;
          }
        },
      } as any,
    });
  }

  private async executeWithRetryAndCircuitBreaker<T>(
    modelId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const [provider] = modelId.split(':');
    const circuitBreaker = this.circuitBreakers.get(provider);

    if (circuitBreaker?.state === 'open') {
      if (Date.now() < circuitBreaker.nextAttemptTime) {
        throw new Error(`Circuit breaker open for ${provider}`);
      }
      // Try to move to half-open
      circuitBreaker.state = 'half-open';
    }

    try {
      const result = await unifiedErrorSystem.executeWithRetry(operation);
      
      // Success - reset circuit breaker
      if (circuitBreaker) {
        circuitBreaker.state = 'closed';
        circuitBreaker.failures = 0;
      }
      
      return result;
    } catch (error) {
      // Update circuit breaker on failure
      if (circuitBreaker) {
        circuitBreaker.failures++;
        circuitBreaker.lastFailureTime = Date.now();
        
        if (circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
          circuitBreaker.state = 'open';
          circuitBreaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
        }
      }
      
      throw error;
    }
  }

  private getHealthyProviders(): string[] {
    return Array.from(this.providerHealth.entries())
      .filter(([_, health]) => health.status !== 'unhealthy')
      .map(([id]) => id);
  }

  private async selectMultipleModels(
    requirements: ModelRequirements,
    healthyProviders: string[],
    count: number
  ): Promise<ModelSelection[]> {
    const scoredModels = await this.scoreModels(requirements, healthyProviders);
    return scoredModels.slice(0, count).map(scored => ({
      provider: scored.provider,
      modelId: scored.modelId,
      model: providerRegistry.languageModel(scored.modelId),
      reason: scored.reason,
      confidence: scored.confidence,
      fallbackOptions: this.buildFallbackChain(scored.modelId),
      estimatedCost: scored.estimatedCost,
      estimatedLatency: scored.estimatedLatency,
    }));
  }

  private applyConsensusStrategy<T>(results: T[]): T {
    // Simple majority vote - in practice would be more sophisticated
    return results[0];
  }

  private applyBestOfStrategy<T>(results: T[]): T {
    // Return first result - in practice would score results
    return results[0];
  }

  private applyEnsembleStrategy<T>(results: T[]): T {
    // Combine results - in practice would merge appropriately
    return results[0];
  }

  private updateProviderHealth(providerId: string, success: boolean): void {
    const health = this.providerHealth.get(providerId);
    if (!health) return;

    health.lastChecked = Date.now();
    
    if (success) {
      health.consecutiveFailures = 0;
      health.successRate = Math.min(health.successRate * 0.95 + 0.05, 1.0);
    } else {
      health.consecutiveFailures++;
      health.errorCount++;
      health.successRate = Math.max(health.successRate * 0.95, 0.0);
    }

    // Update status
    if (health.successRate < 0.5) {
      health.status = 'unhealthy';
    } else if (health.successRate < 0.8) {
      health.status = 'degraded';
    } else {
      health.status = 'healthy';
    }
  }

  private updateProviderMetrics(
    providerId: string, 
    success: boolean, 
    duration?: number, 
    cost?: number
  ): void {
    const metrics = this.providerMetrics.get(providerId);
    if (!metrics) return;

    metrics.requests++;
    
    if (success) {
      metrics.successes++;
      metrics.lastSuccess = Date.now();
    } else {
      metrics.failures++;
      metrics.lastFailure = Date.now();
    }

    if (duration !== undefined) {
      metrics.totalLatency += duration;
      metrics.averageLatency = metrics.totalLatency / metrics.requests;
    }

    if (cost !== undefined) {
      metrics.totalCost += cost;
      metrics.averageCost = metrics.totalCost / metrics.requests;
    }

    metrics.successRate = metrics.successes / metrics.requests;
    metrics.lastRequest = Date.now();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(requirements: ModelRequirements, metadata?: GatewayRequestMetadata): string {
    return `cache_${JSON.stringify(requirements)}_${JSON.stringify(metadata)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
}

// Export singleton instances
export const unifiedProviderSystem = UnifiedProviderSystem.getInstance();

// Convenience functions for backward compatibility

export async function getGatewayModel(
  requirements: ModelRequirements,
  metadata?: LanguageModelRequestMetadata
): Promise<LanguageModel> {
  const selection = await unifiedProviderSystem.getOptimalModel(requirements);
  return selection.model;
}

export async function executeWithGateway<T>(
  requirements: ModelRequirements,
  executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
  metadata?: LanguageModelRequestMetadata
): Promise<T> {
  return unifiedProviderSystem.processRequest(requirements, executor, metadata);
}

export async function executeAggregated<T>(
  requirements: ModelRequirements,
  executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
  strategy: 'consensus' | 'best-of' | 'ensemble' = 'consensus',
  modelCount = 3
): Promise<T> {
  return unifiedProviderSystem.processAggregatedRequest(requirements, executor, strategy, modelCount);
}

export function getRequirementsForTask(
  task: 'chat' | 'code' | 'analysis' | 'creative' | 'reasoning',
  options?: {
    priority?: 'speed' | 'quality' | 'cost';
    complexity?: 'simple' | 'moderate' | 'complex';
    capabilities?: string[];
    maxCost?: number;
    maxLatency?: number;
  }
): ModelRequirements {
  const defaults: Record<string, Partial<ModelRequirements>> = {
    chat: {
      task: 'chat',
      priority: 'speed',
      complexity: 'simple',
      capabilities: ['chat', 'multi-turn'],
    },
    code: {
      task: 'code',
      priority: 'quality',
      complexity: 'moderate',
      capabilities: ['code', 'syntax-aware'],
    },
    analysis: {
      task: 'analysis',
      priority: 'quality',
      complexity: 'complex',
      capabilities: ['analysis', 'reasoning'],
    },
    creative: {
      task: 'creative',
      priority: 'quality',
      complexity: 'moderate',
      capabilities: ['creative', 'storytelling'],
    },
    reasoning: {
      task: 'reasoning',
      priority: 'quality',
      complexity: 'complex',
      capabilities: ['reasoning', 'step-by-step'],
    },
  };

  return {
    ...defaults[task],
    ...options,
    task: task as ModelRequirements['task'],
  } as ModelRequirements;
}

// Quick access functions
export const models = {
  fast: () => unifiedProviderSystem.getEnhancedModel({ 
    priority: 'speed',
    task: 'chat'
  }),
  code: () => unifiedProviderSystem.getEnhancedModel({ 
    task: 'code'
  }),
  creative: () => unifiedProviderSystem.getEnhancedModel({ 
    task: 'creative'
  }),
  reasoning: () => unifiedProviderSystem.getEnhancedModel({ 
    task: 'reasoning'
  }),
  analysis: () => unifiedProviderSystem.getEnhancedModel({ 
    task: 'analysis'
  }),
  cheap: () => unifiedProviderSystem.getEnhancedModel({ 
    priority: 'cost',
    task: 'chat'
  }),
  premium: () => unifiedProviderSystem.getEnhancedModel({ 
    priority: 'quality',
    task: 'chat'
  }),
};

// Health and statistics functions
export async function checkGatewayHealth() {
  const statuses = unifiedProviderSystem.getAllProviderStatuses();
  const healthy = Array.from(statuses.values()).filter(s => s.status === 'healthy').length;
  const total = statuses.size;

  return {
    healthy,
    total,
    percentage: total > 0 ? (healthy / total) * 100 : 0,
    providers: Object.fromEntries(statuses),
  };
}

export function getGatewayStats() {
  return {
    providers: Object.fromEntries(unifiedProviderSystem.getAllProviderMetrics()),
    models: Object.fromEntries(unifiedProviderSystem.getAllModelMetrics()),
    cache: unifiedProviderSystem.getCacheStats(),
    circuitBreakers: Object.fromEntries(unifiedProviderSystem.getCircuitBreakerStatus()),
  };
}

export function clearGatewayCache() {
  unifiedProviderSystem.clearCache();
}

// Export system prompts for consistency
export { systemPrompts };