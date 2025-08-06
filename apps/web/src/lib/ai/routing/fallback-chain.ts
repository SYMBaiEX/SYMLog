import type { LanguageModel } from 'ai';
import { logError as logErrorToConsole } from '@/lib/logger';
import { v2ErrorHandler } from '../error-handling/unified-error-system';
import type { ModelInfo, ProviderInfo } from '../core/gateway';
import { ProviderMetricsService } from '../providers/provider-metrics';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Fallback strategy types
export type FallbackStrategy =
  | 'immediate' // Try next immediately on failure
  | 'exponential' // Exponential backoff between attempts
  | 'circuit-breaker' // Circuit breaker pattern
  | 'degraded'; // Degraded functionality fallback

// Fallback chain configuration
export interface FallbackChainConfig {
  strategy: FallbackStrategy;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableDegradedMode: boolean;
}

// Fallback option
export interface FallbackOption {
  providerId: string;
  modelId: string;
  model?: LanguageModel;
  reason: string;
  priority: number;
  capabilities: string[];
  isDegraded?: boolean;
}

// Fallback execution result
export interface FallbackExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attemptedModels: string[];
  finalModel?: string;
  degraded: boolean;
  totalAttempts: number;
  totalDuration: number;
}

// Circuit breaker state
export interface CircuitBreakerState {
  modelId: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

// Default configuration
const DEFAULT_CONFIG: FallbackChainConfig = {
  strategy: 'exponential',
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60_000, // 1 minute
  enableDegradedMode: true,
};

/**
 * Fallback Chain Manager for handling provider failures
 */
export class FallbackChainManager {
  private static instance: FallbackChainManager;
  private config: FallbackChainConfig;
  private metricsService: ProviderMetricsService;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private fallbackHistory: Map<string, FallbackExecutionResult<any>[]> =
    new Map();

  private constructor(config?: Partial<FallbackChainConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metricsService = ProviderMetricsService.getInstance();

    // Periodic circuit breaker reset check
    setInterval(() => this.checkCircuitBreakers(), 10_000); // Every 10 seconds
  }

  static getInstance(
    config?: Partial<FallbackChainConfig>
  ): FallbackChainManager {
    if (!FallbackChainManager.instance) {
      FallbackChainManager.instance = new FallbackChainManager(config);
    }
    return FallbackChainManager.instance;
  }

  /**
   * Build fallback chain for a primary model
   */
  buildFallbackChain(
    primaryModel: { providerId: string; modelId: string },
    availableModels: Array<{ provider: ProviderInfo; model: ModelInfo }>,
    requirements?: {
      capabilities?: string[];
      maxCost?: number;
      preferSameProvider?: boolean;
    }
  ): FallbackOption[] {
    const fallbackOptions: FallbackOption[] = [];
    const primaryKey = `${primaryModel.providerId}:${primaryModel.modelId}`;

    // Filter out primary model and unhealthy providers
    const candidates = availableModels.filter(({ provider, model }) => {
      const modelKey = `${provider.id}:${model.id}`;
      return modelKey !== primaryKey && provider.health.status !== 'unhealthy';
    });

    // Sort candidates by suitability
    const scored = candidates
      .map(({ provider, model }) => {
        let score = 0;

        // Same provider preference
        if (
          requirements?.preferSameProvider &&
          provider.id === primaryModel.providerId
        ) {
          score += 10;
        }

        // Capability matching
        if (requirements?.capabilities) {
          const matchedCapabilities = requirements.capabilities.filter((cap) =>
            model.capabilities.includes(cap)
          ).length;
          score += matchedCapabilities * 5;
        }

        // Cost consideration
        if (
          requirements?.maxCost &&
          model.costPerToken <= requirements.maxCost
        ) {
          score += 5;
        }

        // Health and performance
        const metrics = this.metricsService.getProviderMetrics(provider.id);
        score +=
          (metrics.successCount / Math.max(1, metrics.totalRequests)) * 10;
        score -= metrics.averageLatency / 1000; // Penalize high latency

        return { provider, model, score };
      })
      .sort((a, b) => b.score - a.score);

    // Build fallback chain
    scored.forEach(({ provider, model, score }, index) => {
      const modelKey = `${provider.id}:${model.id}`;

      fallbackOptions.push({
        providerId: provider.id,
        modelId: model.id,
        reason: this.generateFallbackReason(provider, model, score),
        priority: scored.length - index,
        capabilities: model.capabilities,
        isDegraded: false,
      });
    });

    // Add degraded mode options if enabled
    if (this.config.enableDegradedMode) {
      this.addDegradedModeOptions(fallbackOptions, requirements);
    }

    loggingService.info('Fallback chain built', {
      primary: primaryKey,
      fallbacks: fallbackOptions.length,
      strategy: this.config.strategy,
    });

    return fallbackOptions;
  }

