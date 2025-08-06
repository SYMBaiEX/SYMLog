"use client"

/**
 * Advanced AI Model Orchestration System
 * Inspired by recent projects: LibreChat, big-AGI, OpenHands, Lobe-Chat
 * August 2025 - Latest model integration patterns
 */

export type ModelRole = 
  | 'reasoning'      // o3-mini, o4-mini for complex problem solving
  | 'coding'         // gpt-4.1-nano for fast code generation
  | 'embedding'      // text-embedding-3-large for semantic search
  | 'conversation'   // gpt-4.1-nano for general chat
  | 'research'       // o4-mini-deep-research for comprehensive analysis
  | 'vision'         // gpt-4.1-nano with vision capabilities
  | 'function'       // gpt-4.1-nano for function calling

export interface ModelCapabilities {
  reasoning: boolean
  vision: boolean
  functionCalling: boolean
  multiModal: boolean
  contextWindow: number
  maxOutput: number
  costTier: 'nano' | 'mini' | 'standard' | 'premium'
}

export interface ModelConfig {
  id: string
  displayName: string
  role: ModelRole
  capabilities: ModelCapabilities
  pricing: {
    input: number    // Per 1M tokens
    output: number   // Per 1M tokens
    cached?: number  // Per 1M cached tokens
  }
  benchmarks?: {
    coding?: number
    reasoning?: number
    math?: number
    elo?: number
  }
}

// Latest OpenAI Model Configuration (August 2025)
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4.1-nano': {
    id: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    role: 'conversation',
    capabilities: {
      reasoning: true,
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 1047576,
      maxOutput: 32768,
      costTier: 'nano'
    },
    pricing: { input: 0.1, output: 0.4, cached: 0.025 },
    benchmarks: { elo: 1280 }
  },
  'gpt-4.1-nano-2025-04-14': {
    id: 'gpt-4.1-nano-2025-04-14',
    displayName: 'GPT-4.1 Nano (Apr 2025)',
    role: 'coding',
    capabilities: {
      reasoning: true,
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 1047576,
      maxOutput: 32768,
      costTier: 'nano'
    },
    pricing: { input: 0.1, output: 0.4, cached: 0.025 }
  },
  'gpt-4.1-mini-2025-04-14': {
    id: 'gpt-4.1-mini-2025-04-14',
    displayName: 'GPT-4.1 Mini (Apr 2025)',
    role: 'conversation',
    capabilities: {
      reasoning: true,
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 200000,
      maxOutput: 65536,
      costTier: 'mini'
    },
    pricing: { input: 0.5, output: 2.0, cached: 0.125 }
  },
  'o3-mini': {
    id: 'o3-mini',
    displayName: 'o3-mini',
    role: 'reasoning',
    capabilities: {
      reasoning: true,
      vision: false,
      functionCalling: true,
      multiModal: false,
      contextWindow: 200000,
      maxOutput: 100000,
      costTier: 'mini'
    },
    pricing: { input: 1.1, output: 4.4, cached: 0.55 },
    benchmarks: { reasoning: 1305, math: 85 }
  },
  'o4-mini': {
    id: 'o4-mini',
    displayName: 'o4-mini',
    role: 'reasoning',
    capabilities: {
      reasoning: true,
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 200000,
      maxOutput: 100000,
      costTier: 'mini'
    },
    pricing: { input: 1.1, output: 4.4, cached: 0.275 },
    benchmarks: { reasoning: 1320, coding: 90 }
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    displayName: 'Text Embedding 3 Large',
    role: 'embedding',
    capabilities: {
      reasoning: false,
      vision: false,
      functionCalling: false,
      multiModal: false,
      contextWindow: 8192,
      maxOutput: 3072, // Embedding dimensions
      costTier: 'standard'
    },
    pricing: { input: 0.13, output: 0 }
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    role: 'conversation',
    capabilities: {
      reasoning: true,
      vision: true,
      functionCalling: true,
      multiModal: true,
      contextWindow: 128000,
      maxOutput: 16384,
      costTier: 'mini'
    },
    pricing: { input: 0.15, output: 0.6, cached: 0.075 }
  }
}

/**
 * Advanced Model Selection Strategy
 * Inspired by LibreChat's intelligent model routing
 */
export class ModelOrchestrator {
  private static instance: ModelOrchestrator
  private usage = new Map<string, number>()
  private performance = new Map<string, { latency: number[], success: number }>()

  static getInstance(): ModelOrchestrator {
    if (!ModelOrchestrator.instance) {
      ModelOrchestrator.instance = new ModelOrchestrator()
    }
    return ModelOrchestrator.instance
  }

  /**
   * Smart model selection based on task type and context
   */
  selectOptimalModel(task: {
    type: ModelRole
    complexity: 'low' | 'medium' | 'high'
    requiresVision?: boolean
    requiresFunctions?: boolean
    maxTokens?: number
    budget?: 'minimal' | 'balanced' | 'premium'
  }): string {
    const candidates = Object.values(MODEL_CONFIGS)
      .filter(model => {
        // Filter by role compatibility
        if (task.type === 'reasoning' && !model.capabilities.reasoning) return false
        if (task.requiresVision && !model.capabilities.vision) return false
        if (task.requiresFunctions && !model.capabilities.functionCalling) return false
        if (task.maxTokens && model.capabilities.maxOutput < task.maxTokens) return false
        
        // Filter by budget
        if (task.budget === 'minimal' && model.capabilities.costTier !== 'nano') return false
        if (task.budget === 'balanced' && !['nano', 'mini'].includes(model.capabilities.costTier)) return false
        
        return true
      })
      .sort((a, b) => {
        // Primary: Cost efficiency for task complexity
        const costScore = (model: ModelConfig) => {
          const baseCost = model.pricing.input + model.pricing.output
          const complexityMultiplier = task.complexity === 'high' ? 0.5 : 
                                     task.complexity === 'medium' ? 0.7 : 1.0
          return baseCost * complexityMultiplier
        }

        // Secondary: Performance benchmarks
        const performanceScore = (model: ModelConfig) => {
          if (task.type === 'reasoning') return model.benchmarks?.reasoning || 1000
          if (task.type === 'coding') return model.benchmarks?.coding || 50
          return model.benchmarks?.elo || 1200
        }

        const scoreA = costScore(a) / performanceScore(a) * 1000
        const scoreB = costScore(b) / performanceScore(b) * 1000
        
        return scoreA - scoreB
      })

    return candidates[0]?.id || 'gpt-4.1-nano'
  }

