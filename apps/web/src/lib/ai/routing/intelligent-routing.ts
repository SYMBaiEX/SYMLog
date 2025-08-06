import { logError as logErrorToConsole } from '@/lib/logger';
import type {
  ModelInfo,
  ModelRequirements,
  ProviderInfo,
  SupportedModelId,
} from '../core/gateway';
import { LoadBalancer, type LoadBalancingStrategy } from './load-balancing';
import { ProviderMetricsService } from '../providers/provider-metrics';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Task complexity analysis result
export interface ComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  factors: string[];
  recommendedModels: string[];
  estimatedTokens: number;
}

// Model capability requirements
export interface CapabilityRequirements {
  required: string[];
  preferred: string[];
  optional: string[];
}

// Routing decision
export interface RoutingDecision {
  primaryChoice: {
    providerId: string;
    modelId: SupportedModelId;
    reason: string;
    confidence: number;
  };
  alternatives: Array<{
    providerId: string;
    modelId: SupportedModelId;
    reason: string;
    confidence: number;
  }>;
  strategy: LoadBalancingStrategy;
  metadata: Record<string, any>;
}

// Model capability definitions
const MODEL_CAPABILITIES = {
  // Task-based capabilities
  chat: ['conversation', 'context-aware', 'multi-turn'],
  code: ['syntax-aware', 'debugging', 'refactoring', 'documentation'],
  analysis: ['data-processing', 'pattern-recognition', 'summarization'],
  creative: ['storytelling', 'ideation', 'style-adaptation'],
  reasoning: ['logical-thinking', 'problem-solving', 'step-by-step'],
  vision: ['image-understanding', 'ocr', 'visual-analysis'],

  // Feature-based capabilities
  'function-calling': ['tool-use', 'api-integration'],
  'structured-output': ['json-generation', 'schema-compliance'],
  'long-context': ['extended-memory', 'document-processing'],
  multilingual: ['translation', 'language-detection'],
  'real-time': ['streaming', 'low-latency'],
  factual: ['accuracy', 'citations', 'verification'],
};

// Task complexity factors
const COMPLEXITY_FACTORS = {
  simple: {
    maxTokens: 1000,
    requiresReasoning: false,
    multiStep: false,
    requiresContext: false,
    creativityLevel: 'low',
  },
  moderate: {
    maxTokens: 4000,
    requiresReasoning: true,
    multiStep: false,
    requiresContext: true,
    creativityLevel: 'medium',
  },
  complex: {
    maxTokens: 16_000,
    requiresReasoning: true,
    multiStep: true,
    requiresContext: true,
    creativityLevel: 'high',
  },
};

/**
 * Intelligent Routing Engine for optimal model selection
 */
export class IntelligentRoutingEngine {
  private static instance: IntelligentRoutingEngine;
  private metricsService: ProviderMetricsService;
  private loadBalancer: LoadBalancer;
  private routingHistory: Map<string, RoutingDecision[]> = new Map();
  private modelCapabilityCache: Map<string, Set<string>> = new Map();

  private constructor() {
    this.metricsService = ProviderMetricsService.getInstance();
    this.loadBalancer = new LoadBalancer('adaptive');
    this.initializeModelCapabilities();
  }

  static getInstance(): IntelligentRoutingEngine {
    if (!IntelligentRoutingEngine.instance) {
      IntelligentRoutingEngine.instance = new IntelligentRoutingEngine();
    }
    return IntelligentRoutingEngine.instance;
  }

