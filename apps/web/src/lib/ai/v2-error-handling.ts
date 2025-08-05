import {
  APICallError,
  EmptyResponseBodyError,
  InvalidArgumentError,
  InvalidResponseDataError,
  InvalidToolInputError,
  JSONParseError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  RetryError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from 'ai';
import { logError as logErrorToConsole } from '@/lib/logger';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

export interface ErrorHandlerOptions {
  maxRetries?: number;
  enableFallback?: boolean;
  logErrors?: boolean;
  userFriendly?: boolean;
}

export interface HandledError {
  message: string;
  retry: boolean;
  fallback?: string;
  code?: string;
  details?: any;
  userMessage?: string;
}

/**
 * V2 Specification compliant error handler for AI SDK 5.0
 */
export class V2ErrorHandler {
  private static instance: V2ErrorHandler;

  constructor(private options: ErrorHandlerOptions = {}) {
    this.options = {
      maxRetries: 3,
      enableFallback: true,
      logErrors: true,
      userFriendly: true,
      ...options,
    };
  }

  static getInstance(options?: ErrorHandlerOptions): V2ErrorHandler {
    if (!V2ErrorHandler.instance) {
      V2ErrorHandler.instance = new V2ErrorHandler(options);
    }
    return V2ErrorHandler.instance;
  }

  /**
   * Handle AI SDK errors with proper categorization and recovery strategies
   */
  handleError(error: unknown): HandledError {
    if (this.options.logErrors) {
      loggingService.error('AI SDK Error', { error });
    }

    // API Call Errors
    if (error instanceof APICallError) {
      return this.handleAPICallError(error);
    }

    // Invalid Argument Errors
    if (error instanceof InvalidArgumentError) {
      return {
        message: 'Invalid arguments provided to AI model',
        retry: false,
        code: 'INVALID_ARGUMENT',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Unable to process your request. Please check your input and try again.'
          : error.message,
      };
    }

    // Object Generation Errors
    if (error instanceof NoObjectGeneratedError) {
      return {
        message: 'Failed to generate structured output',
        retry: true,
        fallback: 'Try with simpler schema or different model',
        code: 'NO_OBJECT_GENERATED',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Unable to generate the requested format. Trying alternative approach...'
          : error.message,
      };
    }

    // Unsupported Functionality
    if (error instanceof UnsupportedFunctionalityError) {
      return {
        message: 'Requested functionality not supported by model',
        retry: false,
        fallback: 'Switch to a model that supports this feature',
        code: 'UNSUPPORTED_FUNCTIONALITY',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'This feature is not available with the current AI model.'
          : error.message,
      };
    }

    // Data Validation Errors
    if (error instanceof InvalidResponseDataError) {
      return {
        message: 'Received invalid response data from AI model',
        retry: true,
        code: 'INVALID_RESPONSE_DATA',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Received unexpected response. Retrying...'
          : error.message,
      };
    }

    // API Key Errors
    if (error instanceof LoadAPIKeyError) {
      return {
        message: 'Failed to load API key',
        retry: false,
        code: 'API_KEY_ERROR',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Authentication error. Please check your API configuration.'
          : error.message,
      };
    }

    // Empty Response Errors
    if (error instanceof EmptyResponseBodyError) {
      return {
        message: 'Received empty response from AI model',
        retry: true,
        code: 'EMPTY_RESPONSE',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'No response received. Retrying...'
          : error.message,
      };
    }

    // Type Validation Errors
    if (error instanceof TypeValidationError) {
      return {
        message: 'Type validation failed',
        retry: false,
        fallback: 'Adjust schema or input types',
        code: 'TYPE_VALIDATION_ERROR',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Data format mismatch. Please check your input.'
          : error.message,
      };
    }

    // JSON Parse Errors
    if (error instanceof JSONParseError) {
      return {
        message: 'Failed to parse JSON response',
        retry: true,
        fallback: 'Try with text output instead',
        code: 'JSON_PARSE_ERROR',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Unable to process response format. Trying alternative format...'
          : error.message,
      };
    }

    // Tool Errors
    if (error instanceof InvalidToolInputError) {
      return {
        message: 'Invalid input provided to tool',
        retry: false,
        code: 'INVALID_TOOL_INPUT',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Tool configuration error. Please try a different approach.'
          : error.message,
      };
    }

    if (error instanceof NoSuchToolError) {
      return {
        message: 'Requested tool not found',
        retry: false,
        fallback: 'Use available tools or skip tool usage',
        code: 'NO_SUCH_TOOL',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Requested feature not available.'
          : error.message,
      };
    }

    // Model/Provider Errors
    if (error instanceof NoSuchModelError) {
      return {
        message: 'Requested model not found',
        retry: false,
        fallback: 'Use default model',
        code: 'NO_SUCH_MODEL',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'AI model not available. Using alternative model...'
          : error.message,
      };
    }

    if (error instanceof NoSuchProviderError) {
      return {
        message: 'Requested provider not found',
        retry: false,
        fallback: 'Use default provider',
        code: 'NO_SUCH_PROVIDER',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'AI service not available. Switching to backup service...'
          : error.message,
      };
    }

    // Large request errors (generic handling for embedding/token limits)
    if (
      (error instanceof Error && error.message.includes('too many')) ||
      error.message.includes('too large')
    ) {
      return {
        message: 'Request size exceeds limits',
        retry: false,
        fallback: 'Split into smaller batches',
        code: 'REQUEST_TOO_LARGE',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Request too large. Processing in smaller chunks...'
          : error.message,
      };
    }

    // Retry Errors
    if (error instanceof RetryError) {
      return {
        message: 'Max retries exceeded',
        retry: false,
        fallback: 'Try different approach or model',
        code: 'MAX_RETRIES_EXCEEDED',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Service temporarily unavailable. Please try again later.'
          : error.message,
      };
    }

    // Generic Error handling
    if (error instanceof Error) {
      return {
        message: error.message,
        retry: false,
        code: 'UNKNOWN_ERROR',
        details: error.stack,
        userMessage: this.options.userFriendly
          ? 'An unexpected error occurred. Please try again.'
          : error.message,
      };
    }

    // Non-Error thrown
    return {
      message: 'Unknown error occurred',
      retry: false,
      code: 'UNKNOWN',
      details: String(error),
      userMessage: 'An unexpected error occurred. Please try again.',
    };
  }

  /**
   * Handle API call errors with specific strategies
   */
  private handleAPICallError(error: APICallError): HandledError {
    const statusCode = (error as any).statusCode;

    // Rate limiting
    if (statusCode === 429) {
      return {
        message: 'Rate limit exceeded',
        retry: true,
        fallback: 'Implement exponential backoff',
        code: 'RATE_LIMIT',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Too many requests. Please wait a moment and try again.'
          : error.message,
      };
    }

    // Authentication errors
    if (statusCode === 401 || statusCode === 403) {
      return {
        message: 'Authentication failed',
        retry: false,
        code: 'AUTH_ERROR',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'Authentication error. Please check your credentials.'
          : error.message,
      };
    }

    // Server errors
    if (statusCode >= 500) {
      return {
        message: 'AI service temporarily unavailable',
        retry: true,
        fallback: 'Switch to backup model or provider',
        code: 'SERVER_ERROR',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'AI service is temporarily unavailable. Trying backup service...'
          : error.message,
      };
    }

    // Model overload
    if (statusCode === 503) {
      return {
        message: 'Model overloaded',
        retry: true,
        fallback: 'Switch to less busy model',
        code: 'MODEL_OVERLOADED',
        details: error.message,
        userMessage: this.options.userFriendly
          ? 'AI model is busy. Switching to alternative model...'
          : error.message,
      };
    }

    // Generic API error
    return {
      message: 'API call failed',
      retry: true,
      fallback: 'Try different parameters or model',
      code: 'API_ERROR',
      details: error.message,
      userMessage: this.options.userFriendly
        ? 'Unable to connect to AI service. Retrying...'
        : error.message,
    };
  }

  /**
   * Create user-friendly error messages
   */
  getUserMessage(error: HandledError): string {
    return error.userMessage || error.message;
  }

  /**
   * Determine if error should trigger a retry
   */
  shouldRetry(error: HandledError): boolean {
    return error.retry && this.options.maxRetries! > 0;
  }

  /**
   * Get fallback strategy for error
   */
  getFallbackStrategy(error: HandledError): string | undefined {
    return this.options.enableFallback ? error.fallback : undefined;
  }

  /**
   * Log error with context
   */
  logError(error: HandledError, context?: any): void {
    if (this.options.logErrors) {
      loggingService.error('AI Error Handled', {
        code: error.code,
        message: error.message,
        retry: error.retry,
        fallback: error.fallback,
        context,
      });
    }
  }
}

// Export singleton instance
export const v2ErrorHandler = V2ErrorHandler.getInstance();

/**
 * Error recovery strategies
 */
export class ErrorRecoveryService {
  async executeWithRecovery<T>(
    action: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      fallbacks?: Array<() => Promise<T>>;
      onError?: (error: HandledError, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    let lastError: HandledError;

    // Try primary action with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = v2ErrorHandler.handleError(error);

        if (options.onError) {
          options.onError(lastError, attempt);
        }

        if (!lastError.retry || attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * 2 ** (attempt - 1))
        );
      }
    }

    // Try fallbacks
    if (options.fallbacks && options.fallbacks.length > 0) {
      for (const fallback of options.fallbacks) {
        try {
          loggingService.info('Attempting fallback strategy');
          return await fallback();
        } catch (fallbackError) {
          lastError = v2ErrorHandler.handleError(fallbackError);
        }
      }
    }

    // All attempts failed
    throw new Error(lastError!.userMessage || lastError!.message);
  }
}

export const errorRecoveryService = new ErrorRecoveryService();
