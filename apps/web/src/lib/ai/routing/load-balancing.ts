import { logError as logErrorToConsole } from '@/lib/logger';
import {
  type ModelCapability,
  ModelCapabilityMapper,
} from '../intelligence/model-capability-mapper';
import {
  type ProviderMetrics,
  ProviderMetricsService,
} from '../providers/provider-metrics';
import {
  type OptimizationResult,
  ProviderOptimizationEngine,
  type RequestContext,
} from '../providers/provider-optimizations';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Load balancing strategy types (enhanced with optimization awareness)
export type LoadBalancingStrategy =
  | 'round-robin'
  | 'least-latency'
  | 'cost-optimized'
  | 'weighted'
  | 'sticky-session'
  | 'health-based'
  | 'adaptive'
  | 'optimization-aware'
  | 'intelligent-routing'
  | 'capability-based';

// Provider selection result
export interface ProviderSelection {
  providerId: string;
  reason: string;
  score: number;
  metadata?: Record<string, any>;
}

// Session affinity data
export interface SessionAffinity {
  sessionId: string;
  providerId: string;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
}

// Weight configuration for providers
export interface ProviderWeight {
  providerId: string;
  weight: number;
  reason?: string;
}

// Enhanced load balancer configuration with optimization awareness
export interface LoadBalancerConfig {
  sessionAffinityTTL?: number; // milliseconds
  adaptiveWindowSize?: number; // number of requests
  costWeight?: number; // 0-1, importance of cost in decisions
  performanceWeight?: number; // 0-1, importance of performance
  reliabilityWeight?: number; // 0-1, importance of reliability

  // Optimization-aware features
  enableOptimizationIntegration?: boolean;
  optimizationConfidenceThreshold?: number; // 0-1, minimum confidence to use optimization
  fallbackStrategy?: LoadBalancingStrategy;
  capabilityFiltering?: boolean;
  intelligentFallback?: boolean;
  learningEnabled?: boolean;
  dynamicWeightAdjustment?: boolean;
}

/**
 * Abstract base class for load balancing strategies
 */
export abstract class LoadBalancingStrategyBase {
  protected metricsService: ProviderMetricsService;

  constructor() {
    this.metricsService = ProviderMetricsService.getInstance();
  }

  abstract selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): ProviderSelection | Promise<ProviderSelection>;

  abstract getName(): string;
}

/**
 * Round-robin load balancing
 */
export class RoundRobinStrategy extends LoadBalancingStrategyBase {
  private currentIndex = 0;
  private providerRotation: Map<string, number> = new Map();

  getName(): string {
    return 'round-robin';
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // Get next provider in rotation
    const selectedIndex = this.currentIndex % providers.length;
    const selectedProvider = providers[selectedIndex];

    // Update index for next call
    this.currentIndex = (this.currentIndex + 1) % providers.length;

    // Track rotation count
    const rotationCount =
      (this.providerRotation.get(selectedProvider) || 0) + 1;
    this.providerRotation.set(selectedProvider, rotationCount);

    return {
      providerId: selectedProvider,
      reason: 'Round-robin selection',
      score: 1.0,
      metadata: {
        rotationIndex: selectedIndex,
        rotationCount,
      },
    };
  }
}

/**
 * Least-latency load balancing
 */
export class LeastLatencyStrategy extends LoadBalancingStrategyBase {
  getName(): string {
    return 'least-latency';
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    let bestProvider = providers[0];
    let lowestLatency = Number.POSITIVE_INFINITY;
    let bestScore = 0;

    for (const providerId of providers) {
      const metrics = this.metricsService.getProviderMetrics(providerId);

      // Use p50 latency for typical performance
      const latency =
        metrics.p50Latency ||
        metrics.averageLatency ||
        Number.POSITIVE_INFINITY;

      if (latency < lowestLatency) {
        lowestLatency = latency;
        bestProvider = providerId;
        bestScore = this.calculateLatencyScore(latency);
      }
    }

    return {
      providerId: bestProvider,
      reason: `Lowest latency: ${Math.round(lowestLatency)}ms`,
      score: bestScore,
      metadata: {
        latency: lowestLatency,
        p50: this.metricsService.getProviderMetrics(bestProvider).p50Latency,
        p95: this.metricsService.getProviderMetrics(bestProvider).p95Latency,
      },
    };
  }

  private calculateLatencyScore(latency: number): number {
    // Score from 0-1, where lower latency = higher score
    if (latency <= 100) return 1.0;
    if (latency >= 5000) return 0.1;
    return 1.0 - (latency - 100) / 4900;
  }
}

/**
 * Cost-optimized load balancing
 */
