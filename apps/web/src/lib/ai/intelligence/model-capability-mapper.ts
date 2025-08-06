import { logError as logErrorToConsole } from '@/lib/logger';

// Logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Model capability definitions
export interface ModelCapability {
  modelId: string;
  providerId: string;
  displayName: string;
  description: string;
  features: ModelFeatures;
  limits: ModelLimits;
  pricing: ModelPricing;
  availability: ModelAvailability;
  performance: ModelPerformance;
  compatibilityMatrix: CompatibilityMatrix;
  lastUpdated: Date;
  version?: string;
  deprecated?: boolean;
  replacement?: string;
}

// Feature set that a model supports
export interface ModelFeatures {
  textGeneration: boolean;
  chatCompletion: boolean;
  functionCalling: boolean;
  toolUse: boolean;
  jsonMode: boolean;
  streaming: boolean;
  vision: boolean;
  imageGeneration: boolean;
  embedding: boolean;
  multimodal: boolean;
  reasoning: boolean;
  codeGeneration: boolean;
  mathematicalReasoning: boolean;
  multilingualSupport: string[]; // Language codes
  customInstructions: boolean;
  systemPrompts: boolean;
  contextWindow: number;
  outputTokenLimit: number;
}

// Model limitations and constraints
export interface ModelLimits {
  maxTokensPerRequest: number;
  maxTokensPerMinute: number;
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
  maxBatchSize: number;
  maxFileSize?: number; // For vision/document processing
  supportedFileTypes?: string[];
  regionRestrictions?: string[];
  timeouts: {
    default: number;
    streaming: number;
    batch: number;
  };
}

// Pricing information
export interface ModelPricing {
  inputTokenPrice: number; // Per 1K tokens
  outputTokenPrice: number; // Per 1K tokens
  imagePrice?: number; // Per image
  requestPrice?: number; // Per request
  currency: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  billingModel: 'pay-per-use' | 'subscription' | 'credits';
  minimumCharge?: number;
  discounts?: {
    volume?: Array<{ threshold: number; discount: number }>;
    subscription?: number;
  };
}

// Model availability information
export interface ModelAvailability {
  status: 'stable' | 'beta' | 'alpha' | 'deprecated' | 'discontinued';
  regions: string[];
  uptime: number; // Percentage
  maintenanceWindows?: Array<{
    start: string;
    end: string;
    timezone: string;
    recurring?: boolean;
  }>;
  releaseDate: Date;
  deprecationDate?: Date;
  supportEndDate?: Date;
}

// Performance characteristics
export interface ModelPerformance {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number; // Tokens per second
  accuracyScore?: number;
  reasoningScore?: number;
  creativityScore?: number;
  safetyScore?: number;
  benchmarks: {
    [benchmarkName: string]: {
      score: number;
      percentile?: number;
      date: Date;
    };
  };
}

// Compatibility matrix for different use cases
export interface CompatibilityMatrix {
  useCases: {
    chatbot: CompatibilityScore;
    codeGeneration: CompatibilityScore;
    contentCreation: CompatibilityScore;
    dataAnalysis: CompatibilityScore;
    translation: CompatibilityScore;
    summarization: CompatibilityScore;
    questionAnswering: CompatibilityScore;
    reasoning: CompatibilityScore;
    multimodal: CompatibilityScore;
    embeddings: CompatibilityScore;
  };
  frameworks: {
    [frameworkName: string]: CompatibilityScore;
  };
  integrations: {
    [integrationName: string]: CompatibilityScore;
  };
}

// Compatibility scoring
export interface CompatibilityScore {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'incompatible';
  notes?: string;
  requirements?: string[];
  limitations?: string[];
  lastTested?: Date;
}

// Capability query filters
export interface CapabilityQuery {
  features?: Partial<ModelFeatures>;
  maxLatency?: number;
  maxCost?: number;
  minAccuracy?: number;
  requiredRegions?: string[];
  excludeDeprecated?: boolean;
  includeStatus?: ModelAvailability['status'][];
  useCaseFilter?: keyof CompatibilityMatrix['useCases'];
  minCompatibilityScore?: number;
}