  /**
   * Route request to optimal provider and model
   */
  async routeRequest(
    requirements: ModelRequirements,
    availableProviders: ProviderInfo[],
    context?: Record<string, any>
  ): Promise<RoutingDecision> {
    // Analyze request complexity
    const complexity = this.analyzeComplexity(requirements, context);

    // Determine required capabilities
    const capabilities = this.determineCapabilities(requirements, complexity);

    // Filter suitable models
    const suitableModels = this.filterSuitableModels(
      availableProviders,
      requirements,
      capabilities,
      complexity
    );

    if (suitableModels.length === 0) {
      throw new Error('No suitable models found for requirements');
    }

    // Select optimal strategy based on requirements
    const strategy = this.selectRoutingStrategy(requirements, complexity);
    this.loadBalancer.setStrategy(strategy);

    // Score and rank models
    const scoredModels = this.scoreModels(
      suitableModels,
      requirements,
      complexity
    );

    // Make routing decision
    const decision = this.makeRoutingDecision(scoredModels, strategy, context);

    // Record decision for learning
    this.recordRoutingDecision(requirements, decision);

    loggingService.info('Routing decision made', {
      task: requirements.task,
      priority: requirements.priority,
      complexity: complexity.complexity,
      selectedModel: `${decision.primaryChoice.providerId}:${decision.primaryChoice.modelId}`,
      alternatives: decision.alternatives.length,
      strategy,
    });

    return decision;
  }

  /**
   * Analyze request complexity
   */
  analyzeComplexity(
    requirements: ModelRequirements,
    context?: Record<string, any>
  ): ComplexityAnalysis {
    const factors: string[] = [];
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    let estimatedTokens = 500;

    // Check message length
    const messageLength = context?.messageLength || 0;
    if (messageLength > 2000) {
      complexity = 'moderate';
      factors.push('long input');
      estimatedTokens += messageLength / 4;
    }
    if (messageLength > 5000) {
      complexity = 'complex';
      factors.push('very long input');
    }

    // Check task requirements
    if (requirements.task === 'reasoning' || requirements.task === 'analysis') {
      complexity = complexity === 'simple' ? 'moderate' : 'complex';
      factors.push('requires reasoning');
      estimatedTokens *= 2;
    }

    if (requirements.task === 'code') {
      if (context?.codeComplexity === 'high') {
        complexity = 'complex';
        factors.push('complex code task');
        estimatedTokens *= 3;
      } else {
        complexity = 'moderate';
        factors.push('code generation');
        estimatedTokens *= 1.5;
      }
    }

    // Check for multi-step requirements
    if (context?.multiStep || context?.workflow) {
      complexity = 'complex';
      factors.push('multi-step task');
      estimatedTokens *= 2;
    }

    // Check for specific capabilities
    if (requirements.capabilities?.includes('vision')) {
      complexity = complexity === 'simple' ? 'moderate' : 'complex';
      factors.push('vision capabilities required');
    }

    // Override with explicit complexity if provided
    if (requirements.complexity) {
      complexity = requirements.complexity;
      factors.push(`explicit: ${complexity}`);
    }

    // Determine recommended models based on complexity
    const recommendedModels = this.getRecommendedModelsForComplexity(
      complexity,
      requirements.task
    );

    return {
      complexity,
      factors,
      recommendedModels,
      estimatedTokens: Math.round(estimatedTokens),
    };
  }

  /**
   * Determine required capabilities
   */
  determineCapabilities(
    requirements: ModelRequirements,
    complexity: ComplexityAnalysis
  ): CapabilityRequirements {
    const required: Set<string> = new Set();
    const preferred: Set<string> = new Set();
    const optional: Set<string> = new Set();

    // Add task-specific capabilities
    const taskCapabilities = MODEL_CAPABILITIES[requirements.task] || [];
    taskCapabilities.forEach((cap) => required.add(cap));

    // Add explicitly required capabilities
    requirements.capabilities?.forEach((cap) => required.add(cap));

    // Add complexity-based capabilities
    if (complexity.complexity === 'complex') {
      preferred.add('reasoning');
      preferred.add('long-context');
      optional.add('step-by-step');
    }

    if (
      complexity.complexity === 'moderate' ||
      complexity.complexity === 'complex'
    ) {
      preferred.add('context-aware');
    }

    // Add priority-based preferences
    if (requirements.priority === 'speed') {
      preferred.add('real-time');
      preferred.add('low-latency');
    }

    if (requirements.priority === 'quality') {
      preferred.add('factual');
      preferred.add('accuracy');
      optional.add('citations');
    }

    return {
      required: Array.from(required),
      preferred: Array.from(preferred),
      optional: Array.from(optional),
    };
  }

