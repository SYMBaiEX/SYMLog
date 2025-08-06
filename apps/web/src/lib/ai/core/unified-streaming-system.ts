import {
  generateObject,
  generateText,
  type LanguageModel,
  type ModelMessage,
  Output,
  type PrepareStepResult,
  type StopCondition,
  type StreamTextTransform,
  smoothStream,
  stepCountIs,
  streamText,
  type TextStreamPart,
  type ToolSet,
} from 'ai';
import type { z } from 'zod';
import { unifiedErrorSystem } from '../error-handling/unified-error-system';
import { unifiedProviderSystem } from '../providers/unified-provider-system';

// Unified stream chunk types with strict type safety
export interface TextDeltaChunk {
  type: 'text-delta';
  textDelta: string;
  providerMetadata?: Record<string, any>;
  experimental_providerMetadata?: Record<string, any>;
}

export interface ToolCallChunk {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  providerMetadata?: Record<string, any>;
  experimental_providerMetadata?: Record<string, any>;
}

export interface FinishChunk {
  type: 'finish';
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  providerMetadata?: Record<string, any>;
  experimental_providerMetadata?: Record<string, any>;
}

export interface ErrorChunk {
  type: 'error';
  error: Error;
  providerMetadata?: Record<string, any>;
  experimental_providerMetadata?: Record<string, any>;
}

export type UnifiedStreamChunk =
  | TextDeltaChunk
  | ToolCallChunk
  | FinishChunk
  | ErrorChunk;

// Type guards for stream processing
function isTextDeltaChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): chunk is TextDeltaChunk {
  return chunk.type === 'text-delta' && 'textDelta' in chunk;
}

function isToolCallChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): chunk is ToolCallChunk {
  return chunk.type === 'tool-call' && 'toolCallId' in chunk;
}

function isFinishChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): chunk is FinishChunk {
  return chunk.type === 'finish' && 'finishReason' in chunk;
}

function isErrorChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): chunk is ErrorChunk {
  return chunk.type === 'error' && 'error' in chunk;
}

// Safe content extraction utilities
function extractTextFromChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): string {
  if (isTextDeltaChunkImpl(chunk)) {
    return chunk.textDelta;
  }
  if ('text' in chunk && typeof chunk.text === 'string') {
    return chunk.text;
  }
  return '';
}

function extractMetadataFromChunkImpl(
  chunk: UnifiedStreamChunk | TextStreamPart<any>
): Record<string, any> {
  const metadata: Record<string, any> = {};

  if ('providerMetadata' in chunk && chunk.providerMetadata) {
    Object.assign(metadata, chunk.providerMetadata);
  }

  if (
    'experimental_providerMetadata' in chunk &&
    chunk.experimental_providerMetadata
  ) {
    Object.assign(metadata, chunk.experimental_providerMetadata);
  }

  return metadata;
}

// Unified transform configuration types
export interface UnifiedTransformConfig {
  enabled: boolean;
  debug?: boolean;
  metadata?: Record<string, any>;
}

export interface CompressionTransformConfig extends UnifiedTransformConfig {
  threshold: number;
  algorithm: 'gzip' | 'deflate' | 'brotli';
  level: number;
}

export interface MetricsTransformConfig extends UnifiedTransformConfig {
  collectTokenMetrics: boolean;
  collectPerformanceMetrics: boolean;
  collectQualityMetrics: boolean;
  sampleRate: number;
}

export interface DebugTransformConfig extends UnifiedTransformConfig {
  logLevel: 'info' | 'debug' | 'trace';
  includeContent: boolean;
  includeMetadata: boolean;
  outputFormat: 'console' | 'file' | 'callback';
  callback?: (event: DebugEvent) => void;
}

export interface FilterTransformConfig extends UnifiedTransformConfig {
  filters: Array<{
    type: 'content' | 'metadata' | 'tool-call';
    pattern: string | RegExp;
    action: 'remove' | 'replace' | 'modify';
    replacement?: string;
    modifier?: (content: string) => string;
  }>;
}