  /**
   * Execute with fallback chain
   */
  async executeWithFallback<T>(
    primaryModel: {
      providerId: string;
      modelId: string;
      model: LanguageModel;
    },
    fallbackOptions: FallbackOption[],
    executor: (
      model: LanguageModel,
      modelInfo: { providerId: string; modelId: string }
    ) => Promise<T>
  ): Promise<FallbackExecutionResult<T>> {
    const startTime = Date.now();
    const attemptedModels: string[] = [];
    let lastError: Error | undefined;
    let degraded = false;

    // Try primary model first
    const primaryKey = `${primaryModel.providerId}:${primaryModel.modelId}`;

    if (this.isCircuitBreakerOpen(primaryKey)) {
      loggingService.info('Circuit breaker open for primary model', {
        model: primaryKey,
      });
    } else {
      try {
        attemptedModels.push(primaryKey);
        const result = await this.executeWithStrategy(
          primaryModel.model,
          primaryModel,
          executor
        );

        this.recordSuccess(primaryKey);

        return {
          success: true,
          result,
          attemptedModels,
          finalModel: primaryKey,
          degraded: false,
          totalAttempts: 1,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(primaryKey, error as Error);

        loggingService.warn('Primary model failed, trying fallbacks', {
          model: primaryKey,
          error: lastError.message,
        });
      }
    }

    // Try fallback options
    for (const fallback of fallbackOptions) {
      const fallbackKey = `${fallback.providerId}:${fallback.modelId}`;

      // Skip if circuit breaker is open
      if (this.isCircuitBreakerOpen(fallbackKey)) {
        loggingService.debug('Skipping fallback due to open circuit breaker', {
          model: fallbackKey,
        });
        continue;
      }

      // Get model instance
      const fallbackModel = await this.getModelInstance(fallback);
      if (!fallbackModel) {
        loggingService.warn('Failed to get fallback model instance', {
          model: fallbackKey,
        });
        continue;
      }

      try {
        attemptedModels.push(fallbackKey);

        // Apply delay based on strategy
        await this.applyFallbackDelay(attemptedModels.length - 1);

        const result = await this.executeWithStrategy(
          fallbackModel,
          { providerId: fallback.providerId, modelId: fallback.modelId },
          executor
        );

        this.recordSuccess(fallbackKey);
        degraded = fallback.isDegraded ?? false;

        loggingService.info('Fallback successful', {
          primary: primaryKey,
          fallback: fallbackKey,
          attempts: attemptedModels.length,
          degraded,
        });

        return {
          success: true,
          result,
          attemptedModels,
          finalModel: fallbackKey,
          degraded,
          totalAttempts: attemptedModels.length,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(fallbackKey, error as Error);

        loggingService.warn('Fallback failed', {
          model: fallbackKey,
          error: lastError.message,
          remaining: fallbackOptions.length - attemptedModels.length + 1,
        });
      }
    }

    // All attempts failed
    const result: FallbackExecutionResult<T> = {
      success: false,
      error: lastError || new Error('All fallback attempts failed'),
      attemptedModels,
      degraded: false,
      totalAttempts: attemptedModels.length,
      totalDuration: Date.now() - startTime,
    };

    this.recordFallbackExecution(primaryKey, result);

    loggingService.error('All fallback attempts failed', {
      primary: primaryKey,
      attempts: attemptedModels.length,
      duration: result.totalDuration,
    });

    return result;
  }

  /**
   * Check if a model should be used based on circuit breaker
   */
  isModelAvailable(modelId: string): boolean {
    return !this.isCircuitBreakerOpen(modelId);
  }

  /**
   * Get circuit breaker status for all models
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get fallback execution history
   */
  getFallbackHistory(modelId?: string): FallbackExecutionResult<any>[] {
    if (modelId) {
      return this.fallbackHistory.get(modelId) || [];
    }

    // Return all history
    const allHistory: FallbackExecutionResult<any>[] = [];
    for (const history of this.fallbackHistory.values()) {
      allHistory.push(...history);
    }
    return allHistory;
  }

  /**
   * Reset circuit breaker for a model
   */
  resetCircuitBreaker(modelId: string): void {
    this.circuitBreakers.delete(modelId);
    loggingService.info('Circuit breaker reset', { model: modelId });
  }

  // Private helper methods

  private async executeWithStrategy<T>(
    model: LanguageModel,
    modelInfo: { providerId: string; modelId: string },
    executor: (
      model: LanguageModel,
      modelInfo: { providerId: string; modelId: string }
    ) => Promise<T>
  ): Promise<T> {
    switch (this.config.strategy) {
      case 'immediate':
        return executor(model, modelInfo);

      case 'exponential':
      case 'circuit-breaker': {
        // Execute with timeout
        const timeout = 30_000; // 30 seconds
        return Promise.race([
          executor(model, modelInfo),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          ),
        ]);
      }

      case 'degraded':
        // Execute with reduced expectations
        try {
          return await executor(model, modelInfo);
        } catch (error) {
          // Try to extract partial result in degraded mode
          const handledError = v2ErrorHandler.handleError(error);
          if (handledError.retry) {
            throw error; // Re-throw for retry
          }
          // Return degraded result
          throw new Error(`Degraded mode: ${handledError.message}`);
        }

      default:
        return executor(model, modelInfo);
    }
  }

  private async applyFallbackDelay(attemptIndex: number): Promise<void> {
    if (this.config.strategy === 'immediate') {
      return;
    }

    let delay = this.config.retryDelay;

    if (this.config.strategy === 'exponential') {
      delay =
        this.config.retryDelay * this.config.backoffMultiplier ** attemptIndex;
    }

    if (delay > 0) {
      loggingService.debug(`Applying fallback delay: ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private isCircuitBreakerOpen(modelId: string): boolean {
    if (this.config.strategy !== 'circuit-breaker') {
      return false;
    }

    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) {
      return false;
    }

    return (
      breaker.state === 'open' &&
      (!breaker.nextRetry || new Date() < breaker.nextRetry)
    );
  }

  private recordSuccess(modelId: string): void {
    const breaker = this.circuitBreakers.get(modelId);
    if (breaker) {
      // Reset on success
      if (breaker.state === 'half-open') {
        this.circuitBreakers.delete(modelId);
        loggingService.info('Circuit breaker closed', { model: modelId });
      } else {
        breaker.failures = Math.max(0, breaker.failures - 1);
      }
    }
  }

  private recordFailure(modelId: string, error: Error): void {
    if (this.config.strategy !== 'circuit-breaker') {
      return;
    }

    let breaker = this.circuitBreakers.get(modelId);
    if (!breaker) {
      breaker = {
        modelId,
        state: 'closed',
        failures: 0,
      };
      this.circuitBreakers.set(modelId, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.state = 'open';
      breaker.nextRetry = new Date(
        Date.now() + this.config.circuitBreakerTimeout
      );

      loggingService.warn('Circuit breaker opened', {
        model: modelId,
        failures: breaker.failures,
        nextRetry: breaker.nextRetry,
      });
    }
  }

  private checkCircuitBreakers(): void {
    const now = new Date();

    for (const [modelId, breaker] of this.circuitBreakers) {
      if (
        breaker.state === 'open' &&
        breaker.nextRetry &&
        now >= breaker.nextRetry
      ) {
        breaker.state = 'half-open';
        loggingService.info('Circuit breaker half-open', { model: modelId });
      }
    }
  }

  private generateFallbackReason(
    provider: ProviderInfo,
    model: ModelInfo,
    score: number
  ): string {
    const factors: string[] = [];

    if (provider.health.successRate > 0.95) {
      factors.push('high reliability');
    }

    if (provider.health.averageLatency < 1000) {
      factors.push('low latency');
    }

    if (model.costPerToken < 0.0001) {
      factors.push('cost-effective');
    }

    if (model.capabilities.length > 5) {
      factors.push('versatile');
    }

    return factors.length > 0
      ? `Selected for: ${factors.join(', ')} (score: ${score.toFixed(1)})`
      : `Fallback option (score: ${score.toFixed(1)})`;
  }

  private addDegradedModeOptions(
    fallbackOptions: FallbackOption[],
    requirements?: { capabilities?: string[] }
  ): void {
    // Add simplified model options for degraded mode
    const degradedOptions: FallbackOption[] = [
      {
        providerId: 'openai',
        modelId: 'gpt-3.5-turbo',
        reason: 'Degraded mode: Basic functionality',
        priority: -1,
        capabilities: ['chat', 'basic-analysis'],
        isDegraded: true,
      },
    ];

    // Only add if they meet minimum requirements
    if (
      !requirements?.capabilities ||
      requirements.capabilities.some((cap) =>
        ['chat', 'basic-analysis'].includes(cap)
      )
    ) {
      fallbackOptions.push(...degradedOptions);
    }
  }

  private async getModelInstance(
    fallback: FallbackOption
  ): Promise<LanguageModel | null> {
    try {
      // Import registry dynamically to avoid circular dependency
      const { registry } = await import('../core/providers');
      const modelKey = `${fallback.providerId}:${fallback.modelId}`;
      return registry.languageModel(modelKey as any);
    } catch (error) {
      loggingService.error('Failed to get model instance', {
        model: `${fallback.providerId}:${fallback.modelId}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private recordFallbackExecution(
    primaryModel: string,
    result: FallbackExecutionResult<any>
  ): void {
    if (!this.fallbackHistory.has(primaryModel)) {
      this.fallbackHistory.set(primaryModel, []);
    }

    const history = this.fallbackHistory.get(primaryModel)!;
    history.push(result);

    // Keep only recent history
    if (history.length > 100) {
      history.shift();
    }
  }
}

// Export singleton getter
export const getFallbackChainManager = (
  config?: Partial<FallbackChainConfig>
): FallbackChainManager => {
  return FallbackChainManager.getInstance(config);
};
