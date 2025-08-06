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

// Retry strategy types
export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIBONACCI = 'fibonacci',
  DECORRELATED_JITTER = 'decorrelated-jitter',
  CONSTANT = 'constant',
}

// Retry configuration
export interface RetryStrategyConfig {
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
  jitterFactor?: number;
  timeout?: number;
  onRetry?: (attempt: number, delay: number, error: Error) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  abortController?: AbortController;
}

// Retry result
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
  aborted: boolean;
}

// Default configurations for different strategies
const STRATEGY_DEFAULTS: Record<RetryStrategy, Partial<RetryStrategyConfig>> = {
  [RetryStrategy.EXPONENTIAL]: {
    multiplier: 2,
    jitterFactor: 0.1,
  },
  [RetryStrategy.LINEAR]: {
    multiplier: 1,
    jitterFactor: 0.1,
  },
  [RetryStrategy.FIBONACCI]: {
    jitterFactor: 0.1,
  },
  [RetryStrategy.DECORRELATED_JITTER]: {
    multiplier: 3,
    jitterFactor: 1,
  },
  [RetryStrategy.CONSTANT]: {
    multiplier: 1,
    jitterFactor: 0,
  },
};

/**
 * Advanced Retry Manager with multiple strategies
 */
export class RetryManager {
  private fibonacciCache: Map<number, number> = new Map([
    [0, 0],
    [1, 1],
  ]);
  private lastDecorrelatedDelay = 0;

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryStrategyConfig
  ): Promise<RetryResult<T>> {
    const mergedConfig = this.mergeConfig(config);
    const startTime = Date.now();
    let totalDelay = 0;
    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts < mergedConfig.maxRetries) {
      // Check abort signal
      if (mergedConfig.abortController?.signal.aborted) {
        return {
          success: false,
          error: new Error('Operation aborted'),
          attempts,
          totalDelay,
          aborted: true,
        };
      }

      try {
        // Execute with timeout if specified
        const result = await this.executeWithTimeout(
          operation,
          mergedConfig.timeout,
          mergedConfig.abortController
        );

        return {
          success: true,
          result,
          attempts: attempts + 1,
          totalDelay,
          aborted: false,
        };
      } catch (error) {
        lastError = error as Error;
        attempts++;

        // Check if we should retry
        if (
          attempts >= mergedConfig.maxRetries ||
          (mergedConfig.shouldRetry &&
            !mergedConfig.shouldRetry(lastError, attempts))
        ) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempts, mergedConfig);
        totalDelay += delay;

        // Call retry callback
        if (mergedConfig.onRetry) {
          mergedConfig.onRetry(attempts, delay, lastError);
        }

        loggingService.debug('Retrying operation', {
          attempt: attempts,
          maxRetries: mergedConfig.maxRetries,
          delay,
          strategy: mergedConfig.strategy,
          error: lastError.message,
        });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
      attempts,
      totalDelay,
      aborted: false,
    };
  }

  /**
   * Create a retry wrapper for a function
   */
  createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    config: RetryStrategyConfig
  ): T {
    return (async (...args: Parameters<T>) => {
      const result = await this.executeWithRetry(() => fn(...args), config);

      if (!result.success) {
        throw result.error;
      }

      return result.result;
    }) as T;
  }

  /**
   * Execute multiple operations with retry
   */
  async executeMultipleWithRetry<T>(
    operations: Array<() => Promise<T>>,
    config: RetryStrategyConfig,
    options?: {
      parallel?: boolean;
      stopOnFirstSuccess?: boolean;
      stopOnFirstFailure?: boolean;
    }
  ): Promise<Array<RetryResult<T>>> {
    const {
      parallel = false,
      stopOnFirstSuccess = false,
      stopOnFirstFailure = false,
    } = options || {};

    if (parallel) {
      return Promise.all(
        operations.map((op) => this.executeWithRetry(op, config))
      );
    }

    const results: Array<RetryResult<T>> = [];

    for (const operation of operations) {
      const result = await this.executeWithRetry(operation, config);
      results.push(result);

      if (
        (stopOnFirstSuccess && result.success) ||
        (stopOnFirstFailure && !result.success)
      ) {
        break;
      }
    }

    return results;
  }

  /**
   * Calculate delay based on strategy
   */
  private calculateDelay(attempt: number, config: RetryStrategyConfig): number {
    let baseDelay: number;

    switch (config.strategy) {
      case RetryStrategy.EXPONENTIAL:
        baseDelay =
          config.initialDelay * (config.multiplier || 2) ** (attempt - 1);
        break;

      case RetryStrategy.LINEAR:
        baseDelay = config.initialDelay * attempt;
        break;

      case RetryStrategy.FIBONACCI:
        baseDelay = config.initialDelay * this.getFibonacci(attempt);
        break;

      case RetryStrategy.DECORRELATED_JITTER:
        baseDelay = this.calculateDecorrelatedJitter(config);
        break;

      case RetryStrategy.CONSTANT:
      default:
        baseDelay = config.initialDelay;
    }

    // Apply max delay cap
    baseDelay = Math.min(baseDelay, config.maxDelay);

    // Apply jitter
    if (config.jitterFactor && config.jitterFactor > 0) {
      const jitter = baseDelay * config.jitterFactor * (Math.random() * 2 - 1);
      baseDelay = Math.max(0, baseDelay + jitter);
    }

    return Math.round(baseDelay);
  }

  /**
   * Calculate decorrelated jitter delay
   */
  private calculateDecorrelatedJitter(config: RetryStrategyConfig): number {
    const multiplier = config.multiplier || 3;
    const min = config.initialDelay;
    const max = this.lastDecorrelatedDelay * multiplier;

    this.lastDecorrelatedDelay = min + (max - min) * Math.random();
    this.lastDecorrelatedDelay = Math.min(
      this.lastDecorrelatedDelay,
      config.maxDelay
    );

    return this.lastDecorrelatedDelay;
  }

  /**
   * Get Fibonacci number with memoization
   */
  private getFibonacci(n: number): number {
    if (this.fibonacciCache.has(n)) {
      return this.fibonacciCache.get(n)!;
    }

    const value = this.getFibonacci(n - 1) + this.getFibonacci(n - 2);
    this.fibonacciCache.set(n, value);
    return value;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout?: number,
    abortController?: AbortController
  ): Promise<T> {
    if (!timeout) {
      return operation();
    }

    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // Handle abort signal
      if (abortController) {
        const onAbort = () => {
          cleanup();
          reject(new Error('Operation aborted'));
        };

        if (abortController.signal.aborted) {
          onAbort();
          return;
        }

        abortController.signal.addEventListener('abort', onAbort);
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      // Execute operation
      operation()
        .then((result) => {
          cleanup();
          resolve(result);
        })
        .catch((error) => {
          cleanup();
          reject(error);
        });
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(
    config: RetryStrategyConfig
  ): Required<RetryStrategyConfig> {
    const defaults = STRATEGY_DEFAULTS[config.strategy] || {};

    return {
      strategy: config.strategy,
      maxRetries: config.maxRetries,
      initialDelay: config.initialDelay,
      maxDelay: config.maxDelay,
      multiplier: config.multiplier ?? defaults.multiplier ?? 2,
      jitterFactor: config.jitterFactor ?? defaults.jitterFactor ?? 0.1,
      timeout: config.timeout ?? undefined,
      onRetry: config.onRetry ?? undefined,
      shouldRetry: config.shouldRetry ?? undefined,
      abortController: config.abortController ?? undefined,
    } as Required<RetryStrategyConfig>;
  }
}

// Pre-configured retry strategies
export const RETRY_PRESETS = {
  // Fast retry for transient errors
  fast: {
    strategy: RetryStrategy.EXPONENTIAL,
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000,
    jitterFactor: 0.1,
  },

  // Standard retry for API calls
  standard: {
    strategy: RetryStrategy.EXPONENTIAL,
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30_000,
    jitterFactor: 0.2,
  },

  // Aggressive retry for critical operations
  aggressive: {
    strategy: RetryStrategy.DECORRELATED_JITTER,
    maxRetries: 10,
    initialDelay: 500,
    maxDelay: 60_000,
    jitterFactor: 1,
  },

  // Conservative retry for expensive operations
  conservative: {
    strategy: RetryStrategy.FIBONACCI,
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 30_000,
    jitterFactor: 0.1,
  },

  // Rate limit retry
  rateLimit: {
    strategy: RetryStrategy.EXPONENTIAL,
    maxRetries: 5,
    initialDelay: 60_000, // 1 minute
    maxDelay: 300_000, // 5 minutes
    multiplier: 1.5,
    jitterFactor: 0.5,
  },
} as const;

// Create singleton instance
const retryManager = new RetryManager();

// Export convenience functions
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryStrategyConfig>
): Promise<T> {
  const config: RetryStrategyConfig = {
    ...RETRY_PRESETS.standard,
    ...options,
    strategy: RetryStrategy.EXPONENTIAL,
  };

  const result = await retryManager.executeWithRetry(operation, config);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}

export async function retryWithLinearBackoff<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryStrategyConfig>
): Promise<T> {
  const config: RetryStrategyConfig = {
    ...RETRY_PRESETS.standard,
    ...options,
    strategy: RetryStrategy.LINEAR,
  };

  const result = await retryManager.executeWithRetry(operation, config);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}

export async function retryWithDecorrelatedJitter<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryStrategyConfig>
): Promise<T> {
  const config: RetryStrategyConfig = {
    ...RETRY_PRESETS.aggressive,
    ...options,
    strategy: RetryStrategy.DECORRELATED_JITTER,
  };

  const result = await retryManager.executeWithRetry(operation, config);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}

// Export retry manager instance
export { retryManager };