export class CostOptimizedStrategy extends LoadBalancingStrategyBase {
  getName(): string {
    return 'cost-optimized';
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    let bestProvider = providers[0];
    let lowestCost = Number.POSITIVE_INFINITY;
    let bestScore = 0;

    for (const providerId of providers) {
      const metrics = this.metricsService.getProviderMetrics(providerId);
      const costPerRequest =
        metrics.costTracking.costPerRequest || Number.POSITIVE_INFINITY;

      // Factor in success rate to avoid cheap but unreliable providers
      const adjustedCost =
        costPerRequest /
        (metrics.successCount / Math.max(1, metrics.totalRequests));

      if (adjustedCost < lowestCost) {
        lowestCost = adjustedCost;
        bestProvider = providerId;
        bestScore = this.calculateCostScore(costPerRequest, metrics);
      }
    }

    return {
      providerId: bestProvider,
      reason: `Lowest cost: $${lowestCost.toFixed(4)}/request`,
      score: bestScore,
      metadata: {
        costPerRequest: lowestCost,
        successRate:
          this.metricsService.getProviderMetrics(bestProvider).successCount /
          Math.max(
            1,
            this.metricsService.getProviderMetrics(bestProvider).totalRequests
          ),
      },
    };
  }

  private calculateCostScore(cost: number, metrics: ProviderMetrics): number {
    const costScore = cost > 0 ? 1 / (cost * 1000) : 1;
    const reliabilityScore =
      metrics.successCount / Math.max(1, metrics.totalRequests);
    return costScore * 0.7 + reliabilityScore * 0.3;
  }
}

/**
 * Weighted load balancing based on configured weights
 */
export class WeightedStrategy extends LoadBalancingStrategyBase {
  private weights: Map<string, number> = new Map();
  private totalWeight = 0;
  private random = Math.random;

  constructor(weights?: ProviderWeight[]) {
    super();
    if (weights) {
      this.updateWeights(weights);
    }
  }

  getName(): string {
    return 'weighted';
  }

  updateWeights(weights: ProviderWeight[]): void {
    this.weights.clear();
    this.totalWeight = 0;

    for (const { providerId, weight } of weights) {
      this.weights.set(providerId, weight);
      this.totalWeight += weight;
    }
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // Filter to only providers with weights
    const weightedProviders = providers.filter((p) => this.weights.has(p));

    if (weightedProviders.length === 0) {
      // Fallback to equal weights
      return this.selectWithEqualWeights(providers);
    }

    // Select based on weights
    const rand = this.random() * this.totalWeight;
    let cumulative = 0;

    for (const providerId of weightedProviders) {
      cumulative += this.weights.get(providerId) || 0;
      if (rand <= cumulative) {
        return {
          providerId,
          reason: `Weighted selection (weight: ${this.weights.get(providerId)})`,
          score: (this.weights.get(providerId) || 0) / this.totalWeight,
          metadata: {
            weight: this.weights.get(providerId),
            totalWeight: this.totalWeight,
          },
        };
      }
    }

    // Shouldn't reach here, but fallback to first provider
    return {
      providerId: weightedProviders[0],
      reason: 'Weighted selection (fallback)',
      score: 1.0,
    };
  }

  private selectWithEqualWeights(providers: string[]): ProviderSelection {
    const selected = providers[Math.floor(this.random() * providers.length)];
    return {
      providerId: selected,
      reason: 'Equal weight selection (no weights configured)',
      score: 1.0 / providers.length,
    };
  }
}

/**
 * Sticky session load balancing
 */
export class StickySessionStrategy extends LoadBalancingStrategyBase {
  private sessions: Map<string, SessionAffinity> = new Map();
  private fallbackStrategy: LoadBalancingStrategyBase;
  private ttl: number;

  constructor(config?: LoadBalancerConfig) {
    super();
    this.ttl = config?.sessionAffinityTTL || 30 * 60 * 1000; // 30 minutes default
    this.fallbackStrategy = new RoundRobinStrategy();
  }

  getName(): string {
    return 'sticky-session';
  }

  async selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): Promise<ProviderSelection> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    const sessionId = context?.sessionId;
    if (!sessionId) {
      // No session ID, use fallback strategy
      const fallbackResult = this.fallbackStrategy.selectProvider(providers);
      return fallbackResult instanceof Promise
        ? await fallbackResult
        : fallbackResult;
    }

    // Check for existing session
    const session = this.sessions.get(sessionId);
    const now = new Date();

    if (session && providers.includes(session.providerId)) {
      // Check if session is still valid
      if (now.getTime() - session.lastUsed.getTime() < this.ttl) {
        // Update session
        session.lastUsed = now;
        session.requestCount++;

        return {
          providerId: session.providerId,
          reason: `Sticky session (${session.requestCount} requests)`,
          score: 1.0,
          metadata: {
            sessionId,
            sessionAge: now.getTime() - session.createdAt.getTime(),
            requestCount: session.requestCount,
          },
        };
      }
      // Session expired
      this.sessions.delete(sessionId);
    }

    // Create new session
    const fallbackResult = this.fallbackStrategy.selectProvider(providers);
    const selection =
      fallbackResult instanceof Promise ? await fallbackResult : fallbackResult;

    this.sessions.set(sessionId, {
      sessionId,
      providerId: selection.providerId,
      createdAt: now,
      lastUsed: now,
      requestCount: 1,
    });

    return {
      ...selection,
      reason: `New sticky session created (${selection.reason})`,
      metadata: {
        ...selection.metadata,
        sessionId,
        newSession: true,
      },
    };
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastUsed.getTime() > this.ttl) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      this.sessions.delete(sessionId);
    }

    if (expired.length > 0) {
      loggingService.debug(`Cleaned up ${expired.length} expired sessions`);
    }
  }
}

