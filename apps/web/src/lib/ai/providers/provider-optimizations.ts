import { logError as logErrorToConsole } from '@/lib/logger';
import {
  LoadBalancer,
  type LoadBalancingStrategy,
  type ProviderSelection,
} from '../routing/load-balancing';
import {
  type ModelMetrics,
  type ProviderMetrics,
  ProviderMetricsService,
} from './provider-metrics';

// Logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Provider optimization strategies
export type OptimizationStrategy =
  | 'cost-first'
  | 'performance-first'
  | 'balanced'
  | 'reliability-first'
  | 'adaptive-ml'
  | 'context-aware';

// Provider capability definitions
export interface ProviderCapability {
  providerId: string;
  modelSupport: string[];
  maxBatchSize: number;
  maxTokensPerRequest: number;
  maxConcurrentRequests: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  costTier: 'low' | 'medium' | 'high';
  latencyTier: 'fast' | 'medium' | 'slow';
  reliabilityTier: 'high' | 'medium' | 'low';
}

// Optimization configuration
export interface OptimizationConfig {
  strategy: OptimizationStrategy;
  weights: {
    cost: number; // 0-1
    performance: number; // 0-1
    reliability: number; // 0-1
    accuracy: number; // 0-1
  };
  constraints: {
    maxLatency?: number; // milliseconds
    maxCostPerRequest?: number; // dollars
    minReliability?: number; // 0-1
    requiredCapabilities?: string[];
  };
  learningEnabled: boolean;
  adaptiveThresholds: boolean;
}

// Provider optimization result
export interface OptimizationResult {
  selectedProvider: string;
  selectedModel: string;
  reason: string;
  confidence: number;
  expectedLatency: number;
  expectedCost: number;
  fallbackProviders: string[];
  optimizations: OptimizationApplied[];
}

// Applied optimization details
export interface OptimizationApplied {
  type: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metrics?: Record<string, number>;
}

// Request context for optimization
export interface RequestContext {
  requestType: 'chat' | 'completion' | 'embedding' | 'image' | 'tool-use';
  priority: 'low' | 'medium' | 'high' | 'critical';
  userTier: 'free' | 'pro' | 'enterprise';
  expectedTokens?: number;
  requiresStreaming?: boolean;
  requiresTools?: boolean;
  requiresVision?: boolean;
  sessionId?: string;
  userId?: string;
  timeout?: number;
  budgetConstraint?: number;
  metadata?: Record<string, any>;
}

/**
 * Advanced Provider Optimization Engine
 * Implements ML-based provider selection with context awareness
 */
export class ProviderOptimizationEngine {
  private static instance: ProviderOptimizationEngine;
  private metricsService: ProviderMetricsService;
  private loadBalancer: LoadBalancer;
  private config: OptimizationConfig;
  private capabilities: Map<string, ProviderCapability> = new Map();
  private learningData: Array<{
    context: RequestContext;
    selection: string;
    actualPerformance: {
      latency: number;
      cost: number;
      success: boolean;
    };
    timestamp: number;
  }> = [];

  // Machine Learning State
  private providerScores: Map<string, number> = new Map();
  private contextPatterns: Map<string, ProviderSelection> = new Map();
  private performancePredictions: Map<
    string,
    {
      latency: number;
      cost: number;
      reliability: number;
      confidence: number;
    }
  > = new Map();

  private constructor(config?: Partial<OptimizationConfig>) {
    this.metricsService = ProviderMetricsService.getInstance();
    this.loadBalancer = new LoadBalancer('adaptive');
    this.config = {
      strategy: 'adaptive-ml',
      weights: {
        cost: 0.25,
        performance: 0.35,
        reliability: 0.25,
        accuracy: 0.15,
      },
      constraints: {
        maxLatency: 5000,
        maxCostPerRequest: 0.1,
        minReliability: 0.95,
      },
      learningEnabled: true,
      adaptiveThresholds: true,
      ...config,
    };

    this.initializeProviderCapabilities();
    this.startLearningLoop();

    loggingService.info('Provider Optimization Engine initialized', {
      strategy: this.config.strategy,
      learningEnabled: this.config.learningEnabled,
    });
  }

