/**
 * Unified AI System - Consolidated Interface
 * 
 * This module provides a single, unified interface to all AI functionality,
 * consolidating the previously scattered error handling, provider management,
 * streaming, and experimental features into cohesive systems.
 * 
 * Key Consolidations:
 * - Error handling: Unified from 6 separate files
 * - Provider management: Consolidated gateway and registry functionality  
 * - Streaming: Integrated experimental transforms and features
 * - Type safety: Strict TypeScript compliance throughout
 */

// Core unified systems
export {
  UnifiedErrorSystem,
  unifiedErrorSystem,
  type UnifiedErrorInfo,
  type ErrorClassification,
  type RecoveryStrategy,
  ErrorSeverity,
  ErrorCategory,
  ErrorPattern,
  handleAsync,
  handleSync,
  executeWithRecovery,
  handleAIError,
  classifyError,
  v2ErrorHandler,
} from './error-handling/unified-error-system';

export {
  UnifiedProviderSystem,
  unifiedProviderSystem,
  type SupportedModelId,
  type ProviderHealth,
  type LoadBalancingStrategy,
  type ModelRequirements,
  type ModelSelection,
  type GatewayRequestMetadata,
  type UnifiedGatewayConfig,
  type RequestContext,
  type MiddlewareConfig,
  type EnhancedModelConfig,
  type ProviderMetrics,
  registry,
  getGatewayModel,
  executeWithGateway,
  executeAggregated,
  getRequirementsForTask,
  models,
  checkGatewayHealth,
  getGatewayStats,
  clearGatewayCache,
  systemPrompts,
} from './providers/unified-provider-system';

export {
  UnifiedStreamingSystem,
  unifiedStreamingSystem,
  type UnifiedStreamChunk,
  type TextDeltaChunk,
  type ToolCallChunk,
  type FinishChunk,
  type ErrorChunk,
  type UnifiedTransformConfig,
  type CompressionTransformConfig,
  type MetricsTransformConfig,
  type DebugTransformConfig,
  type FilterTransformConfig,
  type ProgressTransformConfig,
  type StreamProgress,
  type DebugEvent,
  type UnifiedStreamOptions,
  type UnifiedGenerationOptions,
  streamWithTransforms,
  generateWithRetry,
  streamStructured,
  transformPresets,
  isTextDeltaChunk,
  isToolCallChunk,
  isFinishChunk,
  isErrorChunk,
  extractTextFromChunk,
  extractMetadataFromChunk,
  createCompressionTransform,
  createMetricsTransform,
  createDebugTransform,
  createFilterTransform,
  createProgressTransform,
} from './core/unified-streaming-system';

// Backwards compatibility exports - these maintain the same API as before
// Note: These imports are kept for backward compatibility but may reference old files
// export { getAIModel } from './providers/providers';
// export { config } from './config';

// Re-export commonly used AI SDK types for convenience
export type {
  LanguageModel,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  ModelMessage,
  TextStreamPart,
  StreamTextTransform,
  ToolSet,
  StopCondition,
} from 'ai';

/**
 * Unified AI Client - Main interface for all AI operations
 * 
 * This class provides a single point of access to all AI functionality
 * with built-in error handling, provider management, and streaming capabilities.
 */
export class UnifiedAIClient {
  private static instance: UnifiedAIClient;
  
  private constructor() {}
  
  static getInstance(): UnifiedAIClient {
    if (!UnifiedAIClient.instance) {
      UnifiedAIClient.instance = new UnifiedAIClient();
    }
    return UnifiedAIClient.instance;
  }

  /**
   * Generate text with automatic error handling and provider optimization
   */
  async generate(
    prompt: string,
    options: UnifiedGenerationOptions = {}
  ) {
    return unifiedStreamingSystem.generateText(prompt, options);
  }

  /**
   * Stream text with advanced transforms and error recovery
   */
  async stream(
    prompt: string,
    options: UnifiedStreamOptions = {}
  ) {
    return unifiedStreamingSystem.streamText(prompt, options);
  }

  /**
   * Generate structured objects with schema validation and repair
   */
  async generateObject<T>(
    prompt: string,
    schema: any,
    options: UnifiedGenerationOptions<T> = {}
  ) {
    return unifiedStreamingSystem.generateText(prompt, {
      ...options,
      outputType: 'object',
      schema,
    });
  }

  /**
   * Stream structured objects with partial updates
   */
  async streamObject<T>(
    prompt: string,
    schema: any,
    options: UnifiedStreamOptions = {}
  ) {
    return unifiedStreamingSystem.streamStructuredOutput(prompt, schema, options);
  }

  /**
   * Get optimal model based on requirements
   */
  async getModel(requirements: ModelRequirements) {
    return unifiedProviderSystem.getOptimalModel(requirements);
  }

  /**
   * Get enhanced model with gateway features
   */
  async getEnhancedModel(config: EnhancedModelConfig = {}) {
    return unifiedProviderSystem.getEnhancedModel(config);
  }

