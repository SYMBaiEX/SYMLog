import { createLogger } from '../../logger/unified-logger';

// Create AI provider metrics logger
const logger = createLogger({ service: 'ai-provider-metrics' });

// Metric data point
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

// Enhanced provider metrics with optimization-specific data
export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  tokenUsage: TokenUsage;
  costTracking: CostTracking;
  rateLimitStatus: RateLimitStatus;
  lastUpdated: Date;

  // Optimization-specific metrics
  optimizationMetrics: OptimizationMetrics;
  contextualPerformance: Map<string, ContextualMetrics>;
  qualityMetrics: QualityMetrics;
  reliabilityMetrics: ReliabilityMetrics;
}

export interface TokenUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  averageTokensPerRequest: number;
}

export interface CostTracking {
  totalCost: number;
  costPerRequest: number;
  costPerToken: number;
  dailyCost: number;
  monthlyCost: number;
}

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  reset: Date;
  isLimited: boolean;
}

// Optimization-specific metrics
export interface OptimizationMetrics {
  selectionCount: number; // How many times this provider was selected by optimization
  optimizationScore: number; // Current optimization score (0-1)
  predictionAccuracy: number; // How accurate our predictions were (0-1)
  confidenceScore: number; // Confidence in our metrics (0-1)
  lastOptimizationTime: Date;
  trendDirection: 'improving' | 'stable' | 'declining';
  optimizationHistory: Array<{
    timestamp: Date;
    score: number;
    reason: string;
    actualOutcome?: {
      latency: number;
      cost: number;
      success: boolean;
    };
  }>;
}

// Context-specific performance metrics
export interface ContextualMetrics {
  contextKey: string; // e.g., "chat:critical:enterprise"
  requestCount: number;
  averageLatency: number;
  successRate: number;
  averageCost: number;
  lastUsed: Date;
  trendMetrics: {
    latencyTrend: number[]; // Last 10 latency measurements
    successTrend: boolean[]; // Last 10 success/failure indicators
    costTrend: number[]; // Last 10 cost measurements
  };
}

// Quality assessment metrics
export interface QualityMetrics {
  responseQuality: number; // 0-1 score based on user feedback/ratings
  accuracyScore: number; // 0-1 score for factual accuracy
  relevanceScore: number; // 0-1 score for response relevance
  coherenceScore: number; // 0-1 score for response coherence
  safetyScore: number; // 0-1 score for content safety
  userSatisfaction: number; // 0-1 score from user ratings
  qualityTrend: 'improving' | 'stable' | 'declining';
  lastQualityAssessment: Date;
  assessmentCount: number;
}

// Reliability assessment metrics
export interface ReliabilityMetrics {
  uptimePercentage: number; // Service uptime (0-100)
  errorRate: number; // Current error rate (0-1)
  recoveryTime: number; // Average time to recover from errors (ms)
  consecutiveSuccesses: number; // Current streak of successes
  consecutiveFailures: number; // Current streak of failures
  lastFailureTime: Date | null;
  failureTypes: Map<string, number>; // Count of different error types
  meanTimeBetweenFailures: number; // MTBF in milliseconds
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  stabilityScore: number; // 0-1 composite reliability score
}

// Model-specific metrics
export interface ModelMetrics extends ProviderMetrics {
  modelId: string;
  capabilities: string[];
  performanceScore: number;
  reliabilityScore: number;
  costEfficiencyScore: number;
}

// Time window for metrics
export enum MetricWindow {
  MINUTE = 60 * 1000,
  HOUR = 60 * 60 * 1000,
  DAY = 24 * 60 * 60 * 1000,
  WEEK = 7 * 24 * 60 * 60 * 1000,
}

/**
 * Enhanced Provider Metrics Service with optimization awareness
 */
export class ProviderMetricsService {
  private static instance: ProviderMetricsService;
  private metrics: Map<string, ProviderMetrics> = new Map();
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private latencyHistory: Map<string, MetricDataPoint[]> = new Map();
  private errorHistory: Map<string, MetricDataPoint[]> = new Map();
  private costHistory: Map<string, MetricDataPoint[]> = new Map();

  // Enhanced tracking for optimization
  private qualityAssessments: Map<
    string,
    Array<{
      timestamp: Date;
      quality: number;
      feedback: string;
      userId?: string;
    }>
  > = new Map();

  private contextualPerformance: Map<string, Map<string, ContextualMetrics>> =
    new Map();
  private optimizationSelections: Map<
    string,
    Array<{
      timestamp: Date;
      predicted: { latency: number; cost: number; confidence: number };
      actual?: { latency: number; cost: number; success: boolean };
      context: string;
    }>
  > = new Map();

