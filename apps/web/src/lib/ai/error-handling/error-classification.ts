import {
  APICallError,
  InvalidArgumentError,
  type LanguageModelUsage,
  NoObjectGeneratedError,
  NoSuchModelError,
  NoSuchToolError,
} from 'ai';

// Define ToolExecutionError locally since it's not exported from 'ai'
class ToolExecutionError extends Error {
  static isInstance(error: unknown): error is ToolExecutionError {
    return error instanceof ToolExecutionError;
  }
}

import { logError as logErrorToConsole } from '@/lib/logger';
import { ErrorCategory, ErrorSeverity } from './advanced-error-handling';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Error pattern types
export enum ErrorPattern {
  RATE_LIMIT = 'rate-limit',
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  INVALID_INPUT = 'invalid-input',
  RESOURCE_NOT_FOUND = 'resource-not-found',
  SERVICE_UNAVAILABLE = 'service-unavailable',
  QUOTA_EXCEEDED = 'quota-exceeded',
  CONTENT_POLICY = 'content-policy',
  MODEL_OVERLOAD = 'model-overload',
  UNKNOWN = 'unknown',
}

// Error classification result
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  pattern: ErrorPattern;
  isTransient: boolean;
  isRetryable: boolean;
  requiresUserAction: boolean;
  suggestedWaitTime?: number;
  metadata: Record<string, any>;
}

// Pattern matching rules
interface PatternRule {
  pattern: ErrorPattern;
  matches: (error: unknown) => boolean;
  severity: ErrorSeverity;
  isTransient: boolean;
  isRetryable: boolean;
  requiresUserAction: boolean;
  getSuggestedWaitTime?: (error: unknown) => number;
}

/**
 * Error Classifier for AI SDK errors
 */
export class ErrorClassifier {
  private static instance: ErrorClassifier;
  private patternRules: PatternRule[];
  private errorStats: Map<ErrorPattern, number> = new Map();
  private lastErrorTimes: Map<ErrorPattern, number[]> = new Map();

  private constructor() {
    this.patternRules = this.initializePatternRules();
    this.initializeErrorStats();
  }

  static getInstance(): ErrorClassifier {
    if (!ErrorClassifier.instance) {
      ErrorClassifier.instance = new ErrorClassifier();
    }
    return ErrorClassifier.instance;
  }