export interface ProgressTransformConfig extends UnifiedTransformConfig {
  onProgress?: (progress: StreamProgress) => void;
  trackTokens?: boolean;
  trackLatency?: boolean;
  estimateCompletion?: boolean;
}

// Progress tracking types
export interface StreamProgress {
  phase: 'starting' | 'streaming' | 'tool-calling' | 'finishing' | 'complete';
  tokens: {
    current: number;
    estimated?: number;
    rate?: number; // tokens per second
  };
  timing: {
    startTime: number;
    currentTime: number;
    elapsedMs: number;
    estimatedTotalMs?: number;
  };
  chunks: {
    received: number;
    errors: number;
  };
  quality?: {
    coherence?: number;
    completeness?: number;
  };
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

// Streaming options and configuration
export interface UnifiedStreamOptions<TOOLS extends ToolSet = {}> {
  model?: string | LanguageModel;
  tools?: TOOLS;
  activeTools?: string[];
  transforms?: StreamTextTransform<TOOLS>[];
  preset?: 'performance' | 'development' | 'production' | 'smooth';
  
  // Transform configurations
  compressionConfig?: CompressionTransformConfig;
  metricsConfig?: MetricsTransformConfig;
  debugConfig?: DebugTransformConfig;
  filterConfig?: FilterTransformConfig;
  progressConfig?: ProgressTransformConfig;
  
  // Callbacks
  onChunk?: (chunk: TextStreamPart<TOOLS>) => void;
  onProgress?: (progress: StreamProgress) => void;
  onError?: (error: any) => void;
  onComplete?: (result: any) => void;
  
  // Advanced options
  smoothing?: {
    enabled: boolean;
    chunking?: 'word' | 'line' | RegExp;
    delayMs?: number;
  };
  
  experimental?: {
    enableOutput?: boolean;
    outputSchema?: z.ZodSchema<any>;
    enableSteps?: boolean;
    maxSteps?: number;
    stopConditions?: StopCondition<TOOLS>[];
  };
}

// Generation options for unified interface
export interface UnifiedGenerationOptions<T = any> {
  model?: string | LanguageModel;
  tools?: Record<string, any>;
  maxSteps?: number;
  stopConditions?: StopCondition<any>[];
  
  // Output options
  outputType?: 'text' | 'object';
  schema?: z.ZodSchema<T>;
  
  // Error handling
  maxRetries?: number;
  repairAttempts?: number;
  
  // Enhancement options
  enhancePrompt?: {
    level?: 'minimal' | 'moderate' | 'aggressive';
    includeExamples?: boolean;
  };
  
  // Context management
  contextManagement?: {
    maxContextTokens?: number;
    priorityOrder?: 'newest' | 'oldest' | 'relevant';
  };
  