/**
 * Health-based load balancing
 */
export class HealthBasedStrategy extends LoadBalancingStrategyBase {
  getName(): string {
    return 'health-based';
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    let bestProvider = providers[0];
    let bestHealthScore = -1;

    for (const providerId of providers) {
      const healthScore = this.metricsService.calculateHealthScore(providerId);

      if (healthScore > bestHealthScore) {
        bestHealthScore = healthScore;
        bestProvider = providerId;
      }
    }

    const metrics = this.metricsService.getProviderMetrics(bestProvider);

    return {
      providerId: bestProvider,
      reason: `Highest health score: ${bestHealthScore}/100`,
      score: bestHealthScore / 100,
      metadata: {
        healthScore: bestHealthScore,
        successRate: metrics.successCount / Math.max(1, metrics.totalRequests),
        averageLatency: metrics.averageLatency,
        errorRate: metrics.errorCount / Math.max(1, metrics.totalRequests),
      },
    };
  }
}

/**
 * Adaptive load balancing that adjusts based on real-time performance
 */
export class AdaptiveStrategy extends LoadBalancingStrategyBase {
  private config: LoadBalancerConfig;
  private recentSelections: Array<{
    providerId: string;
    timestamp: number;
    success: boolean;
  }> = [];

  constructor(config?: LoadBalancerConfig) {
    super();
    this.config = {
      adaptiveWindowSize: 100,
      costWeight: 0.3,
      performanceWeight: 0.5,
      reliabilityWeight: 0.2,
      ...config,
    };
  }

  getName(): string {
    return 'adaptive';
  }

  selectProvider(providers: string[]): ProviderSelection {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // Calculate composite scores for each provider
    const scores = new Map<string, number>();
    let bestProvider = providers[0];
    let bestScore = -1;

    for (const providerId of providers) {
      const score = this.calculateCompositeScore(providerId);
      scores.set(providerId, score);

      if (score > bestScore) {
        bestScore = score;
        bestProvider = providerId;
      }
    }

    // Apply exploration vs exploitation
    const explorationRate = 0.1; // 10% chance to explore
    if (Math.random() < explorationRate && providers.length > 1) {
      // Explore a different provider
      const otherProviders = providers.filter((p) => p !== bestProvider);
      bestProvider =
        otherProviders[Math.floor(Math.random() * otherProviders.length)];
      loggingService.debug('Adaptive strategy exploring alternative provider', {
        selected: bestProvider,
        originalBest: providers.find((p) => scores.get(p) === bestScore),
      });
    }

    return {
      providerId: bestProvider,
      reason: `Adaptive selection (score: ${bestScore.toFixed(2)})`,
      score: bestScore,
      metadata: {
        scores: Object.fromEntries(scores),
        weights: {
          cost: this.config.costWeight,
          performance: this.config.performanceWeight,
          reliability: this.config.reliabilityWeight,
        },
        exploration: bestScore !== scores.get(bestProvider),
      },
    };
  }

  private calculateCompositeScore(providerId: string): number {
    const metrics = this.metricsService.getProviderMetrics(providerId);

    // Calculate individual scores
    const performanceScore = this.calculatePerformanceScore(metrics);
    const reliabilityScore =
      metrics.totalRequests > 0
        ? metrics.successCount / metrics.totalRequests
        : 0.5; // Default to 50% if no data
    const costScore = this.calculateCostScore(metrics);

    // Apply weights
    const compositeScore =
      performanceScore * (this.config.performanceWeight || 0.5) +
      reliabilityScore * (this.config.reliabilityWeight || 0.2) +
      costScore * (this.config.costWeight || 0.3);

    return compositeScore;
  }

  private calculatePerformanceScore(metrics: ProviderMetrics): number {
    const latency = metrics.p50Latency || metrics.averageLatency || 1000;
    // Convert to 0-1 score
    if (latency <= 200) return 1.0;
    if (latency >= 5000) return 0.1;
    return 1.0 - (latency - 200) / 4800;
  }

  private calculateCostScore(metrics: ProviderMetrics): number {
    const cost = metrics.costTracking.costPerRequest || 0.001;
    // Inverse relationship - lower cost = higher score
    if (cost <= 0.0001) return 1.0;
    if (cost >= 0.01) return 0.1;
    return 1.0 - Math.log10(cost * 10_000) / 2;
  }