  /**
   * Filter models that meet requirements
   */
  filterSuitableModels(
    providers: ProviderInfo[],
    requirements: ModelRequirements,
    capabilities: CapabilityRequirements,
    complexity: ComplexityAnalysis
  ): Array<{ provider: ProviderInfo; model: ModelInfo }> {
    const suitable: Array<{ provider: ProviderInfo; model: ModelInfo }> = [];

    for (const provider of providers) {
      // Skip unhealthy providers
      if (provider.health.status === 'unhealthy') {
        continue;
      }

      for (const model of provider.models) {
        // Check task support
        if (!model.supportedTasks.includes(requirements.task)) {
          continue;
        }

        // Check required capabilities
        const modelCapabilities = this.getModelCapabilities(
          `${provider.id}:${model.id}`
        );
        const hasRequired = capabilities.required.every((cap) =>
          modelCapabilities.has(cap)
        );
        if (!hasRequired) {
          continue;
        }

        // Check token limits
        if (complexity.estimatedTokens > model.maxTokens) {
          continue;
        }

        // Check cost constraints
        if (requirements.maxCost && model.costPerToken > requirements.maxCost) {
          continue;
        }

        // Check latency constraints
        if (requirements.maxLatency) {
          const metrics = this.metricsService.getModelMetrics(
            provider.id,
            model.id
          );
          if (metrics.averageLatency > requirements.maxLatency) {
            continue;
          }
        }

        suitable.push({ provider, model });
      }
    }

    return suitable;
  }

  /**
   * Select appropriate routing strategy
   */
  selectRoutingStrategy(
    requirements: ModelRequirements,
    complexity: ComplexityAnalysis
  ): LoadBalancingStrategy {
    // Priority-based strategy selection
    if (requirements.priority === 'speed') {
      return 'least-latency';
    }

    if (requirements.priority === 'cost') {
      return 'cost-optimized';
    }

    // Complexity-based strategy
    if (complexity.complexity === 'complex') {
      return 'health-based'; // Prefer most reliable for complex tasks
    }

    // Task-based strategy
    if (requirements.task === 'chat') {
      return 'sticky-session'; // Maintain conversation continuity
    }

    // Default to adaptive strategy
    return 'adaptive';
  }

