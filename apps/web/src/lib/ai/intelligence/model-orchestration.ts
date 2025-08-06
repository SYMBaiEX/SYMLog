'use client';

/**
 * Advanced AI Model Orchestration System
 * Inspired by recent projects: LibreChat, big-AGI, OpenHands, Lobe-Chat
 * August 2025 - Latest model integration patterns
 */

export type ModelRole =
  | 'reasoning' // o3-mini, o4-mini for complex problem solving
  | 'coding' // gpt-4.1-nano for fast code generation
  | 'embedding' // text-embedding-3-large for semantic search
  | 'conversation' // gpt-4.1-nano for general chat
  | 'research' // o4-mini-deep-research for comprehensive analysis
  | 'vision' // gpt-4.1-nano with vision capabilities
  | 'function'; // gpt-4.1-nano for function calling

export interface ModelCapabilities {
  reasoning: boolean;
  vision: boolean;
  functionCalling: boolean;
  multiModal: boolean;
  contextWindow: number;
  maxOutput: number;
  costTier: 'nano' | 'mini' | 'standard' | 'premium';
}

export interface ModelConfig {
  id: string;
  displayName: string;
  role: ModelRole;
  description: string; // Detailed capability description for tooltips
  capabilities: ModelCapabilities;
  pricing: {
    input: number; // Per 1M tokens
    output: number; // Per 1M tokens
    cached?: number; // Per 1M cached tokens
  };
  benchmarks?: {
    coding?: number;
    reasoning?: number;
    math?: number;
    elo?: number;
    mmlu?: number;
    gpqa?: number;
    aime?: number;
  };
  useCase: string; // Primary use case summary
  requiresExplicitSelection?: boolean; // For expensive reasoning models
}

// Latest OpenAI Model Configuration (August 2025)
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4.1-nano': {
    id: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    role: 'conversation',
    description:
      'Fastest and most cost-effective model. Ideal for classification, autocompletion, and general conversation. Responds in under 5 seconds with 1M token context.',
    capabilities: {
      reasoning: false, // Basic reasoning only
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 1_047_576,
      maxOutput: 32_768,
      costTier: 'nano',
    },
    pricing: { input: 0.1, output: 0.4, cached: 0.025 },
    benchmarks: { elo: 1280, coding: 9.8, mmlu: 80.1 },
    useCase: 'General chat, classification, autocompletion',
  },
  'gpt-4.1-nano-2025-04-14': {
    id: 'gpt-4.1-nano-2025-04-14',
    displayName: 'GPT-4.1 Nano (Apr 2025)',
    role: 'coding',
    description:
      'Optimized for code generation and programming tasks. Fast responses with 1M token context. Good balance of speed and coding capability.',
    capabilities: {
      reasoning: false, // Basic reasoning
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 1_047_576,
      maxOutput: 32_768,
      costTier: 'nano',
    },
    pricing: { input: 0.1, output: 0.4, cached: 0.025 },
    benchmarks: { coding: 12.5, mmlu: 80.1 },
    useCase: 'Code generation, programming assistance',
  },
  'gpt-4.1-mini-2025-04-14': {
    id: 'gpt-4.1-mini-2025-04-14',
    displayName: 'GPT-4.1 Mini (Apr 2025)',
    role: 'conversation',
    description:
      'Balanced performance and cost for general tasks. Better reasoning than nano models with 200K context. Good for complex conversations.',
    capabilities: {
      reasoning: true, // Better reasoning than nano
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 200_000,
      maxOutput: 65_536,
      costTier: 'mini',
    },
    pricing: { input: 0.5, output: 2.0, cached: 0.125 },
    benchmarks: { mmlu: 85.2, coding: 15.8 },
    useCase: 'Complex conversations, balanced tasks',
  },
  'o3-mini': {
    id: 'o3-mini',
    displayName: 'o3-mini',
    role: 'reasoning',
    description:
      '⚠️ EXPENSIVE: Advanced reasoning model that "thinks" before responding. Excels at complex math, logic, and step-by-step problem solving. 10x cost of nano models.',
    capabilities: {
      reasoning: true, // Advanced reasoning capabilities
      vision: false,
      functionCalling: true,
      multiModal: false,
      contextWindow: 200_000,
      maxOutput: 100_000,
      costTier: 'premium',
    },
    pricing: { input: 1.1, output: 4.4, cached: 0.55 },
    benchmarks: { reasoning: 1305, math: 85, gpqa: 78.5 },
    useCase: 'Complex reasoning, advanced math, logical analysis',
    requiresExplicitSelection: true,
  },
  'o4-mini': {
    id: 'o4-mini',
    displayName: 'o4-mini',
    role: 'reasoning',
    description:
      '⚠️ EXPENSIVE: Latest reasoning model with vision. Can "think with images" and excel at visual reasoning, math (99.5% AIME), and coding. Premium pricing.',
    capabilities: {
      reasoning: true, // Most advanced reasoning
      vision: true, // Can reason with images
      functionCalling: true,
      multiModal: true,
      contextWindow: 200_000,
      maxOutput: 100_000,
      costTier: 'premium',
    },
    pricing: { input: 1.1, output: 4.4, cached: 0.275 },
    benchmarks: { reasoning: 1320, coding: 90, aime: 99.5, math: 95.2 },
    useCase:
      'Advanced reasoning with images, complex math, expert-level coding',
    requiresExplicitSelection: true,
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    displayName: 'Text Embedding 3 Large',
    role: 'embedding',
    description:
      'Specialized for semantic search and text similarity. Converts text to high-dimensional vectors (3072 dimensions) for advanced search and recommendations.',
    capabilities: {
      reasoning: false,
      vision: false,
      functionCalling: false,
      multiModal: false,
      contextWindow: 8192,
      maxOutput: 3072, // Embedding dimensions
      costTier: 'standard',
    },
    pricing: { input: 0.13, output: 0 },
    benchmarks: {},
    useCase: 'Semantic search, text similarity, recommendations',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    role: 'conversation',
    description:
      'Multimodal model with strong vision capabilities. Good for image analysis, document processing, and general tasks. Proven reliable performance.',
    capabilities: {
      reasoning: true, // Good reasoning
      vision: true, // Strong vision capabilities
      functionCalling: true,
      multiModal: true,
      contextWindow: 128_000,
      maxOutput: 16_384,
      costTier: 'mini',
    },
    pricing: { input: 0.15, output: 0.6, cached: 0.075 },
    benchmarks: { mmlu: 82.0, coding: 18.1 },
    useCase: 'Image analysis, document processing, multimodal tasks',
  },
};

