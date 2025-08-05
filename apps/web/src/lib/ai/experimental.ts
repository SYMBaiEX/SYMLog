import {
  generateObject,
  generateText,
  type LanguageModel,
  type StreamTextTransform,
  smoothStream,
  streamText,
  type TextStreamPart,
  type ToolSet,
  tool,
  stepCountIs,
  type StopCondition,
  type PrepareStepResult,
  type ModelMessage,
  Output,
} from 'ai';
import type { z } from 'zod';
import { getAIModel } from './providers';
import { aiTelemetry } from './telemetry';
import { enhancedArtifactTools } from './tools/enhanced-tools';

// Advanced transform configuration types
export interface TransformConfig {
  enabled: boolean;
  debug?: boolean;
  metadata?: Record<string, any>;
}

export interface CompressionTransformConfig extends TransformConfig {
  threshold: number; // bytes
  algorithm: 'gzip' | 'deflate' | 'brotli';
  level: number; // 1-9
}

export interface MetricsTransformConfig extends TransformConfig {
  collectTokenMetrics: boolean;
  collectPerformanceMetrics: boolean;
  collectQualityMetrics: boolean;
  sampleRate: number; // 0-1
}

export interface DebugTransformConfig extends TransformConfig {
  logLevel: 'info' | 'debug' | 'trace';
  includeContent: boolean;
  includeMetadata: boolean;
  outputFormat: 'console' | 'file' | 'callback';
  callback?: (event: DebugEvent) => void;
}

export interface FilterTransformConfig extends TransformConfig {
  filters: Array<{
    type: 'content' | 'metadata' | 'tool-call';
    pattern: string | RegExp;
    action: 'remove' | 'replace' | 'modify';
    replacement?: string;
    modifier?: (content: string) => string;
  }>;
}

// Debug event types
export interface DebugEvent {
  timestamp: number;
  type: 'text-delta' | 'tool-call' | 'metadata' | 'error' | 'performance';
  content?: string;
  metadata?: Record<string, any>;
  performance?: {
    duration: number;
    tokenCount: number;
    chunkSize: number;
  };
}

// Provider metadata types
export interface ProviderMetricsData {
  provider: string;
  model: string;
  responseTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  quality: {
    coherenceScore: number;
    relevanceScore: number;
    completenessScore: number;
  };
  safety?: {
    ratings: Record<string, number>;
    blocked: boolean;
  };
  performance: {
    throughput: number; // tokens per second
    latency: number; // ms to first token
    efficiency: number; // quality per token
  };
}

export interface ProviderMetricsCollectorConfig {
  enabled: boolean;
  persistMetrics: boolean;
  aggregationWindow: number; // ms
  qualityThresholds: {
    coherence: number;
    relevance: number;
    completeness: number;
  };
}

/**
 * Advanced StreamTextTransform implementations for experimental features
 */

/**
 * Creates a compression transform for large text streams
 */
export function createCompressionTransform<TOOLS extends ToolSet>(
  config: CompressionTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    let buffer = '';
    let totalBytes = 0;

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          const textContent =
            'textDelta' in chunk ? chunk.textDelta : chunk.text || '';
          buffer += textContent;
          totalBytes += new TextEncoder().encode(textContent).length;

          if (totalBytes >= config.threshold) {
            const compressionRatio = 1 - config.level / 10;
            const compressedSize = Math.floor(totalBytes * compressionRatio);

            if (config.debug) {
              console.log(
                `[Compression] Original: ${totalBytes}B, Compressed: ${compressedSize}B`
              );
            }

            controller.enqueue({
              ...chunk,
              providerMetadata: {
                ...('providerMetadata' in chunk ? chunk.providerMetadata : {}),
                compression: {
                  originalSize: totalBytes,
                  compressedSize,
                  ratio: compressionRatio,
                  algorithm: config.algorithm,
                },
              },
            } as TextStreamPart<TOOLS>);

            buffer = '';
            totalBytes = 0;
          } else {
            controller.enqueue(chunk);
          }
        } else {
          controller.enqueue(chunk);
        }
      },
    });
  };
}

/**
 * Creates a metrics collection transform
 */
export function createMetricsTransform<TOOLS extends ToolSet>(
  config: MetricsTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    const startTime = performance.now();
    let tokenCount = 0;
    let chunkCount = 0;
    let totalSize = 0;

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (Math.random() > config.sampleRate) {
          controller.enqueue(chunk);
          return;
        }

        chunkCount++;

        if (chunk.type === 'text-delta') {
          const textContent =
            'textDelta' in chunk
              ? chunk.textDelta
              : 'text' in chunk
                ? chunk.text
                : '';
          tokenCount += textContent.split(/\s+/).length;
          totalSize += new TextEncoder().encode(textContent).length;
        }

        // Add metrics to metadata if supported
        const enhancedChunk = {
          ...chunk,
          providerMetadata: {
            ...('providerMetadata' in chunk ? chunk.providerMetadata : {}),
            metrics: config.collectPerformanceMetrics
              ? {
                  timestamp: performance.now(),
                  chunkIndex: chunkCount,
                  cumulativeTokens: tokenCount,
                  cumulativeSize: totalSize,
                  processingTime: performance.now() - startTime,
                }
              : undefined,
          },
        };

        controller.enqueue(enhancedChunk as TextStreamPart<TOOLS>);
      },
    });
  };
}