  // Telemetry
  telemetry?: {
    enabled?: boolean;
    namespace?: string;
  };
}

/**
 * Advanced Transform Implementations
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
          const textContent = extractTextFromChunkImpl(chunk);
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

            const existingMetadata = extractMetadataFromChunkImpl(chunk);
            controller.enqueue({
              ...chunk,
              providerMetadata: {
                ...existingMetadata,
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
          const textContent = extractTextFromChunkImpl(chunk);
          tokenCount += textContent.split(/\s+/).length;
          totalSize += new TextEncoder().encode(textContent).length;
        }

        const existingMetadata = extractMetadataFromChunkImpl(chunk);
        const enhancedChunk = {
          ...chunk,
          providerMetadata: {
            ...existingMetadata,
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
          (config.logLevel === 'info' && ['tool-call', 'error'].includes(event.type))
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
          const textDelta = extractTextFromChunkImpl(chunk);
          debugEvent.content = textDelta;
          debugEvent.performance = {
            duration: 0,
            tokenCount: textDelta.split(/\s+/).length,
            chunkSize: new TextEncoder().encode(textDelta).length,
          };
        }

        logEvent(debugEvent);
        controller.enqueue(chunk);
      },
    });
  };
}

export function createFilterTransform<TOOLS extends ToolSet>(
  config: FilterTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        let processedChunk = { ...chunk };
        let contentModified = false;

        if (chunk.type === 'text-delta') {
          let content = extractTextFromChunkImpl(chunk);

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
                    content = content.replace(pattern, filter.replacement ?? '');
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
            } as TextStreamPart<TOOLS>;
          }
        }

        if (processedChunk.type === 'text-delta' && !extractTextFromChunkImpl(processedChunk)) {
          return; // Skip empty chunks
        }

        controller.enqueue(processedChunk);
      },
    });
  };
}

export function createProgressTransform<TOOLS extends ToolSet>(
  config: ProgressTransformConfig
): StreamTextTransform<TOOLS> {
  return ({ stopStream }) => {
    const startTime = performance.now();
    let tokenCount = 0;
    let chunkCount = 0;
    let errorCount = 0;

    const progress: StreamProgress = {
      phase: 'starting',
      tokens: { current: 0 },
      timing: { startTime, currentTime: startTime, elapsedMs: 0 },
      chunks: { received: 0, errors: 0 },
    };

    const updateProgress = () => {
      const now = performance.now();
      progress.timing.currentTime = now;
      progress.timing.elapsedMs = now - startTime;
      progress.tokens.current = tokenCount;
      progress.chunks.received = chunkCount;
      progress.chunks.errors = errorCount;

      if (config.trackTokens && progress.timing.elapsedMs > 1000) {
        progress.tokens.rate = tokenCount / (progress.timing.elapsedMs / 1000);
      }

      config.onProgress?.(progress);
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      start() {
        progress.phase = 'streaming';
        updateProgress();
      },
      transform(chunk, controller) {
        chunkCount++;

        if (chunk.type === 'text-delta') {
          const textContent = extractTextFromChunkImpl(chunk);
          tokenCount += config.trackTokens ? textContent.split(/\s+/).length : 0;
        } else if (chunk.type === 'tool-call') {
          progress.phase = 'tool-calling';
        } else if (chunk.type === 'error') {
          errorCount++;
        } else if (chunk.type === 'finish') {
          progress.phase = 'complete';
        }

        updateProgress();
        controller.enqueue(chunk);
      },
      flush() {
        progress.phase = 'complete';
        updateProgress();
      },
    });
  };
}

/**
 * Unified Streaming System
 * Consolidates streaming functionality with experimental features
 */
export class UnifiedStreamingSystem {
  private static instance: UnifiedStreamingSystem;

  private constructor() {}

  static getInstance(): UnifiedStreamingSystem {
    if (!UnifiedStreamingSystem.instance) {
      UnifiedStreamingSystem.instance = new UnifiedStreamingSystem();
    }
    return UnifiedStreamingSystem.instance;
  }

  /**
   * Stream text with unified configuration and transforms
   */
  async streamText<TOOLS extends ToolSet = {}>(
    prompt: string,
    options: UnifiedStreamOptions<TOOLS> = {}
  ) {
    const model = await this.resolveModel(options.model);
    let transforms: StreamTextTransform<TOOLS>[] = [];

    // Apply preset transforms
    if (options.preset) {
      transforms = this.getTransformPreset(options.preset);
    }

    // Add custom transforms
    if (options.transforms) {
      transforms.push(...options.transforms);
    }

    // Add configuration-based transforms
    if (options.compressionConfig?.enabled) {
      transforms.push(createCompressionTransform(options.compressionConfig));
    }

    if (options.metricsConfig?.enabled) {
      transforms.push(createMetricsTransform(options.metricsConfig));
    }

    if (options.debugConfig?.enabled) {
      transforms.push(createDebugTransform(options.debugConfig));
    }

    if (options.filterConfig?.enabled) {
      transforms.push(createFilterTransform(options.filterConfig));
    }

    if (options.progressConfig?.enabled) {
      transforms.push(createProgressTransform(options.progressConfig));
    }

    // Add smoothing if enabled
    if (options.smoothing?.enabled) {
      const smoothConfig = {
        ...(options.smoothing.chunking && { chunking: options.smoothing.chunking }),
        ...(options.smoothing.delayMs && { delayInMs: options.smoothing.delayMs }),
      };
      transforms.push(smoothStream(smoothConfig));
    }

    try {
      const stream = await streamText({
        model,
        prompt,
        tools: options.tools,
        activeTools: options.activeTools as any,
        experimental_transform: transforms.length > 0 ? transforms : undefined,
        experimental_output: options.experimental?.enableOutput && options.experimental.outputSchema
          ? Output.object({ schema: options.experimental.outputSchema })
          : undefined,
        stopWhen: options.experimental?.stopConditions,
        onChunk: options.onChunk as any,
        onFinish: (result) => options.onComplete?.(result),
      });

      return stream;
    } catch (error) {
      const errorInfo = unifiedErrorSystem.handleError(error, { prompt, options });
      options.onError?.(errorInfo);
      throw error;
    }
  }

