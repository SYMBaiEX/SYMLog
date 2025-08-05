import {
  APICallError,
  InvalidArgumentError,
  NoObjectGeneratedError,
  NoSuchModelError,
  ToolExecutionError,
} from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdvancedErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  executeWithRetry,
  handleAIError,
} from '../advanced-error-handling';
import {
  classifyError,
  ErrorClassifier,
  ErrorPattern,
} from '../error-classification';
import {
  AlertType,
  ErrorMonitoringService,
  getAIMetrics,
  monitorAIOperation,
} from '../error-monitoring';
import {
  ErrorRecoveryManager,
  generateObjectWithRecovery,
  generateTextWithRecovery,
} from '../error-recovery';
import {
  RETRY_PRESETS,
  RetryManager,
  RetryStrategy,
  retryWithExponentialBackoff,
} from '../retry-strategies';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Mock AI SDK functions
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    generateText: vi.fn(),
    generateObject: vi.fn(),
    streamText: vi.fn(),
    streamObject: vi.fn(),
  };
});

describe('Advanced Error Handler', () => {
  let errorHandler: AdvancedErrorHandler;

  beforeEach(() => {
    errorHandler = AdvancedErrorHandler.getInstance();
    errorHandler.clearErrorHistory();
  });

  describe('handleError', () => {
    it('should handle API call errors correctly', () => {
      const apiError = new APICallError({
        message: 'Rate limit exceeded',
        statusCode: 429,
        statusText: 'Too Many Requests',
        url: 'https://api.example.com',
        responseHeaders: { 'retry-after': '60' },
        isRetryable: true,
      });

      const result = errorHandler.handleError(apiError);

      expect(result.category).toBe(ErrorCategory.API);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.retry).toBe(true);
      expect(result.message).toContain('Rate limit exceeded');
      expect(result.details.statusCode).toBe(429);
    });

    it('should handle validation errors correctly', () => {
      const validationError = new InvalidArgumentError({
        argument: 'schema',
        message: 'Invalid schema provided',
      });

      const result = errorHandler.handleError(validationError);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.retry).toBe(false);
      expect(result.message).toContain('Validation error');
    });

    it('should handle generation errors correctly', () => {
      const generationError = new NoObjectGeneratedError({
        message: 'No object generated',
        text: 'Invalid response',
        response: {},
        usage: { totalTokens: 100 },
        finishReason: 'stop',
      });

      const result = errorHandler.handleError(generationError);

      expect(result.category).toBe(ErrorCategory.GENERATION);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.retry).toBe(true);
      expect(result.suggestions).toContain('Simplify the output schema');
    });

    it('should handle model errors correctly', () => {
      const modelError = new NoSuchModelError({
        modelId: 'invalid-model',
        availableModels: ['gpt-4', 'gpt-3.5-turbo'],
      });

      const result = errorHandler.handleError(modelError);

      expect(result.category).toBe(ErrorCategory.MODEL);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.retry).toBe(false);
      expect(result.actionRequired).toBe('Update model configuration');
    });

    it('should handle unknown errors gracefully', () => {
      const unknownError = new Error('Unknown error');

      const result = errorHandler.handleError(unknownError);

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.retry).toBe(false);
      expect(result.originalError).toBe(unknownError);
    });
  });

  describe('executeWithRetry', () => {
    it('should retry retryable errors', async () => {
      const failingOperation = vi
        .fn()
        .mockRejectedValueOnce(
          new APICallError({
            message: 'Server error',
            statusCode: 500,
            isRetryable: true,
          })
        )
        .mockResolvedValueOnce('success');

      const result = await errorHandler.executeWithRetry(failingOperation);

      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const failingOperation = vi.fn().mockRejectedValue(
        new InvalidArgumentError({
          argument: 'test',
          message: 'Invalid argument',
        })
      );

      await expect(
        errorHandler.executeWithRetry(failingOperation)
      ).rejects.toThrow('Invalid argument');

      expect(failingOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const failingOperation = vi.fn().mockRejectedValue(
        new APICallError({
          message: 'Server error',
          statusCode: 500,
          isRetryable: true,
        })
      );

      await expect(
        errorHandler.executeWithRetry(failingOperation)
      ).rejects.toThrow('Server error');

      expect(failingOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', () => {
      // Simulate multiple errors
      errorHandler.handleError(
        new APICallError({
          message: 'Error 1',
          statusCode: 500,
        })
      );
      errorHandler.handleError(
        new InvalidArgumentError({
          argument: 'test',
          message: 'Error 2',
        })
      );

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(2);
      expect(stats.byCategory[ErrorCategory.API]).toBe(1);
      expect(stats.byCategory[ErrorCategory.VALIDATION]).toBe(1);
      expect(stats.recentErrors).toHaveLength(2);
    });
  });
});

