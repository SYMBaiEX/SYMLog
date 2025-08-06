import {
  APICallError,
  DownloadError,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidResponseDataError,
  InvalidArgumentError as InvalidToolInputError,
  JSONParseError,
  type LanguageModelUsage,
  LoadAPIKeyError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoSuchModelError,
  NoSuchToolError,
  ToolCallRepairError,
  TypeValidationError,
} from 'ai';
import { logError as logErrorToConsole } from '@/lib/logger';

// Define missing error types that are not exported from 'ai'
class NoTranscriptGeneratedError extends Error {
  cause?: Error;
  responses?: any[];
  static isInstance(error: unknown): error is NoTranscriptGeneratedError {
    return error instanceof NoTranscriptGeneratedError;
  }
}

class ToolExecutionError extends Error {
  toolName?: string;
  toolArgs?: any;
  cause?: Error;
  static isInstance(error: unknown): error is ToolExecutionError {
    return error instanceof ToolExecutionError;
  }
}

class TooManyEmbeddingValuesForCallError extends Error {
  values?: number;
  maxValuesPerCall?: number;
  static isInstance(
    error: unknown
  ): error is TooManyEmbeddingValuesForCallError {
    return error instanceof TooManyEmbeddingValuesForCallError;
  }
}

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  API = 'api',
  VALIDATION = 'validation',
  GENERATION = 'generation',
  TOOL = 'tool',
  MODEL = 'model',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown',
}

// Enhanced error information
export interface EnhancedErrorInfo {
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  retry: boolean;
  fallback?: string;
  details?: Record<string, any>;
  timestamp: Date;
  errorId: string;
  originalError?: Error;
  suggestions?: string[];
  actionRequired?: string;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: Set<string>;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30_000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: new Set([
    'APICallError',
    'NoObjectGeneratedError',
    'ToolExecutionError',
    'DownloadError',
  ]),
};

/**
 * Advanced Error Handler for AI SDK v5
 */
export class AdvancedErrorHandler {
  private static instance: AdvancedErrorHandler;
  private retryConfig: RetryConfig;
  private errorHistory: Map<string, EnhancedErrorInfo[]> = new Map();
  private errorMetrics: Map<ErrorCategory, number> = new Map();

