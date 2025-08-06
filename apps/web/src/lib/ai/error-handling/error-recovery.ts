import {
  APICallError,
  type CoreMessage,
  generateObject,
  generateText,
  InvalidToolInputError,
  type LanguageModel,
  NoObjectGeneratedError,
  NoSuchModelError,
  streamObject,
  streamText,
} from 'ai';
import { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import {
  AdvancedErrorHandler,
  type EnhancedErrorInfo,
  ErrorCategory,
  ErrorSeverity,
} from './advanced-error-handling';
import { registry } from '../core/providers';
import { RETRY_PRESETS, RetryStrategy, retryManager } from './retry-strategies';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Fallback options
export interface FallbackOption {
  type: 'model' | 'prompt' | 'schema' | 'parameters';
  value: any;
  reason: string;
}

// Recovery strategy
export interface RecoveryStrategy {
  errorCategory: ErrorCategory;
  strategies: FallbackOption[];
  maxAttempts: number;
}

// Recovery context
export interface RecoveryContext {
  originalError: Error;
  errorInfo: EnhancedErrorInfo;
  attempt: number;
  appliedStrategies: FallbackOption[];
  startTime: number;
}

// Recovery result
export interface RecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  recoveryPath: FallbackOption[];
  totalAttempts: number;
  duration: number;
}

// Type for registry model IDs
type RegistryModelId =
  | 'openai:premium'
  | 'openai:code'
  | 'openai:fast'
  | 'anthropic:fast'
  | 'anthropic:balanced'
  | 'anthropic:reasoning'
  | 'anthropic:creative';

// Helper function to ensure model ID is valid for registry
function getRegistryModelId(modelId: string): RegistryModelId {
  // Map model IDs to registry format
  const modelMap: Record<string, RegistryModelId> = {
    'openai:gpt-4.1-nano': 'openai:premium',
    'openai:gpt-4o-mini': 'openai:fast',
    'anthropic:claude-3-5-sonnet-20241022': 'anthropic:balanced',
    'anthropic:claude-3-haiku-20240307': 'anthropic:fast',
    'openai:premium': 'openai:premium',
    'openai:fast': 'openai:fast',
    'openai:code': 'openai:code',
    'anthropic:fast': 'anthropic:fast',
    'anthropic:balanced': 'anthropic:balanced',
    'anthropic:reasoning': 'anthropic:reasoning',
    'anthropic:creative': 'anthropic:creative',
  };

  return modelMap[modelId] || 'openai:premium';
}

// Model fallback chain - updated to use registry model IDs
const MODEL_FALLBACK_CHAINS: Record<string, RegistryModelId[]> = {
  'openai:gpt-4.1-nano': ['openai:fast', 'anthropic:balanced'],
  'anthropic:claude-3-5-sonnet-20241022': ['anthropic:fast', 'openai:premium'],
  'openai:gpt-4o-mini': ['anthropic:fast', 'openai:premium'],
  'anthropic:claude-3-haiku-20240307': ['openai:fast', 'anthropic:balanced'],
};

// Default recovery strategies
const DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    errorCategory: ErrorCategory.API,
    strategies: [
      { type: 'model', value: 'fallback', reason: 'Switch to fallback model' },
      {
        type: 'parameters',
        value: { temperature: 0.5 },
        reason: 'Reduce temperature',
      },
      {
        type: 'parameters',
        value: { maxTokens: 2000 },
        reason: 'Reduce max tokens',
      },
    ],
    maxAttempts: 3,
  },
  {
    errorCategory: ErrorCategory.GENERATION,
    strategies: [
      { type: 'prompt', value: 'simplify', reason: 'Simplify prompt' },
      { type: 'schema', value: 'simplify', reason: 'Simplify schema' },
      { type: 'model', value: 'upgrade', reason: 'Use more capable model' },
    ],
    maxAttempts: 3,
  },
  {
    errorCategory: ErrorCategory.VALIDATION,
    strategies: [
      { type: 'schema', value: 'relax', reason: 'Relax schema constraints' },
      {
        type: 'prompt',
        value: 'clarify',
        reason: 'Add clarifying instructions',
      },
    ],
    maxAttempts: 2,
  },
  {
    errorCategory: ErrorCategory.TOOL,
    strategies: [
      { type: 'parameters', value: { tools: [] }, reason: 'Disable tools' },
      {
        type: 'prompt',
        value: 'no-tools',
        reason: 'Instruct not to use tools',
      },
    ],
    maxAttempts: 2,
  },
];