// Query result
export interface CapabilityQueryResult {
  models: ModelCapability[];
  totalMatches: number;
  query: CapabilityQuery;
  executionTime: number;
  recommendations: ModelRecommendation[];
}

// Model recommendation with scoring
export interface ModelRecommendation {
  model: ModelCapability;
  score: number;
  reasons: string[];
  warnings?: string[];
  alternatives?: string[];
}

/**
 * Model Capability Mapper
 * Comprehensive mapping and querying of AI model capabilities
 */
export class ModelCapabilityMapper {
  private static instance: ModelCapabilityMapper;
  private capabilities: Map<string, ModelCapability> = new Map();
  private providerCapabilities: Map<string, string[]> = new Map();
  private lastUpdate: Date = new Date();
  private updateInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.initializeCapabilities();
    this.startUpdateLoop();
    loggingService.info('Model Capability Mapper initialized', {
      modelCount: this.capabilities.size,
    });
  }

  static getInstance(): ModelCapabilityMapper {
    if (!ModelCapabilityMapper.instance) {
      ModelCapabilityMapper.instance = new ModelCapabilityMapper();
    }
    return ModelCapabilityMapper.instance;
  }

  /**
   * Query models by capabilities
   */
  query(query: CapabilityQuery): CapabilityQueryResult {
    const startTime = Date.now();
    const allModels = Array.from(this.capabilities.values());

    // Filter models based on query
    let filteredModels = allModels.filter((model) =>
      this.matchesQuery(model, query)
    );

    // Sort by relevance score
    const recommendations = filteredModels
      .map((model) => this.scoreModel(model, query))
      .sort((a, b) => b.score - a.score);

    filteredModels = recommendations.map((r) => r.model);

    const result: CapabilityQueryResult = {
      models: filteredModels.slice(0, 20), // Limit results
      totalMatches: filteredModels.length,
      query,
      executionTime: Date.now() - startTime,
      recommendations: recommendations.slice(0, 5),
    };

    loggingService.debug('Capability query executed', {
      query,
      matches: result.totalMatches,
      executionTime: result.executionTime,
    });

    return result;
  }

  /**
   * Get capability information for a specific model
   */
  getModelCapability(modelId: string): ModelCapability | undefined {
    return this.capabilities.get(modelId);
  }

  /**
   * Get all models for a provider
   */
  getProviderModels(providerId: string): ModelCapability[] {
    const modelIds = this.providerCapabilities.get(providerId) || [];
    return modelIds
      .map((id) => this.capabilities.get(id))
      .filter((model): model is ModelCapability => model !== undefined);
  }

  /**
   * Get models that support specific features
   */
  getModelsByFeatures(features: Partial<ModelFeatures>): ModelCapability[] {
    return Array.from(this.capabilities.values()).filter((model) => {
      return Object.entries(features).every(([key, value]) => {
        const modelValue = model.features[key as keyof ModelFeatures];
        if (typeof value === 'boolean') {
          return modelValue === value;
        }
        if (typeof value === 'number') {
          return (modelValue as number) >= value;
        }
        if (Array.isArray(value)) {
          return value.every((v) => (modelValue as string[]).includes(v));
        }
        return modelValue === value;
      });
    });
  }

  /**
   * Get compatibility score for a specific use case
   */
  getCompatibilityScore(
    modelId: string,
    useCase: keyof CompatibilityMatrix['useCases']
  ): CompatibilityScore | undefined {
    const model = this.capabilities.get(modelId);
    return model?.compatibilityMatrix.useCases[useCase];
  }

  /**
   * Compare models side by side
   */
  compareModels(modelIds: string[]): {
    models: ModelCapability[];
    comparison: {
      features: Record<string, any[]>;
      performance: Record<string, number[]>;
      pricing: Record<string, number[]>;
      compatibility: Record<string, CompatibilityScore[]>;
    };
  } {
    const models = modelIds
      .map((id) => this.capabilities.get(id))
      .filter((model): model is ModelCapability => model !== undefined);

    if (models.length === 0) {
      throw new Error('No valid models found for comparison');
    }

    // Build comparison matrix
    const comparison = {
      features: {} as Record<string, any[]>,
      performance: {} as Record<string, number[]>,
      pricing: {} as Record<string, number[]>,
      compatibility: {} as Record<string, CompatibilityScore[]>,
    };

    // Feature comparison
    const featureKeys = Object.keys(models[0].features);
    for (const key of featureKeys) {
      comparison.features[key] = models.map(
        (m) => m.features[key as keyof ModelFeatures]
      );
    }

    // Performance comparison
    comparison.performance.averageLatency = models.map(
      (m) => m.performance.averageLatency
    );
    comparison.performance.p95Latency = models.map(
      (m) => m.performance.p95Latency
    );
    comparison.performance.throughput = models.map(
      (m) => m.performance.throughput
    );

    // Pricing comparison
    comparison.pricing.inputTokenPrice = models.map(
      (m) => m.pricing.inputTokenPrice
    );
    comparison.pricing.outputTokenPrice = models.map(
      (m) => m.pricing.outputTokenPrice
    );

    // Compatibility comparison
    const useCases = Object.keys(models[0].compatibilityMatrix.useCases);
    for (const useCase of useCases) {
      comparison.compatibility[useCase] = models.map(
        (m) =>
          m.compatibilityMatrix.useCases[
            useCase as keyof CompatibilityMatrix['useCases']
          ]
      );
    }

    return { models, comparison };
  }

  /**
   * Get model recommendations for a specific use case
   */
  getRecommendations(
    useCase: keyof CompatibilityMatrix['useCases'],
    constraints?: {
      maxLatency?: number;
      maxCost?: number;
      requiredFeatures?: string[];
      excludeProviders?: string[];
    }
  ): ModelRecommendation[] {
    const query: CapabilityQuery = {
      useCaseFilter: useCase,
      minCompatibilityScore: 70,
      maxLatency: constraints?.maxLatency,
      maxCost: constraints?.maxCost,
      excludeDeprecated: true,
    };

    const result = this.query(query);
    return result.recommendations;
  }

  /**
   * Update capability information for a model
   */
  updateModelCapability(
    modelId: string,
    updates: Partial<ModelCapability>
  ): void {
    const existing = this.capabilities.get(modelId);
    if (!existing) {
      loggingService.warn('Model not found for update', { modelId });
      return;
    }

    const updated = {
      ...existing,
      ...updates,
      lastUpdated: new Date(),
    };

    this.capabilities.set(modelId, updated);
    loggingService.info('Model capability updated', { modelId, updates });
  }

  /**
   * Add a new model capability
   */
  addModelCapability(capability: ModelCapability): void {
    this.capabilities.set(capability.modelId, capability);

    // Update provider mapping
    const providerModels =
      this.providerCapabilities.get(capability.providerId) || [];
    if (!providerModels.includes(capability.modelId)) {
      providerModels.push(capability.modelId);
      this.providerCapabilities.set(capability.providerId, providerModels);
    }

    loggingService.info('Model capability added', {
      modelId: capability.modelId,
      providerId: capability.providerId,
    });
  }

  /**
   * Get capability statistics
   */
  getStatistics(): {
    totalModels: number;
    providerCount: number;
    featureDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    averageLatency: number;
    priceRange: { min: number; max: number };
  } {
    const models = Array.from(this.capabilities.values());

    const featureDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    let totalLatency = 0;
    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = 0;

    for (const model of models) {
      // Feature distribution
      for (const [feature, value] of Object.entries(model.features)) {
        if (typeof value === 'boolean' && value) {
          featureDistribution[feature] =
            (featureDistribution[feature] || 0) + 1;
        }
      }

      // Status distribution
      statusDistribution[model.availability.status] =
        (statusDistribution[model.availability.status] || 0) + 1;

      // Performance stats
      totalLatency += model.performance.averageLatency;

      // Price stats
      const price = model.pricing.inputTokenPrice;
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    }

    return {
      totalModels: models.length,
      providerCount: this.providerCapabilities.size,
      featureDistribution,
      statusDistribution,
      averageLatency: models.length > 0 ? totalLatency / models.length : 0,
      priceRange: { min: minPrice, max: maxPrice },
    };
  }

  // Private methods

  private matchesQuery(
    model: ModelCapability,
    query: CapabilityQuery
  ): boolean {
    // Exclude deprecated if requested
    if (query.excludeDeprecated && model.deprecated) {
      return false;
    }

    // Status filter
    if (
      query.includeStatus &&
      !query.includeStatus.includes(model.availability.status)
    ) {
      return false;
    }

    // Latency filter
    if (
      query.maxLatency &&
      model.performance.averageLatency > query.maxLatency
    ) {
      return false;
    }

    // Cost filter (input token price)
    if (query.maxCost && model.pricing.inputTokenPrice > query.maxCost) {
      return false;
    }

    // Accuracy filter
    if (
      query.minAccuracy &&
      model.performance.accuracyScore &&
      model.performance.accuracyScore < query.minAccuracy
    ) {
      return false;
    }

    // Region filter
    if (
      query.requiredRegions &&
      !query.requiredRegions.every((region) =>
        model.availability.regions.includes(region)
      )
    ) {
      return false;
    }

    // Feature filter
    if (query.features) {
      for (const [feature, value] of Object.entries(query.features)) {
        const modelValue = model.features[feature as keyof ModelFeatures];
        if (typeof value === 'boolean' && modelValue !== value) {
          return false;
        }
        if (typeof value === 'number' && (modelValue as number) < value) {
          return false;
        }
      }
    }

    // Use case compatibility filter
    if (query.useCaseFilter && query.minCompatibilityScore) {
      const compatScore =
        model.compatibilityMatrix.useCases[query.useCaseFilter];
      if (compatScore.score < query.minCompatibilityScore) {
        return false;
      }
    }

    return true;
  }

  private scoreModel(
    model: ModelCapability,
    query: CapabilityQuery
  ): ModelRecommendation {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Base score from availability and status
    switch (model.availability.status) {
      case 'stable':
        score += 20;
        reasons.push('Stable release');
        break;
      case 'beta':
        score += 15;
        warnings.push('Beta version - may have stability issues');
        break;
      case 'alpha':
        score += 10;
        warnings.push('Alpha version - experimental features');
        break;
      case 'deprecated':
        score += 5;
        warnings.push('Deprecated - consider alternatives');
        break;
    }

    // Performance scoring
    if (model.performance.accuracyScore) {
      score += model.performance.accuracyScore * 0.3;
      reasons.push(`High accuracy score: ${model.performance.accuracyScore}`);
    }

    // Latency scoring (inverse)
    const latencyScore = Math.max(
      0,
      30 - model.performance.averageLatency / 100
    );
    score += latencyScore;
    if (latencyScore > 20) {
      reasons.push('Low latency performance');
    }

    // Cost efficiency scoring
    const costScore = Math.max(0, 20 - model.pricing.inputTokenPrice * 1000);
    score += costScore;
    if (costScore > 15) {
      reasons.push('Cost effective pricing');
    }

    // Use case compatibility
    if (query.useCaseFilter) {
      const compatScore =
        model.compatibilityMatrix.useCases[query.useCaseFilter].score;
      score += compatScore * 0.2;
      if (compatScore > 80) {
        reasons.push(`Excellent compatibility for ${query.useCaseFilter}`);
      }
    }

    // Feature completeness
    const featureCount = Object.values(model.features).filter(
      (v) => v === true
    ).length;
    score += featureCount * 2;
    if (featureCount > 10) {
      reasons.push('Rich feature set');
    }

    // Uptime bonus
    score += model.availability.uptime * 0.1;
    if (model.availability.uptime > 99.9) {
      reasons.push('High availability');
    }

    return {
      model,
      score: Math.round(score),
      reasons,
      warnings,
      alternatives: this.findAlternatives(model),
    };
  }

  private findAlternatives(model: ModelCapability): string[] {
    const alternatives: string[] = [];

    // Find models from the same provider
    const providerModels = this.getProviderModels(model.providerId);
    for (const altModel of providerModels) {
      if (altModel.modelId !== model.modelId && !altModel.deprecated) {
        alternatives.push(altModel.modelId);
      }
    }

    // Find similar models from other providers
    const similarModels = Array.from(this.capabilities.values()).filter(
      (m) =>
        m.providerId !== model.providerId &&
        !m.deprecated &&
        this.calculateSimilarity(model, m) > 0.7
    );

    alternatives.push(...similarModels.map((m) => m.modelId));

    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }

  private calculateSimilarity(
    model1: ModelCapability,
    model2: ModelCapability
  ): number {
    let similarity = 0;
    let totalComparisons = 0;

    // Compare features
    for (const [key, value] of Object.entries(model1.features)) {
      totalComparisons++;
      if (model2.features[key as keyof ModelFeatures] === value) {
        similarity++;
      }
    }

    return similarity / totalComparisons;
  }

  private initializeCapabilities(): void {
    // Initialize with known model capabilities
    const knownModels: ModelCapability[] = [
      {
        modelId: 'gpt-4o',
        providerId: 'openai',
        displayName: 'GPT-4 Omni',
        description:
          'Advanced multimodal AI model with vision and reasoning capabilities',
        features: {
          textGeneration: true,
          chatCompletion: true,
          functionCalling: true,
          toolUse: true,
          jsonMode: true,
          streaming: true,
          vision: true,
          imageGeneration: false,
          embedding: false,
          multimodal: true,
          reasoning: true,
          codeGeneration: true,
          mathematicalReasoning: true,
          multilingualSupport: [
            'en',
            'es',
            'fr',
            'de',
            'it',
            'pt',
            'ru',
            'ja',
            'ko',
            'zh',
          ],
          customInstructions: true,
          systemPrompts: true,
          contextWindow: 128_000,
          outputTokenLimit: 4096,
        },
        limits: {
          maxTokensPerRequest: 128_000,
          maxTokensPerMinute: 150_000,
          maxRequestsPerMinute: 3500,
          maxConcurrentRequests: 100,
          maxBatchSize: 20,
          maxFileSize: 20 * 1024 * 1024, // 20MB
          supportedFileTypes: ['jpg', 'png', 'gif', 'webp'],
          timeouts: {
            default: 30_000,
            streaming: 60_000,
            batch: 120_000,
          },
        },
        pricing: {
          inputTokenPrice: 2.5,
          outputTokenPrice: 10.0,
          currency: 'USD',
          tier: 'premium',
          billingModel: 'pay-per-use',
        },
        availability: {
          status: 'stable',
          regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
          uptime: 99.95,
          releaseDate: new Date('2024-05-13'),
        },
        performance: {
          averageLatency: 1200,
          p95Latency: 2500,
          p99Latency: 4000,
          throughput: 85,
          accuracyScore: 92,
          reasoningScore: 89,
          creativityScore: 88,
          safetyScore: 95,
          benchmarks: {
            MMLU: { score: 87.2, percentile: 95, date: new Date('2024-06-01') },
            HellaSwag: {
              score: 95.3,
              percentile: 98,
              date: new Date('2024-06-01'),
            },
            GSM8K: {
              score: 92.0,
              percentile: 94,
              date: new Date('2024-06-01'),
            },
          },
        },
        compatibilityMatrix: {
          useCases: {
            chatbot: {
              score: 95,
              status: 'excellent',
              notes: 'Excellent conversational AI',
            },
            codeGeneration: {
              score: 92,
              status: 'excellent',
              notes: 'Strong coding capabilities',
            },
            contentCreation: {
              score: 90,
              status: 'excellent',
              notes: 'Creative and engaging content',
            },
            dataAnalysis: {
              score: 85,
              status: 'good',
              notes: 'Good analytical reasoning',
            },
            translation: {
              score: 88,
              status: 'good',
              notes: 'Supports 50+ languages',
            },
            summarization: {
              score: 91,
              status: 'excellent',
              notes: 'Concise and accurate summaries',
            },
            questionAnswering: {
              score: 93,
              status: 'excellent',
              notes: 'Comprehensive Q&A',
            },
            reasoning: {
              score: 89,
              status: 'good',
              notes: 'Strong logical reasoning',
            },
            multimodal: {
              score: 94,
              status: 'excellent',
              notes: 'Advanced vision capabilities',
            },
            embeddings: {
              score: 0,
              status: 'incompatible',
              notes: 'Use text-embedding models',
            },
          },
          frameworks: {
            'vercel-ai-sdk': { score: 100, status: 'excellent' },
            langchain: { score: 95, status: 'excellent' },
            llamaindex: { score: 90, status: 'excellent' },
          },
          integrations: {
            'openai-api': { score: 100, status: 'excellent' },
            'azure-openai': { score: 95, status: 'excellent' },
          },
        },
        lastUpdated: new Date(),
      },
      {
        modelId: 'gpt-4o-mini',
        providerId: 'openai',
        displayName: 'GPT-4 Omni Mini',
        description: 'Fast and cost-effective version of GPT-4 Omni',
        features: {
          textGeneration: true,
          chatCompletion: true,
          functionCalling: true,
          toolUse: true,
          jsonMode: true,
          streaming: true,
          vision: true,
          imageGeneration: false,
          embedding: false,
          multimodal: true,
          reasoning: true,
          codeGeneration: true,
          mathematicalReasoning: true,
          multilingualSupport: [
            'en',
            'es',
            'fr',
            'de',
            'it',
            'pt',
            'ru',
            'ja',
            'ko',
            'zh',
          ],
          customInstructions: true,
          systemPrompts: true,
          contextWindow: 128_000,
          outputTokenLimit: 16_384,
        },
        limits: {
          maxTokensPerRequest: 128_000,
          maxTokensPerMinute: 200_000,
          maxRequestsPerMinute: 5000,
          maxConcurrentRequests: 150,
          maxBatchSize: 50,
          timeouts: {
            default: 20_000,
            streaming: 40_000,
            batch: 90_000,
          },
        },
        pricing: {
          inputTokenPrice: 0.15,
          outputTokenPrice: 0.6,
          currency: 'USD',
          tier: 'basic',
          billingModel: 'pay-per-use',
        },
        availability: {
          status: 'stable',
          regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
          uptime: 99.97,
          releaseDate: new Date('2024-07-18'),
        },
        performance: {
          averageLatency: 800,
          p95Latency: 1800,
          p99Latency: 3000,
          throughput: 120,
          accuracyScore: 87,
          reasoningScore: 84,
          creativityScore: 83,
          safetyScore: 94,
          benchmarks: {
            MMLU: { score: 82.0, percentile: 88, date: new Date('2024-08-01') },
            HellaSwag: {
              score: 91.8,
              percentile: 92,
              date: new Date('2024-08-01'),
            },
          },
        },
        compatibilityMatrix: {
          useCases: {
            chatbot: {
              score: 92,
              status: 'excellent',
              notes: 'Great for high-volume chatbots',
            },
            codeGeneration: {
              score: 88,
              status: 'good',
              notes: 'Solid coding performance',
            },
            contentCreation: {
              score: 85,
              status: 'good',
              notes: 'Good content generation',
            },
            dataAnalysis: {
              score: 82,
              status: 'good',
              notes: 'Basic analytical capabilities',
            },
            translation: {
              score: 86,
              status: 'good',
              notes: 'Good translation quality',
            },
            summarization: {
              score: 89,
              status: 'good',
              notes: 'Effective summarization',
            },
            questionAnswering: {
              score: 90,
              status: 'excellent',
              notes: 'Quick and accurate Q&A',
            },
            reasoning: {
              score: 84,
              status: 'good',
              notes: 'Decent reasoning abilities',
            },
            multimodal: {
              score: 87,
              status: 'good',
              notes: 'Basic vision capabilities',
            },
            embeddings: {
              score: 0,
              status: 'incompatible',
              notes: 'Use text-embedding models',
            },
          },
          frameworks: {
            'vercel-ai-sdk': { score: 100, status: 'excellent' },
            langchain: { score: 95, status: 'excellent' },
            llamaindex: { score: 90, status: 'excellent' },
          },
          integrations: {
            'openai-api': { score: 100, status: 'excellent' },
            'azure-openai': { score: 95, status: 'excellent' },
          },
        },
        lastUpdated: new Date(),
      },
      {
        modelId: 'text-embedding-3-large',
        providerId: 'openai',
        displayName: 'Text Embedding 3 Large',
        description:
          'High-performance text embedding model with 3072 dimensions',
        features: {
          textGeneration: false,
          chatCompletion: false,
          functionCalling: false,
          toolUse: false,
          jsonMode: false,
          streaming: false,
          vision: false,
          imageGeneration: false,
          embedding: true,
          multimodal: false,
          reasoning: false,
          codeGeneration: false,
          mathematicalReasoning: false,
          multilingualSupport: [
            'en',
            'es',
            'fr',
            'de',
            'it',
            'pt',
            'ru',
            'ja',
            'ko',
            'zh',
          ],
          customInstructions: false,
          systemPrompts: false,
          contextWindow: 8191,
          outputTokenLimit: 0,
        },
        limits: {
          maxTokensPerRequest: 8191,
          maxTokensPerMinute: 1_000_000,
          maxRequestsPerMinute: 5000,
          maxConcurrentRequests: 100,
          maxBatchSize: 2048,
          timeouts: {
            default: 10_000,
            streaming: 0,
            batch: 60_000,
          },
        },
        pricing: {
          inputTokenPrice: 0.13,
          outputTokenPrice: 0,
          currency: 'USD',
          tier: 'basic',
          billingModel: 'pay-per-use',
        },
        availability: {
          status: 'stable',
          regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
          uptime: 99.98,
          releaseDate: new Date('2024-01-25'),
        },
        performance: {
          averageLatency: 150,
          p95Latency: 300,
          p99Latency: 500,
          throughput: 2000,
          benchmarks: {
            MTEB: { score: 64.6, percentile: 95, date: new Date('2024-02-01') },
          },
        },
        compatibilityMatrix: {
          useCases: {
            chatbot: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for chat generation',
            },
            codeGeneration: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for code generation',
            },
            contentCreation: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for content creation',
            },
            dataAnalysis: {
              score: 85,
              status: 'good',
              notes: 'Good for semantic search',
            },
            translation: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for translation',
            },
            summarization: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for summarization',
            },
            questionAnswering: {
              score: 90,
              status: 'excellent',
              notes: 'Excellent for RAG systems',
            },
            reasoning: {
              score: 0,
              status: 'incompatible',
              notes: 'Not for reasoning',
            },
            multimodal: {
              score: 0,
              status: 'incompatible',
              notes: 'Text only',
            },
            embeddings: {
              score: 98,
              status: 'excellent',
              notes: 'Primary use case',
            },
          },
          frameworks: {
            'vercel-ai-sdk': { score: 100, status: 'excellent' },
            langchain: { score: 100, status: 'excellent' },
            llamaindex: { score: 100, status: 'excellent' },
          },
          integrations: {
            'openai-api': { score: 100, status: 'excellent' },
            pinecone: { score: 95, status: 'excellent' },
            weaviate: { score: 95, status: 'excellent' },
          },
        },
        lastUpdated: new Date(),
      },
      {
        modelId: 'claude-3-5-sonnet-20241022',
        providerId: 'anthropic',
        displayName: 'Claude 3.5 Sonnet',
        description:
          "Anthropic's flagship model with excellent reasoning and coding capabilities",
        features: {
          textGeneration: true,
          chatCompletion: true,
          functionCalling: true,
          toolUse: true,
          jsonMode: false,
          streaming: true,
          vision: true,
          imageGeneration: false,
          embedding: false,
          multimodal: true,
          reasoning: true,
          codeGeneration: true,
          mathematicalReasoning: true,
          multilingualSupport: [
            'en',
            'es',
            'fr',
            'de',
            'it',
            'pt',
            'ru',
            'ja',
            'ko',
            'zh',
          ],
          customInstructions: true,
          systemPrompts: true,
          contextWindow: 200_000,
          outputTokenLimit: 8192,
        },
        limits: {
          maxTokensPerRequest: 200_000,
          maxTokensPerMinute: 40_000,
          maxRequestsPerMinute: 1000,
          maxConcurrentRequests: 50,
          maxBatchSize: 10,
          timeouts: {
            default: 45_000,
            streaming: 90_000,
            batch: 180_000,
          },
        },
        pricing: {
          inputTokenPrice: 3.0,
          outputTokenPrice: 15.0,
          currency: 'USD',
          tier: 'premium',
          billingModel: 'pay-per-use',
        },
        availability: {
          status: 'stable',
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
          uptime: 99.92,
          releaseDate: new Date('2024-10-22'),
        },
        performance: {
          averageLatency: 1800,
          p95Latency: 3500,
          p99Latency: 6000,
          throughput: 65,
          accuracyScore: 94,
          reasoningScore: 96,
          creativityScore: 93,
          safetyScore: 98,
          benchmarks: {
            MMLU: { score: 88.7, percentile: 97, date: new Date('2024-11-01') },
            HumanEval: {
              score: 92.0,
              percentile: 99,
              date: new Date('2024-11-01'),
            },
            GSM8K: {
              score: 96.4,
              percentile: 98,
              date: new Date('2024-11-01'),
            },
          },
        },
        compatibilityMatrix: {
          useCases: {
            chatbot: {
              score: 96,
              status: 'excellent',
              notes: 'Exceptional conversational AI',
            },
            codeGeneration: {
              score: 98,
              status: 'excellent',
              notes: 'Outstanding coding abilities',
            },
            contentCreation: {
              score: 94,
              status: 'excellent',
              notes: 'Highly creative and nuanced',
            },
            dataAnalysis: {
              score: 91,
              status: 'excellent',
              notes: 'Strong analytical reasoning',
            },
            translation: {
              score: 89,
              status: 'good',
              notes: 'Good multilingual support',
            },
            summarization: {
              score: 93,
              status: 'excellent',
              notes: 'Excellent summarization',
            },
            questionAnswering: {
              score: 95,
              status: 'excellent',
              notes: 'Comprehensive and accurate',
            },
            reasoning: {
              score: 96,
              status: 'excellent',
              notes: 'Exceptional reasoning capabilities',
            },
            multimodal: {
              score: 88,
              status: 'good',
              notes: 'Good vision understanding',
            },
            embeddings: {
              score: 0,
              status: 'incompatible',
              notes: 'Not an embedding model',
            },
          },
          frameworks: {
            'vercel-ai-sdk': { score: 100, status: 'excellent' },
            langchain: { score: 95, status: 'excellent' },
            llamaindex: { score: 90, status: 'excellent' },
          },
          integrations: {
            'anthropic-api': { score: 100, status: 'excellent' },
            'aws-bedrock': { score: 95, status: 'excellent' },
          },
        },
        lastUpdated: new Date(),
      },
    ];

    // Add all models to the capability map
    for (const model of knownModels) {
      this.addModelCapability(model);
    }

    this.lastUpdate = new Date();
  }

  private startUpdateLoop(): void {
    // Update capabilities periodically
    setInterval(() => {
      this.updateCapabilities();
    }, this.updateInterval);
  }

  private updateCapabilities(): void {
    // In a real implementation, this would fetch latest model info from providers
    loggingService.info('Updating model capabilities', {
      lastUpdate: this.lastUpdate,
      modelCount: this.capabilities.size,
    });

    this.lastUpdate = new Date();
  }
}

// Export convenience functions
export const createCapabilityMapper = (): ModelCapabilityMapper => {
  return ModelCapabilityMapper.getInstance();
};

export const queryModels = (query: CapabilityQuery): CapabilityQueryResult => {
  const mapper = ModelCapabilityMapper.getInstance();
  return mapper.query(query);
};

export const getModelCapability = (
  modelId: string
): ModelCapability | undefined => {
  const mapper = ModelCapabilityMapper.getInstance();
  return mapper.getModelCapability(modelId);
};

export const getRecommendations = (
  useCase: keyof CompatibilityMatrix['useCases'],
  constraints?: any
): ModelRecommendation[] => {
  const mapper = ModelCapabilityMapper.getInstance();
  return mapper.getRecommendations(useCase, constraints);
};

// Export singleton
export const modelCapabilityMapper = ModelCapabilityMapper.getInstance();