/**
 * Advanced Model Selection Strategy
 * Inspired by LibreChat's intelligent model routing
 */
export class ModelOrchestrator {
  private static instance: ModelOrchestrator;
  private usage = new Map<string, number>();
  private performance = new Map<
    string,
    { latency: number[]; success: number }
  >();

  static getInstance(): ModelOrchestrator {
    if (!ModelOrchestrator.instance) {
      ModelOrchestrator.instance = new ModelOrchestrator();
    }
    return ModelOrchestrator.instance;
  }

  /**
   * Get model suggestions based on task type and context (no automatic selection)
   */
  getModelSuggestions(task: {
    type: ModelRole;
    complexity: 'low' | 'medium' | 'high';
    requiresVision?: boolean;
    requiresFunctions?: boolean;
    maxTokens?: number;
    budget?: 'minimal' | 'balanced' | 'premium';
  }): { recommended: ModelConfig[]; reasoning: ModelConfig[] } {
    const allModels = Object.values(MODEL_CONFIGS);

    // Filter models that meet basic requirements
    const compatibleModels = allModels.filter((model) => {
      if (task.requiresVision && !model.capabilities.vision) return false;
      if (task.requiresFunctions && !model.capabilities.functionCalling)
        return false;
      if (task.maxTokens && model.capabilities.maxOutput < task.maxTokens)
        return false;
      return true;
    });

    // Separate reasoning models (require explicit selection)
    const reasoningModels = compatibleModels.filter(
      (model) => model.requiresExplicitSelection && model.capabilities.reasoning
    );

    // Get recommended models (exclude expensive reasoning models)
    const recommendedModels = compatibleModels
      .filter((model) => !model.requiresExplicitSelection)
      .sort((a, b) => {
        // Sort by appropriateness for task
        const getTaskScore = (model: ModelConfig) => {
          let score = 0;

          // Role matching
          if (model.role === task.type) score += 3;

          // Budget considerations
          if (
            task.budget === 'minimal' &&
            model.capabilities.costTier === 'nano'
          )
            score += 2;
          if (
            task.budget === 'balanced' &&
            ['nano', 'mini'].includes(model.capabilities.costTier)
          )
            score += 1;

          // Capability matching
          if (task.requiresVision && model.capabilities.vision) score += 1;
          if (task.requiresFunctions && model.capabilities.functionCalling)
            score += 1;

          return score;
        };

        return getTaskScore(b) - getTaskScore(a);
      });

    return {
      recommended: recommendedModels.slice(0, 3),
      reasoning: reasoningModels,
    };
  }

  /**
   * Multi-model pipeline for complex tasks
   * Inspired by big-AGI's model chaining
   */
  async executeMultiModelPipeline(task: {
    type: 'research' | 'code-review' | 'content-creation';
    input: string;
    context?: any;
  }) {
    switch (task.type) {
      case 'research':
        return this.researchPipeline(task.input, task.context);
      case 'code-review':
        return this.codeReviewPipeline(task.input, task.context);
      case 'content-creation':
        return this.contentCreationPipeline(task.input, task.context);
      default:
        throw new Error(`Unsupported pipeline type: ${task.type}`);
    }
  }