/**
 * Error Recovery Manager for AI SDK operations
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private errorHandler: AdvancedErrorHandler;
  private recoveryStrategies: Map<ErrorCategory, RecoveryStrategy>;

  private constructor() {
    this.errorHandler = AdvancedErrorHandler.getInstance();
    this.recoveryStrategies = new Map(
      DEFAULT_RECOVERY_STRATEGIES.map((s) => [s.errorCategory, s])
    );
  }

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  /**
   * Generate text with automatic error recovery
   */
  async generateTextWithRecovery(
    params: Parameters<typeof generateText>[0],
    customStrategies?: RecoveryStrategy[]
  ): Promise<RecoveryResult<string>> {
    const context: RecoveryContext = {
      originalError: new Error('No error yet'),
      errorInfo: {} as EnhancedErrorInfo,
      attempt: 0,
      appliedStrategies: [],
      startTime: Date.now(),
    };

    return this.executeWithRecovery(
      async (modifiedParams) => {
        const result = await generateText(modifiedParams);
        return result.text;
      },
      params,
      context,
      customStrategies
    );
  }

  /**
   * Generate object with automatic error recovery
   */
  async generateObjectWithRecovery<T>(
    params: Parameters<typeof generateObject>[0],
    customStrategies?: RecoveryStrategy[]
  ): Promise<RecoveryResult<T>> {
    const context: RecoveryContext = {
      originalError: new Error('No error yet'),
      errorInfo: {} as EnhancedErrorInfo,
      attempt: 0,
      appliedStrategies: [],
      startTime: Date.now(),
    };

    return this.executeWithRecovery(
      async (modifiedParams) => {
        const result = await generateObject(modifiedParams);
        return result.object as T;
      },
      params,
      context,
      customStrategies
    );
  }

  /**
   * Stream text with automatic error recovery
   */
  async streamTextWithRecovery(
    params: Parameters<typeof streamText>[0],
    customStrategies?: RecoveryStrategy[]
  ): Promise<RecoveryResult<AsyncIterable<string>>> {
    const context: RecoveryContext = {
      originalError: new Error('No error yet'),
      errorInfo: {} as EnhancedErrorInfo,
      attempt: 0,
      appliedStrategies: [],
      startTime: Date.now(),
    };

    return this.executeWithRecovery(
      async (modifiedParams) => {
        const result = await streamText(modifiedParams);
        return result.textStream;
      },
      params,
      context,
      customStrategies
    );
  }

  /**
   * Create recovery workflow for specific error types
   */
  createRecoveryWorkflow(
    errorType: new (...args: any[]) => Error,
    strategies: FallbackOption[]
  ): void {
    // Map error types to categories
    const errorCategoryMap: Record<string, ErrorCategory> = {
      APICallError: ErrorCategory.API,
      NoObjectGeneratedError: ErrorCategory.GENERATION,
      InvalidArgumentError: ErrorCategory.VALIDATION,
      NoSuchToolError: ErrorCategory.TOOL,
      NoSuchModelError: ErrorCategory.MODEL,
    };

    const category = errorCategoryMap[errorType.name] || ErrorCategory.UNKNOWN;

    this.recoveryStrategies.set(category, {
      errorCategory: category,
      strategies,
      maxAttempts: strategies.length,
    });
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoverySuggestions(error: unknown): FallbackOption[] {
    const errorInfo = this.errorHandler.handleError(error);
    const strategy = this.recoveryStrategies.get(errorInfo.category);

    if (!strategy) {
      return this.getDefaultRecoverySuggestions(errorInfo);
    }

    return strategy.strategies;
  }

  // Private helper methods

  private async executeWithRecovery<T>(
    operation: (params: any) => Promise<T>,
    originalParams: any,
    context: RecoveryContext,
    customStrategies?: RecoveryStrategy[]
  ): Promise<RecoveryResult<T>> {
    let currentParams = { ...originalParams };
    const strategies =
      customStrategies || Array.from(this.recoveryStrategies.values());

    while (context.attempt < this.getMaxAttempts(strategies)) {
      try {
        // Add retry logic
        const result = await retryManager.executeWithRetry(
          () => operation(currentParams),
          {
            ...RETRY_PRESETS.standard,
            shouldRetry: (error) => this.shouldRetryError(error),
          }
        );

        if (result.success) {
          return {
            success: true,
            result: result.result,
            recoveryPath: context.appliedStrategies,
            totalAttempts: context.attempt + 1,
            duration: Date.now() - context.startTime,
          };
        }

        throw result.error;
      } catch (error) {
        context.originalError = error as Error;
        context.errorInfo = this.errorHandler.handleError(error);
        context.attempt++;

        loggingService.warn('Recovery attempt failed', {
          attempt: context.attempt,
          error: context.errorInfo.message,
          category: context.errorInfo.category,
        });

        // Apply recovery strategy
        const strategy = this.selectRecoveryStrategy(
          context.errorInfo,
          strategies
        );
        if (!strategy) {
          break;
        }

        const fallback = this.selectFallbackOption(strategy, context);
        if (!fallback) {
          break;
        }

        currentParams = await this.applyFallbackOption(
          currentParams,
          fallback,
          context.errorInfo
        );

        context.appliedStrategies.push(fallback);

        loggingService.info('Applying recovery strategy', {
          strategy: fallback.type,
          reason: fallback.reason,
        });
      }
    }

    return {
      success: false,
      error: context.originalError,
      recoveryPath: context.appliedStrategies,
      totalAttempts: context.attempt,
      duration: Date.now() - context.startTime,
    };
  }

  private async applyFallbackOption(
    params: any,
    fallback: FallbackOption,
    errorInfo: EnhancedErrorInfo
  ): Promise<any> {
    const modifiedParams = { ...params };

    switch (fallback.type) {
      case 'model':
        modifiedParams.model = await this.getFallbackModel(
          params.model,
          fallback.value
        );
        break;

      case 'prompt':
        modifiedParams.prompt = this.modifyPrompt(
          params.prompt || params.messages,
          fallback.value
        );
        break;

      case 'schema':
        if (params.schema) {
          modifiedParams.schema = this.modifySchema(
            params.schema,
            fallback.value
          );
        }
        break;

      case 'parameters':
        Object.assign(modifiedParams, fallback.value);
        break;
    }

    return modifiedParams;
  }

  private async getFallbackModel(
    currentModel: LanguageModel | string,
    fallbackType: string
  ): Promise<LanguageModel> {
    const modelId =
      typeof currentModel === 'string'
        ? currentModel
        : currentModel.modelId || 'unknown';

    if (fallbackType === 'fallback') {
      const fallbacks = MODEL_FALLBACK_CHAINS[modelId] || [
        'openai:fast' as RegistryModelId,
      ];
      const fallbackId = fallbacks[0];

      loggingService.info('Switching to fallback model', {
        from: modelId,
        to: fallbackId,
      });

      return registry.languageModel(fallbackId);
    }

    if (fallbackType === 'upgrade') {
      // Upgrade to more capable model
      const upgrades: Record<string, RegistryModelId> = {
        'openai:gpt-4o-mini': 'openai:premium',
        'anthropic:claude-3-haiku-20240307': 'anthropic:balanced',
        'openai:fast': 'openai:premium',
        'anthropic:fast': 'anthropic:balanced',
      };

      const upgradeId = upgrades[modelId] || 'openai:premium';

      loggingService.info('Upgrading to more capable model', {
        from: modelId,
        to: upgradeId,
      });

      return registry.languageModel(upgradeId);
    }

    return typeof currentModel === 'string'
      ? registry.languageModel(getRegistryModelId(currentModel))
      : currentModel;
  }

  private modifyPrompt(
    prompt: string | CoreMessage[],
    modification: string
  ): string | CoreMessage[] {
    if (modification === 'simplify') {
      if (typeof prompt === 'string') {
        return `Please provide a simple, straightforward response. ${prompt}`;
      }
      return [
        {
          role: 'system',
          content: 'Please provide simple, straightforward responses.',
        },
        ...(Array.isArray(prompt) ? prompt : []),
      ];
    }

    if (modification === 'clarify') {
      if (typeof prompt === 'string') {
        return `${prompt}\n\nPlease ensure your response follows the exact format requested.`;
      }
      return Array.isArray(prompt)
        ? [
            ...prompt,
            {
              role: 'system',
              content:
                'Please ensure your response follows the exact format requested.',
            },
          ]
        : [];
    }

    if (modification === 'no-tools') {
      if (typeof prompt === 'string') {
        return `${prompt}\n\nDo not use any tools or functions. Provide a direct response.`;
      }
      return Array.isArray(prompt)
        ? [
            ...prompt,
            {
              role: 'system',
              content:
                'Do not use any tools or functions. Provide a direct response.',
            },
          ]
        : [];
    }

    return prompt;
  }

  private modifySchema(
    schema: z.ZodSchema<any>,
    modification: string
  ): z.ZodSchema<any> {
    if (modification === 'simplify') {
      // Create a simpler version of the schema
      // This is a basic implementation - could be enhanced
      return z.object({
        result: z.string().describe('The main result'),
        metadata: z.object({}).optional(),
      });
    }

    if (modification === 'relax') {
      // Make all fields optional
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const relaxedShape: any = {};

        for (const [key, value] of Object.entries(shape)) {
          relaxedShape[key] = (value as any).optional();
        }

        return z.object(relaxedShape);
      }
    }

    return schema;
  }

  private shouldRetryError(error: Error): boolean {
    const errorInfo = this.errorHandler.handleError(error);

    // Always retry API errors with 5xx status codes
    if (
      APICallError.isInstance(error) &&
      error.statusCode &&
      error.statusCode >= 500
    ) {
      return true;
    }

    // Retry based on error info
    return errorInfo.retry;
  }

  private selectRecoveryStrategy(
    errorInfo: EnhancedErrorInfo,
    strategies: RecoveryStrategy[]
  ): RecoveryStrategy | null {
    // First try to find exact category match
    const exactMatch = strategies.find(
      (s) => s.errorCategory === errorInfo.category
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Then try related categories
    const relatedCategories: Record<ErrorCategory, ErrorCategory[]> = {
      [ErrorCategory.API]: [ErrorCategory.NETWORK],
      [ErrorCategory.GENERATION]: [ErrorCategory.VALIDATION],
      [ErrorCategory.VALIDATION]: [ErrorCategory.GENERATION],
      [ErrorCategory.TOOL]: [ErrorCategory.VALIDATION],
      [ErrorCategory.MODEL]: [ErrorCategory.API],
      [ErrorCategory.NETWORK]: [ErrorCategory.API],
      [ErrorCategory.CONFIGURATION]: [ErrorCategory.MODEL],
      [ErrorCategory.UNKNOWN]: [],
    };

    const related = relatedCategories[errorInfo.category] || [];
    for (const category of related) {
      const strategy = strategies.find((s) => s.errorCategory === category);
      if (strategy) {
        return strategy;
      }
    }

    return null;
  }

  private selectFallbackOption(
    strategy: RecoveryStrategy,
    context: RecoveryContext
  ): FallbackOption | null {
    // Filter out already applied strategies
    const availableStrategies = strategy.strategies.filter(
      (s) =>
        !context.appliedStrategies.some(
          (applied) => applied.type === s.type && applied.value === s.value
        )
    );

    if (availableStrategies.length === 0) {
      return null;
    }

    // Select based on error severity
    if (context.errorInfo.severity === ErrorSeverity.CRITICAL) {
      // For critical errors, try the most drastic changes first
      return availableStrategies[availableStrategies.length - 1];
    }

    // Otherwise, try strategies in order
    return availableStrategies[0];
  }

  private getMaxAttempts(strategies: RecoveryStrategy[]): number {
    return Math.max(...strategies.map((s) => s.maxAttempts), 3);
  }

  private getDefaultRecoverySuggestions(
    errorInfo: EnhancedErrorInfo
  ): FallbackOption[] {
    const suggestions: FallbackOption[] = [];

    // Add generic suggestions based on severity
    if (errorInfo.severity === ErrorSeverity.CRITICAL) {
      suggestions.push({
        type: 'model',
        value: 'fallback',
        reason: 'Critical error - switch to fallback model',
      });
    }

    if (errorInfo.severity === ErrorSeverity.HIGH) {
      suggestions.push({
        type: 'parameters',
        value: { temperature: 0.3, maxTokens: 1000 },
        reason: 'High severity - use conservative parameters',
      });
    }

    // Add category-specific suggestions
    switch (errorInfo.category) {
      case ErrorCategory.API:
        suggestions.push({
          type: 'model',
          value: 'fallback',
          reason: 'API error - try different provider',
        });
        break;

      case ErrorCategory.GENERATION:
        suggestions.push({
          type: 'prompt',
          value: 'simplify',
          reason: 'Generation failed - simplify request',
        });
        break;

      case ErrorCategory.VALIDATION:
        suggestions.push({
          type: 'schema',
          value: 'relax',
          reason: 'Validation error - relax constraints',
        });
        break;
    }

    return suggestions;
  }
}

// Export singleton getter
export const getErrorRecoveryManager = (): ErrorRecoveryManager => {
  return ErrorRecoveryManager.getInstance();
};

// Convenience functions
export async function generateTextWithRecovery(
  params: Parameters<typeof generateText>[0]
): Promise<string> {
  const manager = getErrorRecoveryManager();
  const result = await manager.generateTextWithRecovery(params);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}

export async function generateObjectWithRecovery<T>(
  params: Parameters<typeof generateObject>[0]
): Promise<T> {
  const manager = getErrorRecoveryManager();
  const result = await manager.generateObjectWithRecovery<T>(params);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}