  /**
   * Score models based on requirements
   */
  scoreModels(
    models: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements: ModelRequirements,
    complexity: ComplexityAnalysis
  ): Array<{
    provider: ProviderInfo;
    model: ModelInfo;
    score: number;
    breakdown: Record<string, number>;
  }> {
    return models
      .map(({ provider, model }) => {
        const breakdown: Record<string, number> = {};

        // Base score from model capabilities
        const modelCapabilities = this.getModelCapabilities(
          `${provider.id}:${model.id}`
        );
        breakdown.capability = this.scoreCapabilities(
          modelCapabilities,
          requirements
        );

        // Performance score
        const metrics = this.metricsService.getModelMetrics(
          provider.id,
          model.id
        );
        breakdown.performance = this.scorePerformance(metrics, requirements);

        // Cost score
        breakdown.cost = this.scoreCost(model, requirements);

        // Reliability score
        breakdown.reliability = metrics.reliabilityScore / 100;

        // Complexity match score
        breakdown.complexity = this.scoreComplexityMatch(model, complexity);

        // Calculate weighted total
        const weights = this.getScoreWeights(requirements);
        const totalScore = Object.entries(breakdown).reduce(
          (sum, [key, value]) => sum + value * (weights[key] || 0.2),
          0
        );

        return {
          provider,
          model,
          score: totalScore,
          breakdown,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Make final routing decision
   */
  makeRoutingDecision(
    scoredModels: Array<{
      provider: ProviderInfo;
      model: ModelInfo;
      score: number;
      breakdown: Record<string, number>;
    }>,
    strategy: LoadBalancingStrategy,
    context?: Record<string, any>
  ): RoutingDecision {
    if (scoredModels.length === 0) {
      throw new Error('No models to route to');
    }

    // Get top model
    const topModel = scoredModels[0];

    // Get alternatives (next 3 best)
    const alternatives = scoredModels.slice(1, 4).map((m) => ({
      providerId: m.provider.id,
      modelId: `${m.provider.id}:${m.model.id}` as SupportedModelId,
      reason: this.explainModelChoice(m),
      confidence: m.score,
    }));

    return {
      primaryChoice: {
        providerId: topModel.provider.id,
        modelId:
          `${topModel.provider.id}:${topModel.model.id}` as SupportedModelId,
        reason: this.explainModelChoice(topModel),
        confidence: topModel.score,
      },
      alternatives,
      strategy,
      metadata: {
        scoreBreakdown: topModel.breakdown,
        totalCandidates: scoredModels.length,
        context,
      },
    };
  }

  /**
   * Record routing decision for learning
   */
  recordRoutingDecision(
    requirements: ModelRequirements,
    decision: RoutingDecision
  ): void {
    const key = `${requirements.task}:${requirements.priority}`;

    if (!this.routingHistory.has(key)) {
      this.routingHistory.set(key, []);
    }

    const history = this.routingHistory.get(key)!;
    history.push(decision);

    // Keep only recent history
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [key, decisions] of this.routingHistory) {
      const providers = decisions.map((d) => d.primaryChoice.providerId);
      const models = decisions.map((d) => d.primaryChoice.modelId);

      stats[key] = {
        totalDecisions: decisions.length,
        providers: this.countOccurrences(providers),
        models: this.countOccurrences(models),
        averageConfidence:
          decisions.reduce((sum, d) => sum + d.primaryChoice.confidence, 0) /
          decisions.length,
      };
    }

    return stats;
  }

  // Private helper methods

  private initializeModelCapabilities(): void {
    // Initialize known model capabilities
    // OpenAI models
    this.modelCapabilityCache.set(
      'openai:gpt-4o-mini' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'function-calling',
        'structured-output',
        'context-aware',
        'multi-turn',
        'real-time',
      ])
    );

    this.modelCapabilityCache.set(
      'openai:gpt-4.1-nano' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'creative',
        'reasoning',
        'function-calling',
        'structured-output',
        'long-context',
        'context-aware',
        'multi-turn',
        'factual',
      ])
    );

    this.modelCapabilityCache.set(
      'openai:gpt-4.1-2025-04-14' as SupportedModelId,
      new Set([
        'code',
        'analysis',
        'debugging',
        'refactoring',
        'documentation',
        'syntax-aware',
        'structured-output',
      ])
    );