  // Exponential weighted moving average parameters
  private readonly EWMA_ALPHA = 0.2; // Weight for new values
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly PERCENTILE_WINDOW_SIZE = 100;
  private readonly TREND_WINDOW_SIZE = 10;

  private constructor() {
    // Initialize cleanup interval
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000); // Every hour

    // Initialize optimization analytics interval
    setInterval(() => this.updateOptimizationMetrics(), 15 * 60 * 1000); // Every 15 minutes
  }

  static getInstance(): ProviderMetricsService {
    if (!ProviderMetricsService.instance) {
      ProviderMetricsService.instance = new ProviderMetricsService();
    }
    return ProviderMetricsService.instance;
  }

  /**
   * Record a successful request
   */
  recordSuccess(
    providerId: string,
    modelId: string,
    latency: number,
    tokens?: {
      prompt: number;
      completion: number;
    }
  ): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const modelKey = `${providerId}:${modelId}`;
    const modelMetrics = this.getOrCreateModelMetrics(modelKey, modelId);

    // Update counts
    metrics.totalRequests++;
    metrics.successCount++;
    modelMetrics.totalRequests++;
    modelMetrics.successCount++;

    // Update latency metrics
    this.updateLatencyMetrics(metrics, latency);
    this.updateLatencyMetrics(modelMetrics, latency);

    // Record latency history
    this.recordLatencyDataPoint(providerId, latency);
    this.recordLatencyDataPoint(modelKey, latency);

    // Update token usage if provided
    if (tokens) {
      this.updateTokenUsage(metrics, tokens);
      this.updateTokenUsage(modelMetrics, tokens);
    }

    // Update timestamps
    metrics.lastUpdated = new Date();
    modelMetrics.lastUpdated = new Date();

    // Update performance scores
    this.updatePerformanceScores(modelMetrics);

    logger.debug('Recorded success', {
      providerId,
      modelId,
      latency,
      tokens,
    });
  }

  /**
   * Record a failed request
   */
  recordFailure(providerId: string, modelId: string, error: Error): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const modelKey = `${providerId}:${modelId}`;
    const modelMetrics = this.getOrCreateModelMetrics(modelKey, modelId);

    // Update counts
    metrics.totalRequests++;
    metrics.errorCount++;
    modelMetrics.totalRequests++;
    modelMetrics.errorCount++;

    // Record error data point
    this.recordErrorDataPoint(providerId, error);
    this.recordErrorDataPoint(modelKey, error);

    // Update timestamps
    metrics.lastUpdated = new Date();
    modelMetrics.lastUpdated = new Date();

    // Update performance scores
    this.updatePerformanceScores(modelMetrics);

    logger.warn('Recorded failure', {
      providerId,
      modelId,
      error: error.message,
    });
  }

  /**
   * Record latency for a request
   */
  recordLatency(providerId: string, modelId: string, latency: number): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const modelKey = `${providerId}:${modelId}`;
    const modelMetrics = this.getOrCreateModelMetrics(modelKey, modelId);

    this.updateLatencyMetrics(metrics, latency);
    this.updateLatencyMetrics(modelMetrics, latency);

    this.recordLatencyDataPoint(providerId, latency);
    this.recordLatencyDataPoint(modelKey, latency);
  }

  /**
   * Record token usage
   */
  recordTokenUsage(
    providerId: string,
    modelId: string,
    tokens: {
      prompt: number;
      completion: number;
    }
  ): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const modelKey = `${providerId}:${modelId}`;
    const modelMetrics = this.getOrCreateModelMetrics(modelKey, modelId);

    this.updateTokenUsage(metrics, tokens);
    this.updateTokenUsage(modelMetrics, tokens);
  }

  /**
   * Record cost for a request
   */
  recordCost(providerId: string, modelId: string, cost: number): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const modelKey = `${providerId}:${modelId}`;
    const modelMetrics = this.getOrCreateModelMetrics(modelKey, modelId);

    this.updateCostTracking(metrics, cost);
    this.updateCostTracking(modelMetrics, cost);

    this.recordCostDataPoint(providerId, cost);
    this.recordCostDataPoint(modelKey, cost);
  }

  /**
   * Update rate limit status
   */
  updateRateLimit(providerId: string, status: RateLimitStatus): void {
    const metrics = this.getOrCreateMetrics(providerId);
    metrics.rateLimitStatus = status;
    metrics.lastUpdated = new Date();
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(providerId: string): ProviderMetrics {
    return this.getOrCreateMetrics(providerId);
  }

  /**
   * Get model metrics
   */
  getModelMetrics(providerId: string, modelId: string): ModelMetrics {
    const modelKey = `${providerId}:${modelId}`;
    return this.getOrCreateModelMetrics(modelKey, modelId);
  }

  /**
   * Get all provider metrics
   */
  getAllProviderMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get all model metrics
   */
  getAllModelMetrics(): Map<string, ModelMetrics> {
    return new Map(this.modelMetrics);
  }

  /**
   * Get metrics for a time window
   */
  getMetricsForWindow(
    providerId: string,
    window: MetricWindow
  ): {
    latency: MetricDataPoint[];
    errors: MetricDataPoint[];
    costs: MetricDataPoint[];
  } {
    const now = Date.now();
    const windowStart = now - window;

    const latency = (this.latencyHistory.get(providerId) || []).filter(
      (point) => point.timestamp >= windowStart
    );

    const errors = (this.errorHistory.get(providerId) || []).filter(
      (point) => point.timestamp >= windowStart
    );

    const costs = (this.costHistory.get(providerId) || []).filter(
      (point) => point.timestamp >= windowStart
    );

    return { latency, errors, costs };
  }

  /**
   * Calculate provider health score (0-100)
   */
  calculateHealthScore(providerId: string): number {
    const metrics = this.getProviderMetrics(providerId);

    if (metrics.totalRequests === 0) {
      return 100; // No data, assume healthy
    }

    const successRate = metrics.successCount / metrics.totalRequests;
    const latencyScore = this.calculateLatencyScore(metrics.averageLatency);
    const errorRate = metrics.errorCount / metrics.totalRequests;

    // Weighted health score
    const healthScore =
      successRate * 50 + // 50% weight on success rate
      latencyScore * 30 + // 30% weight on latency
      (1 - errorRate) * 20; // 20% weight on error rate

    return Math.round(Math.max(0, Math.min(100, healthScore)));
  }

  /**
   * Get top performing models
   */
  getTopPerformingModels(limit = 5): ModelMetrics[] {
    return Array.from(this.modelMetrics.values())
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit);
  }

  /**
   * Get most cost-efficient models
   */
  getMostCostEfficientModels(limit = 5): ModelMetrics[] {
    return Array.from(this.modelMetrics.values())
      .sort((a, b) => b.costEfficiencyScore - a.costEfficiencyScore)
      .slice(0, limit);
  }

  /**
   * Record optimization selection with prediction
   */
  recordOptimizationSelection(
    providerId: string,
    context: string,
    prediction: { latency: number; cost: number; confidence: number }
  ): void {
    if (!this.optimizationSelections.has(providerId)) {
      this.optimizationSelections.set(providerId, []);
    }

    const selections = this.optimizationSelections.get(providerId)!;
    selections.push({
      timestamp: new Date(),
      predicted: prediction,
      context,
    });

    // Limit history size
    if (selections.length > this.MAX_HISTORY_SIZE) {
      selections.shift();
    }

    // Update optimization metrics
    const metrics = this.getOrCreateMetrics(providerId);
    metrics.optimizationMetrics.selectionCount++;
    metrics.optimizationMetrics.lastOptimizationTime = new Date();

    logger.debug('Optimization selection recorded', {
      providerId,
      context,
      prediction,
    });
  }

  /**
   * Record actual outcome for optimization selection
   */
  recordOptimizationOutcome(
    providerId: string,
    context: string,
    actual: { latency: number; cost: number; success: boolean }
  ): void {
    const selections = this.optimizationSelections.get(providerId);
    if (!selections) return;

    // Find the most recent selection for this context
    const recentSelection = selections
      .filter((s) => s.context === context && !s.actual)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (recentSelection) {
      recentSelection.actual = actual;

      // Update prediction accuracy
      this.updatePredictionAccuracy(
        providerId,
        recentSelection.predicted,
        actual
      );

      // Update contextual performance
      this.updateContextualPerformance(providerId, context, actual);
    }

    logger.debug('Optimization outcome recorded', {
      providerId,
      context,
      actual,
    });
  }

  /**
   * Record quality assessment
   */
  recordQualityAssessment(
    providerId: string,
    quality: number,
    feedback: string,
    userId?: string
  ): void {
    if (!this.qualityAssessments.has(providerId)) {
      this.qualityAssessments.set(providerId, []);
    }

    const assessments = this.qualityAssessments.get(providerId)!;
    assessments.push({
      timestamp: new Date(),
      quality,
      feedback,
      userId,
    });

    // Limit history size
    if (assessments.length > this.MAX_HISTORY_SIZE) {
      assessments.shift();
    }

    // Update quality metrics
    const metrics = this.getOrCreateMetrics(providerId);
    this.updateQualityMetrics(metrics, assessments);

    logger.debug('Quality assessment recorded', {
      providerId,
      quality,
      feedback,
    });
  }

  /**
   * Get contextual performance for a specific context
   */
  getContextualPerformance(
    providerId: string,
    context: string
  ): ContextualMetrics | undefined {
    const providerContexts = this.contextualPerformance.get(providerId);
    return providerContexts?.get(context);
  }

  /**
   * Get all contextual performance data for a provider
   */
  getAllContextualPerformance(
    providerId: string
  ): Map<string, ContextualMetrics> {
    return this.contextualPerformance.get(providerId) || new Map();
  }

  /**
   * Get optimization insights for a provider
   */
  getOptimizationInsights(providerId: string): {
    predictionAccuracy: number;
    selectionFrequency: number;
    contextualVariation: number;
    reliabilityTrend: 'improving' | 'stable' | 'declining';
    recommendations: string[];
  } {
    const metrics = this.getProviderMetrics(providerId);
    const selections = this.optimizationSelections.get(providerId) || [];
    const contexts = this.getAllContextualPerformance(providerId);

    // Calculate contextual variation (how much performance varies by context)
    const contextualVariation = this.calculateContextualVariation(contexts);

    // Determine reliability trend
    const reliabilityTrend = this.determineReliabilityTrend(metrics);

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(
      metrics,
      selections,
      contexts
    );

    return {
      predictionAccuracy: metrics.optimizationMetrics.predictionAccuracy,
      selectionFrequency: selections.length,
      contextualVariation,
      reliabilityTrend,
      recommendations,
    };
  }

  /**
   * Get comprehensive provider analytics
   */
  getProviderAnalytics(providerId: string): {
    overall: ProviderMetrics;
    optimization: OptimizationMetrics;
    quality: QualityMetrics;
    reliability: ReliabilityMetrics;
    contextual: Array<{ context: string; metrics: ContextualMetrics }>;
    trends: {
      latency: number[];
      cost: number[];
      quality: number[];
      success: boolean[];
    };
    insights: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
  } {
    const metrics = this.getProviderMetrics(providerId);
    const contextual = Array.from(
      this.getAllContextualPerformance(providerId).entries()
    ).map(([context, metrics]) => ({ context, metrics }));

    // Get trend data
    const latencyTrend = (this.latencyHistory.get(providerId) || [])
      .slice(-this.TREND_WINDOW_SIZE)
      .map((p) => p.value);

    const costTrend = (this.costHistory.get(providerId) || [])
      .slice(-this.TREND_WINDOW_SIZE)
      .map((p) => p.value);

    const qualityTrend = (this.qualityAssessments.get(providerId) || [])
      .slice(-this.TREND_WINDOW_SIZE)
      .map((a) => a.quality);

    const successTrend = contextual
      .flatMap((c) => c.metrics.trendMetrics.successTrend)
      .slice(-this.TREND_WINDOW_SIZE);

    // SWOT analysis
    const insights = this.generateSWOTAnalysis(metrics, contextual);

    return {
      overall: metrics,
      optimization: metrics.optimizationMetrics,
      quality: metrics.qualityMetrics,
      reliability: metrics.reliabilityMetrics,
      contextual,
      trends: {
        latency: latencyTrend,
        cost: costTrend,
        quality: qualityTrend,
        success: successTrend,
      },
      insights,
    };
  }

  /**
   * Compare providers across multiple dimensions
   */
  compareProviders(providerIds: string[]): {
    comparison: Array<{
      providerId: string;
      overallScore: number;
      latencyScore: number;
      costScore: number;
      qualityScore: number;
      reliabilityScore: number;
      optimizationScore: number;
    }>;
    winner: {
      overall: string;
      latency: string;
      cost: string;
      quality: string;
      reliability: string;
    };
    insights: string[];
  } {
    const comparison = providerIds.map((providerId) => {
      const metrics = this.getProviderMetrics(providerId);

      const latencyScore = this.calculateLatencyScore(metrics.averageLatency);
      const costScore = this.calculateCostEfficiencyScore(metrics);
      const qualityScore = metrics.qualityMetrics.responseQuality * 100;
      const reliabilityScore = metrics.reliabilityMetrics.stabilityScore * 100;
      const optimizationScore =
        metrics.optimizationMetrics.optimizationScore * 100;

      const overallScore =
        latencyScore * 0.2 +
        costScore * 0.2 +
        qualityScore * 0.25 +
        reliabilityScore * 0.25 +
        optimizationScore * 0.1;

      return {
        providerId,
        overallScore,
        latencyScore,
        costScore,
        qualityScore,
        reliabilityScore,
        optimizationScore,
      };
    });

    // Determine winners in each category
    const winner = {
      overall:
        comparison.sort((a, b) => b.overallScore - a.overallScore)[0]
          ?.providerId || '',
      latency:
        comparison.sort((a, b) => b.latencyScore - a.latencyScore)[0]
          ?.providerId || '',
      cost:
        comparison.sort((a, b) => b.costScore - a.costScore)[0]?.providerId ||
        '',
      quality:
        comparison.sort((a, b) => b.qualityScore - a.qualityScore)[0]
          ?.providerId || '',
      reliability:
        comparison.sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0]
          ?.providerId || '',
    };

    // Generate insights
    const insights = this.generateComparisonInsights(comparison, winner);

    return {
      comparison,
      winner,
      insights,
    };
  }

  // Private helper methods

  private getOrCreateMetrics(providerId: string): ProviderMetrics {
    if (!this.metrics.has(providerId)) {
      this.metrics.set(providerId, {
        providerId,
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        tokenUsage: {
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          averageTokensPerRequest: 0,
        },
        costTracking: {
          totalCost: 0,
          costPerRequest: 0,
          costPerToken: 0,
          dailyCost: 0,
          monthlyCost: 0,
        },
        rateLimitStatus: {
          remaining: -1,
          limit: -1,
          reset: new Date(),
          isLimited: false,
        },
        lastUpdated: new Date(),

        // Initialize optimization-specific metrics
        optimizationMetrics: {
          selectionCount: 0,
          optimizationScore: 0.5,
          predictionAccuracy: 0.5,
          confidenceScore: 0.5,
          lastOptimizationTime: new Date(),
          trendDirection: 'stable',
          optimizationHistory: [],
        },
        contextualPerformance: new Map(),
        qualityMetrics: {
          responseQuality: 0.5,
          accuracyScore: 0.5,
          relevanceScore: 0.5,
          coherenceScore: 0.5,
          safetyScore: 0.5,
          userSatisfaction: 0.5,
          qualityTrend: 'stable',
          lastQualityAssessment: new Date(),
          assessmentCount: 0,
        },
        reliabilityMetrics: {
          uptimePercentage: 99.0,
          errorRate: 0.0,
          recoveryTime: 0,
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
          lastFailureTime: null,
          failureTypes: new Map(),
          meanTimeBetweenFailures: 0,
          circuitBreakerState: 'closed',
          stabilityScore: 0.9,
        },
      });
    }
    return this.metrics.get(providerId)!;
  }

  private getOrCreateModelMetrics(
    modelKey: string,
    modelId: string
  ): ModelMetrics {
    if (!this.modelMetrics.has(modelKey)) {
      const baseMetrics = this.getOrCreateMetrics(modelKey);
      this.modelMetrics.set(modelKey, {
        ...baseMetrics,
        modelId,
        capabilities: [],
        performanceScore: 0,
        reliabilityScore: 0,
        costEfficiencyScore: 0,
      });
    }
    return this.modelMetrics.get(modelKey)!;
  }

  private updateLatencyMetrics(
    metrics: ProviderMetrics,
    latency: number
  ): void {
    // Update average using EWMA
    if (metrics.averageLatency === 0) {
      metrics.averageLatency = latency;
    } else {
      metrics.averageLatency =
        this.EWMA_ALPHA * latency +
        (1 - this.EWMA_ALPHA) * metrics.averageLatency;
    }

    // Update percentiles (simplified - in production, use proper algorithms)
    const history = this.latencyHistory.get(metrics.providerId) || [];
    const recentLatencies = history
      .slice(-this.PERCENTILE_WINDOW_SIZE)
      .map((p) => p.value)
      .concat([latency])
      .sort((a, b) => a - b);

    if (recentLatencies.length > 0) {
      metrics.p50Latency = this.calculatePercentile(recentLatencies, 0.5);
      metrics.p95Latency = this.calculatePercentile(recentLatencies, 0.95);
      metrics.p99Latency = this.calculatePercentile(recentLatencies, 0.99);
    }
  }

  private updateTokenUsage(
    metrics: ProviderMetrics,
    tokens: {
      prompt: number;
      completion: number;
    }
  ): void {
    metrics.tokenUsage.promptTokens += tokens.prompt;
    metrics.tokenUsage.completionTokens += tokens.completion;
    metrics.tokenUsage.totalTokens += tokens.prompt + tokens.completion;

    if (metrics.totalRequests > 0) {
      metrics.tokenUsage.averageTokensPerRequest =
        metrics.tokenUsage.totalTokens / metrics.totalRequests;
    }
  }

  private updateCostTracking(metrics: ProviderMetrics, cost: number): void {
    metrics.costTracking.totalCost += cost;

    if (metrics.totalRequests > 0) {
      metrics.costTracking.costPerRequest =
        metrics.costTracking.totalCost / metrics.totalRequests;
    }

    if (metrics.tokenUsage.totalTokens > 0) {
      metrics.costTracking.costPerToken =
        metrics.costTracking.totalCost / metrics.tokenUsage.totalTokens;
    }

    // Update daily/monthly estimates (simplified)
    const requestsPerDay = metrics.totalRequests; // Simplified
    metrics.costTracking.dailyCost =
      metrics.costTracking.costPerRequest * requestsPerDay;
    metrics.costTracking.monthlyCost = metrics.costTracking.dailyCost * 30;
  }

  private updatePerformanceScores(metrics: ModelMetrics): void {
    // Performance score (based on latency)
    metrics.performanceScore = this.calculateLatencyScore(
      metrics.averageLatency
    );

    // Reliability score (based on success rate)
    if (metrics.totalRequests > 0) {
      metrics.reliabilityScore =
        (metrics.successCount / metrics.totalRequests) * 100;
    }

    // Cost efficiency score (performance per dollar)
    if (metrics.costTracking.costPerRequest > 0) {
      metrics.costEfficiencyScore =
        metrics.performanceScore / metrics.costTracking.costPerRequest;
    }
  }

  private calculateLatencyScore(latency: number): number {
    // Convert latency to score (0-100)
    // <500ms = 100, >5000ms = 0
    if (latency <= 500) return 100;
    if (latency >= 5000) return 0;
    return Math.round(100 - ((latency - 500) / 4500) * 100);
  }

  private calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private recordLatencyDataPoint(key: string, latency: number): void {
    if (!this.latencyHistory.has(key)) {
      this.latencyHistory.set(key, []);
    }

    const history = this.latencyHistory.get(key)!;
    history.push({
      timestamp: Date.now(),
      value: latency,
    });

    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  private recordErrorDataPoint(key: string, error: Error): void {
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    const history = this.errorHistory.get(key)!;
    history.push({
      timestamp: Date.now(),
      value: 1,
      metadata: {
        errorType: error.name,
        errorMessage: error.message,
      },
    });

    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  private recordCostDataPoint(key: string, cost: number): void {
    if (!this.costHistory.has(key)) {
      this.costHistory.set(key, []);
    }

    const history = this.costHistory.get(key)!;
    history.push({
      timestamp: Date.now(),
      value: cost,
    });

    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup old data points
    for (const [key, history] of this.latencyHistory) {
      const filtered = history.filter(
        (point) => now - point.timestamp < maxAge
      );
      if (filtered.length !== history.length) {
        this.latencyHistory.set(key, filtered);
      }
    }

    for (const [key, history] of this.errorHistory) {
      const filtered = history.filter(
        (point) => now - point.timestamp < maxAge
      );
      if (filtered.length !== history.length) {
        this.errorHistory.set(key, filtered);
      }
    }

    for (const [key, history] of this.costHistory) {
      const filtered = history.filter(
        (point) => now - point.timestamp < maxAge
      );
      if (filtered.length !== history.length) {
        this.costHistory.set(key, filtered);
      }
    }

    logger.debug('Cleaned up old metrics');
  }

  // New optimization-aware helper methods

  private updateOptimizationMetrics(): void {
    // Update optimization metrics for all providers
    for (const [providerId] of this.metrics) {
      this.updateProviderOptimizationMetrics(providerId);
    }
  }

  private updateProviderOptimizationMetrics(providerId: string): void {
    const metrics = this.getOrCreateMetrics(providerId);
    const selections = this.optimizationSelections.get(providerId) || [];

    // Update prediction accuracy
    const recentPredictions = selections.filter((s) => s.actual).slice(-20); // Last 20 predictions

    if (recentPredictions.length > 0) {
      const accuracySum = recentPredictions.reduce((sum, selection) => {
        const latencyAccuracy =
          1 -
          Math.abs(selection.predicted.latency - selection.actual!.latency) /
            selection.predicted.latency;
        const costAccuracy =
          1 -
          Math.abs(selection.predicted.cost - selection.actual!.cost) /
            selection.predicted.cost;
        return sum + (latencyAccuracy + costAccuracy) / 2;
      }, 0);

      metrics.optimizationMetrics.predictionAccuracy = Math.max(
        0,
        accuracySum / recentPredictions.length
      );
    }

    // Update trend direction
    if (recentPredictions.length >= 10) {
      const recentAccuracy =
        recentPredictions
          .slice(-5)
          .reduce((sum, s) => sum + (s.actual!.success ? 1 : 0), 0) / 5;
      const olderAccuracy =
        recentPredictions
          .slice(-10, -5)
          .reduce((sum, s) => sum + (s.actual!.success ? 1 : 0), 0) / 5;

      if (recentAccuracy > olderAccuracy + 0.1) {
        metrics.optimizationMetrics.trendDirection = 'improving';
      } else if (recentAccuracy < olderAccuracy - 0.1) {
        metrics.optimizationMetrics.trendDirection = 'declining';
      } else {
        metrics.optimizationMetrics.trendDirection = 'stable';
      }
    }
  }

  private updatePredictionAccuracy(
    providerId: string,
    predicted: { latency: number; cost: number; confidence: number },
    actual: { latency: number; cost: number; success: boolean }
  ): void {
    const metrics = this.getOrCreateMetrics(providerId);

    // Calculate accuracy for this prediction
    const latencyError =
      Math.abs(predicted.latency - actual.latency) / predicted.latency;
    const costError = Math.abs(predicted.cost - actual.cost) / predicted.cost;
    const accuracy = 1 - (latencyError + costError) / 2;

    // Update overall prediction accuracy with exponential smoothing
    const alpha = 0.1;
    metrics.optimizationMetrics.predictionAccuracy =
      alpha * Math.max(0, accuracy) +
      (1 - alpha) * metrics.optimizationMetrics.predictionAccuracy;

    // Update confidence based on success
    if (actual.success) {
      metrics.optimizationMetrics.confidenceScore = Math.min(
        1,
        metrics.optimizationMetrics.confidenceScore + 0.05
      );
    } else {
      metrics.optimizationMetrics.confidenceScore = Math.max(
        0,
        metrics.optimizationMetrics.confidenceScore - 0.1
      );
    }
  }

  private updateContextualPerformance(
    providerId: string,
    context: string,
    actual: { latency: number; cost: number; success: boolean }
  ): void {
    if (!this.contextualPerformance.has(providerId)) {
      this.contextualPerformance.set(providerId, new Map());
    }

    const providerContexts = this.contextualPerformance.get(providerId)!;

    if (!providerContexts.has(context)) {
      providerContexts.set(context, {
        contextKey: context,
        requestCount: 0,
        averageLatency: 0,
        successRate: 0,
        averageCost: 0,
        lastUsed: new Date(),
        trendMetrics: {
          latencyTrend: [],
          successTrend: [],
          costTrend: [],
        },
      });
    }

    const contextMetrics = providerContexts.get(context)!;

    // Update metrics
    contextMetrics.requestCount++;
    contextMetrics.averageLatency =
      (contextMetrics.averageLatency * (contextMetrics.requestCount - 1) +
        actual.latency) /
      contextMetrics.requestCount;
    contextMetrics.averageCost =
      (contextMetrics.averageCost * (contextMetrics.requestCount - 1) +
        actual.cost) /
      contextMetrics.requestCount;
    contextMetrics.successRate =
      (contextMetrics.successRate * (contextMetrics.requestCount - 1) +
        (actual.success ? 1 : 0)) /
      contextMetrics.requestCount;
    contextMetrics.lastUsed = new Date();

    // Update trends
    contextMetrics.trendMetrics.latencyTrend.push(actual.latency);
    contextMetrics.trendMetrics.successTrend.push(actual.success);
    contextMetrics.trendMetrics.costTrend.push(actual.cost);

    // Limit trend arrays
    if (
      contextMetrics.trendMetrics.latencyTrend.length > this.TREND_WINDOW_SIZE
    ) {
      contextMetrics.trendMetrics.latencyTrend.shift();
    }
    if (
      contextMetrics.trendMetrics.successTrend.length > this.TREND_WINDOW_SIZE
    ) {
      contextMetrics.trendMetrics.successTrend.shift();
    }
    if (contextMetrics.trendMetrics.costTrend.length > this.TREND_WINDOW_SIZE) {
      contextMetrics.trendMetrics.costTrend.shift();
    }
  }

  private updateQualityMetrics(
    metrics: ProviderMetrics,
    assessments: any[]
  ): void {
    if (assessments.length === 0) return;

    const recent = assessments.slice(-10); // Last 10 assessments
    const averageQuality =
      recent.reduce((sum, a) => sum + a.quality, 0) / recent.length;

    metrics.qualityMetrics.responseQuality = averageQuality;
    metrics.qualityMetrics.userSatisfaction = averageQuality; // Simplified
    metrics.qualityMetrics.lastQualityAssessment = new Date();
    metrics.qualityMetrics.assessmentCount = assessments.length;

    // Determine quality trend
    if (recent.length >= 6) {
      const recentAvg =
        recent.slice(-3).reduce((sum, a) => sum + a.quality, 0) / 3;
      const olderAvg =
        recent.slice(-6, -3).reduce((sum, a) => sum + a.quality, 0) / 3;

      if (recentAvg > olderAvg + 0.1) {
        metrics.qualityMetrics.qualityTrend = 'improving';
      } else if (recentAvg < olderAvg - 0.1) {
        metrics.qualityMetrics.qualityTrend = 'declining';
      } else {
        metrics.qualityMetrics.qualityTrend = 'stable';
      }
    }
  }

  private calculateContextualVariation(
    contexts: Map<string, ContextualMetrics>
  ): number {
    if (contexts.size === 0) return 0;

    const latencies = Array.from(contexts.values()).map(
      (c) => c.averageLatency
    );
    const mean = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const variance =
      latencies.reduce((sum, l) => sum + (l - mean) ** 2, 0) / latencies.length;

    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private determineReliabilityTrend(
    metrics: ProviderMetrics
  ): 'improving' | 'stable' | 'declining' {
    return metrics.reliabilityMetrics.consecutiveSuccesses > 10
      ? 'improving'
      : metrics.reliabilityMetrics.consecutiveFailures > 3
        ? 'declining'
        : 'stable';
  }

  private generateOptimizationRecommendations(
    metrics: ProviderMetrics,
    selections: any[],
    contexts: Map<string, ContextualMetrics>
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.optimizationMetrics.predictionAccuracy < 0.7) {
      recommendations.push(
        'Improve prediction accuracy by collecting more training data'
      );
    }

    if (
      contexts.size > 5 &&
      this.calculateContextualVariation(contexts) > 0.5
    ) {
      recommendations.push('Consider context-specific optimization strategies');
    }

    if (metrics.reliabilityMetrics.errorRate > 0.1) {
      recommendations.push('Investigate and address high error rate');
    }

    if (metrics.qualityMetrics.responseQuality < 0.7) {
      recommendations.push('Focus on improving response quality');
    }

    return recommendations;
  }

  private generateSWOTAnalysis(
    metrics: ProviderMetrics,
    contextual: Array<{ context: string; metrics: ContextualMetrics }>
  ): {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Analyze strengths
    if (metrics.averageLatency < 1000) strengths.push('Low latency response');
    if (metrics.costTracking.costPerRequest < 0.01)
      strengths.push('Cost effective');
    if (metrics.qualityMetrics.responseQuality > 0.8)
      strengths.push('High response quality');
    if (metrics.reliabilityMetrics.stabilityScore > 0.9)
      strengths.push('High reliability');

    // Analyze weaknesses
    if (metrics.averageLatency > 3000) weaknesses.push('High latency');
    if (metrics.costTracking.costPerRequest > 0.05)
      weaknesses.push('Expensive');
    if (metrics.qualityMetrics.responseQuality < 0.6)
      weaknesses.push('Poor quality responses');
    if (metrics.reliabilityMetrics.errorRate > 0.1)
      weaknesses.push('High error rate');

    // Analyze opportunities
    if (metrics.optimizationMetrics.trendDirection === 'improving') {
      opportunities.push('Performance is improving, consider increased usage');
    }
    if (contextual.length > 0) {
      opportunities.push(
        'Leverage contextual performance data for better optimization'
      );
    }

    // Analyze threats
    if (metrics.optimizationMetrics.trendDirection === 'declining') {
      threats.push('Performance is declining, investigate issues');
    }
    if (metrics.reliabilityMetrics.consecutiveFailures > 5) {
      threats.push('Multiple consecutive failures, may need circuit breaker');
    }

    return { strengths, weaknesses, opportunities, threats };
  }

  private calculateCostEfficiencyScore(metrics: ProviderMetrics): number {
    // Calculate cost efficiency score based on cost per successful request
    if (metrics.successCount === 0) return 0;

    const costPerSuccess =
      metrics.costTracking.totalCost / metrics.successCount;
    // Lower cost per success = higher score
    // $0.01 per success = 100, $0.10 per success = 0
    if (costPerSuccess <= 0.01) return 100;
    if (costPerSuccess >= 0.1) return 0;
    return Math.round(100 - ((costPerSuccess - 0.01) / 0.09) * 100);
  }

  private generateComparisonInsights(
    comparison: Array<{
      providerId: string;
      overallScore: number;
      latencyScore: number;
      costScore: number;
      qualityScore: number;
      reliabilityScore: number;
      optimizationScore: number;
    }>,
    winner: any
  ): string[] {
    const insights: string[] = [];

    const topProvider = comparison[0];
    const worstProvider = comparison[comparison.length - 1];

    insights.push(`${winner.overall} leads in overall performance`);

    if (winner.latency !== winner.overall) {
      insights.push(
        `${winner.latency} has the best latency but not overall performance`
      );
    }

    if (winner.cost !== winner.overall) {
      insights.push(
        `${winner.cost} is most cost-effective but not the overall leader`
      );
    }

    const scoreGap = topProvider.overallScore - worstProvider.overallScore;
    if (scoreGap > 30) {
      insights.push('Significant performance gap between providers');
    } else {
      insights.push('Providers have similar performance levels');
    }

    return insights;
  }
}

// Export singleton getter
export const providerMetricsService = ProviderMetricsService.getInstance();