  /**
   * Generate text with unified options and error handling
   */
  async generateText<T = any>(
    prompt: string,
    options: UnifiedGenerationOptions<T> = {}
  ): Promise<any> {
    const model = await this.resolveModel(options.model);

    try {
      // Handle object generation
      if (options.outputType === 'object' && options.schema) {
        return await this.generateObjectWithRepair(model, prompt, options.schema, options);
      }

      // Handle enhanced prompts
      const enhancedPrompt = options.enhancePrompt 
        ? this.enhancePrompt(prompt, options.enhancePrompt)
        : prompt;

      // Generate with context management
      const finalPrompt = options.contextManagement
        ? this.applyContextManagement(enhancedPrompt, options.contextManagement)
        : enhancedPrompt;

      const result = await generateText({
        model,
        prompt: finalPrompt,
        tools: options.tools,
        stopWhen: options.stopConditions,
        experimental_telemetry: options.telemetry?.enabled ? {
          isEnabled: true,
          tracer: {
            resource: {
              serviceName: 'unified-streaming-system',
              namespace: options.telemetry.namespace || 'default',
            },
          },
        } as any : undefined,
      });

      return result;
    } catch (error) {
      if (options.maxRetries && options.maxRetries > 0) {
        return await unifiedErrorSystem.executeWithRetry(
          () => this.generateText(prompt, { ...options, maxRetries: 0 }),
          { prompt, options },
          { maxRetries: options.maxRetries }
        );
      }
      throw error;
    }
  }

  /**
   * Generate object with repair functionality
   */
  async generateObjectWithRepair<T>(
    model: LanguageModel,
    prompt: string,
    schema: z.ZodSchema<T>,
    options: UnifiedGenerationOptions<T>
  ): Promise<any> {
    const maxAttempts = options.repairAttempts || 3;
    let attempt = 0;
    let enhancedPrompt = prompt;

    while (attempt < maxAttempts) {
      try {
        return await generateObject({
          model,
          schema: schema as any,
          prompt: enhancedPrompt,
        });
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(
            `Failed to generate valid object after ${maxAttempts} attempts: ${error}`
          );
        }

        enhancedPrompt = `${enhancedPrompt}\n\nIMPORTANT: Return ONLY valid JSON matching the schema. No additional text or explanation.`;
      }
    }

    throw new Error('Failed to generate object');
  }

