import {
  APICallError,
  embed,
  generateObject,
  generateText,
  InvalidArgumentError,
  type LanguageModel,
  NoObjectGeneratedError,
  streamText,
} from 'ai';

// Define TooManyEmbeddingValuesForCallError locally since it's not exported from 'ai'
class TooManyEmbeddingValuesForCallError extends Error {
  static isInstance(
    error: unknown
  ): error is TooManyEmbeddingValuesForCallError {
    return error instanceof TooManyEmbeddingValuesForCallError;
  }
}

import { responseCache } from '../core/caching';
import {
  type AIErrorInfo,
  ErrorCategory,
  ErrorSeverity,
  handleAIError,
} from './error-handling';
import { getAIModel, registry } from '../core/providers';

// Fallback chain configuration
export interface FallbackConfig {
  models: string[];
  strategies: ('retry' | 'degrade' | 'cache' | 'mock')[];
  maxAttempts: number;
  backoffMultiplier: number;
  timeout?: number;
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  successCount: number;
}

// Health check result
interface HealthCheckResult {
  model: string;
  healthy: boolean;
  latency: number;
  lastChecked: number;
  errorRate: number;
}

/**
 * Resilient AI Service with automatic error recovery and fallbacks
 */
export class ResilientAIService {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private healthChecks = new Map<string, HealthCheckResult>();
  private fallbackConfigs = new Map<string, FallbackConfig>();

  // Default fallback configuration
  private defaultFallbackConfig: FallbackConfig = {
    models: ['openai:fast', 'anthropic:fast', 'openai:premium'],
    strategies: ['retry', 'cache', 'degrade'],
    maxAttempts: 3,
    backoffMultiplier: 2,
    timeout: 30_000,
  };

  constructor() {
    // Initialize circuit breakers for known models
    const models = [
      'openai:fast',
      'openai:premium',
      'anthropic:fast',
      'anthropic:balanced',
    ];
    models.forEach((model) => {
      this.circuitBreakers.set(model, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        successCount: 0,
      });
    });