  /**
   * Execute operation with full error handling and recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: UnifiedErrorInfo) => RecoveryStrategy
  ) {
    return executeWithRecovery(operation, errorHandler);
  }

  /**
   * Get system health and statistics
   */
  async getSystemHealth() {
    const [gatewayHealth, errorStats] = await Promise.all([
      checkGatewayHealth(),
      unifiedErrorSystem.getErrorStatistics(),
    ]);

    return {
      gateway: gatewayHealth,
      errors: {
        recentCount: errorStats.recentErrors.length,
        patterns: errorStats.recentPatterns,
        recommendations: errorStats.recommendations,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get comprehensive system statistics
   */
  getSystemStats() {
    return {
      gateway: getGatewayStats(),
      errors: unifiedErrorSystem.getErrorStatistics(),
      providers: Object.fromEntries(unifiedProviderSystem.getAllProviderMetrics()),
      models: Object.fromEntries(unifiedProviderSystem.getAllModelMetrics()),
    };
  }

  /**
   * Clear all system caches
   */
  clearCaches() {
    clearGatewayCache();
    unifiedErrorSystem.clearErrorHistory();
  }
}

// Export singleton client instance
export const unifiedAI = UnifiedAIClient.getInstance();

/**
 * Quick access functions for common operations
 */

/**
 * Generate text with optimal model selection
 */
export async function generateText(
  prompt: string,
  options: UnifiedGenerationOptions = {}
) {
  return unifiedAI.generate(prompt, options);
}

/**
 * Stream text with advanced features
 */
export async function streamText(
  prompt: string,
  options: UnifiedStreamOptions = {}
) {
  return unifiedAI.stream(prompt, options);
}

/**
 * Generate objects with schema validation
 */
export async function generateObject<T>(
  prompt: string,
  schema: any,
  options: UnifiedGenerationOptions<T> = {}
) {
  return unifiedAI.generateObject(prompt, schema, options);
}

/**
 * Stream objects with partial updates
 */
export async function streamObject<T>(
  prompt: string,
  schema: any,
  options: UnifiedStreamOptions = {}
) {
  return unifiedAI.streamObject(prompt, schema, options);
}

/**
 * Quick model access functions
 */
export const quickModels = {
  fast: () => models.fast(),
  code: () => models.code(),
  creative: () => models.creative(),
  reasoning: () => models.reasoning(),
  analysis: () => models.analysis(),
  cheap: () => models.cheap(),
  premium: () => models.premium(),
};

/**
 * Configuration presets for different use cases
 */
export const configPresets = {
  development: {
    debugConfig: {
      enabled: true,
      logLevel: 'debug' as const,
      includeContent: true,
      includeMetadata: true,
      outputFormat: 'console' as const,
    },
    errorHandling: {
      maxRetries: 1,
      logLevel: 'debug' as const,
      includeStack: true,
      enableClassification: true,
    },
  },
  production: {
    filterConfig: {
      enabled: true,
      filters: [
        {
          type: 'content' as const,
          pattern: /(api[_-]?key|secret|password|token)/gi,
          action: 'replace' as const,
          replacement: '[REDACTED]',
        },
      ],
    },
    compressionConfig: {
      enabled: true,
      threshold: 2048,
      algorithm: 'gzip' as const,
      level: 4,
    },
    errorHandling: {
      maxRetries: 3,
      logLevel: 'error' as const,
      sanitizeContext: true,
      enableClassification: true,
    },
  },
  performance: {
    compressionConfig: {
      enabled: true,
      threshold: 1024,
      algorithm: 'gzip' as const,
      level: 6,
    },
    metricsConfig: {
      enabled: true,
      collectTokenMetrics: true,
      collectPerformanceMetrics: true,
      collectQualityMetrics: false,
      sampleRate: 0.1,
    },
    errorHandling: {
      maxRetries: 2,
      logLevel: 'warn' as const,
      enableMetrics: true,
    },
  },
};

/**
 * Utility functions for working with the unified system
 */
export const unifiedUtils = {
  /**
   * Create a configured client for a specific use case
   */
  createClient: (preset: keyof typeof configPresets) => {
    const config = configPresets[preset];
    return {
      generate: (prompt: string, options: UnifiedGenerationOptions = {}) =>
        generateText(prompt, { ...config.errorHandling, ...options }),
      stream: (prompt: string, options: UnifiedStreamOptions = {}) =>
        streamText(prompt, { ...config, ...options }),
      generateObject: <T>(prompt: string, schema: any, options: UnifiedGenerationOptions<T> = {}) =>
        generateObject(prompt, schema, { ...config.errorHandling, ...options }),
    };
  },

  /**
   * Health check for the entire system
   */
  healthCheck: async () => {
    return unifiedAI.getSystemHealth();
  },

  /**
   * Get system performance metrics
   */
  getMetrics: () => {
    return unifiedAI.getSystemStats();
  },

  /**
   * Reset all system state
   */
  reset: () => {
    unifiedAI.clearCaches();
  },
};

/**
 * Migration helpers for existing code
 * These functions help migrate from the old scattered APIs to the unified system
 */
export const migrationHelpers = {
  /**
   * Migrate from old error handler APIs
   */
  fromOldErrorHandler: (oldHandler: any) => {
    return {
      handleError: (error: unknown, context?: any) => 
        unifiedErrorSystem.handleError(error, context),
      executeWithRetry: <T>(fn: () => Promise<T>, options?: any) =>
        unifiedErrorSystem.executeWithRetry(fn, undefined, options),
    };
  },

  /**
   * Migrate from old provider APIs
   */
  fromOldProvider: (oldConfig: any) => {
    return unifiedProviderSystem.getEnhancedModel({
      modelId: oldConfig.model,
      task: oldConfig.task || 'chat',
      priority: oldConfig.priority || 'speed',
      fallbackEnabled: oldConfig.enableFallback !== false,
    });
  },

  /**
   * Migrate from old streaming APIs
   */
  fromOldStreaming: (oldOptions: any) => {
    return {
      preset: oldOptions.preset || 'production',
      smoothing: oldOptions.smooth ? { enabled: true } : undefined,
      debugConfig: oldOptions.debug ? { enabled: true, logLevel: 'debug' } : undefined,
    };
  },
};

// Default export for easy importing
export default unifiedAI;