  static getInstance(
    config?: Partial<OptimizationConfig>
  ): ProviderOptimizationEngine {
    if (!ProviderOptimizationEngine.instance) {
      ProviderOptimizationEngine.instance = new ProviderOptimizationEngine(
        config
      );
    }
    return ProviderOptimizationEngine.instance;
  }

  /**
   * Main optimization method - selects optimal provider and model
   */
  async optimizeProviderSelection(
    availableProviders: string[],
    requestContext: RequestContext,
    modelRequirements?: {
      modelType?: string;
      minCapability?: string;
      preferredModels?: string[];
    }
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      // Filter providers by capabilities
      const capableProviders = this.filterByCapabilities(
        availableProviders,
        requestContext
      );

      if (capableProviders.length === 0) {
        throw new Error('No providers meet the required capabilities');
      }

      // Apply optimization strategy
      let result: OptimizationResult;

      switch (this.config.strategy) {
        case 'adaptive-ml':
          result = await this.applyMLOptimization(
            capableProviders,
            requestContext,
            modelRequirements
          );
          break;
        case 'context-aware':
          result = await this.applyContextAwareOptimization(
            capableProviders,
            requestContext
          );
          break;
        case 'cost-first':
          result = await this.applyCostFirstOptimization(
            capableProviders,
            requestContext
          );
          break;
        case 'performance-first':
          result = await this.applyPerformanceFirstOptimization(
            capableProviders,
            requestContext
          );
          break;
        case 'reliability-first':
          result = await this.applyReliabilityFirstOptimization(
            capableProviders,
            requestContext
          );
          break;
        default:
          result = await this.applyBalancedOptimization(
            capableProviders,
            requestContext
          );
      }

      // Apply post-optimization enhancements
      result = await this.applyPostOptimizations(result, requestContext);

      const optimizationTime = Date.now() - startTime;
      loggingService.debug('Provider optimization completed', {
        strategy: this.config.strategy,
        selected: result.selectedProvider,
        optimizationTime,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      loggingService.error('Provider optimization failed', error);

      // Fallback to simple load balancing
      const fallbackSelection = await this.loadBalancer.selectProvider(
        availableProviders,
        requestContext
      );

      return {
        selectedProvider: fallbackSelection.providerId,
        selectedModel: this.getDefaultModelForProvider(
          fallbackSelection.providerId
        ),
        reason: `Fallback selection: ${fallbackSelection.reason}`,
        confidence: 0.5,
        expectedLatency: 2000,
        expectedCost: 0.01,
        fallbackProviders: availableProviders.filter(
          (p) => p !== fallbackSelection.providerId
        ),
        optimizations: [
          {
            type: 'fallback',
            description:
              'Applied fallback provider selection due to optimization failure',
            impact: 'medium',
          },
        ],
      };
    }
  }

  /**
   * Record actual performance for learning
   */
  recordActualPerformance(
    providerId: string,
    requestContext: RequestContext,
    actualPerformance: {
      latency: number;
      cost: number;
      success: boolean;
      errorType?: string;
    }
  ): void {
    if (!this.config.learningEnabled) return;

    this.learningData.push({
      context: requestContext,
      selection: providerId,
      actualPerformance,
      timestamp: Date.now(),
    });

    // Limit learning data size
    if (this.learningData.length > 10_000) {
      this.learningData = this.learningData.slice(-5000);
    }

    // Update predictions
    this.updatePerformancePredictions(
      providerId,
      requestContext,
      actualPerformance
    );

    loggingService.debug('Recorded performance data for learning', {
      providerId,
      performance: actualPerformance,
    });
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    loggingService.info('Optimization configuration updated', newConfig);
  }

  /**
   * Get optimization insights and statistics
   */
  getOptimizationInsights(): {
    totalOptimizations: number;
    averageConfidence: number;
    topPerformingProviders: Array<{ providerId: string; score: number }>;
    learningDataSize: number;
    recentAccuracy: number;
  } {
    const scores = Array.from(this.providerScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([providerId, score]) => ({ providerId, score }));

    const recentPredictions = this.learningData.slice(-100);
    const accuracyScore =
      recentPredictions.length > 0
        ? recentPredictions.filter((d) => d.actualPerformance.success).length /
          recentPredictions.length
        : 0;

    return {
      totalOptimizations: this.learningData.length,
      averageConfidence: this.calculateAverageConfidence(),
      topPerformingProviders: scores,
      learningDataSize: this.learningData.length,
      recentAccuracy: accuracyScore,
    };
  }

  // Private optimization methods

  private async applyMLOptimization(
    providers: string[],
    context: RequestContext,
    modelRequirements?: any
  ): Promise<OptimizationResult> {
    const scores = new Map<string, number>();

    for (const providerId of providers) {
      const score = await this.calculateMLScore(providerId, context);
      scores.set(providerId, score);
    }

    const bestProvider = Array.from(scores.entries()).sort(
      ([, a], [, b]) => b - a
    )[0];

    const prediction = this.performancePredictions.get(bestProvider[0]);
    const selectedModel = this.selectOptimalModel(
      bestProvider[0],
      context,
      modelRequirements
    );

    return {
      selectedProvider: bestProvider[0],
      selectedModel,
      reason: `ML-optimized selection (score: ${bestProvider[1].toFixed(3)})`,
      confidence: prediction?.confidence || 0.8,
      expectedLatency: prediction?.latency || 1500,
      expectedCost: prediction?.cost || 0.005,
      fallbackProviders: providers.filter((p) => p !== bestProvider[0]),
      optimizations: [
        {
          type: 'ml-optimization',
          description: 'Applied machine learning based provider selection',
          impact: 'high',
          metrics: { mlScore: bestProvider[1] },
        },
      ],
    };
  }

  private async applyContextAwareOptimization(
    providers: string[],
    context: RequestContext
  ): Promise<OptimizationResult> {
    const contextKey = this.generateContextKey(context);
    const cachedSelection = this.contextPatterns.get(contextKey);

    if (cachedSelection && providers.includes(cachedSelection.providerId)) {
      return {
        selectedProvider: cachedSelection.providerId,
        selectedModel: this.getDefaultModelForProvider(
          cachedSelection.providerId
        ),
        reason: `Context-aware cached selection: ${cachedSelection.reason}`,
        confidence: 0.9,
        expectedLatency: 1200,
        expectedCost: 0.004,
        fallbackProviders: providers.filter(
          (p) => p !== cachedSelection.providerId
        ),
        optimizations: [
          {
            type: 'context-caching',
            description: 'Used cached context-aware selection',
            impact: 'medium',
          },
        ],
      };
    }

    // Fallback to balanced optimization
    return this.applyBalancedOptimization(providers, context);
  }

  private async applyCostFirstOptimization(
    providers: string[],
    context: RequestContext
  ): Promise<OptimizationResult> {
    let bestProvider = providers[0];
    let lowestCost = Number.POSITIVE_INFINITY;

    for (const providerId of providers) {
      const metrics = this.metricsService.getProviderMetrics(providerId);
      const cost = metrics.costTracking.costPerRequest || 0.01;

      if (cost < lowestCost) {
        lowestCost = cost;
        bestProvider = providerId;
      }
    }

    return {
      selectedProvider: bestProvider,
      selectedModel: this.getDefaultModelForProvider(bestProvider),
      reason: `Cost-optimized selection ($${lowestCost.toFixed(4)}/request)`,
      confidence: 0.85,
      expectedLatency: 2000,
      expectedCost: lowestCost,
      fallbackProviders: providers.filter((p) => p !== bestProvider),
      optimizations: [
        {
          type: 'cost-optimization',
          description: 'Selected lowest cost provider',
          impact: 'high',
          metrics: { costPerRequest: lowestCost },
        },
      ],
    };
  }

  private async applyPerformanceFirstOptimization(
    providers: string[],
    context: RequestContext
  ): Promise<OptimizationResult> {
    let bestProvider = providers[0];
    let lowestLatency = Number.POSITIVE_INFINITY;

    for (const providerId of providers) {
      const metrics = this.metricsService.getProviderMetrics(providerId);
      const latency = metrics.p50Latency || metrics.averageLatency || 5000;

      if (latency < lowestLatency) {
        lowestLatency = latency;
        bestProvider = providerId;
      }
    }

    return {
      selectedProvider: bestProvider,
      selectedModel: this.getDefaultModelForProvider(bestProvider),
      reason: `Performance-optimized selection (${Math.round(lowestLatency)}ms)`,
      confidence: 0.88,
      expectedLatency: lowestLatency,
      expectedCost: 0.008,
      fallbackProviders: providers.filter((p) => p !== bestProvider),
      optimizations: [
        {
          type: 'performance-optimization',
          description: 'Selected fastest provider',
          impact: 'high',
          metrics: { expectedLatency: lowestLatency },
        },
      ],
    };
  }

  private async applyReliabilityFirstOptimization(
    providers: string[],
    context: RequestContext
  ): Promise<OptimizationResult> {
    let bestProvider = providers[0];
    let highestReliability = 0;

    for (const providerId of providers) {
      const metrics = this.metricsService.getProviderMetrics(providerId);
      const reliability =
        metrics.totalRequests > 0
          ? metrics.successCount / metrics.totalRequests
          : 0.5;

      if (reliability > highestReliability) {
        highestReliability = reliability;
        bestProvider = providerId;
      }
    }

    return {
      selectedProvider: bestProvider,
      selectedModel: this.getDefaultModelForProvider(bestProvider),
      reason: `Reliability-optimized selection (${(highestReliability * 100).toFixed(1)}% success)`,
      confidence: 0.92,
      expectedLatency: 1800,
      expectedCost: 0.006,
      fallbackProviders: providers.filter((p) => p !== bestProvider),
      optimizations: [
        {
          type: 'reliability-optimization',
          description: 'Selected most reliable provider',
          impact: 'high',
          metrics: { successRate: highestReliability },
        },
      ],
    };
  }

  private async applyBalancedOptimization(
    providers: string[],
    context: RequestContext
  ): Promise<OptimizationResult> {
    const scores = new Map<string, number>();

    for (const providerId of providers) {
      const score = this.calculateBalancedScore(providerId, context);
      scores.set(providerId, score);
    }

    const bestProvider = Array.from(scores.entries()).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      selectedProvider: bestProvider[0],
      selectedModel: this.getDefaultModelForProvider(bestProvider[0]),
      reason: `Balanced optimization (score: ${bestProvider[1].toFixed(3)})`,
      confidence: 0.82,
      expectedLatency: 1600,
      expectedCost: 0.007,
      fallbackProviders: providers.filter((p) => p !== bestProvider[0]),
      optimizations: [
        {
          type: 'balanced-optimization',
          description: 'Applied balanced multi-factor optimization',
          impact: 'medium',
          metrics: { balancedScore: bestProvider[1] },
        },
      ],
    };
  }

