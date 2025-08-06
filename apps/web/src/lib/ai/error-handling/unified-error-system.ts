import {
  APICallError,
  DownloadError,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidResponseDataError,
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

// Unified logger wrapper with consistent interface
const unifiedLogger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data),
} as const;

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
  static isInstance(error: unknown): error is TooManyEmbeddingValuesForCallError {
    return error instanceof TooManyEmbeddingValuesForCallError;
  }
}

// Unified error severity and category enums
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  API = 'api',
  VALIDATION = 'validation',
  GENERATION = 'generation',
  TOOL = 'tool',
  MODEL = 'model',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  PARSING = 'parsing',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  UNKNOWN = 'unknown',
}

// Unified error pattern types for classification
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

// Unified error information interface
export interface UnifiedErrorInfo {
  // Core error information
  message: string;
  code: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  pattern: ErrorPattern;
  timestamp: Date;
  errorId: string;
  
  // Behavioral flags
  isRetryable: boolean;
  retry: boolean; // Alias for backward compatibility
  isTransient: boolean;
  requiresUserAction: boolean;
  
  // Retry configuration
  suggestedWaitTime?: number;
  maxRetries?: number;
  retryDelay?: number;
  
  // Additional context
  context?: Record<string, any>;
  metadata: Record<string, any>;
  originalError?: Error;
  
  // User-facing information
  userMessage?: string;
  suggestions?: string[];
  actionRequired?: string;
  fallback?: string;
  
  // Technical details
  technicalDetails?: Record<string, any>;
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

// Unified retry configuration
export interface UnifiedRetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: Set<string>;
  retryablePatterns?: ErrorPattern[];
}

// Error handling options
export interface ErrorHandlingOptions {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  includeStack?: boolean;
  sanitizeContext?: boolean;
  maxRetries?: number;
  enableClassification?: boolean;
  enableMetrics?: boolean;
}

// Recovery strategy interface
export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'degrade' | 'fail';
  maxRetries?: number;
  retryDelay?: number;
  fallbackModel?: string;
  degradedFeatures?: string[];
  customHandler?: (error: unknown) => Promise<any>;
}

// Pattern matching rule for classification
interface PatternRule {
  pattern: ErrorPattern;
  matches: (error: unknown) => boolean;
  severity: ErrorSeverity;
  isTransient: boolean;
  isRetryable: boolean;
  requiresUserAction: boolean;
  getSuggestedWaitTime?: (error: unknown) => number;
}

// Default configurations
const DEFAULT_RETRY_CONFIG: UnifiedRetryConfig = {
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
    'NoTranscriptGeneratedError',
    'NoImageGeneratedError',
  ]),
  retryablePatterns: [
    ErrorPattern.RATE_LIMIT,
    ErrorPattern.TIMEOUT,
    ErrorPattern.NETWORK,
    ErrorPattern.SERVICE_UNAVAILABLE,
    ErrorPattern.MODEL_OVERLOAD,
  ],
};

/**
 * Unified Error System for AI SDK v5 and custom error handling
 * Consolidates functionality from multiple error handling files
 */
export class UnifiedErrorSystem {
  private static instance: UnifiedErrorSystem;
  private retryConfig: UnifiedRetryConfig;
  private patternRules: PatternRule[];
  private errorHistory: Map<string, UnifiedErrorInfo[]> = new Map();
  private errorMetrics: Map<ErrorCategory, number> = new Map();
  private errorStats: Map<ErrorPattern, number> = new Map();
  private lastErrorTimes: Map<ErrorPattern, number[]> = new Map();

  private constructor(retryConfig?: Partial<UnifiedRetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.patternRules = this.initializePatternRules();
    this.initializeErrorStats();
  }

  static getInstance(retryConfig?: Partial<UnifiedRetryConfig>): UnifiedErrorSystem {
    if (!UnifiedErrorSystem.instance) {
      UnifiedErrorSystem.instance = new UnifiedErrorSystem(retryConfig);
    }
    return UnifiedErrorSystem.instance;
  }