  recordSelection(providerId: string, success: boolean): void {
    this.recentSelections.push({
      providerId,
      timestamp: Date.now(),
      success,
    });

    // Keep only recent selections
    if (
      this.recentSelections.length > (this.config.adaptiveWindowSize || 100)
    ) {
      this.recentSelections.shift();
    }
  }
}

/**
 * Optimization-Aware Strategy
 * Integrates with the provider optimization engine for intelligent routing
 */
export class OptimizationAwareStrategy extends LoadBalancingStrategyBase {
  private optimizationEngine: ProviderOptimizationEngine;
  private fallbackStrategy: LoadBalancingStrategyBase;
  private confidenceThreshold: number;

  constructor(config?: LoadBalancerConfig) {
    super();
    this.optimizationEngine = ProviderOptimizationEngine.getInstance();
    this.fallbackStrategy = new AdaptiveStrategy(config);
    this.confidenceThreshold = config?.optimizationConfidenceThreshold || 0.7;
  }

  getName(): string {
    return 'optimization-aware';
  }

  async selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): Promise<ProviderSelection> {
    try {
      // Convert context to RequestContext for optimization engine
      const requestContext: RequestContext = {
        requestType: context?.requestType || 'chat',
        priority: context?.priority || 'medium',
        userTier: context?.userTier || 'pro',
        expectedTokens: context?.expectedTokens,
        requiresStreaming: context?.requiresStreaming,
        requiresTools: context?.requiresTools,
        requiresVision: context?.requiresVision,
        sessionId: context?.sessionId,
        userId: context?.userId,
        timeout: context?.timeout,
        budgetConstraint: context?.budgetConstraint,
        metadata: context?.metadata,
      };

      // Get optimization result
      const optimizationResult =
        await this.optimizationEngine.optimizeProviderSelection(
          providers,
          requestContext
        );

      // Check confidence threshold
      if (optimizationResult.confidence >= this.confidenceThreshold) {
        return {
          providerId: optimizationResult.selectedProvider,
          reason: `Optimization-guided: ${optimizationResult.reason}`,
          score: optimizationResult.confidence,
          metadata: {
            optimizationResult,
            strategy: 'optimization',
            confidence: optimizationResult.confidence,
            expectedLatency: optimizationResult.expectedLatency,
            expectedCost: optimizationResult.expectedCost,
          },
        };
      }
      // Low confidence, fall back to adaptive strategy
      const fallbackResult = this.fallbackStrategy.selectProvider(
        providers,
        context
      );
      const fallbackSelection =
        fallbackResult instanceof Promise
          ? await fallbackResult
          : fallbackResult;
      return {
        ...fallbackSelection,
        reason: `Low optimization confidence (${optimizationResult.confidence.toFixed(2)}), ${fallbackSelection.reason}`,
        metadata: {
          ...fallbackSelection.metadata,
          optimizationAttempted: true,
          optimizationConfidence: optimizationResult.confidence,
          fallbackReason: 'Low confidence',
        },
      };
    } catch (error) {
      loggingService.warn('Optimization strategy failed, falling back', error);
      const fallbackResult = this.fallbackStrategy.selectProvider(
        providers,
        context
      );
      const fallbackSelection =
        fallbackResult instanceof Promise
          ? await fallbackResult
          : fallbackResult;
      return {
        ...fallbackSelection,
        reason: `Optimization failed, ${fallbackSelection.reason}`,
        metadata: {
          ...fallbackSelection.metadata,
          optimizationError:
            error instanceof Error ? error.message : 'Unknown error',
          fallbackReason: 'Optimization error',
        },
      };
    }
  }
}

/**
 * Intelligent Routing Strategy
 * Combines optimization with capability matching and dynamic adaptation
 */
export class IntelligentRoutingStrategy extends LoadBalancingStrategyBase {
  private optimizationEngine: ProviderOptimizationEngine;
  private capabilityMapper: ModelCapabilityMapper;
  private config: LoadBalancerConfig;

  constructor(config?: LoadBalancerConfig) {
    super();
    this.optimizationEngine = ProviderOptimizationEngine.getInstance();
    this.capabilityMapper = ModelCapabilityMapper.getInstance();
    this.config = {
      enableOptimizationIntegration: true,
      capabilityFiltering: true,
      intelligentFallback: true,
      optimizationConfidenceThreshold: 0.8,
      ...config,
    };
  }

  getName(): string {
    return 'intelligent-routing';
  }