  private async applyPostOptimizations(
    result: OptimizationResult,
    context: RequestContext
  ): Promise<OptimizationResult> {
    const optimizations = [...result.optimizations];

    // Apply batching optimization if applicable
    if (context.expectedTokens && context.expectedTokens > 1000) {
      const capability = this.capabilities.get(result.selectedProvider);
      if (capability?.maxBatchSize && capability.maxBatchSize > 1) {
        optimizations.push({
          type: 'batching',
          description: `Enabled batching (max: ${capability.maxBatchSize})`,
          impact: 'medium',
          metrics: { maxBatchSize: capability.maxBatchSize },
        });
      }
    }

    // Apply caching optimization
    if (context.sessionId) {
      optimizations.push({
        type: 'session-caching',
        description: 'Enabled session-based caching',
        impact: 'low',
      });
    }

    // Apply streaming optimization
    if (context.requiresStreaming) {
      const capability = this.capabilities.get(result.selectedProvider);
      if (capability?.supportsStreaming) {
        optimizations.push({
          type: 'streaming',
          description: 'Enabled streaming response',
          impact: 'medium',
        });
      }
    }

    return {
      ...result,
      optimizations,
    };
  }

  // Helper methods

  private filterByCapabilities(
    providers: string[],
    context: RequestContext
  ): string[] {
    return providers.filter((providerId) => {
      const capability = this.capabilities.get(providerId);
      if (!capability) return true; // Allow unknown providers

      // Check streaming requirement
      if (context.requiresStreaming && !capability.supportsStreaming) {
        return false;
      }

      // Check tools requirement
      if (context.requiresTools && !capability.supportsTools) {
        return false;
      }

      // Check vision requirement
      if (context.requiresVision && !capability.supportsVision) {
        return false;
      }

      // Check token limits
      if (
        context.expectedTokens &&
        context.expectedTokens > capability.maxTokensPerRequest
      ) {
        return false;
      }

      return true;
    });
  }

