import logger from '@/lib/logger';

/**
 * Standardized error handling for the enhanced tool system
 * Addresses P3 issue: Inconsistent error handling patterns across modules
 */

export interface ToolError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  context?: Record<string, any>;
  originalError?: Error;
  timestamp: number;
  retryable: boolean;
}

export interface ErrorHandlingOptions {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  includeStack?: boolean;
  sanitizeContext?: boolean;
  maxRetries?: number;
}

/**
 * Standard error handling utility for all tool modules
 */
export class StandardErrorHandler {
  private static instance: StandardErrorHandler;

  static getInstance(): StandardErrorHandler {
    if (!StandardErrorHandler.instance) {
      StandardErrorHandler.instance = new StandardErrorHandler();
    }
    return StandardErrorHandler.instance;
  }

  /**
   * Handle and log errors consistently across all modules
   */
  handleError(
    error: Error | ToolError | unknown,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): ToolError {
    const {
      logLevel = 'error',
      includeStack = true,
      sanitizeContext = true,
      maxRetries = 0,
    } = options;

    // Normalize error to ToolError format
    const toolError = this.normalizeError(error, context);

    // Sanitize context if requested
    if (sanitizeContext && toolError.context) {
      toolError.context = this.sanitizeContext(toolError.context);
    }

    // Log error based on severity and logLevel
    this.logError(toolError, logLevel, includeStack);

    return toolError;
  }

  /**
   * Wrap function execution with standardized error handling
   */
  async wrapExecution<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): Promise<
    { success: true; data: T } | { success: false; error: ToolError }
  > {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      const toolError = this.handleError(error, context, options);
      return { success: false, error: toolError };
    }
  }

  /**
   * Wrap synchronous function execution with standardized error handling
   */
  wrapSyncExecution<T>(
    fn: () => T,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): { success: true; data: T } | { success: false; error: ToolError } {
    try {
      const result = fn();
      return { success: true, data: result };
    } catch (error) {
      const toolError = this.handleError(error, context, options);
      return { success: false, error: toolError };
    }
  }

  /**
   * Create a retryable operation with standardized error handling
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): Promise<
    | { success: true; data: T }
    | { success: false; error: ToolError; attempts: number }
  > {
    let lastError: ToolError | null = null;
    let attempts = 0;

    for (let i = 0; i <= maxRetries; i++) {
      attempts++;
      try {
        const result = await fn();
        return { success: true, data: result };
      } catch (error) {
        lastError = this.handleError(
          error,
          { ...context, attempt: i + 1 },
          {
            ...options,
            logLevel: i === maxRetries ? 'error' : 'warn',
          }
        );

        if (!lastError.retryable || i === maxRetries) {
          break;
        }

        // Exponential backoff for retries
        if (i < maxRetries) {
          await this.delay(2 ** i * 1000);
        }
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts,
    };
  }

  /**
   * Normalize various error types to ToolError format
   */
  private normalizeError(
    error: Error | ToolError | unknown,
    context?: Record<string, any>
  ): ToolError {
    const timestamp = Date.now();

    // Already a ToolError
    if (this.isToolError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
        timestamp,
      };
    }

    // Standard Error object
    if (error instanceof Error) {
      return {
        code: this.inferErrorCode(error),
        message: error.message,
        severity: this.inferSeverity(error),
        context,
        originalError: error,
        timestamp,
        retryable: this.isRetryable(error),
      };
    }

    // Unknown error type
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      severity: 'medium',
      context,
      timestamp,
      retryable: false,
    };
  }

  /**
   * Type guard for ToolError
   */
  private isToolError(error: any): error is ToolError {
    return (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      'severity' in error
    );
  }

  /**
   * Infer error code from Error object
   */
  private inferErrorCode(error: Error): string {
    if (error.name) return error.name.toUpperCase();
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('permission')) return 'PERMISSION_ERROR';
    return 'GENERIC_ERROR';
  }

  /**
   * Infer severity from Error object
   */
  private inferSeverity(error: Error): ToolError['severity'] {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal'))
      return 'critical';
    if (message.includes('security') || message.includes('auth')) return 'high';
    if (message.includes('validation') || message.includes('timeout'))
      return 'medium';
    return 'low';
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    if (
      message.includes('validation') ||
      message.includes('auth') ||
      message.includes('permission') ||
      message.includes('syntax')
    ) {
      return false;
    }

    // Retryable errors
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('temporary') ||
      message.includes('busy')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      // Remove sensitive keys
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credential',
      'session',
      'cookie',
      'bearer',
      'jwt',
      'apikey',
    ];

    return sensitiveKeys.some((sensitive) =>
      key.toLowerCase().includes(sensitive)
    );
  }

  /**
   * Sanitize string to prevent log injection
   */
  private sanitizeString(value: string): string {
    return value.replace(/[\r\n\t]/g, ' ').substring(0, 1000);
  }

  /**
   * Log error with appropriate level
   */
  private logError(
    error: ToolError,
    logLevel: ErrorHandlingOptions['logLevel'],
    includeStack: boolean
  ): void {
    const logData = {
      errorCode: error.code,
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp,
      retryable: error.retryable,
      context: error.context,
      ...(includeStack &&
        error.originalError?.stack && {
          stack: error.originalError.stack,
        }),
    };

    switch (logLevel) {
      case 'error':
        logger.error(logData, 'Tool system error');
        break;
      case 'warn':
        logger.warn(logData, 'Tool system warning');
        break;
      case 'info':
        logger.info(logData, 'Tool system info');
        break;
      case 'debug':
        logger.debug(logData, 'Tool system debug');
        break;
    }
  }

  /**
   * Delay execution for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const standardErrorHandler = StandardErrorHandler.getInstance();

// Convenience functions for common error handling patterns

/**
 * Standard async error wrapper
 */
export async function handleAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ success: true; data: T } | { success: false; error: ToolError }> {
  return standardErrorHandler.wrapExecution(fn, context);
}

/**
 * Standard sync error wrapper
 */
export function handleSync<T>(
  fn: () => T,
  context?: Record<string, any>
): { success: true; data: T } | { success: false; error: ToolError } {
  return standardErrorHandler.wrapSyncExecution(fn, context);
}

/**
 * Standard retry wrapper
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  context?: Record<string, any>
): Promise<
  | { success: true; data: T }
  | { success: false; error: ToolError; attempts: number }
> {
  return standardErrorHandler.withRetry(fn, maxRetries, context);
}