  async selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): Promise<ProviderSelection> {
    const startTime = Date.now();

    try {
      // Step 1: Filter providers by capability requirements
      let filteredProviders = providers;
      if (this.config.capabilityFiltering && context?.modelRequirements) {
        filteredProviders = this.filterByCapabilities(
          providers,
          context.modelRequirements
        );

        if (filteredProviders.length === 0) {
          loggingService.warn(
            'No providers match capability requirements, using all providers'
          );
          filteredProviders = providers;
        }
      }

      // Step 2: Apply optimization-based selection
      const requestContext: RequestContext = this.buildRequestContext(context);

      const optimizationResult =
        await this.optimizationEngine.optimizeProviderSelection(
          filteredProviders,
          requestContext
        );

      // Step 3: Validate selection against capabilities
      const selectedProvider = optimizationResult.selectedProvider;
      const isCapabilityMatch = this.validateCapabilityMatch(
        selectedProvider,
        context?.modelRequirements
      );

      if (!isCapabilityMatch && this.config.intelligentFallback) {
        // Find alternative with better capability match
        const alternativeProvider = this.findCapabilityAlternative(
          filteredProviders,
          selectedProvider,
          context?.modelRequirements
        );

        if (alternativeProvider) {
          return {
            providerId: alternativeProvider,
            reason: `Capability-adjusted selection (original: ${selectedProvider})`,
            score: optimizationResult.confidence * 0.9, // Slight penalty for adjustment
            metadata: {
              originalSelection: selectedProvider,
              adjustmentReason: 'Better capability match',
              optimizationResult,
              routingTime: Date.now() - startTime,
            },
          };
        }
      }

      // Step 4: Return optimization result
      return {
        providerId: selectedProvider,
        reason: `Intelligent routing: ${optimizationResult.reason}`,
        score: optimizationResult.confidence,
        metadata: {
          optimizationResult,
          capabilityFiltered: filteredProviders.length !== providers.length,
          originalProviderCount: providers.length,
          filteredProviderCount: filteredProviders.length,
          routingTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      loggingService.error('Intelligent routing failed', error);
      // Emergency fallback to simple round-robin
      const fallbackIndex = Math.floor(Math.random() * providers.length);
      return {
        providerId: providers[fallbackIndex],
        reason: `Emergency fallback due to routing failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        score: 0.3,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackType: 'emergency',
          routingTime: Date.now() - startTime,
        },
      };
    }
  }

  private filterByCapabilities(
    providers: string[],
    requirements: any
  ): string[] {
    if (!requirements) return providers;

    return providers.filter((providerId) => {
      // Get provider models and check if any meet requirements
      const providerModels =
        this.capabilityMapper.getProviderModels(providerId);

      return providerModels.some((model) => {
        // Check feature requirements
        if (requirements.features) {
          for (const [feature, required] of Object.entries(
            requirements.features
          )) {
            const modelFeature =
              model.features[feature as keyof typeof model.features];
            if (typeof required === 'boolean' && modelFeature !== required) {
              return false;
            }
            if (
              typeof required === 'number' &&
              (modelFeature as number) < required
            ) {
              return false;
            }
          }
        }

        // Check performance requirements
        if (
          requirements.maxLatency &&
          model.performance.averageLatency > requirements.maxLatency
        ) {
          return false;
        }

        // Check cost requirements
        if (
          requirements.maxCost &&
          model.pricing.inputTokenPrice > requirements.maxCost
        ) {
          return false;
        }

        return true;
      });
    });
  }

  private validateCapabilityMatch(
    providerId: string,
    requirements: any
  ): boolean {
    if (!requirements) return true;

    const providerModels = this.capabilityMapper.getProviderModels(providerId);
    return providerModels.some((model) => {
      // Similar validation logic as filterByCapabilities
      if (requirements.features) {
        for (const [feature, required] of Object.entries(
          requirements.features
        )) {
          const modelFeature =
            model.features[feature as keyof typeof model.features];
          if (typeof required === 'boolean' && modelFeature !== required) {
            return false;
          }
        }
      }
      return true;
    });
  }

  private findCapabilityAlternative(
    providers: string[],
    currentProvider: string,
    requirements: any
  ): string | null {
    const alternatives = providers.filter((p) => p !== currentProvider);

    for (const providerId of alternatives) {
      if (this.validateCapabilityMatch(providerId, requirements)) {
        return providerId;
      }
    }

    return null;
  }

  private buildRequestContext(context?: Record<string, any>): RequestContext {
    return {
      requestType: context?.requestType || 'chat',
      priority: context?.priority || 'medium',
      userTier: context?.userTier || 'pro',
      expectedTokens: context?.expectedTokens,
      requiresStreaming: context?.requiresStreaming,
      requiresTools: context?.requiresTools,
      requiresVision: context?.requiresVision,
      sessionId: context?.sessionId,
      userId: context?.userId,
      timeout: context?.timeout,
      budgetConstraint: context?.budgetConstraint,
      metadata: context?.metadata,
    };
  }
}

/**
 * Capability-Based Strategy
 * Routes based primarily on model capabilities and feature matching
 */
export class CapabilityBasedStrategy extends LoadBalancingStrategyBase {
  private capabilityMapper: ModelCapabilityMapper;

  constructor() {
    super();
    this.capabilityMapper = ModelCapabilityMapper.getInstance();
  }

  getName(): string {
    return 'capability-based';
  }

  selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): ProviderSelection {
    if (!context?.modelRequirements) {
      // No requirements specified, fall back to round-robin
      const selectedIndex = Math.floor(Math.random() * providers.length);
      return {
        providerId: providers[selectedIndex],
        reason: 'No capability requirements specified, random selection',
        score: 0.5,
      };
    }

    const requirements = context.modelRequirements;
    const providerScores = new Map<string, number>();

    // Score each provider based on capability match
    for (const providerId of providers) {
      const score = this.scoreProviderCapabilities(providerId, requirements);
      providerScores.set(providerId, score);
    }

    // Select provider with highest capability score
    const sortedProviders = Array.from(providerScores.entries()).sort(
      ([, a], [, b]) => b - a
    );

    const bestProvider = sortedProviders[0];

    if (!bestProvider || bestProvider[1] === 0) {
      // No provider meets requirements, select randomly
      const fallbackIndex = Math.floor(Math.random() * providers.length);
      return {
        providerId: providers[fallbackIndex],
        reason: 'No providers meet capability requirements, fallback selection',
        score: 0.3,
        metadata: {
          capabilityScores: Object.fromEntries(providerScores),
          fallbackReason: 'No capability match',
        },
      };
    }

    return {
      providerId: bestProvider[0],
      reason: `Best capability match (score: ${bestProvider[1].toFixed(2)})`,
      score: bestProvider[1],
      metadata: {
        capabilityScores: Object.fromEntries(providerScores),
        requirements,
      },
    };
  }

  private scoreProviderCapabilities(
    providerId: string,
    requirements: any
  ): number {
    const providerModels = this.capabilityMapper.getProviderModels(providerId);

    if (providerModels.length === 0) {
      return 0;
    }

    // Find the best model for this provider
    let bestScore = 0;

    for (const model of providerModels) {
      let score = 0;
      let maxScore = 0;

      // Score features
      if (requirements.features) {
        for (const [feature, required] of Object.entries(
          requirements.features
        )) {
          maxScore += 10;
          const modelFeature =
            model.features[feature as keyof typeof model.features];

          if (typeof required === 'boolean') {
            if (modelFeature === required) {
              score += 10;
            }
          } else if (typeof required === 'number') {
            if ((modelFeature as number) >= required) {
              score += 10;
            } else {
              score += Math.max(
                0,
                5 - Math.abs((modelFeature as number) - required)
              );
            }
          }
        }
      }

      // Score performance requirements
      if (requirements.maxLatency) {
        maxScore += 10;
        if (model.performance.averageLatency <= requirements.maxLatency) {
          score += 10;
        } else {
          score += Math.max(
            0,
            10 -
              (model.performance.averageLatency - requirements.maxLatency) /
                1000
          );
        }
      }

      // Score cost requirements
      if (requirements.maxCost) {
        maxScore += 10;
        if (model.pricing.inputTokenPrice <= requirements.maxCost) {
          score += 10;
        } else {
          score += Math.max(
            0,
            10 - (model.pricing.inputTokenPrice - requirements.maxCost) * 1000
          );
        }
      }

      // Normalize score
      const normalizedScore = maxScore > 0 ? score / maxScore : 0;
      bestScore = Math.max(bestScore, normalizedScore);
    }

    return bestScore;
  }
}

/**
 * Enhanced Load balancer that manages different strategies with optimization awareness
 */
export class LoadBalancer {
  private strategy: LoadBalancingStrategyBase;
  private strategies: Map<LoadBalancingStrategy, LoadBalancingStrategyBase> =
    new Map();
  private config: LoadBalancerConfig;

  constructor(
    initialStrategy: LoadBalancingStrategy = 'round-robin',
    config?: LoadBalancerConfig
  ) {
    this.config = {
      enableOptimizationIntegration: true,
      capabilityFiltering: true,
      intelligentFallback: true,
      optimizationConfidenceThreshold: 0.7,
      fallbackStrategy: 'adaptive',
      learningEnabled: true,
      dynamicWeightAdjustment: false,
      ...config,
    };

    // Initialize all strategies (including new optimization-aware ones)
    this.strategies.set('round-robin', new RoundRobinStrategy());
    this.strategies.set('least-latency', new LeastLatencyStrategy());
    this.strategies.set('cost-optimized', new CostOptimizedStrategy());
    this.strategies.set('weighted', new WeightedStrategy());
    this.strategies.set(
      'sticky-session',
      new StickySessionStrategy(this.config)
    );
    this.strategies.set('health-based', new HealthBasedStrategy());
    this.strategies.set('adaptive', new AdaptiveStrategy(this.config));
    this.strategies.set(
      'optimization-aware',
      new OptimizationAwareStrategy(this.config)
    );
    this.strategies.set(
      'intelligent-routing',
      new IntelligentRoutingStrategy(this.config)
    );
    this.strategies.set('capability-based', new CapabilityBasedStrategy());

    this.strategy =
      this.strategies.get(initialStrategy) || new RoundRobinStrategy();

    loggingService.info('Enhanced Load balancer initialized', {
      strategy: initialStrategy,
      availableStrategies: Array.from(this.strategies.keys()),
      optimizationIntegration: this.config.enableOptimizationIntegration,
    });
  }

  /**
   * Select a provider using the current strategy (supports async strategies)
   */
  async selectProvider(
    providers: string[],
    context?: Record<string, any>
  ): Promise<ProviderSelection> {
    try {
      // Handle both sync and async strategies uniformly
      const selectionResult = this.strategy.selectProvider(providers, context);

      // Await if it's a Promise, otherwise use directly
      const selection =
        selectionResult instanceof Promise
          ? await selectionResult
          : selectionResult;

      loggingService.debug('Provider selected', {
        strategy: this.strategy.getName(),
        ...selection,
      });

      return selection;
    } catch (error) {
      loggingService.error('Provider selection failed', error);

      // Emergency fallback
      const fallbackIndex = Math.floor(Math.random() * providers.length);
      return {
        providerId: providers[fallbackIndex],
        reason: `Emergency fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        score: 0.2,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          originalStrategy: this.strategy.getName(),
        },
      };
    }
  }

  /**
   * Change the load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    const newStrategy = this.strategies.get(strategy);
    if (!newStrategy) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    this.strategy = newStrategy;
    loggingService.info('Load balancing strategy changed', { strategy });
  }

  /**
   * Get the current strategy name
   */
  getCurrentStrategy(): string {
    return this.strategy.getName();
  }

  /**
   * Update weights for weighted strategy
   */
  updateWeights(weights: ProviderWeight[]): void {
    const weightedStrategy = this.strategies.get(
      'weighted'
    ) as WeightedStrategy;
    if (weightedStrategy) {
      weightedStrategy.updateWeights(weights);
    }
  }

  /**
   * Clean up expired sessions for sticky session strategy
   */
  cleanupSessions(): void {
    const stickyStrategy = this.strategies.get(
      'sticky-session'
    ) as StickySessionStrategy;
    if (stickyStrategy) {
      stickyStrategy.cleanupExpiredSessions();
    }
  }

  /**
   * Record selection outcome for adaptive strategy
   */
  recordSelectionOutcome(providerId: string, success: boolean): void {
    if (this.strategy instanceof AdaptiveStrategy) {
      this.strategy.recordSelection(providerId, success);
    }
  }

  /**
   * Get optimization insights from the current strategy
   */
  getOptimizationInsights(): any {
    if (
      this.strategy instanceof OptimizationAwareStrategy ||
      this.strategy instanceof IntelligentRoutingStrategy
    ) {
      // Return insights from the optimization engine
      const optimizationEngine = ProviderOptimizationEngine.getInstance();
      return optimizationEngine.getOptimizationInsights();
    }

    return {
      message: 'Current strategy does not support optimization insights',
      strategy: this.strategy.getName(),
    };
  }

  /**
   * Update optimization configuration
   */
  updateOptimizationConfig(config: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update strategies that use configuration
    if (this.config.enableOptimizationIntegration) {
      // Reinitialize optimization-aware strategies with new config
      this.strategies.set(
        'optimization-aware',
        new OptimizationAwareStrategy(this.config)
      );
      this.strategies.set(
        'intelligent-routing',
        new IntelligentRoutingStrategy(this.config)
      );

      // Update current strategy if it's one of the configurable ones
      if (
        this.strategy instanceof OptimizationAwareStrategy ||
        this.strategy instanceof IntelligentRoutingStrategy
      ) {
        this.strategy = this.strategies.get(
          this.getCurrentStrategy() as LoadBalancingStrategy
        )!;
      }
    }

    loggingService.info('Load balancer configuration updated', config);
  }

  /**
   * Get detailed performance analytics
   */
  getPerformanceAnalytics(): {
    strategy: string;
    config: LoadBalancerConfig;
    strategyMetrics: any;
    optimizationMetrics?: any;
  } {
    const analytics = {
      strategy: this.strategy.getName(),
      config: this.config,
      strategyMetrics: {},
      optimizationMetrics: undefined as any,
    };

    // Get strategy-specific metrics
    if (this.strategy instanceof AdaptiveStrategy) {
      // Could add method to get adaptive strategy metrics
      analytics.strategyMetrics = {
        type: 'adaptive',
        recentSelections: 'available',
      };
    }

    // Get optimization metrics if available
    if (this.config.enableOptimizationIntegration) {
      analytics.optimizationMetrics = this.getOptimizationInsights();
    }

    return analytics;
  }

  /**
   * Test strategy performance with given providers and context
   */
  async testStrategy(
    strategy: LoadBalancingStrategy,
    providers: string[],
    contexts: Record<string, any>[],
    iterations = 10
  ): Promise<{
    strategy: string;
    results: Array<{
      context: Record<string, any>;
      selections: ProviderSelection[];
      averageScore: number;
      averageLatency: number;
    }>;
    overallMetrics: {
      totalSelections: number;
      uniqueProviders: Set<string>;
      averageConfidence: number;
      errorRate: number;
    };
  }> {
    const testStrategy = this.strategies.get(strategy);
    if (!testStrategy) {
      throw new Error(`Strategy ${strategy} not found`);
    }

    const results: any[] = [];
    const allSelections: ProviderSelection[] = [];
    let errorCount = 0;

    for (const context of contexts) {
      const contextResults: ProviderSelection[] = [];

      for (let i = 0; i < iterations; i++) {
        try {
          // Handle both sync and async strategies uniformly
          const selectionResult = testStrategy.selectProvider(
            providers,
            context
          );

          // Await if it's a Promise, otherwise use directly
          const selection =
            selectionResult instanceof Promise
              ? await selectionResult
              : selectionResult;

          contextResults.push(selection);
          allSelections.push(selection);
        } catch (error) {
          errorCount++;
          loggingService.warn('Strategy test iteration failed', {
            strategy,
            context,
            error,
          });
        }
      }

      const averageScore =
        contextResults.reduce((sum, s) => sum + s.score, 0) /
        contextResults.length;
      const averageLatency =
        contextResults.reduce(
          (sum, s) => sum + (s.metadata?.expectedLatency || 1000),
          0
        ) / contextResults.length;

      results.push({
        context,
        selections: contextResults,
        averageScore,
        averageLatency,
      });
    }

    const uniqueProviders = new Set(allSelections.map((s) => s.providerId));
    const averageConfidence =
      allSelections.reduce((sum, s) => sum + s.score, 0) / allSelections.length;

    return {
      strategy,
      results,
      overallMetrics: {
        totalSelections: allSelections.length,
        uniqueProviders,
        averageConfidence,
        errorRate: errorCount / (contexts.length * iterations),
      },
    };
  }

  /**
   * Compare multiple strategies side by side
   */
  async compareStrategies(
    strategies: LoadBalancingStrategy[],
    providers: string[],
    contexts: Record<string, any>[],
    iterations = 5
  ): Promise<{
    comparison: Array<{
      strategy: string;
      averageConfidence: number;
      providerDistribution: Record<string, number>;
      averageLatency: number;
      errorRate: number;
    }>;
    winner: string;
    recommendations: string[];
  }> {
    const results: Array<{
      strategy: string;
      averageConfidence: number;
      providerDistribution: Record<string, number>;
      averageLatency: number;
      errorRate: number;
    }> = [];

    for (const strategy of strategies) {
      try {
        const testResult = await this.testStrategy(
          strategy,
          providers,
          contexts,
          iterations
        );

        const providerDistribution: Record<string, number> = {};
        for (const result of testResult.results) {
          for (const selection of result.selections) {
            providerDistribution[selection.providerId] =
              (providerDistribution[selection.providerId] || 0) + 1;
          }
        }

        results.push({
          strategy,
          averageConfidence: testResult.overallMetrics.averageConfidence,
          providerDistribution,
          averageLatency:
            testResult.results.reduce((sum, r) => sum + r.averageLatency, 0) /
            testResult.results.length,
          errorRate: testResult.overallMetrics.errorRate,
        });
      } catch (error) {
        loggingService.error(`Failed to test strategy ${strategy}`, error);
        results.push({
          strategy,
          averageConfidence: 0,
          providerDistribution: {},
          averageLatency: Number.POSITIVE_INFINITY,
          errorRate: 1,
        });
      }
    }

    // Determine winner (highest confidence with low error rate)
    const lowErrorResults = results.filter((r) => r.errorRate < 0.1);
    const winner =
      lowErrorResults.length > 0
        ? lowErrorResults.sort(
            (a, b) => b.averageConfidence - a.averageConfidence
          )[0].strategy
        : strategies[0];

    // Generate recommendations
    const recommendations = [];
    const sortedByConfidence = results.sort(
      (a, b) => b.averageConfidence - a.averageConfidence
    );
    const bestPerforming =
      sortedByConfidence.length > 0 ? sortedByConfidence[0] : null;
    const sortedByLatency = results.sort(
      (a, b) => a.averageLatency - b.averageLatency
    );
    const fastestResponse =
      sortedByLatency.length > 0 ? sortedByLatency[0] : null;
    const sortedByReliability = results.sort(
      (a, b) => a.errorRate - b.errorRate
    );
    const mostReliable =
      sortedByReliability.length > 0 ? sortedByReliability[0] : null;

    if (bestPerforming) {
      recommendations.push(
        `Best overall performance: ${bestPerforming.strategy}`
      );
    }
    if (fastestResponse) {
      recommendations.push(`Fastest response: ${fastestResponse.strategy}`);
    }
    if (mostReliable && mostReliable.errorRate < 0.05) {
      recommendations.push(`Most reliable: ${mostReliable.strategy}`);
    }

    return {
      comparison: results,
      winner,
      recommendations,
    };
  }
}

// Export convenience function
export const createLoadBalancer = (
  strategy: LoadBalancingStrategy = 'round-robin',
  config?: LoadBalancerConfig
): LoadBalancer => {
  return new LoadBalancer(strategy, config);
};
