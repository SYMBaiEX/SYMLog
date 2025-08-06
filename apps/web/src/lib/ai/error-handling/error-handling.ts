import {
  APICallError,
  InvalidArgumentError,
  InvalidResponseDataError,
  InvalidToolInputError,
  JSONParseError,
  type LanguageModelUsage,
  NoObjectGeneratedError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from 'ai';

// Define TooManyEmbeddingValuesForCallError locally since it's not exported from 'ai'
class TooManyEmbeddingValuesForCallError extends Error {
  static isInstance(
    error: unknown
  ): error is TooManyEmbeddingValuesForCallError {
    return error instanceof TooManyEmbeddingValuesForCallError;
  }
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low', // Can be ignored or logged
  MEDIUM = 'medium', // Should be handled but not critical
  HIGH = 'high', // Requires immediate handling
  CRITICAL = 'critical', // System-breaking, requires fallback
}

// Error categories for better handling
export enum ErrorCategory {
  API = 'api',
  VALIDATION = 'validation',
  PARSING = 'parsing',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  TOOL = 'tool',
  SCHEMA = 'schema',
  UNKNOWN = 'unknown',
}

// Enhanced error info structure
export interface AIErrorInfo {
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  retry: boolean;
  retryDelay?: number;
  fallback?: string;
  userMessage?: string;
  technicalDetails?: any;
  suggestedActions?: string[];
  timestamp: number;
}

// Error recovery strategies
export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'degrade' | 'fail';
  maxRetries?: number;
  retryDelay?: number;
  fallbackModel?: string;
  degradedFeatures?: string[];
  customHandler?: (error: unknown) => Promise<any>;
}

// Main error handler class
export class AIErrorHandler {
  private static errorHistory: AIErrorInfo[] = [];
  private static readonly MAX_HISTORY = 100;

  /**
   * Main error handling function with AI SDK 5 specific error types
   */
  static handleAIError(error: unknown, context?: any): AIErrorInfo {
    const timestamp = Date.now();
    let errorInfo: AIErrorInfo;

    // Handle AI SDK 5 specific errors
    if (error instanceof APICallError) {
      errorInfo = AIErrorHandler.handleAPICallError(error);
    } else if (error instanceof InvalidArgumentError) {
      errorInfo = AIErrorHandler.handleInvalidArgumentError(error);
    } else if (error instanceof NoObjectGeneratedError) {
      errorInfo = AIErrorHandler.handleNoObjectGeneratedError(error);
    } else if (error instanceof UnsupportedFunctionalityError) {
      errorInfo = AIErrorHandler.handleUnsupportedFunctionalityError(error);
    } else if (error instanceof JSONParseError) {
      errorInfo = AIErrorHandler.handleJSONParseError(error);
    } else if (error instanceof TypeValidationError) {
      errorInfo = AIErrorHandler.handleTypeValidationError(error);
    } else if (error instanceof InvalidToolInputError) {
      errorInfo = AIErrorHandler.handleInvalidToolInputError(error);
    } else if (error instanceof InvalidResponseDataError) {
      errorInfo = AIErrorHandler.handleInvalidResponseDataError(error);
    } else if (error instanceof TooManyEmbeddingValuesForCallError) {
      errorInfo = AIErrorHandler.handleTooManyEmbeddingValuesError(error);
    } else if (error instanceof Error) {
      errorInfo = AIErrorHandler.handleGenericError(error);
    } else {
      errorInfo = AIErrorHandler.handleUnknownError(error);
    }

    // Add context and timestamp
    errorInfo.timestamp = timestamp;
    if (context) {
      errorInfo.technicalDetails = { ...errorInfo.technicalDetails, context };
    }

    // Store in history
    AIErrorHandler.addToHistory(errorInfo);

    return errorInfo;
  }