  private async calculateMLScore(
    providerId: string,
    context: RequestContext
  ): Promise<number> {
    const metrics = this.metricsService.getProviderMetrics(providerId);
    const capability = this.capabilities.get(providerId);

    // Base scores
    const performanceScore = this.calculatePerformanceScore(metrics);
    const reliabilityScore =
      metrics.totalRequests > 0
        ? metrics.successCount / metrics.totalRequests
        : 0.5;
    const costScore = this.calculateCostScore(metrics);

    // Context-based adjustments
    let contextMultiplier = 1.0;

    if (context.priority === 'critical') {
      contextMultiplier *= 1.2; // Boost for critical requests
    }

    if (context.userTier === 'enterprise') {
      contextMultiplier *= 1.1; // Slight boost for enterprise
    }

    if (capability) {
      // Boost score if provider has required capabilities
      if (context.requiresStreaming && capability.supportsStreaming) {
        contextMultiplier *= 1.05;
      }
      if (context.requiresTools && capability.supportsTools) {
        contextMultiplier *= 1.05;
      }
    }

    // Weighted composite score
    const compositeScore =
      performanceScore * this.config.weights.performance +
      reliabilityScore * this.config.weights.reliability +
      costScore * this.config.weights.cost;

    return compositeScore * contextMultiplier;
  }