    // Anthropic models
    this.modelCapabilityCache.set(
      'anthropic:claude-3-haiku-20240307' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'context-aware',
        'multi-turn',
        'real-time',
        'low-latency',
      ])
    );

    this.modelCapabilityCache.set(
      'anthropic:claude-3-5-sonnet-20241022' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'creative',
        'reasoning',
        'long-context',
        'context-aware',
        'multi-turn',
        'factual',
      ])
    );

    this.modelCapabilityCache.set(
      'anthropic:claude-3-7-sonnet-20250219' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'reasoning',
        'problem-solving',
        'step-by-step',
        'long-context',
        'factual',
      ])
    );

    this.modelCapabilityCache.set(
      'anthropic:claude-3-opus-20240229' as SupportedModelId,
      new Set([
        'chat',
        'code',
        'analysis',
        'creative',
        'reasoning',
        'storytelling',
        'ideation',
        'style-adaptation',
        'long-context',
        'factual',
      ])
    );
  }

  private getModelCapabilities(modelId: string): Set<string> {
    return this.modelCapabilityCache.get(modelId) || new Set();
  }

  private getRecommendedModelsForComplexity(
    complexity: 'simple' | 'moderate' | 'complex',
    task: string
  ): string[] {
    const recommendations: Record<string, string[]> = {
      simple: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
      moderate: ['gpt-4.1-nano', 'claude-3-5-sonnet-20241022'],
      complex: [
        'gpt-4.1-nano',
        'claude-3-7-sonnet-20250219',
        'claude-3-opus-20240229',
      ],
    };

    // Add task-specific recommendations
    if (task === 'code' && complexity !== 'simple') {
      recommendations[complexity].push('gpt-4.1-2025-04-14');
    }

    return recommendations[complexity] || [];
  }

  private scoreCapabilities(
    modelCapabilities: Set<string>,
    requirements: ModelRequirements
  ): number {
    let score = 0;
    const requiredCapabilities = requirements.capabilities || [];

    // Check required capabilities
    for (const cap of requiredCapabilities) {
      if (modelCapabilities.has(cap)) {
        score += 0.3;
      }
    }

    // Bonus for task-specific capabilities
    const taskCaps = MODEL_CAPABILITIES[requirements.task] || [];
    for (const cap of taskCaps) {
      if (modelCapabilities.has(cap)) {
        score += 0.1;
      }
    }

    return Math.min(1.0, score);
  }

  private scorePerformance(
    metrics: any,
    requirements: ModelRequirements
  ): number {
    if (requirements.priority !== 'speed') {
      return 0.7; // Default performance score
    }

    const latency = metrics.averageLatency || 1000;
    if (latency <= 500) return 1.0;
    if (latency >= 5000) return 0.2;
    return 1.0 - (latency - 500) / 4500;
  }

  private scoreCost(model: ModelInfo, requirements: ModelRequirements): number {
    if (requirements.priority !== 'cost') {
      return 0.7; // Default cost score
    }

    const cost = model.costPerToken;
    if (cost <= 0.000_02) return 1.0;
    if (cost >= 0.0003) return 0.2;
    return 1.0 - Math.log10(cost * 50_000) / 2;
  }

  private scoreComplexityMatch(
    model: ModelInfo,
    complexity: ComplexityAnalysis
  ): number {
    const recommended = complexity.recommendedModels;
    if (recommended.includes(model.id)) {
      return 1.0;
    }

    // Partial score based on capabilities
    if (complexity.complexity === 'complex' && model.maxTokens >= 100_000) {
      return 0.8;
    }
    if (complexity.complexity === 'moderate' && model.maxTokens >= 50_000) {
      return 0.8;
    }
    if (complexity.complexity === 'simple' && model.costPerToken <= 0.000_05) {
      return 0.8;
    }

    return 0.5;
  }

  private getScoreWeights(
    requirements: ModelRequirements
  ): Record<string, number> {
    const baseWeights = {
      capability: 0.3,
      performance: 0.2,
      cost: 0.2,
      reliability: 0.2,
      complexity: 0.1,
    };

    // Adjust weights based on priority
    if (requirements.priority === 'speed') {
      baseWeights.performance = 0.4;
      baseWeights.cost = 0.1;
    } else if (requirements.priority === 'cost') {
      baseWeights.cost = 0.4;
      baseWeights.performance = 0.1;
    } else if (requirements.priority === 'quality') {
      baseWeights.capability = 0.4;
      baseWeights.reliability = 0.3;
    }

    return baseWeights;
  }

  private explainModelChoice(model: {
    provider: ProviderInfo;
    model: ModelInfo;
    score: number;
    breakdown: Record<string, number>;
  }): string {
    const topFactors = Object.entries(model.breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([factor, score]) => `${factor}: ${(score * 100).toFixed(0)}%`);

    return `Selected for ${topFactors.join(', ')}`;
  }

  private countOccurrences(items: string[]): Record<string, number> {
    return items.reduce(
      (acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

// Export singleton getter
export const getIntelligentRouter = (): IntelligentRoutingEngine => {
  return IntelligentRoutingEngine.getInstance();
};