  private async researchPipeline(query: string, context?: any) {
    // Step 1: Use embedding model for semantic search
    const embeddingSuggestions = this.getModelSuggestions({
      type: 'embedding',
      complexity: 'low',
      budget: 'balanced',
    });
    const embeddingModel = embeddingSuggestions.recommended[0];

    // Step 2: Use reasoning model for analysis
    const reasoningSuggestions = this.getModelSuggestions({
      type: 'reasoning',
      complexity: 'high',
      budget: 'premium',
    });
    const reasoningModel = reasoningSuggestions.recommended[0];

    // Step 3: Use conversation model for final synthesis
    const conversationModelSuggestions = this.getModelSuggestions({
      type: 'conversation',
      complexity: 'medium',
      budget: 'balanced',
    });
    const conversationModel = conversationModelSuggestions.recommended[0];

    return {
      pipeline: [embeddingModel, reasoningModel, conversationModel],
      strategy: 'research-synthesis',
    };
  }

  private async codeReviewPipeline(code: string, context?: any) {
    // Step 1: Use coding model for technical analysis
    const codingModelSuggestions = this.getModelSuggestions({
      type: 'coding',
      complexity: 'high',
      requiresFunctions: true,
      budget: 'balanced',
    });
    const codingModel = codingModelSuggestions.recommended[0];

    // Step 2: Use reasoning model for logical review
    const reasoningModelSuggestions = this.getModelSuggestions({
      type: 'reasoning',
      complexity: 'high',
      budget: 'premium',
    });
    const reasoningModel = reasoningModelSuggestions.recommended[0];

    return {
      pipeline: [codingModel, reasoningModel],
      strategy: 'code-analysis',
    };
  }

  private async contentCreationPipeline(prompt: string, context?: any) {
    // Use nano model for fast, cost-effective content generation
    const conversationModelSuggestions = this.getModelSuggestions({
      type: 'conversation',
      complexity: 'medium',
      budget: 'minimal',
    });
    const conversationModel = conversationModelSuggestions.recommended[0];

    return {
      pipeline: [conversationModel],
      strategy: 'content-generation',
    };
  }

  /**
   * Adaptive model switching based on performance
   * Inspired by OpenHands' verified model system
   */
  recordPerformance(modelId: string, latency: number, success: boolean) {
    if (!this.performance.has(modelId)) {
      this.performance.set(modelId, { latency: [], success: 0 });
    }

    const stats = this.performance.get(modelId)!;
    stats.latency.push(latency);
    if (success) stats.success++;

    // Keep only recent performance data
    if (stats.latency.length > 100) {
      stats.latency = stats.latency.slice(-50);
    }
  }

  getModelPerformance(modelId: string) {
    const stats = this.performance.get(modelId);
    if (!stats || stats.latency.length === 0) return null;

    const avgLatency =
      stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length;
    const successRate = stats.success / stats.latency.length;

    return {
      averageLatency: avgLatency,
      successRate,
      totalRequests: stats.latency.length,
    };
  }

  /**
   * Cost optimization strategies
   * Inspired by Lobe-Chat's pricing optimization
   */
  estimateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cached = 0
  ) {
    const config = MODEL_CONFIGS[modelId];
    if (!config) return 0;

    const inputCost = (inputTokens / 1_000_000) * config.pricing.input;
    const outputCost = (outputTokens / 1_000_000) * config.pricing.output;
    const cachedCost =
      cached && config.pricing.cached
        ? (cached / 1_000_000) * config.pricing.cached
        : 0;

    return {
      total: inputCost + outputCost + cachedCost,
      breakdown: {
        input: inputCost,
        output: outputCost,
        cached: cachedCost,
      },
    };
  }

  /**
   * Get model recommendations based on current context
   */
  getRecommendations(context: {
    userTier: 'free' | 'pro' | 'enterprise';
    taskHistory: ModelRole[];
    currentUsage: number;
    budget: number;
  }) {
    const recommendations: {
      model: string;
      reason: string;
      savings?: number;
    }[] = [];

    // Recommend nano models for cost optimization
    if (context.userTier === 'free' || context.budget < 10) {
      recommendations.push({
        model: 'gpt-4.1-nano',
        reason: 'Optimal cost efficiency for general tasks',
        savings: 0.75, // 75% cost savings vs premium models
      });
    }

    // Recommend o3/o4-mini for reasoning tasks
    if (context.taskHistory.includes('reasoning')) {
      recommendations.push({
        model: 'o4-mini',
        reason: 'Superior reasoning with vision capabilities',
      });
    }

    // Recommend embeddings for search-heavy usage
    if (context.taskHistory.filter((t) => t === 'embedding').length > 5) {
      recommendations.push({
        model: 'text-embedding-3-large',
        reason: 'High-dimensional embeddings for semantic search',
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const modelOrchestrator = ModelOrchestrator.getInstance();

// MODEL_CONFIGS is already exported at line 53