describe('Error Classifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = ErrorClassifier.getInstance();
  });

  describe('classifyError', () => {
    it('should classify rate limit errors correctly', () => {
      const rateLimitError = new APICallError({
        message: 'Rate limit exceeded',
        statusCode: 429,
      });

      const classification = classifier.classifyError(rateLimitError);

      expect(classification.pattern).toBe(ErrorPattern.RATE_LIMIT);
      expect(classification.isRetryable).toBe(true);
      expect(classification.isTransient).toBe(true);
      expect(classification.suggestedWaitTime).toBeGreaterThan(0);
    });

    it('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timed out');

      const classification = classifier.classifyError(timeoutError);

      expect(classification.pattern).toBe(ErrorPattern.TIMEOUT);
      expect(classification.isRetryable).toBe(true);
      expect(classification.isTransient).toBe(true);
    });

    it('should classify authentication errors correctly', () => {
      const authError = new APICallError({
        message: 'Unauthorized',
        statusCode: 401,
      });

      const classification = classifier.classifyError(authError);

      expect(classification.pattern).toBe(ErrorPattern.AUTHENTICATION);
      expect(classification.isRetryable).toBe(false);
      expect(classification.requiresUserAction).toBe(true);
    });
  });

  describe('error statistics and predictions', () => {
    it('should provide error statistics', () => {
      // Simulate multiple errors
      classifier.classifyError(
        new APICallError({ statusCode: 429, message: 'Rate limit' })
      );
      classifier.classifyError(
        new APICallError({ statusCode: 429, message: 'Rate limit' })
      );
      classifier.classifyError(new Error('timeout'));

      const stats = classifier.getErrorStatistics();

      expect(stats.byPattern[ErrorPattern.RATE_LIMIT]).toBeGreaterThan(0);
      expect(stats.recentPatterns).toBeDefined();
      expect(stats.recommendations).toBeDefined();
    });

    it('should predict error likelihood', () => {
      // Simulate repeated rate limit errors
      for (let i = 0; i < 5; i++) {
        classifier.classifyError(
          new APICallError({ statusCode: 429, message: 'Rate limit' })
        );
      }

      const prediction = classifier.predictErrorLikelihood(
        ErrorPattern.RATE_LIMIT
      );

      expect(prediction.likelihood).toBe('medium');
      expect(prediction.recentOccurrences).toBe(5);
    });
  });
});

describe('Error Recovery Manager', () => {
  let recoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    recoveryManager = ErrorRecoveryManager.getInstance();
  });

  describe('recovery strategies', () => {
    it('should get recovery suggestions for different error types', () => {
      const apiError = new APICallError({
        message: 'Server error',
        statusCode: 500,
      });

      const suggestions = recoveryManager.getRecoverySuggestions(apiError);

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('model');
    });

    it('should create custom recovery workflows', () => {
      const customStrategies = [
        { type: 'model', value: 'backup', reason: 'Switch to backup model' },
        { type: 'prompt', value: 'simplify', reason: 'Simplify the prompt' },
      ];

      recoveryManager.createRecoveryWorkflow(APICallError, customStrategies);

      const suggestions = recoveryManager.getRecoverySuggestions(
        new APICallError({ message: 'Test', statusCode: 500 })
      );

      expect(suggestions).toEqual(customStrategies);
    });
  });
});