  /**
   * Multi-model pipeline for complex tasks
   * Inspired by big-AGI's model chaining
   */
  async executeMultiModelPipeline(task: {
    type: 'research' | 'code-review' | 'content-creation'
    input: string
    context?: any
  }) {
    switch (task.type) {
      case 'research':
        return this.researchPipeline(task.input, task.context)
      case 'code-review':
        return this.codeReviewPipeline(task.input, task.context)
      case 'content-creation':
        return this.contentCreationPipeline(task.input, task.context)
      default:
        throw new Error(`Unsupported pipeline type: ${task.type}`)
    }
  }

  private async researchPipeline(query: string, context?: any) {
    // Step 1: Use embedding model for semantic search
    const embeddingModel = this.selectOptimalModel({
      type: 'embedding',
      complexity: 'low',
      budget: 'balanced'
    })

    // Step 2: Use reasoning model for analysis
    const reasoningModel = this.selectOptimalModel({
      type: 'reasoning',
      complexity: 'high',
      budget: 'premium'
    })

    // Step 3: Use conversation model for final synthesis
    const conversationModel = this.selectOptimalModel({
      type: 'conversation',
      complexity: 'medium',
      budget: 'balanced'
    })

    return {
      pipeline: [embeddingModel, reasoningModel, conversationModel],
      strategy: 'research-synthesis'
    }
  }

  private async codeReviewPipeline(code: string, context?: any) {
    // Step 1: Use coding model for technical analysis
    const codingModel = this.selectOptimalModel({
      type: 'coding',
      complexity: 'high',
      requiresFunctions: true,
      budget: 'balanced'
    })

    // Step 2: Use reasoning model for logical review
    const reasoningModel = this.selectOptimalModel({
      type: 'reasoning',
      complexity: 'high',
      budget: 'premium'
    })

    return {
      pipeline: [codingModel, reasoningModel],
      strategy: 'code-analysis'
    }
  }

  private async contentCreationPipeline(prompt: string, context?: any) {
    // Use nano model for fast, cost-effective content generation
    const conversationModel = this.selectOptimalModel({
      type: 'conversation',
      complexity: 'medium',
      budget: 'minimal'
    })

    return {
      pipeline: [conversationModel],
      strategy: 'content-generation'
    }
  }

  /**
   * Adaptive model switching based on performance
   * Inspired by OpenHands' verified model system
   */
  recordPerformance(modelId: string, latency: number, success: boolean) {
    if (!this.performance.has(modelId)) {
      this.performance.set(modelId, { latency: [], success: 0 })
    }

    const stats = this.performance.get(modelId)!
    stats.latency.push(latency)
    if (success) stats.success++

    // Keep only recent performance data
    if (stats.latency.length > 100) {
      stats.latency = stats.latency.slice(-50)
    }
  }

  getModelPerformance(modelId: string) {
    const stats = this.performance.get(modelId)
    if (!stats || stats.latency.length === 0) return null

    const avgLatency = stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length
    const successRate = stats.success / stats.latency.length

    return {
      averageLatency: avgLatency,
      successRate,
      totalRequests: stats.latency.length
    }
  }

  /**
   * Cost optimization strategies
   * Inspired by Lobe-Chat's pricing optimization
   */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number, cached = 0) {
    const config = MODEL_CONFIGS[modelId]
    if (!config) return 0

    const inputCost = (inputTokens / 1_000_000) * config.pricing.input
    const outputCost = (outputTokens / 1_000_000) * config.pricing.output
    const cachedCost = cached && config.pricing.cached ? 
      (cached / 1_000_000) * config.pricing.cached : 0

    return {
      total: inputCost + outputCost + cachedCost,
      breakdown: {
        input: inputCost,
        output: outputCost,
        cached: cachedCost
      }
    }
  }

  /**
   * Get model recommendations based on current context
   */
  getRecommendations(context: {
    userTier: 'free' | 'pro' | 'enterprise'
    taskHistory: ModelRole[]
    currentUsage: number
    budget: number
  }) {
    const recommendations: { model: string; reason: string; savings?: number }[] = []

    // Recommend nano models for cost optimization
    if (context.userTier === 'free' || context.budget < 10) {
      recommendations.push({
        model: 'gpt-4.1-nano',
        reason: 'Optimal cost efficiency for general tasks',
        savings: 0.75 // 75% cost savings vs premium models
      })
    }

    // Recommend o3/o4-mini for reasoning tasks
    if (context.taskHistory.includes('reasoning')) {
      recommendations.push({
        model: 'o4-mini',
        reason: 'Superior reasoning with vision capabilities',
      })
    }

    // Recommend embeddings for search-heavy usage
    if (context.taskHistory.filter(t => t === 'embedding').length > 5) {
      recommendations.push({
        model: 'text-embedding-3-large',
        reason: 'High-dimensional embeddings for semantic search'
      })
    }

    return recommendations
  }
}

// Export singleton instance
export const modelOrchestrator = ModelOrchestrator.getInstance()