    // Start health check interval
    this.startHealthChecks();
  }

  /**
   * Execute operation with automatic fallback chain
   */
  async executeWithFallback<T>(
    primaryAction: () => Promise<T>,
    fallbackChain: Array<() => Promise<T>>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    const errors: AIErrorInfo[] = [];

    // Try primary action with retries
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.executeWithTimeout(primaryAction);
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorInfo = handleAIError(error);
        errors.push(errorInfo);

        // Check if we should retry
        if (!this.shouldRetry(errorInfo, i, maxRetries)) {
          break;
        }

        // Wait with exponential backoff
        await this.delay(this.calculateBackoff(i));
      }
    }

    // Try fallback chain
    for (const [index, fallback] of fallbackChain.entries()) {
      try {
        console.log(`Attempting fallback ${index + 1}/${fallbackChain.length}`);
        const result = await this.executeWithTimeout(fallback);
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorInfo = handleAIError(error);
        errors.push(errorInfo);
      }
    }

    // All attempts failed
    throw new AggregateError(
      errors,
      lastError?.message || 'All fallback attempts failed'
    );
  }

  /**
   * Generate text with resilience
   */
  async generateTextResilient(
    prompt: string,
    options?: {
      model?: string;
      fallbackModels?: string[];
      enableCache?: boolean;
      degradeOptions?: any;
    }
  ): Promise<any> {
    const primaryModel = options?.model || 'openai:premium';
    const fallbackModels =
      options?.fallbackModels || this.defaultFallbackConfig.models;

    // Check cache first if enabled
    if (options?.enableCache) {
      const cacheKey = `text:${primaryModel}:${this.hashPrompt(prompt)}`;
      const cached = await responseCache
        .getCachedResponse(
          cacheKey,
          async () => null,
          { ttl: 0 } // Just check, don't generate
        )
        .catch(() => null);

      if (cached) {
        return cached;
      }
    }

    // Check circuit breaker
    if (!this.isModelAvailable(primaryModel)) {
      console.log(
        `Model ${primaryModel} circuit breaker is open, using fallback`
      );
      return this.generateTextWithFallback(prompt, fallbackModels, options);
    }

    // Primary action
    const primaryAction = async () => {
      const model = getAIModel(primaryModel);
      const result = await generateText({
        model,
        prompt,
        ...options?.degradeOptions,
      });

      // Record success
      this.recordSuccess(primaryModel);

      // Cache if enabled
      if (options?.enableCache) {
        const cacheKey = `text:${primaryModel}:${this.hashPrompt(prompt)}`;
        await responseCache.getCachedResponse(
          cacheKey,
          async () => result,
          { ttl: 5 * 60 * 1000 } // 5 minutes
        );
      }

      return result;
    };

    // Fallback chain
    const fallbackChain = fallbackModels.map((modelId) => async () => {
      if (!this.isModelAvailable(modelId)) {
        throw new Error(`Model ${modelId} is unavailable`);
      }

      const model = getAIModel(modelId);
      const result = await generateText({
        model,
        prompt,
        ...this.getDegradedOptions(options?.degradeOptions),
      });

      this.recordSuccess(modelId);
      return result;
    });

    try {
      return await this.executeWithFallback(primaryAction, fallbackChain);
    } catch (error) {
      this.recordFailure(primaryModel);
      throw error;
    }
  }

  /**
   * Generate object with resilience
   */
  async generateObjectResilient<T>(
    schema: any,
    prompt: string,
    options?: {
      model?: string;
      fallbackModels?: string[];
      relaxSchema?: boolean;
      enableCache?: boolean;
    }
  ): Promise<{ object: T }> {
    const primaryModel = options?.model || 'openai:premium';
    const fallbackModels =
      options?.fallbackModels || this.defaultFallbackConfig.models;

    // Check cache first
    if (options?.enableCache) {
      const cacheKey = `object:${primaryModel}:${this.hashPrompt(prompt)}:${this.hashSchema(schema)}`;
      const cached = await responseCache
        .getCachedResponse(cacheKey, async () => null, { ttl: 0 })
        .catch(() => null);

      if (cached) {
        return cached;
      }
    }

    // Primary action
    const primaryAction = async () => {
      const model = getAIModel(primaryModel);
      const result = await generateObject({
        model,
        schema,
        prompt,
      });

      this.recordSuccess(primaryModel);

      // Cache result
      if (options?.enableCache) {
        const cacheKey = `object:${primaryModel}:${this.hashPrompt(prompt)}:${this.hashSchema(schema)}`;
        await responseCache.getCachedResponse(
          cacheKey,
          async () => result,
          { ttl: 10 * 60 * 1000 } // 10 minutes
        );
      }

      return result;
    };

    // Fallback with potentially relaxed schema
    const fallbackChain = fallbackModels.map((modelId) => async () => {
      const model = getAIModel(modelId);

      // Try with original schema first
      try {
        const result = await generateObject({
          model,
          schema,
          prompt,
        });
        this.recordSuccess(modelId);
        return result;
      } catch (schemaError) {
        // If schema fails and relaxation is enabled, try with relaxed schema
        if (options?.relaxSchema && schema._def) {
          const relaxedSchema = this.relaxSchema(schema);
          const result = await generateObject({
            model,
            schema: relaxedSchema,
            prompt: `${prompt}\n\nNote: Please ensure the output matches the expected format as closely as possible.`,
          });
          this.recordSuccess(modelId);
          return result;
        }
        throw schemaError;
      }
    });

    try {
      return await this.executeWithFallback(primaryAction, fallbackChain);
    } catch (error) {
      this.recordFailure(primaryModel);

      // Last resort: return mock data if schema allows
      if (options?.relaxSchema) {
        return this.generateMockData(schema);
      }

      throw error;
    }
  }

  /**
   * Stream text with resilience
   */
  async streamTextResilient(
    prompt: string,
    options?: {
      model?: string;
      fallbackModels?: string[];
      onChunk?: (chunk: string) => void;
    }
  ) {
    const primaryModel = options?.model || 'openai:premium';
    const fallbackModels =
      options?.fallbackModels || this.defaultFallbackConfig.models;

    // Check circuit breaker
    if (!this.isModelAvailable(primaryModel)) {
      return this.streamTextWithFallback(prompt, fallbackModels, options);
    }

    try {
      const model = getAIModel(primaryModel);
      const stream = await streamText({
        model,
        prompt,
        onChunk: ({ chunk }) => {
          // Extract text content from streaming chunk based on chunk type
          if (chunk.type === 'text-delta') {
            options?.onChunk?.(chunk.text);
          }
        },
      });

      this.recordSuccess(primaryModel);
      return stream;
    } catch (error) {
      this.recordFailure(primaryModel);

      // Try fallbacks
      for (const fallbackModel of fallbackModels) {
        if (!this.isModelAvailable(fallbackModel)) continue;

        try {
          const model = getAIModel(fallbackModel);
          const stream = await streamText({
            model,
            prompt,
            onChunk: ({ chunk }) => {
              // Extract text content from streaming chunk based on chunk type
              if (chunk.type === 'text-delta') {
                options?.onChunk?.(chunk.text);
              }
            },
          });

          this.recordSuccess(fallbackModel);
          return stream;
        } catch (fallbackError) {
          this.recordFailure(fallbackModel);
        }
      }

      throw error;
    }
  }

  /**
   * Generate embeddings with resilience
   */
  async embedResilient(
    value: string | string[],
    options?: {
      model?: string;
      fallbackModels?: string[];
      enableCache?: boolean;
    }
  ) {
    const primaryModel = options?.model || 'openai:text-embedding-3-small';
    const fallbackModels = options?.fallbackModels || [
      'openai:text-embedding-3-small',
      'openai:text-embedding-ada-002',
    ];

    // Check cache for embeddings
    if (options?.enableCache) {
      const cacheKey = `embed:${primaryModel}:${this.hashPrompt(Array.isArray(value) ? value.join('') : value)}`;
      const cached = await responseCache
        .getCachedResponse(cacheKey, async () => null, { ttl: 0 })
        .catch(() => null);

      if (cached) {
        return cached;
      }
    }

    const primaryAction = async () => {
      // Ensure the model ID follows the template literal pattern
      const normalizedModelId = this.normalizeEmbeddingModelId(primaryModel);
      const provider = registry.textEmbeddingModel(normalizedModelId);
      const result = await embed({
        model: provider,
        value,
      });

      // Cache embeddings
      if (options?.enableCache) {
        const cacheKey = `embed:${primaryModel}:${this.hashPrompt(Array.isArray(value) ? value.join('') : value)}`;
        await responseCache.getCachedResponse(
          cacheKey,
          async () => result,
          { ttl: 24 * 60 * 60 * 1000 } // 24 hours for embeddings
        );
      }

      return result;
    };

    const fallbackChain = fallbackModels.map((modelId) => async () => {
      // Ensure the model ID follows the template literal pattern
      const normalizedModelId = this.normalizeEmbeddingModelId(modelId);
      const provider = registry.textEmbeddingModel(normalizedModelId);

      // For array inputs that might be too large, chunk them
      if (Array.isArray(value) && value.length > 100) {
        const chunks = this.chunkArray(value, 100);
        const results = await Promise.all(
          chunks.map((chunk) =>
            embed({ model: provider, value: chunk.join(' ') })
          )
        );

        // Combine results
        return {
          embedding: results.flatMap((r) => r.embedding),
          usage: results.reduce(
            (acc, r) => ({
              tokens: acc.tokens + (r.usage?.tokens || 0),
            }),
            { tokens: 0 }
          ),
        };
      }

      return await embed({ model: provider, value });
    });

    return this.executeWithFallback(primaryAction, fallbackChain);
  }

  // Circuit breaker methods

  private isModelAvailable(modelId: string): boolean {
    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) return true;

    // Check if circuit is open
    if (breaker.state === 'open') {
      // Check if enough time has passed to try half-open
      const timeSinceFailure = Date.now() - breaker.lastFailure;
      if (timeSinceFailure > 60_000) {
        // 1 minute
        breaker.state = 'half-open';
        breaker.successCount = 0;
      } else {
        return false;
      }
    }

    return true;
  }

  private recordSuccess(modelId: string) {
    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) return;

    breaker.failures = 0;
    breaker.successCount++;

    // If half-open and successful, close the circuit
    if (breaker.state === 'half-open' && breaker.successCount >= 3) {
      breaker.state = 'closed';
    }
  }

  private recordFailure(modelId: string) {
    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) return;

    breaker.failures++;
    breaker.lastFailure = Date.now();
    breaker.successCount = 0;

    // Open circuit if too many failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
    }
  }

  // Health check methods

  private async startHealthChecks() {
    // Run health checks every 5 minutes
    setInterval(
      () => {
        this.runHealthChecks();
      },
      5 * 60 * 1000
    );

    // Run initial health check
    this.runHealthChecks();
  }

  private async runHealthChecks() {
    const models = Array.from(this.circuitBreakers.keys());

    for (const modelId of models) {
      try {
        const startTime = Date.now();
        const model = getAIModel(modelId);

        // Simple health check prompt
        await generateText({
          model,
          prompt: 'Respond with "OK"',
        });

        const latency = Date.now() - startTime;

        this.healthChecks.set(modelId, {
          model: modelId,
          healthy: true,
          latency,
          lastChecked: Date.now(),
          errorRate: this.calculateErrorRate(modelId),
        });
      } catch (error) {
        this.healthChecks.set(modelId, {
          model: modelId,
          healthy: false,
          latency: -1,
          lastChecked: Date.now(),
          errorRate: this.calculateErrorRate(modelId),
        });
      }
    }
  }

  private calculateErrorRate(modelId: string): number {
    const breaker = this.circuitBreakers.get(modelId);
    if (!breaker) return 0;

    const total = breaker.failures + breaker.successCount;
    if (total === 0) return 0;

    return breaker.failures / total;
  }

  // Helper methods

  private async executeWithTimeout<T>(
    action: () => Promise<T>,
    timeout = 30_000
  ): Promise<T> {
    return Promise.race([
      action(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      ),
    ]);
  }

  private shouldRetry(
    error: AIErrorInfo,
    attempt: number,
    maxAttempts: number
  ): boolean {
    // Don't retry if we've hit max attempts
    if (attempt >= maxAttempts - 1) return false;

    // Don't retry validation errors
    if (error.category === ErrorCategory.VALIDATION) return false;

    // Don't retry authentication errors
    if (error.category === ErrorCategory.AUTHENTICATION) return false;

    // Retry API and network errors
    return error.retry;
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 second
    return baseDelay * this.defaultFallbackConfig.backoffMultiplier ** attempt;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for cache keys
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private hashSchema(schema: any): string {
    try {
      return JSON.stringify(schema._def || schema).substring(0, 32);
    } catch {
      return 'unknown';
    }
  }

  private async generateTextWithFallback(
    prompt: string,
    fallbackModels: string[],
    options?: any
  ): Promise<any> {
    for (const modelId of fallbackModels) {
      if (!this.isModelAvailable(modelId)) continue;

      try {
        const model = getAIModel(modelId);
        const result = await generateText({
          model,
          prompt,
          ...this.getDegradedOptions(options?.degradeOptions),
        });

        this.recordSuccess(modelId);
        return result;
      } catch (error) {
        this.recordFailure(modelId);
      }
    }

    throw new Error('All fallback models failed');
  }

  private async streamTextWithFallback(
    prompt: string,
    fallbackModels: string[],
    options?: any
  ) {
    for (const modelId of fallbackModels) {
      if (!this.isModelAvailable(modelId)) continue;

      try {
        const model = getAIModel(modelId);
        const stream = await streamText({
          model,
          prompt,
          onChunk: options?.onChunk,
        });

        this.recordSuccess(modelId);
        return stream;
      } catch (error) {
        this.recordFailure(modelId);
      }
    }

    throw new Error('All fallback models failed');
  }

  private getDegradedOptions(options: any): any {
    // Reduce quality settings for fallback attempts
    return {
      ...options,
      temperature: 0.5,
      topP: 0.9,
    };
  }

  private relaxSchema(schema: any): any {
    // This is a simplified version - in reality, you'd want more sophisticated schema relaxation
    if (schema._def?.typeName === 'ZodObject') {
      // Make all fields optional
      const shape = schema._def.shape();
      const relaxed: any = {};

      for (const [key, value] of Object.entries(shape)) {
        relaxed[key] = (value as any).optional();
      }

      return schema.constructor.create(relaxed);
    }

    return schema;
  }

  private generateMockData<T>(schema: any): { object: T } {
    // Generate mock data based on schema - simplified version
    const mockData: any = {};

    if (schema._def?.typeName === 'ZodObject') {
      const shape = schema._def.shape();

      for (const [key, value] of Object.entries(shape)) {
        const type = (value as any)._def?.typeName;

        switch (type) {
          case 'ZodString':
            mockData[key] = 'mock_string';
            break;
          case 'ZodNumber':
            mockData[key] = 0;
            break;
          case 'ZodBoolean':
            mockData[key] = false;
            break;
          case 'ZodArray':
            mockData[key] = [];
            break;
          default:
            mockData[key] = null;
        }
      }
    }

    return { object: mockData as T };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Normalize embedding model ID to match template literal constraints
   */
  private normalizeEmbeddingModelId(
    modelId: string
  ): `openai:${string}` | `anthropic:${string}` {
    // Handle legacy model IDs and ensure proper provider prefix
    if (modelId === 'openai' || modelId === 'text-embedding-3-small') {
      return 'openai:text-embedding-3-small';
    }
    if (modelId === 'text-embedding-3-large') {
      return 'openai:text-embedding-3-large';
    }
    if (modelId === 'text-embedding-ada-002') {
      return 'openai:text-embedding-ada-002';
    }
    if (modelId === 'mistral-embed') {
      return 'anthropic:claude-3-haiku-20240307'; // Use Claude as fallback for non-OpenAI
    }

    // If already has provider prefix, use as-is if it matches the expected format
    if (
      modelId.includes(':') &&
      (modelId.startsWith('openai:') || modelId.startsWith('anthropic:'))
    ) {
      return modelId as `openai:${string}` | `anthropic:${string}`;
    }

    // Default to OpenAI if no provider specified
    return `openai:${modelId}`;
  }

  // Public methods for monitoring

  getHealthStatus(): Map<string, HealthCheckResult> {
    return new Map(this.healthChecks);
  }

  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  resetCircuitBreaker(modelId: string) {
    const breaker = this.circuitBreakers.get(modelId);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      breaker.successCount = 0;
    }
  }
}

// Export singleton instance
export const resilientAI = new ResilientAIService();

// Convenience functions
export const generateTextSafe =
  resilientAI.generateTextResilient.bind(resilientAI);
export const generateObjectSafe =
  resilientAI.generateObjectResilient.bind(resilientAI);
export const streamTextSafe = resilientAI.streamTextResilient.bind(resilientAI);
export const embedSafe = resilientAI.embedResilient.bind(resilientAI);