describe('Error Monitoring Service', () => {
  let monitoringService: ErrorMonitoringService;

  beforeEach(() => {
    monitoringService = ErrorMonitoringService.getInstance();
    monitoringService.reset();
  });

  describe('operation monitoring', () => {
    it('should monitor successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await monitoringService.monitorOperation(
        'test-op',
        operation
      );

      expect(result).toBe('success');

      const metrics = monitoringService.getMetrics();
      expect(metrics.successRate).toBe(1);
      expect(metrics.errorRate).toBe(0);
    });

    it('should monitor failed operations', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(
        monitoringService.monitorOperation('test-op', operation)
      ).rejects.toThrow('Test error');

      const metrics = monitoringService.getMetrics();
      expect(metrics.errorRate).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should track operation-specific metrics', async () => {
      const successOp = vi.fn().mockResolvedValue('success');
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      await monitoringService.monitorOperation('test-op', successOp);
      await expect(
        monitoringService.monitorOperation('test-op', failOp)
      ).rejects.toThrow();

      const opMetrics = monitoringService.getOperationMetrics('test-op');
      expect(opMetrics.successRate).toBe(0.5);
      expect(opMetrics.errorRate).toBe(0.5);
      expect(opMetrics.totalCalls).toBe(2);
    });
  });

  describe('alerting', () => {
    it('should configure and trigger alerts', async () => {
      const alertConfig = {
        type: AlertType.CRITICAL_ERROR,
        threshold: 1,
        window: 0,
        cooldown: 1000,
        enabled: true,
        channels: [{ type: 'console' as const, config: {} }],
      };

      monitoringService.configureAlert(alertConfig);

      // Trigger a critical error
      const criticalOp = vi.fn().mockRejectedValue(
        new APICallError({
          message: 'Critical error',
          statusCode: 500,
        })
      );

      await expect(
        monitoringService.monitorOperation('critical-op', criticalOp)
      ).rejects.toThrow();

      const metrics = monitoringService.getMetrics();
      expect(metrics.activeAlerts.length).toBeGreaterThan(0);
    });

    it('should respect alert cooldowns', async () => {
      const alertConfig = {
        type: AlertType.CRITICAL_ERROR,
        threshold: 1,
        window: 0,
        cooldown: 60_000, // 1 minute
        enabled: true,
        channels: [{ type: 'console' as const, config: {} }],
      };

      monitoringService.configureAlert(alertConfig);

      // Trigger multiple critical errors quickly
      for (let i = 0; i < 3; i++) {
        const criticalOp = vi.fn().mockRejectedValue(
          new APICallError({
            message: 'Critical error',
            statusCode: 500,
          })
        );

        await expect(
          monitoringService.monitorOperation('critical-op', criticalOp)
        ).rejects.toThrow();
      }

      const alertHistory = monitoringService.getAlertHistory();
      expect(alertHistory.length).toBe(1); // Only one alert due to cooldown
    });
  });
});

describe('Retry Manager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
  });

  describe('retry strategies', () => {
    it('should execute exponential backoff correctly', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success');

      const result = await retryManager.executeWithRetry(operation, {
        strategy: RetryStrategy.EXPONENTIAL,
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('Success');
      expect(result.attempts).toBe(3);
    });

    it('should handle timeout correctly', async () => {
      const slowOperation = () =>
        new Promise((resolve) => setTimeout(() => resolve('too slow'), 100));

      const result = await retryManager.executeWithRetry(slowOperation, {
        strategy: RetryStrategy.CONSTANT,
        maxRetries: 1,
        initialDelay: 10,
        maxDelay: 100,
        timeout: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should respect abort controller', async () => {
      const abortController = new AbortController();
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      // Abort immediately
      setTimeout(() => abortController.abort(), 10);

      const result = await retryManager.executeWithRetry(operation, {
        strategy: RetryStrategy.CONSTANT,
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 1000,
        abortController,
      });

      expect(result.success).toBe(false);
      expect(result.aborted).toBe(true);
    });
  });

  describe('retry presets', () => {
    it('should use fast preset correctly', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('Success');

      const result = await retryWithExponentialBackoff(
        operation,
        RETRY_PRESETS.fast
      );

      expect(result).toBe('Success');
    });

    it('should create retry wrapper', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('Success');

      const wrappedFn = retryManager.createRetryWrapper(
        originalFn,
        RETRY_PRESETS.fast
      );

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('Success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    // Reset all singletons
    AdvancedErrorHandler.getInstance().clearErrorHistory();
    ErrorMonitoringService.getInstance().reset();
  });

  it('should integrate error handling with monitoring', async () => {
    const failingOperation = vi.fn().mockRejectedValue(
      new APICallError({
        message: 'Integration test error',
        statusCode: 500,
        isRetryable: true,
      })
    );

    await expect(
      monitorAIOperation('integration-test', failingOperation)
    ).rejects.toThrow();

    const metrics = getAIMetrics();
    expect(metrics.errorCount).toBe(1);
    expect(metrics.errorsByCategory[ErrorCategory.API]).toBe(1);
  });

  it('should integrate classification with monitoring', async () => {
    const rateLimitError = new APICallError({
      message: 'Rate limit exceeded',
      statusCode: 429,
    });

    const failingOperation = vi.fn().mockRejectedValue(rateLimitError);

    await expect(
      monitorAIOperation('rate-limit-test', failingOperation)
    ).rejects.toThrow();

    const metrics = getAIMetrics();
    expect(metrics.errorsByPattern[ErrorPattern.RATE_LIMIT]).toBeGreaterThan(0);
  });

  it('should handle convenience functions correctly', () => {
    const testError = new APICallError({
      message: 'Test error',
      statusCode: 400,
    });

    const errorInfo = handleAIError(testError);
    const classification = classifyError(testError);

    expect(errorInfo.category).toBe(ErrorCategory.API);
    expect(classification.pattern).toBe(ErrorPattern.INVALID_INPUT);
  });
});