  /**
   * Classify an error
   */
  classifyError(error: unknown): ErrorClassification {
    // Determine category
    const category = this.determineCategory(error);

    // Find matching pattern
    const matchedRule = this.findMatchingPattern(error);
    const pattern = matchedRule?.pattern || ErrorPattern.UNKNOWN;

    // Determine severity if not provided by pattern
    const severity =
      matchedRule?.severity || this.determineSeverity(error, category, pattern);

    // Track error occurrence
    this.trackErrorOccurrence(pattern);

    // Build classification
    const classification: ErrorClassification = {
      category,
      severity,
      pattern,
      isTransient:
        matchedRule?.isTransient ?? this.isTransientError(error, pattern),
      isRetryable:
        matchedRule?.isRetryable ?? this.isRetryableError(error, pattern),
      requiresUserAction:
        matchedRule?.requiresUserAction ?? this.requiresUserAction(pattern),
      suggestedWaitTime: matchedRule?.getSuggestedWaitTime?.(error),
      metadata: this.extractMetadata(error),
    };

    // Apply rate limit detection
    if (this.isRateLimitPattern(pattern)) {
      classification.suggestedWaitTime =
        classification.suggestedWaitTime ||
        this.calculateRateLimitWaitTime(pattern);
    }

    loggingService.debug('Error classified', {
      pattern,
      category,
      severity,
      isRetryable: classification.isRetryable,
    });

    return classification;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    byPattern: Record<ErrorPattern, number>;
    recentPatterns: Array<{
      pattern: ErrorPattern;
      count: number;
      rate: number;
    }>;
    recommendations: string[];
  } {
    const byPattern = Object.fromEntries(this.errorStats) as Record<
      ErrorPattern,
      number
    >;

    // Calculate recent patterns and rates
    const recentPatterns = Array.from(this.lastErrorTimes.entries())
      .map(([pattern, times]) => {
        const recentTimes = times.filter((t) => Date.now() - t < 3_600_000); // Last hour
        const rate = recentTimes.length / 60; // Per minute

        return {
          pattern,
          count: recentTimes.length,
          rate,
        };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.rate - a.rate);

    // Generate recommendations
    const recommendations = this.generateRecommendations(recentPatterns);

    return {
      byPattern,
      recentPatterns,
      recommendations,
    };
  }

  /**
   * Predict if an error is likely to occur
   */
  predictErrorLikelihood(pattern: ErrorPattern): {
    likelihood: 'low' | 'medium' | 'high';
    recentOccurrences: number;
    averageInterval: number;
  } {
    const times = this.lastErrorTimes.get(pattern) || [];
    const recentTimes = times.filter((t) => Date.now() - t < 3_600_000); // Last hour

    if (recentTimes.length === 0) {
      return {
        likelihood: 'low',
        recentOccurrences: 0,
        averageInterval: 0,
      };
    }

    // Calculate average interval
    const intervals: number[] = [];
    for (let i = 1; i < recentTimes.length; i++) {
      intervals.push(recentTimes[i] - recentTimes[i - 1]);
    }

    const averageInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;

    // Determine likelihood
    let likelihood: 'low' | 'medium' | 'high' = 'low';
    if (recentTimes.length > 10) {
      likelihood = 'high';
    } else if (recentTimes.length > 5) {
      likelihood = 'medium';
    }

    return {
      likelihood,
      recentOccurrences: recentTimes.length,
      averageInterval,
    };
  }

  // Private helper methods

  private initializePatternRules(): PatternRule[] {
    return [
      // Rate limit pattern
      {
        pattern: ErrorPattern.RATE_LIMIT,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return (
              error.statusCode === 429 ||
              error.message?.toLowerCase().includes('rate limit')
            );
          }
          return false;
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
        getSuggestedWaitTime: (error) => {
          if (APICallError.isInstance(error)) {
            const retryAfter = error.responseHeaders?.['retry-after'];
            if (retryAfter) {
              return Number.parseInt(retryAfter) * 1000;
            }
          }
          return 60_000; // Default 1 minute
        },
      },

      // Timeout pattern
      {
        pattern: ErrorPattern.TIMEOUT,
        matches: (error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('timeout') ||
            message.includes('timed out') ||
            (APICallError.isInstance(error) && error.statusCode === 408)
          );
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },

      // Network pattern
      {
        pattern: ErrorPattern.NETWORK,
        matches: (error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('network') ||
            message.includes('connection') ||
            message.includes('econnrefused') ||
            message.includes('enotfound')
          );
        },
        severity: ErrorSeverity.HIGH,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },

      // Authentication pattern
      {
        pattern: ErrorPattern.AUTHENTICATION,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return error.statusCode === 401;
          }
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('unauthorized') ||
            message.includes('authentication')
          );
        },
        severity: ErrorSeverity.CRITICAL,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Permission pattern
      {
        pattern: ErrorPattern.PERMISSION,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return error.statusCode === 403;
          }
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('forbidden') || message.includes('permission')
          );
        },
        severity: ErrorSeverity.HIGH,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Invalid input pattern
      {
        pattern: ErrorPattern.INVALID_INPUT,
        matches: (error) => {
          if (InvalidArgumentError.isInstance(error)) {
            return true;
          }
          if (APICallError.isInstance(error)) {
            return error.statusCode === 400;
          }
          return false;
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Resource not found pattern
      {
        pattern: ErrorPattern.RESOURCE_NOT_FOUND,
        matches: (error) => {
          if (
            NoSuchModelError.isInstance(error) ||
            NoSuchToolError.isInstance(error)
          ) {
            return true;
          }
          if (APICallError.isInstance(error)) {
            return error.statusCode === 404;
          }
          return false;
        },
        severity: ErrorSeverity.HIGH,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Service unavailable pattern
      {
        pattern: ErrorPattern.SERVICE_UNAVAILABLE,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return (
              error.statusCode === 503 ||
              error.statusCode === 502 ||
              error.statusCode === 504
            );
          }
          return false;
        },
        severity: ErrorSeverity.HIGH,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },

      // Quota exceeded pattern
      {
        pattern: ErrorPattern.QUOTA_EXCEEDED,
        matches: (error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('quota') ||
            message.includes('limit exceeded') ||
            message.includes('usage limit')
          );
        },
        severity: ErrorSeverity.HIGH,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Content policy pattern
      {
        pattern: ErrorPattern.CONTENT_POLICY,
        matches: (error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('content policy') ||
            message.includes('safety') ||
            message.includes('inappropriate') ||
            message.includes('violation')
          );
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },

      // Model overload pattern
      {
        pattern: ErrorPattern.MODEL_OVERLOAD,
        matches: (error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : '';
          return (
            message.includes('overloaded') ||
            message.includes('capacity') ||
            (APICallError.isInstance(error) && error.statusCode === 529)
          );
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
        getSuggestedWaitTime: () => 30_000, // 30 seconds
      },
    ];
  }

  private determineCategory(error: unknown): ErrorCategory {
    if (APICallError.isInstance(error)) {
      return ErrorCategory.API;
    }

    if (InvalidArgumentError.isInstance(error)) {
      return ErrorCategory.VALIDATION;
    }

    if (NoObjectGeneratedError.isInstance(error)) {
      return ErrorCategory.GENERATION;
    }

    if (
      NoSuchToolError.isInstance(error) ||
      ToolExecutionError.isInstance(error)
    ) {
      return ErrorCategory.TOOL;
    }

    if (NoSuchModelError.isInstance(error)) {
      return ErrorCategory.MODEL;
    }

    // Check message patterns
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('connection')) {
        return ErrorCategory.NETWORK;
      }
      if (message.includes('config') || message.includes('api key')) {
        return ErrorCategory.CONFIGURATION;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  private findMatchingPattern(error: unknown): PatternRule | undefined {
    return this.patternRules.find((rule) => rule.matches(error));
  }

  private determineSeverity(
    error: unknown,
    category: ErrorCategory,
    pattern: ErrorPattern
  ): ErrorSeverity {
    // Critical patterns
    if (
      pattern === ErrorPattern.AUTHENTICATION ||
      pattern === ErrorPattern.QUOTA_EXCEEDED
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity patterns
    if (
      pattern === ErrorPattern.NETWORK ||
      pattern === ErrorPattern.SERVICE_UNAVAILABLE ||
      pattern === ErrorPattern.RESOURCE_NOT_FOUND
    ) {
      return ErrorSeverity.HIGH;
    }

    // Category-based defaults
    switch (category) {
      case ErrorCategory.CONFIGURATION:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.API:
      case ErrorCategory.MODEL:
        return ErrorSeverity.HIGH;
      case ErrorCategory.GENERATION:
      case ErrorCategory.VALIDATION:
      case ErrorCategory.TOOL:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  private isTransientError(error: unknown, pattern: ErrorPattern): boolean {
    // Network and service errors are usually transient
    if (
      pattern === ErrorPattern.NETWORK ||
      pattern === ErrorPattern.SERVICE_UNAVAILABLE ||
      pattern === ErrorPattern.TIMEOUT ||
      pattern === ErrorPattern.MODEL_OVERLOAD
    ) {
      return true;
    }

    // 5xx errors are transient
    if (
      APICallError.isInstance(error) &&
      error.statusCode &&
      error.statusCode >= 500
    ) {
      return true;
    }

    return false;
  }

  private isRetryableError(error: unknown, pattern: ErrorPattern): boolean {
    // Authentication and permission errors are not retryable
    if (
      pattern === ErrorPattern.AUTHENTICATION ||
      pattern === ErrorPattern.PERMISSION ||
      pattern === ErrorPattern.QUOTA_EXCEEDED
    ) {
      return false;
    }

    // Check API error retryability
    if (APICallError.isInstance(error)) {
      return (
        Boolean(error.isRetryable) ||
        (error.statusCode !== undefined && error.statusCode >= 500) ||
        (error.statusCode !== undefined && error.statusCode === 429)
      );
    }

    return this.isTransientError(error, pattern);
  }

  private requiresUserAction(pattern: ErrorPattern): boolean {
    return [
      ErrorPattern.AUTHENTICATION,
      ErrorPattern.PERMISSION,
      ErrorPattern.INVALID_INPUT,
      ErrorPattern.RESOURCE_NOT_FOUND,
      ErrorPattern.QUOTA_EXCEEDED,
      ErrorPattern.CONTENT_POLICY,
    ].includes(pattern);
  }

  private extractMetadata(error: unknown): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (APICallError.isInstance(error)) {
      metadata.statusCode = error.statusCode;
      metadata.statusText = (error as any).statusText;
      metadata.url = error.url;
      metadata.isRetryable = error.isRetryable;
    }

    if (error instanceof Error) {
      metadata.errorName = error.name;
      metadata.errorMessage = error.message;
    }

    if (NoObjectGeneratedError.isInstance(error)) {
      metadata.finishReason = error.finishReason;
      metadata.usage = error.usage;
    }

    return metadata;
  }

  private trackErrorOccurrence(pattern: ErrorPattern): void {
    // Update count
    const currentCount = this.errorStats.get(pattern) || 0;
    this.errorStats.set(pattern, currentCount + 1);

    // Track time
    if (!this.lastErrorTimes.has(pattern)) {
      this.lastErrorTimes.set(pattern, []);
    }

    const times = this.lastErrorTimes.get(pattern)!;
    times.push(Date.now());

    // Keep only recent times (last 2 hours)
    const cutoff = Date.now() - 2 * 3_600_000;
    const recentTimes = times.filter((t) => t > cutoff);
    this.lastErrorTimes.set(pattern, recentTimes);
  }

  private isRateLimitPattern(pattern: ErrorPattern): boolean {
    return [
      ErrorPattern.RATE_LIMIT,
      ErrorPattern.QUOTA_EXCEEDED,
      ErrorPattern.MODEL_OVERLOAD,
    ].includes(pattern);
  }

  private calculateRateLimitWaitTime(pattern: ErrorPattern): number {
    const times = this.lastErrorTimes.get(pattern) || [];
    const recentTimes = times.filter((t) => Date.now() - t < 600_000); // Last 10 minutes

    // Exponential backoff based on recent occurrences
    const occurrences = recentTimes.length;
    const baseWait = 60_000; // 1 minute
    const maxWait = 300_000; // 5 minutes

    const waitTime = Math.min(baseWait * 2 ** (occurrences - 1), maxWait);

    return waitTime;
  }

  private generateRecommendations(
    recentPatterns: Array<{
      pattern: ErrorPattern;
      count: number;
      rate: number;
    }>
  ): string[] {
    const recommendations: string[] = [];

    for (const { pattern, count, rate } of recentPatterns) {
      if (pattern === ErrorPattern.RATE_LIMIT && rate > 0.5) {
        recommendations.push(
          'Implement request throttling to avoid rate limits'
        );
      }

      if (pattern === ErrorPattern.TIMEOUT && count > 5) {
        recommendations.push(
          'Consider increasing timeout values or optimizing requests'
        );
      }

      if (pattern === ErrorPattern.NETWORK && count > 3) {
        recommendations.push(
          'Check network connectivity and implement offline fallbacks'
        );
      }

      if (pattern === ErrorPattern.MODEL_OVERLOAD && rate > 0.2) {
        recommendations.push(
          'Consider using alternative models during peak times'
        );
      }

      if (pattern === ErrorPattern.INVALID_INPUT && count > 2) {
        recommendations.push(
          'Review input validation and provide clearer error messages'
        );
      }
    }

    return recommendations;
  }

  private initializeErrorStats(): void {
    Object.values(ErrorPattern).forEach((pattern) => {
      this.errorStats.set(pattern, 0);
    });
  }
}

// Export singleton getter
export const getErrorClassifier = (): ErrorClassifier => {
  return ErrorClassifier.getInstance();
};

// Convenience function
export function classifyError(error: unknown): ErrorClassification {
  const classifier = getErrorClassifier();
  return classifier.classifyError(error);
}