  /**
   * Handle API call errors with retry logic
   */
  private static handleAPICallError(error: APICallError): AIErrorInfo {
    const statusCode = (error as any).statusCode || 0;
    const isRateLimitError = statusCode === 429;
    const isServerError = statusCode >= 500;

    return {
      message: error.message,
      severity: isRateLimitError ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
      category: isRateLimitError ? ErrorCategory.RATE_LIMIT : ErrorCategory.API,
      retry: isRateLimitError || isServerError,
      retryDelay: isRateLimitError ? 60_000 : 5000, // 1 minute for rate limit, 5s for server errors
      fallback: 'Switch to backup AI provider',
      userMessage: isRateLimitError
        ? 'AI service is temporarily busy. Please wait a moment.'
        : 'AI service temporarily unavailable. Trying backup provider.',
      technicalDetails: {
        statusCode,
        url: (error as any).url,
        requestId: (error as any).requestId,
      },
      suggestedActions: [
        'Wait and retry',
        'Switch to different model',
        'Use cached response if available',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle invalid argument errors
   */
  private static handleInvalidArgumentError(
    error: InvalidArgumentError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      retry: false,
      fallback: 'Sanitize and retry with corrected arguments',
      userMessage: 'Invalid input provided. Please check your request.',
      technicalDetails: {
        argument: (error as any).argument,
        expectedType: (error as any).expectedType,
      },
      suggestedActions: [
        'Validate input parameters',
        'Check API documentation',
        'Use default values',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle no object generated errors
   */
  private static handleNoObjectGeneratedError(
    error: NoObjectGeneratedError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.SCHEMA,
      retry: true,
      retryDelay: 2000,
      fallback: 'Try with simpler schema or different prompt',
      userMessage: 'Failed to generate the requested output format.',
      technicalDetails: {
        schema: (error as any).schema,
        response: (error as any).response,
      },
      suggestedActions: [
        'Simplify the schema',
        'Improve the prompt',
        'Use generateText instead of generateObject',
        'Try different model',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle unsupported functionality errors
   */
  private static handleUnsupportedFunctionalityError(
    error: UnsupportedFunctionalityError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.API,
      retry: false,
      fallback: 'Use alternative approach or different model',
      userMessage: 'This feature is not supported by the current AI model.',
      technicalDetails: {
        functionality: (error as any).functionality,
        provider: (error as any).provider,
      },
      suggestedActions: [
        'Switch to different model',
        'Use alternative approach',
        'Check model capabilities',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle JSON parse errors
   */
  private static handleJSONParseError(error: JSONParseError): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.PARSING,
      retry: true,
      retryDelay: 1000,
      fallback: 'Use text mode instead of JSON',
      userMessage: 'Failed to process the AI response.',
      technicalDetails: {
        text: (error as any).text,
        cause: (error as any).cause,
      },
      suggestedActions: [
        'Add response format instructions to prompt',
        'Use generateObject for structured data',
        'Implement custom parser',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle type validation errors
   */
  private static handleTypeValidationError(
    error: TypeValidationError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      retry: true,
      retryDelay: 2000,
      fallback: 'Relax schema constraints',
      userMessage: 'The AI response did not match the expected format.',
      technicalDetails: {
        value: (error as any).value,
        cause: (error as any).cause,
      },
      suggestedActions: [
        'Make schema more flexible',
        'Add examples to prompt',
        'Use partial schemas',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle invalid tool arguments errors
   */
  private static handleInvalidToolInputError(
    error: InvalidToolInputError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.TOOL,
      retry: true,
      retryDelay: 1000,
      fallback: 'Disable tool or fix arguments',
      userMessage: 'Tool execution failed due to invalid parameters.',
      technicalDetails: {
        toolName: (error as any).toolName,
        arguments: (error as any).arguments,
      },
      suggestedActions: [
        'Validate tool parameters',
        'Update tool schema',
        'Provide better tool descriptions',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle invalid response data errors
   */
  private static handleInvalidResponseDataError(
    error: InvalidResponseDataError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.API,
      retry: false,
      fallback: 'Contact support or switch provider',
      userMessage: 'Received invalid data from AI service.',
      technicalDetails: {
        data: (error as any).data,
      },
      suggestedActions: [
        'Check API version compatibility',
        'Update SDK version',
        'Switch to different provider',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle too many embedding values error
   */
  private static handleTooManyEmbeddingValuesError(
    error: TooManyEmbeddingValuesForCallError
  ): AIErrorInfo {
    return {
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      retry: false,
      fallback: 'Batch embeddings or reduce input size',
      userMessage: 'Too much data for embedding generation.',
      technicalDetails: {
        providedValues: (error as any).providedValues,
        maxValues: (error as any).maxValues,
      },
      suggestedActions: [
        'Batch embedding requests',
        'Reduce input size',
        'Use chunking strategy',
      ],
      timestamp: 0,
    };
  }

  /**
   * Handle generic errors
   */
  private static handleGenericError(error: Error): AIErrorInfo {
    // Check for common patterns
    const isNetworkError =
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('fetch');
    const isTimeoutError = error.message.toLowerCase().includes('timeout');
    const isAuthError =
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('forbidden');

    return {
      message: error.message,
      severity: isAuthError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      category: isNetworkError
        ? ErrorCategory.NETWORK
        : isAuthError
          ? ErrorCategory.AUTHENTICATION
          : ErrorCategory.UNKNOWN,
      retry: isNetworkError || isTimeoutError,
      retryDelay: isTimeoutError ? 10_000 : 3000,
      fallback: isAuthError ? 'Check API credentials' : 'Use fallback provider',
      userMessage: AIErrorHandler.getUserFriendlyMessage(error),
      technicalDetails: {
        stack: error.stack,
        name: error.name,
      },
      suggestedActions: AIErrorHandler.getSuggestedActions(error),
      timestamp: 0,
    };
  }

  /**
   * Handle unknown errors
   */
  private static handleUnknownError(error: unknown): AIErrorInfo {
    return {
      message: 'An unknown error occurred',
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      retry: false,
      fallback: 'Report issue and use alternative',
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: { error },
      suggestedActions: [
        'Check logs for details',
        'Report to development team',
        'Try alternative approach',
      ],
      timestamp: 0,
    };
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit')) {
      return 'Service is busy. Please wait a moment before trying again.';
    }
    if (message.includes('timeout')) {
      return 'Request took too long. Please try again.';
    }
    if (message.includes('network')) {
      return 'Connection issue. Please check your internet and try again.';
    }
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'Authentication failed. Please check your credentials.';
    }
    if (message.includes('not found')) {
      return 'The requested resource was not found.';
    }

    return 'Something went wrong. Please try again.';
  }

  /**
   * Get suggested actions based on error
   */
  private static getSuggestedActions(error: Error): string[] {
    const message = error.message.toLowerCase();
    const actions: string[] = [];

    if (message.includes('rate limit')) {
      actions.push('Wait 60 seconds before retrying');
      actions.push('Upgrade to higher tier');
      actions.push('Implement request throttling');
    }
    if (message.includes('timeout')) {
      actions.push('Reduce request complexity');
      actions.push('Increase timeout limit');
      actions.push('Use streaming response');
    }
    if (message.includes('network')) {
      actions.push('Check internet connection');
      actions.push('Verify API endpoint');
      actions.push('Try different network');
    }

    return actions.length > 0
      ? actions
      : ['Retry request', 'Check error logs', 'Contact support'];
  }

  /**
   * Add error to history for pattern analysis
   */
  private static addToHistory(error: AIErrorInfo) {
    AIErrorHandler.errorHistory.unshift(error);
    if (AIErrorHandler.errorHistory.length > AIErrorHandler.MAX_HISTORY) {
      AIErrorHandler.errorHistory.pop();
    }
  }

  /**
   * Get error patterns from history
   */
  static getErrorPatterns(): {
    mostCommon: ErrorCategory[];
    recentTrend: 'increasing' | 'decreasing' | 'stable';
    criticalCount: number;
  } {
    const categoryCounts = new Map<ErrorCategory, number>();
    let criticalCount = 0;

    AIErrorHandler.errorHistory.forEach((error) => {
      const count = categoryCounts.get(error.category) || 0;
      categoryCounts.set(error.category, count + 1);

      if (error.severity === ErrorSeverity.CRITICAL) {
        criticalCount++;
      }
    });

    const mostCommon = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Simple trend analysis
    const recentErrors = AIErrorHandler.errorHistory.slice(0, 10).length;
    const olderErrors = AIErrorHandler.errorHistory.slice(10, 20).length;
    const trend =
      recentErrors > olderErrors
        ? 'increasing'
        : recentErrors < olderErrors
          ? 'decreasing'
          : 'stable';

    return { mostCommon, recentTrend: trend, criticalCount };
  }

  /**
   * Create recovery strategy based on error
   */
  static createRecoveryStrategy(error: AIErrorInfo): RecoveryStrategy {
    // Critical errors need immediate fallback
    if (error.severity === ErrorSeverity.CRITICAL) {
      return {
        type: 'fallback',
        fallbackModel: 'gpt-4o-mini', // Fast fallback model
      };
    }

    // Rate limit errors need delay
    if (error.category === ErrorCategory.RATE_LIMIT) {
      return {
        type: 'retry',
        maxRetries: 3,
        retryDelay: error.retryDelay || 60_000,
      };
    }

    // API errors might recover with retry
    if (error.category === ErrorCategory.API && error.retry) {
      return {
        type: 'retry',
        maxRetries: 3,
        retryDelay: error.retryDelay || 5000,
      };
    }

    // Validation errors need degraded functionality
    if (
      error.category === ErrorCategory.VALIDATION ||
      error.category === ErrorCategory.SCHEMA
    ) {
      return {
        type: 'degrade',
        degradedFeatures: ['structured-output', 'tool-calling'],
      };
    }

    // Default to fail for unknown errors
    return { type: 'fail' };
  }
}

// Convenience function for quick error handling
export function handleAIError(error: unknown, context?: any): AIErrorInfo {
  return AIErrorHandler.handleAIError(error, context);
}

// Error recovery executor
export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: AIErrorInfo) => RecoveryStrategy
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = handleAIError(error);
    const strategy = errorHandler
      ? errorHandler(errorInfo)
      : AIErrorHandler.createRecoveryStrategy(errorInfo);

    switch (strategy.type) {
      case 'retry':
        // Implement retry logic
        for (let i = 0; i < (strategy.maxRetries || 3); i++) {
          await new Promise((resolve) =>
            setTimeout(resolve, strategy.retryDelay || 5000)
          );
          try {
            return await operation();
          } catch (retryError) {
            if (i === (strategy.maxRetries || 3) - 1) throw retryError;
          }
        }
        break;

      case 'fallback':
        // This would need to be implemented based on your fallback logic
        throw new Error(
          `Fallback to ${strategy.fallbackModel} not implemented`
        );

      case 'degrade':
        // This would need custom implementation based on degraded features
        throw new Error('Degraded mode not implemented');

      case 'fail':
      default:
        throw error;
    }

    throw error;
  }
}

// Export a v2ErrorHandler instance for backward compatibility
export const v2ErrorHandler = {
  handleError: (error: unknown): AIErrorInfo => {
    return AIErrorHandler.handleAIError(error);
  },
};

// Additional types are already exported as interfaces above