  private calculateBalancedScore(
    providerId: string,
    context: RequestContext
  ): number {
    const metrics = this.metricsService.getProviderMetrics(providerId);

    const performanceScore = this.calculatePerformanceScore(metrics);
    const reliabilityScore =
      metrics.totalRequests > 0
        ? metrics.successCount / metrics.totalRequests
        : 0.5;
    const costScore = this.calculateCostScore(metrics);

    // Equal weighting for balanced approach
    return (performanceScore + reliabilityScore + costScore) / 3;
  }

  private calculatePerformanceScore(metrics: ProviderMetrics): number {
    const latency = metrics.p50Latency || metrics.averageLatency || 2000;
    // Convert to 0-1 score
    if (latency <= 500) return 1.0;
    if (latency >= 5000) return 0.1;
    return 1.0 - (latency - 500) / 4500;
  }

  private calculateCostScore(metrics: ProviderMetrics): number {
    const cost = metrics.costTracking.costPerRequest || 0.005;
    // Inverse relationship - lower cost = higher score
    if (cost <= 0.001) return 1.0;
    if (cost >= 0.05) return 0.1;
    return 1.0 - Math.log10(cost * 200) / 2;
  }

  private selectOptimalModel(
    providerId: string,
    context: RequestContext,
    requirements?: any
  ): string {
    const capability = this.capabilities.get(providerId);

    if (requirements?.preferredModels) {
      for (const model of requirements.preferredModels) {
        if (capability?.modelSupport.includes(model)) {
          return model;
        }
      }
    }

    // Default model selection based on context
    switch (context.requestType) {
      case 'chat':
        return this.getDefaultChatModel(providerId);
      case 'embedding':
        return this.getDefaultEmbeddingModel(providerId);
      case 'image':
        return this.getDefaultImageModel(providerId);
      default:
        return this.getDefaultModelForProvider(providerId);
    }
  }