  /**
   * Main error handling function with classification and recovery
   */
  handleError(
    error: unknown,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): UnifiedErrorInfo {
    const errorId = this.generateErrorId();
    const timestamp = new Date();
    
    // Classify error
    const classification = options.enableClassification !== false 
      ? this.classifyError(error) 
      : this.getBasicClassification(error);
    
    // Create unified error info
    const unifiedError = this.createUnifiedErrorInfo(
      error, 
      classification, 
      errorId, 
      timestamp, 
      context
    );
    
    // Sanitize context if requested
    if (options.sanitizeContext && unifiedError.context) {
      unifiedError.context = this.sanitizeContext(unifiedError.context);
    }
    
    // Record error for metrics and history
    this.recordError(unifiedError);
    
    // Log error
    this.logError(unifiedError, options);
    
    return unifiedError;
  }

  /**
   * Execute operation with unified retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): Promise<T> {
    let lastError: UnifiedErrorInfo | undefined;
    let attempts = 0;
    const maxRetries = options.maxRetries ?? this.retryConfig.maxRetries;

    while (attempts <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempts++;
        lastError = this.handleError(error, { ...context, attempt: attempts }, {
          ...options,
          logLevel: attempts > maxRetries ? 'error' : 'warn',
        });

        if (!lastError.isRetryable || attempts > maxRetries) {
          break;
        }

        // Calculate delay with jitter
        const delay = this.calculateRetryDelay(attempts - 1);
        unifiedLogger.debug(`Retrying operation in ${delay}ms (attempt ${attempts}/${maxRetries})`, {
          errorPattern: lastError.pattern,
          delay,
        });
        
        await this.sleep(delay);
      }
    }

    throw lastError?.originalError || new Error('Max retries exceeded');
  }

  /**
   * Classify error with pattern matching
   */
  classifyError(error: unknown): ErrorClassification {
    const category = this.determineCategory(error);
    const matchedRule = this.findMatchingPattern(error);
    const pattern = matchedRule?.pattern || ErrorPattern.UNKNOWN;
    const severity = matchedRule?.severity || this.determineSeverity(error, category, pattern);
    
    // Track error occurrence
    this.trackErrorOccurrence(pattern);
    
    return {
      category,
      severity,
      pattern,
      isTransient: matchedRule?.isTransient ?? this.isTransientError(error, pattern),
      isRetryable: matchedRule?.isRetryable ?? this.isRetryableError(error, pattern),
      requiresUserAction: matchedRule?.requiresUserAction ?? this.requiresUserAction(pattern),
      suggestedWaitTime: matchedRule?.getSuggestedWaitTime?.(error),
      metadata: this.extractMetadata(error),
    };
  }

  /**
   * Create recovery strategy based on error
   */
  createRecoveryStrategy(errorInfo: UnifiedErrorInfo): RecoveryStrategy {
    // Critical errors need immediate fallback
    if (errorInfo.severity === ErrorSeverity.CRITICAL) {
      return {
        type: 'fallback',
        fallbackModel: 'gpt-4o-mini',
      };
    }

    // Rate limit errors need delay
    if (errorInfo.pattern === ErrorPattern.RATE_LIMIT) {
      return {
        type: 'retry',
        maxRetries: 3,
        retryDelay: errorInfo.suggestedWaitTime || 60_000,
      };
    }

    // Transient errors are retryable
    if (errorInfo.isTransient && errorInfo.isRetryable) {
      return {
        type: 'retry',
        maxRetries: this.retryConfig.maxRetries,
        retryDelay: errorInfo.suggestedWaitTime || this.retryConfig.initialDelay,
      };
    }

    // Validation errors need degraded functionality
    if (errorInfo.category === ErrorCategory.VALIDATION) {
      return {
        type: 'degrade',
        degradedFeatures: ['structured-output', 'tool-calling'],
      };
    }

    return { type: 'fail' };
  }