  private constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.initializeErrorMetrics();
  }

  static getInstance(retryConfig?: Partial<RetryConfig>): AdvancedErrorHandler {
    if (!AdvancedErrorHandler.instance) {
      AdvancedErrorHandler.instance = new AdvancedErrorHandler(retryConfig);
    }
    return AdvancedErrorHandler.instance;
  }

  /**
   * Handle AI SDK errors with enhanced information
   */
  handleError(error: unknown): EnhancedErrorInfo {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    // API Call Errors
    if (APICallError.isInstance(error)) {
      return this.handleAPICallError(error, errorId, timestamp);
    }

    // Validation Errors
    if (InvalidArgumentError.isInstance(error)) {
      return this.handleValidationError(
        error,
        'InvalidArgumentError',
        errorId,
        timestamp
      );
    }

    if (InvalidDataContentError.isInstance(error)) {
      return this.handleValidationError(
        error,
        'InvalidDataContentError',
        errorId,
        timestamp
      );
    }

    if (InvalidResponseDataError.isInstance(error)) {
      return this.handleValidationError(
        error,
        'InvalidResponseDataError',
        errorId,
        timestamp
      );
    }

    if (TypeValidationError.isInstance(error)) {
      return this.handleValidationError(
        error,
        'TypeValidationError',
        errorId,
        timestamp
      );
    }

    if (JSONParseError.isInstance(error)) {
      return this.handleJSONParseError(error, errorId, timestamp);
    }

    // Generation Errors
    if (NoObjectGeneratedError.isInstance(error)) {
      return this.handleNoObjectGeneratedError(error, errorId, timestamp);
    }

    if (NoImageGeneratedError.isInstance(error)) {
      return this.handleNoImageGeneratedError(error, errorId, timestamp);
    }

    if (NoTranscriptGeneratedError.isInstance(error)) {
      return this.handleNoTranscriptGeneratedError(error, errorId, timestamp);
    }

    // Tool Errors
    if (NoSuchToolError.isInstance(error)) {
      return this.handleToolError(error, 'NoSuchToolError', errorId, timestamp);
    }

    if (InvalidToolInputError.isInstance(error)) {
      return this.handleToolError(
        error,
        'InvalidToolInputError',
        errorId,
        timestamp
      );
    }

    if (ToolExecutionError.isInstance(error)) {
      return this.handleToolError(
        error,
        'ToolExecutionError',
        errorId,
        timestamp
      );
    }

    if (ToolCallRepairError.isInstance(error)) {
      return this.handleToolError(
        error,
        'ToolCallRepairError',
        errorId,
        timestamp
      );
    }

    // Model Errors
    if (NoSuchModelError.isInstance(error)) {
      return this.handleModelError(error, errorId, timestamp);
    }

    if (TooManyEmbeddingValuesForCallError.isInstance(error)) {
      return this.handleEmbeddingError(error, errorId, timestamp);
    }

    // Configuration Errors
    if (LoadAPIKeyError.isInstance(error)) {
      return this.handleConfigurationError(error, errorId, timestamp);
    }

    // Network Errors
    if (DownloadError.isInstance(error)) {
      return this.handleNetworkError(error, errorId, timestamp);
    }

    // Unknown errors
    return this.handleUnknownError(error, errorId, timestamp);
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: { operationName?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.retryConfig.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorInfo = this.handleError(error);

        if (!errorInfo.retry || attempt >= this.retryConfig.maxRetries - 1) {
          throw error;
        }

        const delay = this.calculateRetryDelay(attempt);

        loggingService.warn('Retrying operation', {
          operation: context?.operationName || 'unknown',
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: errorInfo.message,
        });

        await this.sleep(delay);
        attempt++;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    byCategory: Record<ErrorCategory, number>;
    recentErrors: EnhancedErrorInfo[];
    totalErrors: number;
  } {
    const recentErrors: EnhancedErrorInfo[] = [];

    for (const errors of this.errorHistory.values()) {
      recentErrors.push(...errors);
    }

    // Sort by timestamp and take most recent
    recentErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      byCategory: Object.fromEntries(this.errorMetrics) as Record<
        ErrorCategory,
        number
      >,
      recentErrors: recentErrors.slice(0, 100),
      totalErrors: recentErrors.length,
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.initializeErrorMetrics();
    loggingService.info('Error history cleared');
  }

  // Private helper methods

  private handleAPICallError(
    error: APICallError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const isRateLimitError = error.statusCode === 429;
    const isServerError = (error.statusCode ?? 0) >= 500;

    const errorInfo: EnhancedErrorInfo = {
      message: isRateLimitError
        ? 'Rate limit exceeded. Please wait before retrying.'
        : `API call failed with status ${error.statusCode}: ${(error as any).statusText || 'Unknown error'}`,
      severity: isServerError ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      category: ErrorCategory.API,
      retry: error.isRetryable || isServerError || isRateLimitError,
      fallback: 'Switch to backup model or reduce request frequency',
      details: {
        statusCode: error.statusCode,
        statusText: (error as any).statusText,
        url: error.url,
        responseHeaders: error.responseHeaders,
        isRetryable: error.isRetryable,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: this.getAPIErrorSuggestions(error),
      actionRequired: isRateLimitError
        ? 'Wait for rate limit reset'
        : undefined,
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleValidationError(
    error:
      | InvalidArgumentError
      | InvalidDataContentError
      | InvalidResponseDataError
      | TypeValidationError,
    errorType: string,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: `Validation error (${errorType}): ${error.message}`,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      retry: false,
      fallback: 'Check input data and try with corrected values',
      details: {
        errorType,
        argument: (error as any).argument,
        value: (error as any).value,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Verify input data format',
        'Check for required fields',
        'Ensure data types match expected schema',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleJSONParseError(
    error: JSONParseError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: `JSON parsing failed: ${error.message}`,
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.VALIDATION,
      retry: true,
      fallback: 'Try with a simpler response format',
      details: {
        text: error.text,
        cause: error.cause,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Ensure model is instructed to return valid JSON',
        'Try with a more structured prompt',
        'Consider using generateObject instead',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleNoObjectGeneratedError(
    error: NoObjectGeneratedError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: 'Failed to generate structured output',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.GENERATION,
      retry: true,
      fallback: 'Try with simpler schema or different model',
      details: {
        text: error.text,
        response: error.response,
        usage: error.usage,
        finishReason: error.finishReason,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Simplify the output schema',
        'Provide more specific instructions',
        'Try a different model',
        'Increase max tokens',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleNoImageGeneratedError(
    error: NoImageGeneratedError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: 'Failed to generate image',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.GENERATION,
      retry: true,
      fallback: 'Try with different prompt or image generation model',
      details: {
        cause: error.cause,
        responses: error.responses,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Adjust prompt for better clarity',
        'Check model capabilities',
        'Verify API limits',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleNoTranscriptGeneratedError(
    error: NoTranscriptGeneratedError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: 'Failed to generate transcript',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.GENERATION,
      retry: true,
      fallback: 'Try with different audio format or transcription model',
      details: {
        cause: error.cause,
        responses: error.responses,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Check audio file format',
        'Verify audio quality',
        'Try shorter audio segments',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleToolError(
    error:
      | NoSuchToolError
      | InvalidToolInputError
      | ToolExecutionError
      | ToolCallRepairError,
    errorType: string,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const severity =
      errorType === 'ToolExecutionError'
        ? ErrorSeverity.HIGH
        : ErrorSeverity.MEDIUM;

    const errorInfo: EnhancedErrorInfo = {
      message: `Tool error (${errorType}): ${error.message}`,
      severity,
      category: ErrorCategory.TOOL,
      retry: errorType === 'ToolExecutionError',
      fallback: 'Try without tools or with different tool configuration',
      details: {
        errorType,
        toolName: (error as any).toolName,
        toolArgs: (error as any).toolArgs,
        cause: (error as any).cause,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: this.getToolErrorSuggestions(errorType),
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleModelError(
    error: NoSuchModelError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: `Model not found: ${error.message}`,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.MODEL,
      retry: false,
      fallback: 'Use a different model or check model availability',
      details: {
        modelId: (error as any).modelId,
        availableModels: (error as any).availableModels,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Verify model ID is correct',
        'Check if model is available in your region',
        'Use a supported model from the provider',
      ],
      actionRequired: 'Update model configuration',
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleEmbeddingError(
    error: TooManyEmbeddingValuesForCallError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: 'Too many embedding values for single call',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      retry: false,
      fallback: 'Split embeddings into smaller batches',
      details: {
        values: (error as any).values,
        maxValuesPerCall: (error as any).maxValuesPerCall,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Batch embedding requests',
        'Reduce number of values per request',
        'Implement pagination for large datasets',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleConfigurationError(
    error: LoadAPIKeyError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: 'Failed to load API key',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.CONFIGURATION,
      retry: false,
      fallback: 'Check environment variables and API key configuration',
      details: {
        keyName: (error as any).keyName,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Verify environment variables are set',
        'Check .env file configuration',
        'Ensure API key is valid and active',
      ],
      actionRequired: 'Configure API credentials',
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleNetworkError(
    error: DownloadError,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    const errorInfo: EnhancedErrorInfo = {
      message: `Download failed: ${error.message}`,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      retry: true,
      fallback: 'Retry download or use cached version',
      details: {
        url: (error as any).url,
        statusCode: (error as any).statusCode,
        statusText: (error as any).statusText,
      },
      timestamp,
      errorId,
      originalError: error,
      suggestions: [
        'Check network connectivity',
        'Verify URL is accessible',
        'Try again later',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private handleUnknownError(
    error: unknown,
    errorId: string,
    timestamp: Date
  ): EnhancedErrorInfo {
    let message = 'An unknown error occurred';
    let details: Record<string, any> = {};

    if (error === null || error === undefined) {
      message = 'Null or undefined error';
    } else if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      message = error.message;
      details = {
        name: error.name,
        stack: error.stack,
      };
    } else {
      message = JSON.stringify(error);
      details = { rawError: error };
    }

    const errorInfo: EnhancedErrorInfo = {
      message,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      retry: false,
      fallback: 'Contact support if issue persists',
      details,
      timestamp,
      errorId,
      originalError: error instanceof Error ? error : new Error(message),
      suggestions: [
        'Check logs for more details',
        'Verify all inputs are valid',
        'Try a simpler operation',
      ],
    };

    this.recordError(errorInfo);
    return errorInfo;
  }

  private getAPIErrorSuggestions(error: APICallError): string[] {
    const suggestions: string[] = [];

    switch (error.statusCode) {
      case 400:
        suggestions.push('Check request parameters', 'Verify input format');
        break;
      case 401:
        suggestions.push('Verify API credentials', 'Check authentication');
        break;
      case 403:
        suggestions.push('Check API permissions', 'Verify access rights');
        break;
      case 404:
        suggestions.push('Verify endpoint URL', 'Check API documentation');
        break;
      case 429:
        suggestions.push(
          'Implement rate limiting',
          'Add retry logic with backoff'
        );
        break;
      case 500:
      case 502:
      case 503:
        suggestions.push(
          'Wait and retry',
          'Check service status',
          'Use fallback provider'
        );
        break;
    }

    return suggestions;
  }

  private getToolErrorSuggestions(errorType: string): string[] {
    switch (errorType) {
      case 'NoSuchToolError':
        return [
          'Verify tool name',
          'Check available tools',
          'Register missing tool',
        ];
      case 'InvalidToolInputError':
        return [
          'Check tool parameter schema',
          'Validate input data',
          'Review tool documentation',
        ];
      case 'ToolExecutionError':
        return [
          'Check tool implementation',
          'Handle tool errors gracefully',
          'Add timeout handling',
        ];
      case 'ToolCallRepairError':
        return [
          'Simplify tool calls',
          'Provide clearer tool descriptions',
          'Use repair function',
        ];
      default:
        return ['Review tool configuration', 'Check tool compatibility'];
    }
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.initialDelay *
        this.retryConfig.backoffMultiplier ** attempt,
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Add random jitter (±25% of delay)
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      return Math.round(exponentialDelay + jitter);
    }

    return exponentialDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordError(errorInfo: EnhancedErrorInfo): void {
    const key = `${errorInfo.category}_${errorInfo.severity}`;

    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    const history = this.errorHistory.get(key)!;
    history.push(errorInfo);

    // Keep only recent errors
    if (history.length > 100) {
      history.shift();
    }

    // Update metrics
    const currentCount = this.errorMetrics.get(errorInfo.category) || 0;
    this.errorMetrics.set(errorInfo.category, currentCount + 1);

    // Log error based on severity
    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        loggingService.error('AI SDK Error', errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        loggingService.warn('AI SDK Error', errorInfo);
        break;
      case ErrorSeverity.LOW:
        loggingService.debug('AI SDK Error', errorInfo);
        break;
    }
  }

  private initializeErrorMetrics(): void {
    Object.values(ErrorCategory).forEach((category) => {
      this.errorMetrics.set(category, 0);
    });
  }
}

// Export singleton getter
export const getAdvancedErrorHandler = (
  retryConfig?: Partial<RetryConfig>
): AdvancedErrorHandler => {
  return AdvancedErrorHandler.getInstance(retryConfig);
};

// Convenience function for handling errors
export function handleAIError(error: unknown): EnhancedErrorInfo {
  const handler = getAdvancedErrorHandler();
  return handler.handleError(error);
}

// Convenience function for executing with retry
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  context?: { operationName?: string; metadata?: Record<string, any> }
): Promise<T> {
  const handler = getAdvancedErrorHandler();
  return handler.executeWithRetry(operation, context);
}