  private getDefaultModelForProvider(providerId: string): string {
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      google: 'gemini-pro',
      cohere: 'command-r',
      mistral: 'mistral-small',
    };

    return defaultModels[providerId] || 'gpt-4o-mini';
  }

  private getDefaultChatModel(providerId: string): string {
    const chatModels: Record<string, string> = {
      openai: 'gpt-4o',
      anthropic: 'claude-3-5-sonnet-20241022',
      google: 'gemini-pro',
      cohere: 'command-r-plus',
    };

    return (
      chatModels[providerId] || this.getDefaultModelForProvider(providerId)
    );
  }

  private getDefaultEmbeddingModel(providerId: string): string {
    const embeddingModels: Record<string, string> = {
      openai: 'text-embedding-3-large',
      cohere: 'embed-english-v3.0',
      google: 'text-embedding-004',
    };

    return embeddingModels[providerId] || 'text-embedding-3-small';
  }

  private getDefaultImageModel(providerId: string): string {
    const imageModels: Record<string, string> = {
      openai: 'dall-e-3',
      anthropic: 'claude-3-opus-20240229', // Vision model
    };

    return imageModels[providerId] || 'dall-e-3';
  }

  private generateContextKey(context: RequestContext): string {
    return `${context.requestType}:${context.priority}:${context.userTier}:${context.requiresStreaming}`;
  }

  private updatePerformancePredictions(
    providerId: string,
    context: RequestContext,
    actual: { latency: number; cost: number; success: boolean }
  ): void {
    const current = this.performancePredictions.get(providerId) || {
      latency: 2000,
      cost: 0.01,
      reliability: 0.5,
      confidence: 0.5,
    };

    // Simple exponential smoothing
    const alpha = 0.3;
    current.latency = alpha * actual.latency + (1 - alpha) * current.latency;
    current.cost = alpha * actual.cost + (1 - alpha) * current.cost;
    current.reliability =
      alpha * (actual.success ? 1 : 0) + (1 - alpha) * current.reliability;
    current.confidence = Math.min(1.0, current.confidence + 0.1);

    this.performancePredictions.set(providerId, current);
  }

  private calculateAverageConfidence(): number {
    if (this.performancePredictions.size === 0) return 0.5;

    const confidences = Array.from(this.performancePredictions.values()).map(
      (p) => p.confidence
    );

    return (
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
    );
  }

  private initializeProviderCapabilities(): void {
    // Initialize known provider capabilities
    const knownCapabilities: ProviderCapability[] = [
      {
        providerId: 'openai',
        modelSupport: [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4',
          'text-embedding-3-large',
          'dall-e-3',
        ],
        maxBatchSize: 20,
        maxTokensPerRequest: 128_000,
        maxConcurrentRequests: 100,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsEmbeddings: true,
        costTier: 'medium',
        latencyTier: 'fast',
        reliabilityTier: 'high',
      },
      {
        providerId: 'anthropic',
        modelSupport: [
          'claude-3-5-sonnet-20241022',
          'claude-3-haiku-20240307',
          'claude-3-opus-20240229',
        ],
        maxBatchSize: 10,
        maxTokensPerRequest: 200_000,
        maxConcurrentRequests: 50,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsEmbeddings: false,
        costTier: 'high',
        latencyTier: 'medium',
        reliabilityTier: 'high',
      },
      {
        providerId: 'google',
        modelSupport: ['gemini-pro', 'gemini-pro-vision', 'text-embedding-004'],
        maxBatchSize: 5,
        maxTokensPerRequest: 1_000_000,
        maxConcurrentRequests: 30,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsEmbeddings: true,
        costTier: 'low',
        latencyTier: 'medium',
        reliabilityTier: 'medium',
      },
    ];

    knownCapabilities.forEach((capability) => {
      this.capabilities.set(capability.providerId, capability);
    });

    loggingService.info('Provider capabilities initialized', {
      count: this.capabilities.size,
    });
  }

  private startLearningLoop(): void {
    if (!this.config.learningEnabled) return;

    // Run learning updates every 5 minutes
    setInterval(
      () => {
        this.updateProviderScores();
        this.updateContextPatterns();
        this.cleanupOldLearningData();
      },
      5 * 60 * 1000
    );

    loggingService.info('Learning loop started');
  }

  private updateProviderScores(): void {
    // Simple provider scoring based on recent performance
    const recentData = this.learningData.slice(-1000);
    const providerPerformance = new Map<
      string,
      {
        successCount: number;
        totalCount: number;
        avgLatency: number;
        avgCost: number;
      }
    >();

    for (const data of recentData) {
      const current = providerPerformance.get(data.selection) || {
        successCount: 0,
        totalCount: 0,
        avgLatency: 0,
        avgCost: 0,
      };

      current.totalCount++;
      if (data.actualPerformance.success) {
        current.successCount++;
      }
      current.avgLatency =
        (current.avgLatency * (current.totalCount - 1) +
          data.actualPerformance.latency) /
        current.totalCount;
      current.avgCost =
        (current.avgCost * (current.totalCount - 1) +
          data.actualPerformance.cost) /
        current.totalCount;

      providerPerformance.set(data.selection, current);
    }

    // Calculate scores
    for (const [providerId, perf] of providerPerformance) {
      const successRate = perf.successCount / perf.totalCount;
      const latencyScore = Math.max(0, 1 - perf.avgLatency / 5000);
      const costScore = Math.max(0, 1 - perf.avgCost / 0.1);

      const overallScore =
        successRate * 0.4 + latencyScore * 0.3 + costScore * 0.3;
      this.providerScores.set(providerId, overallScore);
    }
  }

  private updateContextPatterns(): void {
    // Group learning data by context patterns
    const contextGroups = new Map<string, typeof this.learningData>();

    for (const data of this.learningData.slice(-5000)) {
      const contextKey = this.generateContextKey(data.context);
      const group = contextGroups.get(contextKey) || [];
      group.push(data);
      contextGroups.set(contextKey, group);
    }

    // Find best provider for each context pattern
    for (const [contextKey, group] of contextGroups) {
      if (group.length < 10) continue; // Need sufficient data

      const providerStats = new Map<
        string,
        { success: number; total: number }
      >();

      for (const data of group) {
        const stats = providerStats.get(data.selection) || {
          success: 0,
          total: 0,
        };
        stats.total++;
        if (data.actualPerformance.success) {
          stats.success++;
        }
        providerStats.set(data.selection, stats);
      }

      // Find best provider for this context
      let bestProvider = '';
      let bestSuccessRate = 0;

      for (const [providerId, stats] of providerStats) {
        const successRate = stats.success / stats.total;
        if (successRate > bestSuccessRate && stats.total >= 5) {
          bestSuccessRate = successRate;
          bestProvider = providerId;
        }
      }

      if (bestProvider) {
        this.contextPatterns.set(contextKey, {
          providerId: bestProvider,
          reason: `Context pattern match (${(bestSuccessRate * 100).toFixed(1)}% success)`,
          score: bestSuccessRate,
        });
      }
    }
  }

  private cleanupOldLearningData(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    this.learningData = this.learningData.filter(
      (data) => now - data.timestamp < maxAge
    );
  }
}

// Export convenience functions
export const createOptimizationEngine = (
  config?: Partial<OptimizationConfig>
) => {
  return ProviderOptimizationEngine.getInstance(config);
};

export const optimizeProvider = async (
  availableProviders: string[],
  requestContext: RequestContext,
  modelRequirements?: any
) => {
  const engine = ProviderOptimizationEngine.getInstance();
  return engine.optimizeProviderSelection(
    availableProviders,
    requestContext,
    modelRequirements
  );
};

// Export singleton
export const providerOptimizationEngine =
  ProviderOptimizationEngine.getInstance();