  /**
   * Get comprehensive error statistics
   */
  getErrorStatistics(): {
    byCategory: Record<ErrorCategory, number>;
    byPattern: Record<ErrorPattern, number>;
    recentErrors: UnifiedErrorInfo[];
    recentPatterns: Array<{
      pattern: ErrorPattern;
      count: number;
      rate: number;
    }>;
    recommendations: string[];
    totalErrors: number;
  } {
    const recentErrors: UnifiedErrorInfo[] = [];
    for (const errors of this.errorHistory.values()) {
      recentErrors.push(...errors);
    }
    recentErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const recentPatterns = Array.from(this.lastErrorTimes.entries())
      .map(([pattern, times]) => {
        const recentTimes = times.filter(t => Date.now() - t < 3_600_000);
        return {
          pattern,
          count: recentTimes.length,
          rate: recentTimes.length / 60,
        };
      })
      .filter(p => p.count > 0)
      .sort((a, b) => b.rate - a.rate);

    return {
      byCategory: Object.fromEntries(this.errorMetrics) as Record<ErrorCategory, number>,
      byPattern: Object.fromEntries(this.errorStats) as Record<ErrorPattern, number>,
      recentErrors: recentErrors.slice(0, 100),
      recentPatterns,
      recommendations: this.generateRecommendations(recentPatterns),
      totalErrors: recentErrors.length,
    };
  }

