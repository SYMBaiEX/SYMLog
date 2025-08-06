import type { LanguageModel, LanguageModelRequestMetadata } from 'ai';
import { config } from '../../config';
import { getFallbackChainManager } from '../routing/fallback-chain';
import {
  type GatewayConfig,
  getAIGateway,
  type ModelRequirements,
  type SupportedModelId,
} from '../core/gateway';
import {
  getGatewayMiddleware,
  type MiddlewareConfig,
  type RequestContext,
} from '../core/gateway-middleware';
import { getIntelligentRouter } from '../routing/intelligent-routing';
import { registry as providerRegistry, systemPrompts } from '../core/providers';

// Export the original registry for backward compatibility
export { registry } from '../core/providers';

// Gateway configuration based on environment
const gatewayConfig: GatewayConfig = {
  providers: ['openai', 'anthropic'],
  fallbackChain: ['openai:fast', 'anthropic:fast', 'openai:premium'],
  loadBalancing: 'adaptive',
  maxRetries: 3,
  retryDelay: 1000,
  cooldownPeriod: 60_000, // 1 minute
  costThreshold: 0.01, // $0.01 per request max
  performanceSLA: {
    maxLatency: 5000, // 5 seconds
    minSuccessRate: 0.95, // 95% success rate
  },
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// Middleware configuration
const middlewareConfig: MiddlewareConfig = {
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

// Initialize gateway and middleware
const gateway = getAIGateway(gatewayConfig);
const middleware = getGatewayMiddleware(middlewareConfig);
const router = getIntelligentRouter();
const fallbackManager = getFallbackChainManager();

/**
 * Get AI model through the gateway with intelligent routing
 */
export const getGatewayModel = async (
  requirements: ModelRequirements,
  metadata?: LanguageModelRequestMetadata
): Promise<LanguageModel> => {
  // Use gateway to get optimal model
  const modelSelection = await gateway.getOptimalModel(requirements);
  return modelSelection.model;
};

/**
 * Execute AI request with full gateway features
 */
export const executeWithGateway = async <T>(
  requirements: ModelRequirements,
  executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
  metadata?: LanguageModelRequestMetadata
): Promise<T> => {
  return middleware.processRequest(requirements, executor, metadata);
};

/**
 * Execute aggregated request with multiple models
 */
export const executeAggregated = async <T>(
  requirements: ModelRequirements,
  executor: (model: LanguageModel, context: RequestContext) => Promise<T>,
  strategy: 'consensus' | 'best-of' | 'ensemble' = 'consensus',
  modelCount = 3
) => {
  return middleware.processAggregatedRequest(
    requirements,
    executor,
    strategy,
    modelCount
  );
};

/**
 * Helper function to convert task type to model requirements
 */
export const getRequirementsForTask = (
  task: 'chat' | 'code' | 'analysis' | 'creative' | 'reasoning',
  options?: {
    priority?: 'speed' | 'quality' | 'cost';
    complexity?: 'simple' | 'moderate' | 'complex';
    capabilities?: string[];
    maxCost?: number;
    maxLatency?: number;
  }
): ModelRequirements => {
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
};

/**
 * Get model with automatic fallback handling
 */
export const getModelWithFallback = async (
  preferredModel: string,
  requirements: ModelRequirements
): Promise<LanguageModel> => {
  try {
    // Try to get preferred model from registry
    const model = providerRegistry.languageModel(
      preferredModel as SupportedModelId
    );

    // Check if model is available through circuit breaker
    if (fallbackManager.isModelAvailable(preferredModel)) {
      return model;
    }
  } catch (error) {
    console.warn(`Preferred model ${preferredModel} not available`, error);
  }

  // Fall back to gateway selection
  return getGatewayModel(requirements);
};

/**
 * Quick access functions for common use cases
 */
export const models = {
  // Get fastest available model
  fast: () =>
    getGatewayModel(getRequirementsForTask('chat', { priority: 'speed' })),

  // Get best model for coding
  code: () => getGatewayModel(getRequirementsForTask('code')),

  // Get creative writing model
  creative: () => getGatewayModel(getRequirementsForTask('creative')),

  // Get reasoning model
  reasoning: () => getGatewayModel(getRequirementsForTask('reasoning')),

  // Get analysis model
  analysis: () => getGatewayModel(getRequirementsForTask('analysis')),

  // Get cheapest model
  cheap: () =>
    getGatewayModel(getRequirementsForTask('chat', { priority: 'cost' })),

  // Get highest quality model
  premium: () =>
    getGatewayModel(getRequirementsForTask('chat', { priority: 'quality' })),
};

/**
 * Gateway health check
 */
export const checkGatewayHealth = async () => {
  const statuses = gateway.getAllProviderStatuses();
  const healthy = Array.from(statuses.values()).filter(
    (s) => s.status === 'healthy'
  ).length;
  const total = statuses.size;

  return {
    healthy,
    total,
    percentage: total > 0 ? (healthy / total) * 100 : 0,
    providers: Object.fromEntries(statuses),
  };
};

/**
 * Get gateway statistics
 */
export const getGatewayStats = () => {
  return {
    routing: router.getRoutingStats(),
    cache: middleware.getCacheStats(),
    circuitBreakers: middleware.getCircuitBreakerStatus(),
    fallbackHistory: fallbackManager.getFallbackHistory(),
  };
};

/**
 * Clear gateway cache
 */
export const clearGatewayCache = () => {
  middleware.clearCache();
};

/**
 * Add custom interceptors
 */
export const gatewayInterceptors = {
  addRequestInterceptor: middleware.addRequestInterceptor.bind(middleware),
  addResponseInterceptor: middleware.addResponseInterceptor.bind(middleware),
  addErrorInterceptor: middleware.addErrorInterceptor.bind(middleware),
};

/**
 * Export system prompts for consistency
 */
export { systemPrompts };

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  maxRequestsPerHour: config.get().rateLimitMaxRequests,
  maxTokensPerRequest: config.get().aiMaxTokensPerRequest,
};