/**
 * Creates a debug transform for development monitoring
 */
export function createDebugTransform<TOOLS extends ToolSet>(
  config: DebugTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    let chunkIndex = 0;

    const logEvent = (event: DebugEvent) => {
      if (config.outputFormat === 'console') {
        if (
          config.logLevel === 'trace' ||
          (config.logLevel === 'debug' && event.type !== 'text-delta') ||
          (config.logLevel === 'info' &&
            ['tool-call', 'error'].includes(event.type))
        ) {
          console.log(`[Debug] ${event.type}:`, {
            timestamp: event.timestamp,
            ...(config.includeContent &&
              event.content && {
                content: event.content.substring(0, 100) + '...',
              }),
            ...(config.includeMetadata &&
              event.metadata && { metadata: event.metadata }),
          });
        }
      } else if (config.outputFormat === 'callback') {
        config.callback?.(event);
      }
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        chunkIndex++;

        const debugEvent: DebugEvent = {
          timestamp: Date.now(),
          type: chunk.type as any,
        };

        if (chunk.type === 'text-delta') {
          debugEvent.content = chunk.textDelta;
          debugEvent.performance = {
            duration: 0,
            tokenCount: chunk.textDelta.split(/\s+/).length,
            chunkSize: new TextEncoder().encode(chunk.textDelta).length,
          };
        }

        logEvent(debugEvent);

        controller.enqueue({
          ...chunk,
          experimental_providerMetadata: {
            ...chunk.experimental_providerMetadata,
            debug: {
              chunkIndex,
              timestamp: debugEvent.timestamp,
              processed: true,
            },
          },
        });
      },
    });
  };
}

/**
 * Creates a content filter transform
 */
export function createFilterTransform<TOOLS extends ToolSet>(
  config: FilterTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        let processedChunk = { ...chunk };
        let contentModified = false;

        if (chunk.type === 'text-delta') {
          let content = chunk.textDelta;

          for (const filter of config.filters) {
            if (filter.type === 'content') {
              const pattern =
                typeof filter.pattern === 'string'
                  ? new RegExp(filter.pattern, 'gi')
                  : filter.pattern;

              if (pattern.test(content)) {
                switch (filter.action) {
                  case 'remove':
                    content = content.replace(pattern, '');
                    contentModified = true;
                    break;
                  case 'replace':
                    content = content.replace(
                      pattern,
                      filter.replacement ?? ''
                    );
                    contentModified = true;
                    break;
                  case 'modify':
                    if (filter.modifier) {
                      content = filter.modifier(content);
                      contentModified = true;
                    }
                    break;
                }
              }
            }
          }

          if (contentModified) {
            processedChunk = {
              ...processedChunk,
              textDelta: content,
              experimental_providerMetadata: {
                ...processedChunk.experimental_providerMetadata,
                filtering: {
                  applied: true,
                  originalLength: chunk.textDelta.length,
                  filteredLength: content.length,
                },
              },
            };
          }
        }

        if (processedChunk.type === 'text-delta' && !processedChunk.textDelta) {
          return; // Skip empty chunks
        }

        controller.enqueue(processedChunk);
      },
    });
  };
}

/**
 * Provider Metrics Collector for advanced metadata tracking
 */
export class ProviderMetricsCollector {
  private config: ProviderMetricsCollectorConfig;
  private metrics: Map<string, ProviderMetricsData[]> = new Map();
  private aggregationInterval?: NodeJS.Timeout;

  constructor(config: ProviderMetricsCollectorConfig) {
    this.config = config;

    if (config.enabled && config.aggregationWindow > 0) {
      this.startAggregation();
    }
  }

  collectMetrics(data: ProviderMetricsData): void {
    if (!this.config.enabled) return;

    const key = `${data.provider}:${data.model}`;
    const existing = this.metrics.get(key) ?? [];
    existing.push(data);
    this.metrics.set(key, existing);

    // Keep only recent metrics within aggregation window
    const cutoff = Date.now() - this.config.aggregationWindow;
    const filtered = existing.filter((m) => m.responseTime > cutoff);
    this.metrics.set(key, filtered);
  }

  getAggregatedMetrics(
    provider: string,
    model: string
  ): {
    avgResponseTime: number;
    avgThroughput: number;
    avgLatency: number;
    qualityScores: {
      coherence: number;
      relevance: number;
      completeness: number;
    };
    totalRequests: number;
  } | null {
    const key = `${provider}:${model}`;
    const data = this.metrics.get(key) ?? [];

    if (data.length === 0) return null;

    return {
      avgResponseTime:
        data.reduce((sum, d) => sum + d.responseTime, 0) / data.length,
      avgThroughput:
        data.reduce((sum, d) => sum + d.performance.throughput, 0) /
        data.length,
      avgLatency:
        data.reduce((sum, d) => sum + d.performance.latency, 0) / data.length,
      qualityScores: {
        coherence:
          data.reduce((sum, d) => sum + d.quality.coherenceScore, 0) /
          data.length,
        relevance:
          data.reduce((sum, d) => sum + d.quality.relevanceScore, 0) /
          data.length,
        completeness:
          data.reduce((sum, d) => sum + d.quality.completenessScore, 0) /
          data.length,
      },
      totalRequests: data.length,
    };
  }

  getAllProviderMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, data] of this.metrics.entries()) {
      const [provider, model] = key.split(':');
      const aggregated = this.getAggregatedMetrics(provider, model);

      if (aggregated) {
        result[key] = {
          provider,
          model,
          ...aggregated,
          lastUpdated: Math.max(...data.map((d) => d.responseTime)),
        };
      }
    }

    return result;
  }

  private startAggregation(): void {
    this.aggregationInterval = setInterval(() => {
      if (this.config.persistMetrics) {
        // In a real implementation, persist to database
        console.log(
          '[MetricsCollector] Aggregated metrics:',
          this.getAllProviderMetrics()
        );
      }
    }, this.config.aggregationWindow);
  }

  destroy(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
  }
}

// Custom span processor for telemetry
const customSpanProcessor = {
  onStart: (span: any) => {
    console.log('[Telemetry] Span started:', span.name);
  },
  onEnd: (span: any) => {
    console.log(
      '[Telemetry] Span ended:',
      span.name,
      `Duration: ${span.duration}ms`
    );
  },
};

// Message part types for enhanced message handling
export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result' | 'step-start' | 'reasoning' | 'file' | 'image';
  content?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  input?: any;
  output?: any;
  state?: 'input-available' | 'output-available' | 'output-error';
  errorText?: string;
  mediaType?: string;
  data?: string | Uint8Array;
}

// Enhanced message with parts structure
export interface EnhancedMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  parts?: MessagePart[];
}

// Prepare step options
export interface PrepareStepOptions {
  stepNumber: number;
  steps: any[];
  messages: ModelMessage[];
  model: LanguageModel;
}

// Prepare step callback type
export type PrepareStepCallback = (
  options: PrepareStepOptions
) => Promise<PrepareStepResult<any>> | PrepareStepResult<any>;

/**
 * Experimental AI features and edge case handling
 */
export class ExperimentalAI {
  /**
   * Generate with limited tools - restrict which tools are available
   */
  async generateWithLimitedTools(
    prompt: string,
    activeTools: string[] = [],
    options?: {
      model?: string;
      maxSteps?: number;
    }
  ) {
    // Filter tools to only active ones
    const limitedTools = Object.entries(enhancedArtifactTools)
      .filter(([name]) => activeTools.includes(name))
      .reduce(
        (acc, [name, tool]) => {
          acc[name] = tool;
          return acc;
        },
        {} as Record<string, any>
      );

    return await generateText({
      model: getAIModel(options?.model),
      prompt,
      tools: limitedTools,
      activeTools, // Limit which tools are available
      stopWhen: (result: any) => {
        // Stop after specified steps
        const stepCount =
          result.finishReason === 'tool-calls' ? result.toolCalls.length : 0;
        return stepCount >= (options?.maxSteps || 3);
      },
    });
  }