  /**
   * Clear all error history and metrics
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.errorMetrics.clear();
    this.errorStats.clear();
    this.lastErrorTimes.clear();
    this.initializeErrorStats();
    unifiedLogger.info('Error history and metrics cleared');
  }

  // Private helper methods

  private initializePatternRules(): PatternRule[] {
    return [
      {
        pattern: ErrorPattern.RATE_LIMIT,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return error.statusCode === 429 || error.message?.toLowerCase().includes('rate limit');
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
            if (retryAfter) return Number.parseInt(retryAfter) * 1000;
          }
          return 60_000;
        },
      },
      {
        pattern: ErrorPattern.TIMEOUT,
        matches: (error) => {
          const message = error instanceof Error ? error.message.toLowerCase() : '';
          return message.includes('timeout') || message.includes('timed out') ||
            (APICallError.isInstance(error) && error.statusCode === 408);
        },
        severity: ErrorSeverity.MEDIUM,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },
      {
        pattern: ErrorPattern.NETWORK,
        matches: (error) => {
          const message = error instanceof Error ? error.message.toLowerCase() : '';
          return message.includes('network') || message.includes('connection') ||
            message.includes('econnrefused') || message.includes('enotfound');
        },
        severity: ErrorSeverity.HIGH,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },
      {
        pattern: ErrorPattern.AUTHENTICATION,
        matches: (error) => {
          if (APICallError.isInstance(error)) return error.statusCode === 401;
          const message = error instanceof Error ? error.message.toLowerCase() : '';
          return message.includes('unauthorized') || message.includes('authentication');
        },
        severity: ErrorSeverity.CRITICAL,
        isTransient: false,
        isRetryable: false,
        requiresUserAction: true,
      },
      {
        pattern: ErrorPattern.SERVICE_UNAVAILABLE,
        matches: (error) => {
          if (APICallError.isInstance(error)) {
            return [503, 502, 504].includes(error.statusCode ?? 0);
          }
          return false;
        },
        severity: ErrorSeverity.HIGH,
        isTransient: true,
        isRetryable: true,
        requiresUserAction: false,
      },
      // Add more patterns as needed...
    ];
  }

  private createUnifiedErrorInfo(
    error: unknown,
    classification: ErrorClassification,
    errorId: string,
    timestamp: Date,
    context?: Record<string, any>
  ): UnifiedErrorInfo {
    const baseInfo = this.getBaseErrorInfo(error);
    
    return {
      ...baseInfo,
      code: this.inferErrorCode(error),
      severity: classification.severity,
      category: classification.category,
      pattern: classification.pattern,
      timestamp,
      errorId,
      isRetryable: classification.isRetryable,
      retry: classification.isRetryable, // Alias for backward compatibility
      isTransient: classification.isTransient,
      requiresUserAction: classification.requiresUserAction,
      suggestedWaitTime: classification.suggestedWaitTime,
      context,
      metadata: classification.metadata,
      userMessage: this.getUserFriendlyMessage(error),
      suggestions: this.getSuggestedActions(error, classification),
      fallback: this.getFallbackSuggestion(classification),
      technicalDetails: this.getTechnicalDetails(error),
      originalError: error instanceof Error ? error : undefined,
    };
  }

  private getBaseErrorInfo(error: unknown): { message: string } {
    if (error instanceof Error) {
      return { message: error.message };
    }
    if (typeof error === 'string') {
      return { message: error };
    }
    return { message: 'Unknown error occurred' };
  }

  private getBasicClassification(error: unknown): ErrorClassification {
    const category = this.determineCategory(error);
    return {
      category,
      severity: ErrorSeverity.MEDIUM,
      pattern: ErrorPattern.UNKNOWN,
      isTransient: false,
      isRetryable: false,
      requiresUserAction: true,
      metadata: this.extractMetadata(error),
    };
  }

  private determineCategory(error: unknown): ErrorCategory {
    if (APICallError.isInstance(error)) return ErrorCategory.API;
    if (InvalidArgumentError.isInstance(error) || TypeValidationError.isInstance(error)) {
      return ErrorCategory.VALIDATION;
    }
    if (NoObjectGeneratedError.isInstance(error) || NoImageGeneratedError.isInstance(error)) {
      return ErrorCategory.GENERATION;
    }
    if (NoSuchToolError.isInstance(error) || ToolExecutionError.isInstance(error)) {
      return ErrorCategory.TOOL;
    }
    if (NoSuchModelError.isInstance(error)) return ErrorCategory.MODEL;
    if (LoadAPIKeyError.isInstance(error)) return ErrorCategory.CONFIGURATION;
    if (JSONParseError.isInstance(error)) return ErrorCategory.PARSING;
    if (DownloadError.isInstance(error)) return ErrorCategory.NETWORK;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('connection')) {
        return ErrorCategory.NETWORK;
      }
      if (message.includes('rate limit')) return ErrorCategory.RATE_LIMIT;
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return ErrorCategory.AUTHENTICATION;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  private findMatchingPattern(error: unknown): PatternRule | undefined {
    return this.patternRules.find(rule => rule.matches(error));
  }

  private determineSeverity(
    error: unknown,
    category: ErrorCategory,
    pattern: ErrorPattern
  ): ErrorSeverity {
    // Pattern-based severity
    if ([ErrorPattern.AUTHENTICATION, ErrorPattern.QUOTA_EXCEEDED].includes(pattern)) {
      return ErrorSeverity.CRITICAL;
    }
    if ([
      ErrorPattern.NETWORK,
      ErrorPattern.SERVICE_UNAVAILABLE, 
      ErrorPattern.RESOURCE_NOT_FOUND
    ].includes(pattern)) {
      return ErrorSeverity.HIGH;
    }

    // Category-based defaults
    switch (category) {
      case ErrorCategory.CONFIGURATION:
      case ErrorCategory.AUTHENTICATION:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.API:
      case ErrorCategory.MODEL:
      case ErrorCategory.NETWORK:
        return ErrorSeverity.HIGH;
      case ErrorCategory.GENERATION:
      case ErrorCategory.VALIDATION:
      case ErrorCategory.TOOL:
      case ErrorCategory.PARSING:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  private isTransientError(error: unknown, pattern: ErrorPattern): boolean {
    const transientPatterns = [
      ErrorPattern.NETWORK,
      ErrorPattern.SERVICE_UNAVAILABLE,
      ErrorPattern.TIMEOUT,
      ErrorPattern.MODEL_OVERLOAD,
      ErrorPattern.RATE_LIMIT,
    ];
    
    if (transientPatterns.includes(pattern)) return true;
    
    if (APICallError.isInstance(error) && error.statusCode && error.statusCode >= 500) {
      return true;
    }
    
    return false;
  }

  private isRetryableError(error: unknown, pattern: ErrorPattern): boolean {
    const nonRetryablePatterns = [
      ErrorPattern.AUTHENTICATION,
      ErrorPattern.PERMISSION,
      ErrorPattern.QUOTA_EXCEEDED,
      ErrorPattern.INVALID_INPUT,
    ];
    
    if (nonRetryablePatterns.includes(pattern)) return false;
    
    if (APICallError.isInstance(error)) {
      return Boolean(error.isRetryable) || 
        (error.statusCode !== undefined && error.statusCode >= 500) ||
        (error.statusCode !== undefined && error.statusCode === 429);
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
      metadata.url = error.url;
      metadata.isRetryable = error.isRetryable;
      metadata.responseHeaders = error.responseHeaders;
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
    const currentCount = this.errorStats.get(pattern) || 0;
    this.errorStats.set(pattern, currentCount + 1);

    if (!this.lastErrorTimes.has(pattern)) {
      this.lastErrorTimes.set(pattern, []);
    }

    const times = this.lastErrorTimes.get(pattern)!;
    times.push(Date.now());

    const cutoff = Date.now() - 2 * 3_600_000;
    const recentTimes = times.filter(t => t > cutoff);
    this.lastErrorTimes.set(pattern, recentTimes);
  }

  private recordError(errorInfo: UnifiedErrorInfo): void {
    const key = `${errorInfo.category}_${errorInfo.severity}`;
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    
    const history = this.errorHistory.get(key)!;
    history.push(errorInfo);
    
    if (history.length > 100) {
      history.shift();
    }
    
    const currentCount = this.errorMetrics.get(errorInfo.category) || 0;
    this.errorMetrics.set(errorInfo.category, currentCount + 1);
  }

  private logError(errorInfo: UnifiedErrorInfo, options: ErrorHandlingOptions): void {
    const logData = {
      errorId: errorInfo.errorId,
      code: errorInfo.code,
      message: errorInfo.message,
      severity: errorInfo.severity,
      category: errorInfo.category,
      pattern: errorInfo.pattern,
      isRetryable: errorInfo.isRetryable,
      context: errorInfo.context,
      ...(options.includeStack && errorInfo.originalError?.stack && {
        stack: errorInfo.originalError.stack,
      }),
    };

    const logLevel = options.logLevel || 'error';
    switch (logLevel) {
      case 'error':
        unifiedLogger.error('Unified error system:', logData);
        break;
      case 'warn':
        unifiedLogger.warn('Unified error system warning:', logData);
        break;
      case 'info':
        unifiedLogger.info('Unified error system info:', logData);
        break;
      case 'debug':
        unifiedLogger.debug('Unified error system debug:', logData);
        break;
    }
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.initialDelay * (this.retryConfig.backoffMultiplier ** attempt),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      return Math.round(exponentialDelay + jitter);
    }

    return exponentialDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const [key, value] of Object.entries(context)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = value.replace(/[\r\n\t]/g, ' ').substring(0, 1000);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private inferErrorCode(error: unknown): string {
    if (error instanceof Error) {
      if (error.name) return error.name.toUpperCase();
      const message = error.message.toLowerCase();
      if (message.includes('validation')) return 'VALIDATION_ERROR';
      if (message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (message.includes('network')) return 'NETWORK_ERROR';
      if (message.includes('permission')) return 'PERMISSION_ERROR';
      if (message.includes('rate limit')) return 'RATE_LIMIT_ERROR';
    }
    return 'GENERIC_ERROR';
  }

  private getUserFriendlyMessage(error: unknown): string {
    if (error instanceof Error) {
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
    }
    return 'Something went wrong. Please try again.';
  }

  private getSuggestedActions(error: unknown, classification: ErrorClassification): string[] {
    const actions: string[] = [];

    // Pattern-based suggestions
    switch (classification.pattern) {
      case ErrorPattern.RATE_LIMIT:
        actions.push('Wait before retrying', 'Implement request throttling', 'Consider upgrading API tier');
        break;
      case ErrorPattern.TIMEOUT:
        actions.push('Reduce request complexity', 'Increase timeout limit', 'Use streaming response');
        break;
      case ErrorPattern.NETWORK:
        actions.push('Check internet connection', 'Verify API endpoint', 'Try different network');
        break;
      case ErrorPattern.AUTHENTICATION:
        actions.push('Verify API credentials', 'Check authentication configuration', 'Regenerate API key');
        break;
      default:
        actions.push('Retry request', 'Check error logs', 'Contact support if issue persists');
    }

    return actions;
  }

  private getFallbackSuggestion(classification: ErrorClassification): string {
    switch (classification.pattern) {
      case ErrorPattern.RATE_LIMIT:
        return 'Use alternative provider or implement request queue';
      case ErrorPattern.AUTHENTICATION:
        return 'Check API credentials and configuration';
      case ErrorPattern.SERVICE_UNAVAILABLE:
        return 'Switch to backup provider or retry later';
      case ErrorPattern.NETWORK:
        return 'Check network connectivity and try again';
      default:
        return 'Use alternative approach or contact support';
    }
  }

  private getTechnicalDetails(error: unknown): Record<string, any> {
    const details: Record<string, any> = {};

    if (APICallError.isInstance(error)) {
      details.statusCode = error.statusCode;
      details.url = error.url;
      details.responseHeaders = error.responseHeaders;
    }

    if (error instanceof Error) {
      details.name = error.name;
      details.stack = error.stack;
    }

    return details;
  }

  private generateRecommendations(recentPatterns: Array<{
    pattern: ErrorPattern;
    count: number; 
    rate: number;
  }>): string[] {
    const recommendations: string[] = [];

    for (const { pattern, count, rate } of recentPatterns) {
      if (pattern === ErrorPattern.RATE_LIMIT && rate > 0.5) {
        recommendations.push('Implement request throttling to avoid rate limits');
      }
      if (pattern === ErrorPattern.TIMEOUT && count > 5) {
        recommendations.push('Consider increasing timeout values or optimizing requests');
      }
      if (pattern === ErrorPattern.NETWORK && count > 3) {
        recommendations.push('Check network connectivity and implement offline fallbacks');
      }
      if (pattern === ErrorPattern.MODEL_OVERLOAD && rate > 0.2) {
        recommendations.push('Consider using alternative models during peak times');
      }
    }

    return recommendations;
  }

  private initializeErrorStats(): void {
    Object.values(ErrorCategory).forEach(category => {
      this.errorMetrics.set(category, 0);
    });
    Object.values(ErrorPattern).forEach(pattern => {
      this.errorStats.set(pattern, 0);
    });
  }
}

// Export singleton instance
export const unifiedErrorSystem = UnifiedErrorSystem.getInstance();

// Convenience functions for backward compatibility
export async function handleAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, any>,
  options?: ErrorHandlingOptions
): Promise<{ success: true; data: T } | { success: false; error: UnifiedErrorInfo }> {
  try {
    const data = await unifiedErrorSystem.executeWithRetry(fn, context, options);
    return { success: true, data };
  } catch (error) {
    const errorInfo = unifiedErrorSystem.handleError(error, context, options);
    return { success: false, error: errorInfo };
  }
}

export function handleSync<T>(
  fn: () => T,
  context?: Record<string, any>,
  options?: ErrorHandlingOptions
): { success: true; data: T } | { success: false; error: UnifiedErrorInfo } {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    const errorInfo = unifiedErrorSystem.handleError(error, context, options);
    return { success: false, error: errorInfo };
  }
}

export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: UnifiedErrorInfo) => RecoveryStrategy
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = unifiedErrorSystem.handleError(error);
    const strategy = errorHandler
      ? errorHandler(errorInfo)
      : unifiedErrorSystem.createRecoveryStrategy(errorInfo);

    switch (strategy.type) {
      case 'retry':
        return await unifiedErrorSystem.executeWithRetry(
          operation,
          undefined,
          { maxRetries: strategy.maxRetries }
        );
      case 'fallback':
        throw new Error(`Fallback to ${strategy.fallbackModel} not implemented`);
      case 'degrade':
        throw new Error('Degraded mode not implemented');
      case 'fail':
      default:
        throw error;
    }
  }
}

// Export types and convenience functions
export function handleAIError(error: unknown, context?: any): UnifiedErrorInfo {
  return unifiedErrorSystem.handleError(error, context, { enableClassification: true });
}

export function classifyError(error: unknown): ErrorClassification {
  return unifiedErrorSystem.classifyError(error);
}

// Export for backward compatibility with v2ErrorHandler
export const v2ErrorHandler = {
  handleError: (error: unknown): UnifiedErrorInfo => {
    return unifiedErrorSystem.handleError(error, undefined, { enableClassification: true });
  },
};