  /**
   * Stream with structured output and partial updates
   */
  async streamStructuredOutput<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: UnifiedStreamOptions = {}
  ) {
    const model = await this.resolveModel(options.model);
    const output = Output.object({ schema });

    const stream = await streamText({
      model,
      prompt,
      experimental_output: output,
    });

    // Handle partial output stream if available
    if ('experimental_partialOutputStream' in stream && options.onProgress) {
      (async () => {
        for await (const partialOutput of stream.experimental_partialOutputStream!) {
          options.onProgress?.({
            phase: 'streaming',
            tokens: { current: 0 },
            timing: { 
              startTime: performance.now(), 
              currentTime: performance.now(), 
              elapsedMs: 0 
            },
            chunks: { received: 0, errors: 0 },
          });
        }
      })();
    }

    return stream;
  }

  /**
   * Batch processing with optimized streaming
   */
  async streamBatch(
    prompts: string[],
    options: UnifiedStreamOptions & {
      batchSize?: number;
      delayBetweenBatches?: number;
      onBatchComplete?: (batchIndex: number, results: any[]) => void;
    } = {}
  ) {
    const batchSize = options.batchSize || 5;
    const delay = options.delayBetweenBatches || 100;
    const results: any[] = [];

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      const batchPromises = batch.map(async (prompt) => {
        try {
          return await this.streamText(prompt, options);
        } catch (error) {
          console.warn(`Batch stream failed for prompt:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      options.onBatchComplete?.(batchIndex, batchResults);

      if (i + batchSize < prompts.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Get transform presets
   */
  public getTransformPreset<TOOLS extends ToolSet>(
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
   * Resolve model from string or LanguageModel
   */
  private async resolveModel(model?: string | LanguageModel): Promise<LanguageModel> {
    if (!model) {
      return await unifiedProviderSystem.getEnhancedModel({ task: 'chat', priority: 'speed' });
    }

    if (typeof model === 'string') {
      return await unifiedProviderSystem.getEnhancedModel({ 
        modelId: model,
        fallbackEnabled: true 
      });
    }

    return model;
  }

  /**
   * Enhance prompts with additional instructions
   */
  private enhancePrompt(
    basePrompt: string,
    options: { level?: 'minimal' | 'moderate' | 'aggressive'; includeExamples?: boolean }
  ): string {
    const level = options.level || 'moderate';
    let enhancedPrompt = basePrompt;

    if (level !== 'minimal') {
      enhancedPrompt = `Task: ${basePrompt}\n\nPlease provide a clear, detailed response.`;
    }

    if (level === 'aggressive') {
      enhancedPrompt += '\n\nStructure your response with:\n1. Overview\n2. Details\n3. Summary';
    }

    if (options.includeExamples) {
      enhancedPrompt += '\n\nProvide concrete examples where applicable.';
    }

    return enhancedPrompt;
  }

  /**
   * Apply context management to prompts
   */
  private applyContextManagement(
    prompt: string,
    options: { maxContextTokens?: number; priorityOrder?: 'newest' | 'oldest' | 'relevant' }
  ): string {
    // Simplified context management - in practice would be more sophisticated
    return prompt;
  }
}

// Export singleton instance
export const unifiedStreamingSystem = UnifiedStreamingSystem.getInstance();

// Convenience functions
export async function streamWithTransforms<TOOLS extends ToolSet = {}>(
  prompt: string,
  options: UnifiedStreamOptions<TOOLS> = {}
) {
  return unifiedStreamingSystem.streamText(prompt, options);
}

export async function generateWithRetry<T = any>(
  prompt: string,
  options: UnifiedGenerationOptions<T> = {}
) {
  return unifiedStreamingSystem.generateText(prompt, options);
}

export async function streamStructured<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: UnifiedStreamOptions = {}
) {
  return unifiedStreamingSystem.streamStructuredOutput(prompt, schema, options);
}

// Transform presets for easy access
export const transformPresets = {
  performance: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => 
    unifiedStreamingSystem.getTransformPreset('performance'),
    
  development: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => 
    unifiedStreamingSystem.getTransformPreset('development'),
    
  production: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => 
    unifiedStreamingSystem.getTransformPreset('production'),
    
  smooth: <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS>[] => 
    unifiedStreamingSystem.getTransformPreset('smooth'),
};

// Export utility functions with proper names
export const extractTextFromChunk = extractTextFromChunkImpl;
export const extractMetadataFromChunk = extractMetadataFromChunkImpl;
export const isTextDeltaChunk = isTextDeltaChunkImpl;
export const isToolCallChunk = isToolCallChunkImpl;
export const isFinishChunk = isFinishChunkImpl;
export const isErrorChunk = isErrorChunkImpl;