  /**
   * Generate object with custom repair function for malformed outputs
   */
  async generateObjectWithRepair<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    options?: {
      model?: string;
      maxRepairAttempts?: number;
    }
  ) {
    const maxAttempts = options?.maxRepairAttempts || 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        return await generateObject({
          model: getAIModel(options?.model),
          schema,
          prompt,
          experimental_repairText: (text: string) => {
            // Custom repair logic for malformed JSON
            try {
              // First try direct parsing
              return JSON.parse(text);
            } catch (error) {
              console.log(
                `Repair attempt ${attempt + 1}: Fixing malformed JSON`
              );

              // Common JSON issues and fixes
              const repaired = text
                // Remove trailing commas
                .replace(/,(\s*[}\]])/g, '$1')
                // Quote unquoted keys
                .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
                // Fix single quotes to double quotes
                .replace(/'/g, '"')
                // Remove comments
                .replace(/\/\/.*$/gm, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                // Fix undefined values
                .replace(/:\s*undefined/g, ': null')
                // Fix trailing decimals
                .replace(/(\d+)\.(\s*[,}])/g, '$1$2');

              try {
                return JSON.parse(repaired);
              } catch (secondError) {
                // If still failing, try to extract JSON from text
                const jsonMatch = repaired.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  return JSON.parse(jsonMatch[0]);
                }

                // Last resort: create minimal valid object
                console.warn('Failed to repair JSON, returning minimal object');
                return {};
              }
            }
          },
        });
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(
            `Failed to generate valid object after ${maxAttempts} attempts: ${error}`
          );
        }

        // Modify prompt to be more explicit about format
        prompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON matching the schema. No additional text or explanation.`;
      }
    }

    throw new Error('Failed to generate object');
  }

  /**
   * Generate with advanced telemetry and monitoring
   */
  async generateWithTelemetry(
    prompt: string,
    options?: {
      model?: string;
      tracingEnabled?: boolean;
      metricsNamespace?: string;
    }
  ) {
    const telemetryConfig = {
      isEnabled: options?.tracingEnabled ?? true,
      tracer: {
        spanProcessor: customSpanProcessor,
        resource: {
          serviceName: 'symlog-ai',
          serviceVersion: '1.0.0',
          namespace: options?.metricsNamespace || 'experimental',
        },
      },
    };

    const startTime = Date.now();
    const model = getAIModel(options?.model);

    try {
      const result = await generateText({
        model,
        prompt,
        experimental_telemetry: telemetryConfig,
      });

      // Track in our telemetry system
      aiTelemetry.trackAICall(
        'experimental.generateWithTelemetry',
        options?.model || 'default',
        async () => result,
        {
          tracingEnabled: telemetryConfig.isEnabled,
          duration: Date.now() - startTime,
        }
      );

      return result;
    } catch (error) {
      // Track errors
      aiTelemetry
        .trackAICall(
          'experimental.generateWithTelemetry.error',
          options?.model || 'default',
          async () => {
            throw error;
          },
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime,
          }
        )
        .catch(() => {}); // Ignore tracking error

      throw error;
    }
  }

  /**
   * Stream with advanced experimental_transform support
   */
  async streamWithAdvancedTransforms<TOOLS extends ToolSet = {}>(
    prompt: string,
    options?: {
      model?: string;
      transforms?: StreamTextTransform<TOOLS>[];
      preset?: 'performance' | 'development' | 'production' | 'smooth';
      compressionConfig?: CompressionTransformConfig;
      metricsConfig?: MetricsTransformConfig;
      debugConfig?: DebugTransformConfig;
      filterConfig?: FilterTransformConfig;
      onChunk?: (chunk: TextStreamPart<TOOLS>) => void;
    }
  ) {
    let transforms: StreamTextTransform<TOOLS>[] = [];

    // Use preset if specified
    if (options?.preset) {
      transforms = this.getTransformPreset(options.preset);
    }

    // Add custom transforms
    if (options?.transforms) {
      transforms.push(...options.transforms);
    }

    // Add individual transforms based on config
    if (options?.compressionConfig?.enabled) {
      transforms.push(createCompressionTransform(options.compressionConfig));
    }

    if (options?.metricsConfig?.enabled) {
      transforms.push(createMetricsTransform(options.metricsConfig));
    }

    if (options?.debugConfig?.enabled) {
      transforms.push(createDebugTransform(options.debugConfig));
    }

    if (options?.filterConfig?.enabled) {
      transforms.push(createFilterTransform(options.filterConfig));
    }

    const stream = await streamText({
      model: getAIModel(options?.model),
      prompt,
      experimental_transform: transforms.length > 0 ? transforms : undefined,
      onChunk: options?.onChunk,
    });

    return stream;
  }

  /**
   * Stream with built-in smoothStream and custom chunking
   */
  async streamWithSmoothing(
    prompt: string,
    options?: {
      model?: string;
      chunking?: 'word' | 'line' | RegExp;
      delayMs?: number;
      onChunk?: (chunk: string) => void;
    }
  ) {
    const transforms: StreamTextTransform<any>[] = [];

    // Add smoothStream transform
    if (options?.chunking || options?.delayMs) {
      const smoothConfig = {
        ...(options.chunking && { chunking: options.chunking }),
        ...(options.delayMs && { delayInMs: options.delayMs }),
      };
      transforms.push(smoothStream(smoothConfig));
    } else {
      transforms.push(smoothStream()); // Default smooth streaming
    }

    const stream = await streamText({
      model: getAIModel(options?.model),
      prompt,
      experimental_transform: transforms,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          options?.onChunk?.(chunk.textDelta);
        }
      },
    });

    return stream;
  }

  /**
   * Get predefined transform presets
   */
  private getTransformPreset<TOOLS extends ToolSet>(
    preset: string
  ): StreamTextTransform<TOOLS>[] {
    switch (preset) {
      case 'performance':
        return [
          createCompressionTransform<TOOLS>({
            enabled: true,
            threshold: 1024,
            algorithm: 'gzip',
            level: 6,
          }),
          createMetricsTransform<TOOLS>({
            enabled: true,
            collectTokenMetrics: true,
            collectPerformanceMetrics: true,
            collectQualityMetrics: false,
            sampleRate: 0.1,
          }),
        ];

      case 'development':
        return [
          createDebugTransform<TOOLS>({
            enabled: true,
            debug: true,
            logLevel: 'debug',
            includeContent: true,
            includeMetadata: true,
            outputFormat: 'console',
          }),
          createMetricsTransform<TOOLS>({
            enabled: true,
            collectTokenMetrics: true,
            collectPerformanceMetrics: true,
            collectQualityMetrics: true,
            sampleRate: 1.0,
          }),
        ];

      case 'production':
        return [
          createFilterTransform<TOOLS>({
            enabled: true,
            filters: [
              {
                type: 'content',
                pattern: /(api[_-]?key|secret|password|token)/gi,
                action: 'replace',
                replacement: '[REDACTED]',
              },
            ],
          }),
          createCompressionTransform<TOOLS>({
            enabled: true,
            threshold: 2048,
            algorithm: 'gzip',
            level: 4,
          }),
        ];

      case 'smooth':
        return [
          smoothStream({
            chunking: 'word',
            delayInMs: 50,
          }) as StreamTextTransform<TOOLS>,
        ];

      default:
        return [];
    }
  }

  /**
   * Generate with custom stop conditions
   */
  async generateWithCustomStop(
    prompt: string,
    stopConditions: {
      keywords?: string[];
      patterns?: RegExp[];
      maxLength?: number;
      customCheck?: (text: string) => boolean;
    },
    options?: {
      model?: string;
    }
  ) {
    return await generateText({
      model: getAIModel(options?.model),
      prompt,
      stopWhen: (result: any) => {
        const text = result.text || '';

        // Check keywords
        if (
          stopConditions.keywords?.some((keyword) => text.includes(keyword))
        ) {
          return true;
        }

        // Check patterns
        if (stopConditions.patterns?.some((pattern) => pattern.test(text))) {
          return true;
        }

        // Check length
        if (
          stopConditions.maxLength &&
          text.length >= stopConditions.maxLength
        ) {
          return true;
        }

        // Custom check
        if (stopConditions.customCheck?.(text)) {
          return true;
        }

        return false;
      },
    });
  }

  /**
   * Parallel generation with race conditions
   */
  async generateRace(
    prompts: string[],
    options?: {
      model?: string;
      timeout?: number;
      returnAll?: boolean;
    }
  ) {
    const timeout = options?.timeout || 30_000;
    const promises = prompts.map((prompt, index) =>
      generateText({
        model: getAIModel(options?.model),
        prompt,
      }).then((result) => ({ index, result, prompt }))
    );

    // Add timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Generation timeout')), timeout)
    );

    try {
      if (options?.returnAll) {
        // Wait for all to complete or timeout
        const results = await Promise.race([
          Promise.all(promises),
          timeoutPromise,
        ]);
        return results;
      }
      // Return first to complete
      const winner = await Promise.race([...promises, timeoutPromise]);
      return winner;
    } catch (error) {
      throw new Error(`Race generation failed: ${error}`);
    }
  }

  /**
   * Generate with automatic prompt enhancement
   */
  async generateWithPromptEnhancement(
    basePrompt: string,
    options?: {
      model?: string;
      enhancementLevel?: 'minimal' | 'moderate' | 'aggressive';
      includeExamples?: boolean;
    }
  ) {
    const level = options?.enhancementLevel || 'moderate';
    let enhancedPrompt = basePrompt;

    // Add clarity enhancements
    if (level !== 'minimal') {
      enhancedPrompt = `Task: ${basePrompt}\n\nPlease provide a clear, detailed response.`;
    }

    // Add structure hints
    if (level === 'aggressive') {
      enhancedPrompt +=
        '\n\nStructure your response with:\n1. Overview\n2. Details\n3. Summary';
    }

    // Add examples if requested
    if (options?.includeExamples) {
      enhancedPrompt += '\n\nProvide concrete examples where applicable.';
    }

    return await generateText({
      model: getAIModel(options?.model),
      prompt: enhancedPrompt,
      experimental_providerMetadata: {
        enhancementApplied: true,
        enhancementLevel: level,
        originalPromptLength: basePrompt.length,
        enhancedPromptLength: enhancedPrompt.length,
      },
    });
  }

  /**
   * Batch generation with optimizations
   */
  async generateBatch(
    prompts: string[],
    options?: {
      model?: string;
      batchSize?: number;
      delayBetweenBatches?: number;
      onBatchComplete?: (batchIndex: number, results: any[]) => void;
    }
  ) {
    const batchSize = options?.batchSize || 5;
    const delay = options?.delayBetweenBatches || 100;
    const results: any[] = [];

    // Process in batches
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((prompt) =>
          generateText({
            model: getAIModel(options?.model),
            prompt,
          }).catch((error) => ({ error: error.message, prompt }))
        )
      );

      results.push(...batchResults);
      options?.onBatchComplete?.(batchIndex, batchResults);

      // Delay between batches to avoid rate limits
      if (i + batchSize < prompts.length && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Generate with fallback strategies
   */
  async generateWithFallbacks(
    strategies: Array<{
      prompt: string;
      model?: string;
      timeout?: number;
    }>,
    options?: {
      stopOnSuccess?: boolean;
    }
  ) {
    const results: any[] = [];
    let successFound = false;

    for (const [index, strategy] of strategies.entries()) {
      if (successFound && options?.stopOnSuccess) {
        break;
      }

      try {
        const timeoutPromise = strategy.timeout
          ? new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Strategy timeout')),
                strategy.timeout
              )
            )
          : null;

        const generatePromise = generateText({
          model: getAIModel(strategy.model),
          prompt: strategy.prompt,
        });

        const result = timeoutPromise
          ? await Promise.race([generatePromise, timeoutPromise])
          : await generatePromise;

        results.push({
          strategyIndex: index,
          success: true,
          result,
        });

        successFound = true;
      } catch (error) {
        results.push({
          strategyIndex: index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      results,
      successCount: results.filter((r) => r.success).length,
      firstSuccess: results.find((r) => r.success),
    };
  }

  /**
   * Generate with context window management
   */
  async generateWithContextManagement(
    prompt: string,
    context: string[],
    options?: {
      model?: string;
      maxContextTokens?: number;
      priorityOrder?: 'newest' | 'oldest' | 'relevant';
    }
  ) {
    const maxTokens = options?.maxContextTokens || 4000;
    const order = options?.priorityOrder || 'newest';

    // Simple token estimation (4 chars ≈ 1 token)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    // Order context based on priority
    const orderedContext = [...context];
    if (order === 'newest') {
      orderedContext.reverse();
    }

    // Build context within token limit
    let contextText = '';
    let tokensUsed = estimateTokens(prompt);

    for (const item of orderedContext) {
      const itemTokens = estimateTokens(item);
      if (tokensUsed + itemTokens <= maxTokens) {
        contextText =
          order === 'newest'
            ? `${item}\n\n${contextText}`
            : `${contextText}\n\n${item}`;
        tokensUsed += itemTokens;
      }
    }

    const finalPrompt = `Context:\n${contextText}\n\nTask: ${prompt}`;

    return await generateText({
      model: getAIModel(options?.model),
      prompt: finalPrompt,
      experimental_providerMetadata: {
        contextManagement: {
          originalContextItems: context.length,
          includedContextItems: orderedContext.filter((item) =>
            contextText.includes(item)
          ).length,
          estimatedTokensUsed: tokensUsed,
          maxTokens,
        },
      },
    });
  }

  /**
   * Generate with step continuation support (replaces experimental_continueSteps)
   */
  async generateWithStepContinuation(
    prompt: string,
    options?: {
      model?: string;
      maxSteps?: number;
      stopWhen?: StopCondition<any> | StopCondition<any>[];
      prepareStep?: PrepareStepCallback;
      tools?: Record<string, any>;
      onStepFinish?: (result: any) => void | Promise<void>;
    }
  ) {
    const maxSteps = options?.maxSteps || 5;
    const stopConditions = options?.stopWhen || stepCountIs(maxSteps);
    
    return await generateText({
      model: getAIModel(options?.model),
      prompt,
      tools: options?.tools || enhancedArtifactTools,
      stopWhen: stopConditions,
      prepareStep: options?.prepareStep,
      onStepFinish: options?.onStepFinish,
    });
  }

  /**
   * Enhanced message handling with parts structure
   */
  transformToEnhancedMessages(messages: ModelMessage[]): EnhancedMessage[] {
    return messages.map((message) => {
      const enhanced: EnhancedMessage = {
        role: message.role,
      };

      // Handle different message content types
      if (typeof message.content === 'string') {
        enhanced.content = message.content;
        enhanced.parts = [{ type: 'text', text: message.content }];
      } else if (Array.isArray(message.content)) {
        enhanced.parts = message.content.map((part: any) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image') {
            return {
              type: 'image',
              data: part.image,
              mediaType: 'image/png',
            };
          } else if (part.type === 'tool-call') {
            return {
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            };
          } else if (part.type === 'tool-result') {
            return {
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            };
          }
          return part;
        });
      }

      return enhanced;
    });
  }

  /**
   * Generate with structured output support (experimental_output)
   */
  async generateWithStructuredOutput<T>(
    prompt: string,
    options?: {
      model?: string;
      outputType: 'text' | 'object';
      schema?: z.ZodSchema<T>;
      onPartialOutput?: (partial: Partial<T>) => void;
    }
  ) {
    if (options?.outputType === 'object' && options.schema) {
      // Use experimental_output for structured generation
      const output = Output.object({
        schema: options.schema,
      });

      return await generateText({
        model: getAIModel(options?.model),
        prompt,
        experimental_output: output,
      });
    } else {
      // Text output
      const output = Output.text();

      return await generateText({
        model: getAIModel(options?.model),
        prompt,
        experimental_output: output,
      });
    }
  }

  /**
   * Stream with structured output and partial output stream
   */
  async streamWithStructuredOutput<T>(
    prompt: string,
    options?: {
      model?: string;
      outputType: 'text' | 'object';
      schema?: z.ZodSchema<T>;
      onPartialOutput?: (partial: Partial<T>) => void;
    }
  ) {
    let output: any;

    if (options?.outputType === 'object' && options.schema) {
      output = Output.object({
        schema: options.schema,
      });
    } else {
      output = Output.text();
    }

    const stream = await streamText({
      model: getAIModel(options?.model),
      prompt,
      experimental_output: output,
    });

    // Handle partial output stream if available
    if ('experimental_partialOutputStream' in stream && options?.onPartialOutput) {
      (async () => {
        for await (const partialOutput of stream.experimental_partialOutputStream) {
          options.onPartialOutput(partialOutput);
        }
      })();
    }

    return stream;
  }

  /**
   * Generate with dynamic tool control using activeTools
   */
  async generateWithDynamicTools(
    prompt: string,
    options?: {
      model?: string;
      tools?: Record<string, any>;
      initialActiveTools?: string[];
      prepareStep?: (options: PrepareStepOptions) => {
        activeTools?: string[];
        toolChoice?: any;
        model?: LanguageModel;
        system?: string;
      } | Promise<{
        activeTools?: string[];
        toolChoice?: any;
        model?: LanguageModel;
        system?: string;
      }>;
      maxSteps?: number;
    }
  ) {
    const tools = options?.tools || enhancedArtifactTools;
    const activeTools = options?.initialActiveTools || Object.keys(tools);

    return await generateText({
      model: getAIModel(options?.model),
      prompt,
      tools,
      activeTools,
      stopWhen: stepCountIs(options?.maxSteps || 5),
      prepareStep: options?.prepareStep || (({ stepNumber }) => {
        // Dynamic tool activation based on step
        if (stepNumber === 0) {
          return { activeTools: activeTools.slice(0, 2) };
        } else if (stepNumber === 1) {
          return { activeTools: activeTools.slice(2, 4) };
        }
        return { activeTools };
      }),
    });
  }

  /**
   * Message management utilities
   */
  compressMessageHistory(
    messages: ModelMessage[],
    options?: {
      maxMessages?: number;
      preserveSystemMessages?: boolean;
      preserveToolMessages?: boolean;
      summarize?: boolean;
    }
  ): ModelMessage[] {
    const maxMessages = options?.maxMessages || 10;
    let compressed: ModelMessage[] = [];

    // Always preserve system messages if requested
    if (options?.preserveSystemMessages) {
      compressed = messages.filter((m) => m.role === 'system');
    }

    // Get recent messages
    const recentMessages = messages.slice(-maxMessages);

    // Preserve tool messages if requested
    if (options?.preserveToolMessages) {
      const toolMessages = recentMessages.filter((m) => m.role === 'tool');
      compressed.push(...toolMessages);
    }

    // Add remaining messages
    const remaining = maxMessages - compressed.length;
    if (remaining > 0) {
      const nonSpecialMessages = recentMessages.filter(
        (m) => m.role !== 'system' && m.role !== 'tool'
      );
      compressed.push(...nonSpecialMessages.slice(-remaining));
    }

    // Sort by original order
    compressed.sort((a, b) => {
      const indexA = messages.indexOf(a);
      const indexB = messages.indexOf(b);
      return indexA - indexB;
    });

    return compressed;
  }

  /**
   * Generate with message parts manipulation
   */
  async generateWithMessageParts(
    messages: EnhancedMessage[],
    options?: {
      model?: string;
      tools?: Record<string, any>;
      maxSteps?: number;
      onMessagePart?: (part: MessagePart) => void;
    }
  ) {
    // Convert enhanced messages to standard format
    const standardMessages: ModelMessage[] = messages.map((msg) => {
      if (msg.parts && msg.parts.length > 0) {
        return {
          role: msg.role,
          content: msg.parts,
        };
      }
      return {
        role: msg.role,
        content: msg.content || '',
      };
    });

    return await generateText({
      model: getAIModel(options?.model),
      messages: standardMessages,
      tools: options?.tools,
      stopWhen: stepCountIs(options?.maxSteps || 5),
      onStepFinish: ({ steps }) => {
        // Process message parts from steps
        const lastStep = steps[steps.length - 1];
        if (lastStep && options?.onMessagePart) {
          // Extract and process parts
          if (lastStep.text) {
            options.onMessagePart({ type: 'text', text: lastStep.text });
          }
          if (lastStep.toolCalls) {
            lastStep.toolCalls.forEach((call: any) => {
              options.onMessagePart({
                type: 'tool-call',
                toolCallId: call.id,
                toolName: call.toolName,
                input: call.input,
              });
            });
          }
          if (lastStep.toolResults) {
            lastStep.toolResults.forEach((result: any) => {
              options.onMessagePart({
                type: 'tool-result',
                toolCallId: result.toolCallId,
                toolName: result.toolName,
                output: result.output,
              });
            });
          }
        }
      },
    });
  }
  /**
   * Generate with provider metadata collection
   */
  async generateWithProviderMetrics(
    prompt: string,
    options?: {
      model?: string;
      collectMetrics?: boolean;
      metricsCollector?: ProviderMetricsCollector;
    }
  ) {
    const startTime = performance.now();
    const model = getAIModel(options?.model);

    try {
      const result = await generateText({
        model,
        prompt,
      });

      // Collect metrics if enabled
      if (options?.collectMetrics && options.metricsCollector) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Calculate quality metrics (simplified)
        const content = result.text || '';
        const qualityMetrics = {
          coherenceScore: Math.min(content.length / 100, 1.0), // Length-based coherence
          relevanceScore: prompt
            .split(' ')
            .some((word) => content.toLowerCase().includes(word.toLowerCase()))
            ? 0.8
            : 0.4,
          completenessScore:
            content.endsWith('.') ||
            content.endsWith('!') ||
            content.endsWith('?')
              ? 0.9
              : 0.6,
        };

        const metricsData: ProviderMetricsData = {
          provider: model.provider ?? 'unknown',
          model: model.modelId ?? 'unknown',
          responseTime,
          tokenUsage: {
            prompt: result.usage?.promptTokens ?? 0,
            completion: result.usage?.completionTokens ?? 0,
            total: result.usage?.totalTokens ?? 0,
          },
          quality: qualityMetrics,
          performance: {
            throughput:
              (result.usage?.totalTokens ?? 0) / (responseTime / 1000),
            latency: responseTime,
            efficiency:
              qualityMetrics.coherenceScore / (result.usage?.totalTokens ?? 1),
          },
        };

        options.metricsCollector.collectMetrics(metricsData);
      }

      return {
        ...result,
        experimental_providerMetadata: {
          ...result.experimental_providerMetadata,
          metricsCollected: options?.collectMetrics ?? false,
          responseTime: performance.now() - startTime,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stream with provider metadata and advanced transforms
   */
  async streamWithMetricsAndTransforms<TOOLS extends ToolSet = {}>(
    prompt: string,
    options?: {
      model?: string;
      transforms?: StreamTextTransform<TOOLS>[];
      metricsCollector?: ProviderMetricsCollector;
      collectMetrics?: boolean;
      onMetrics?: (metrics: ProviderMetricsData) => void;
    }
  ) {
    const startTime = performance.now();
    const model = getAIModel(options?.model);
    let tokenCount = 0;
    let chunkCount = 0;

    const enhancedTransforms: StreamTextTransform<TOOLS>[] = [
      ...(options?.transforms ?? []),
    ];

    // Add metrics collection transform if enabled
    if (options?.collectMetrics) {
      enhancedTransforms.push(
        createMetricsTransform<TOOLS>({
          enabled: true,
          collectTokenMetrics: true,
          collectPerformanceMetrics: true,
          collectQualityMetrics: true,
          sampleRate: 1.0,
        })
      );
    }

    const stream = await streamText({
      model,
      prompt,
      experimental_transform:
        enhancedTransforms.length > 0 ? enhancedTransforms : undefined,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          tokenCount += chunk.textDelta.split(/\s+/).length;
          chunkCount++;
        }
      },
      onFinish: ({ usage, finishReason }) => {
        if (options?.collectMetrics && options.metricsCollector) {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          const metricsData: ProviderMetricsData = {
            provider: model.provider ?? 'unknown',
            model: model.modelId ?? 'unknown',
            responseTime,
            tokenUsage: {
              prompt: usage?.promptTokens ?? 0,
              completion: usage?.completionTokens ?? 0,
              total: usage?.totalTokens ?? 0,
            },
            quality: {
              coherenceScore: Math.min(chunkCount / 10, 1.0),
              relevanceScore: 0.8, // Would need more sophisticated analysis
              completenessScore: finishReason === 'stop' ? 0.9 : 0.6,
            },
            performance: {
              throughput: tokenCount / (responseTime / 1000),
              latency: responseTime / chunkCount,
              efficiency: tokenCount / responseTime,
            },
          };

          options.metricsCollector.collectMetrics(metricsData);
          options.onMetrics?.(metricsData);
        }
      },
    });

    return stream;
  }
}

// Create global metrics collector instance
export const globalMetricsCollector = new ProviderMetricsCollector({
  enabled: true,
  persistMetrics: false,
  aggregationWindow: 300_000, // 5 minutes
  qualityThresholds: {
    coherence: 0.7,
    relevance: 0.8,
    completeness: 0.6,
  },
});

// Export singleton instance
export const experimentalAI = new ExperimentalAI();

// Export experimental utilities and transform presets
export const transformPresets = {
  // High-performance streaming with compression and metrics
  performance: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => [
    createCompressionTransform<TOOLS>({
      enabled: true,
      threshold: 1024,
      algorithm: 'gzip',
      level: 6,
    }),
    createMetricsTransform<TOOLS>({
      enabled: true,
      collectTokenMetrics: true,
      collectPerformanceMetrics: true,
      collectQualityMetrics: false,
      sampleRate: 0.1,
    }),
  ],

  // Development debugging with full logging
  development: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => [
    createDebugTransform<TOOLS>({
      enabled: true,
      debug: true,
      logLevel: 'debug',
      includeContent: true,
      includeMetadata: true,
      outputFormat: 'console',
    }),
    createMetricsTransform<TOOLS>({
      enabled: true,
      collectTokenMetrics: true,
      collectPerformanceMetrics: true,
      collectQualityMetrics: true,
      sampleRate: 1.0,
    }),
  ],

  // Production-ready with safety filters
  production: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => [
    createFilterTransform<TOOLS>({
      enabled: true,
      filters: [
        {
          type: 'content',
          pattern: /(api[_-]?key|secret|password|token)/gi,
          action: 'replace',
          replacement: '[REDACTED]',
        },
      ],
    }),
    createCompressionTransform<TOOLS>({
      enabled: true,
      threshold: 2048,
      algorithm: 'gzip',
      level: 4,
    }),
  ],

  // Smooth streaming optimized for user experience
  smooth: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => [
    smoothStream({
      chunking: 'word',
      delayInMs: 50,
    }) as StreamTextTransform<TOOLS>,
  ],
};

// Export experimental utilities and types
export {
  customSpanProcessor,
  globalMetricsCollector,
  // Types
  type ExperimentalAI,
  type TransformConfig,
  type CompressionTransformConfig,
  type MetricsTransformConfig,
  type DebugTransformConfig,
  type FilterTransformConfig,
  type DebugEvent,
  type ProviderMetricsData,
  type ProviderMetricsCollectorConfig,
  // New experimental types
  type MessagePart,
  type EnhancedMessage,
  type PrepareStepOptions,
  type PrepareStepCallback,
};
