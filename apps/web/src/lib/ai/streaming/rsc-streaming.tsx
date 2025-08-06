import { openai } from '@ai-sdk/openai';
import {
  createStreamableUI,
  createStreamableValue,
  type StreamableValue,
  streamUI,
} from '@ai-sdk/rsc';
import type { Tool } from 'ai';
import type { ReactNode } from 'react';
import { z } from 'zod';
import {
  type PrepareStepFunction,
  usePrepareStep,
} from '../../hooks/use-prepare-step';
import { getAIModel } from '../core/providers';

// Type definitions for RSC streaming with proper AI SDK v5 constraints
export interface StreamableArtifact {
  id: string;
  type: 'code' | 'document' | 'chart' | 'data' | 'image';
  status: 'streaming' | 'complete' | 'error';
  content: any;
  metadata?: Record<string, any>;
}

// AI SDK v5 compatible streaming types
export interface StreamableToolResult {
  status: string;
  artifactId?: string;
  type?: string;
  title?: string;
  created?: boolean;
  updated?: boolean;
  validating?: boolean;
  message?: string;
}

// Status wrapper component for streaming tools
const ToolStatusIndicator = ({ 
  status, 
  message, 
  validating 
}: { 
  status?: string; 
  message?: string; 
  validating?: boolean; 
}): ReactNode => {
  if (validating) {
    return <LoadingIndicator message="Validating data..." />;
  }
  if (status === 'executing') {
    return <LoadingIndicator message={message || 'Executing tool...'} />;
  }
  if (status === 'processing') {
    return <LoadingIndicator message={message || 'Processing output...'} />;
  }
  return null;
};

// Proper AsyncGenerator type for streaming tools compatible with AI SDK v5
export type StreamingToolGenerator<TResult = any> = AsyncGenerator<
  ReactNode, 
  TResult, 
  void
>;

// AI SDK v5 Streamable compatibility wrapper and type guards
export type StreamableCompatible<T> = T extends ReactNode
  ? T
  : StreamableValue<T>;

// Type guard for StreamableValue
export function isStreamableValue<T>(value: any): value is StreamableValue<T> {
  return (
    value &&
    typeof value === 'object' &&
    'value' in value &&
    'update' in value &&
    'done' in value
  );
}

// Type guard for ReactNode that ensures non-undefined values
export function isValidReactNode(value: any): value is NonNullable<ReactNode> {
  return value !== null && value !== undefined;
}

// Safe streamable value creation with proper type constraints
export function createSafeStreamableValue<T>(initialValue?: T): {
  stream: StreamableValue<T>;
  update: (value: T) => void;
  done: (finalValue?: T) => void;
  error: (error: Error) => void;
} {
  const streamable = createStreamableValue<T>(initialValue);

  return {
    stream: streamable.value,
    update: (value: T) => {
      if (value !== null && value !== undefined) {
        streamable.update(value);
      }
    },
    done: (finalValue?: T) => {
      if (finalValue !== null && finalValue !== undefined) {
        streamable.update(finalValue);
      }
      streamable.done();
    },
    error: (error: Error) => {
      streamable.error(error);
    },
  };
}

// Enhanced streaming options with AI SDK v5 constraints
export interface EnhancedStreamingOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> extends StreamingOptions<TOOLS> {
  streamable?: boolean;
  enableStreamableUI?: boolean;
  streamableTimeout?: number;
  streamableBufferSize?: number;
}

export interface StreamingOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  onProgress?: (progress: number) => void;
  onPartial?: (content: any) => void;

  // PrepareStep integration
  tools?: TOOLS;
  prepareStep?: PrepareStepFunction<TOOLS>;
  enableIntelligentStepping?: boolean;
  stepAnalysisDebug?: boolean;
}

// Component interfaces for streaming UI
export interface ArtifactPreviewProps {
  content: string;
  type?: string;
  streaming?: boolean;
}

export interface ArtifactViewerProps {
  type: string;
  content: any;
  metadata?: Record<string, any>;
}

// Placeholder components - these would be actual React components in a real implementation
const ArtifactPreview = ({
  content,
  type,
  streaming,
}: ArtifactPreviewProps): ReactNode => {
  // This would be an actual React component
  return null as any;
};

const ArtifactViewer = ({
  type,
  content,
  metadata,
}: ArtifactViewerProps): ReactNode => {
  // This would be an actual React component
  return null as any;
};

const LoadingIndicator = ({ message }: { message: string }): ReactNode => {
  // This would be an actual React component
  return null as any;
};

const ErrorDisplay = ({ error }: { error: string }): ReactNode => {
  // This would be an actual React component
  return null as any;
};

const StatusComponent = ({
  status,
  message,
}: {
  status: string;
  message?: string;
}): ReactNode => {
  // This would be an actual React component for status updates
  return null as any;
};

const ProgressComponent = ({
  progress,
  validating,
}: {
  progress?: string;
  validating?: boolean;
}): ReactNode => {
  // This would be an actual React component for progress updates
  return null as any;
};

const SuccessComponent = ({
  message,
  artifactId,
  type,
  title,
  created,
  updated,
  generated,
  data,
}: {
  message?: string;
  artifactId?: string;
  type?: string;
  title?: string;
  created?: boolean;
  updated?: boolean;
  generated?: boolean;
  data?: any;
}): ReactNode => {
  // This would be an actual React component for success states
  return null as any;
};

/**
 * Stream artifact generation with real-time UI updates
 */
export async function streamingArtifactGeneration<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
>(prompt: string, options: StreamingOptions<TOOLS> = {}) {
  const streamableUI = createStreamableUI();

  // Show initial loading state
  streamableUI.update(
    <LoadingIndicator message="Processing your request..." />
  );

  // Create intelligent prepareStep function if enabled
  const prepareStepFunction =
    options.prepareStep ??
    (options.enableIntelligentStepping
      ? ({ steps, stepNumber, model, messages }) => {
          const isArtifactGeneration = messages.some(
            (m) =>
              typeof m.content === 'string' &&
              (m.content.includes('create') ||
                m.content.includes('generate') ||
                m.content.includes('build'))
          );

          if (isArtifactGeneration && stepNumber === 0) {
            return {
              temperature: 0.4,
              maxOutputTokens: 4096,
              system:
                'You are an expert content creator. Generate high-quality, detailed artifacts with proper structure and formatting.',
            };
          }

          return;
        }
      : undefined);

  try {
    const result = await streamUI({
      model: getAIModel(options.model),
      prompt,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (done) {
          const finalPreview = (
            <ArtifactPreview content={content} streaming={false} />
          );
          streamableUI.done(finalPreview);
          return finalPreview;
        }
        const preview = <ArtifactPreview content={content} streaming={true} />;
        streamableUI.update(preview);
        options.onPartial?.(content);
        return preview;
      },
      tools: {
        createArtifact: {
          description: 'Create an interactive artifact',
          inputSchema: z.object({
            type: z.enum(['code', 'document', 'chart', 'data', 'image']),
            title: z.string(),
            content: z.string(),
            language: z.string().optional(),
            metadata: z.record(z.string(), z.any()).optional(),
          }),
          async *generate({
            type,
            title,
            content,
            language,
            metadata,
          }: {
            type: string;
            title: string;
            content: string;
            language?: string;
            metadata?: Record<string, any>;
          }): StreamingToolGenerator {
            // Stream the artifact creation process
            streamableUI.update(
              <LoadingIndicator
                message={`Creating ${type} artifact: ${title}...`}
              />
            );

            yield <LoadingIndicator message="Validating content..." />;

            // Simulate processing steps
            yield <LoadingIndicator message="Formatting artifact..." />;

            // Create the artifact ID and prepare final result
            const artifactId = `artifact_${Date.now()}`;

            // Final artifact
            const finalArtifact = (
              <ArtifactViewer
                content={content}
                metadata={{
                  ...metadata,
                  title,
                  language,
                  artifactId,
                  created: true,
                }}
                type={type}
              />
            );

            streamableUI.done(finalArtifact);

            // Return the final artifact component (Streamable)
            return finalArtifact;
          },
        },
        updateArtifact: {
          description: 'Update an existing artifact',
          inputSchema: z.object({
            artifactId: z.string(),
            updates: z.object({
              content: z.string().optional(),
              metadata: z.record(z.string(), z.any()).optional(),
            }),
          }),
          async *generate({
            artifactId,
            updates,
          }: {
            artifactId: string;
            updates: { content?: string; metadata?: Record<string, any> };
          }): StreamingToolGenerator {
            streamableUI.update(
              <LoadingIndicator message="Updating artifact..." />
            );

            yield (
              <LoadingIndicator
                message={`Updating artifact ${artifactId}...`}
              />
            );

            // In a real implementation, this would update the actual artifact
            const updatedArtifact = (
              <ArtifactViewer
                content={updates.content || 'Updated content'}
                metadata={{ artifactId, ...updates.metadata, updated: true }}
                type="updated"
              />
            );

            streamableUI.done(updatedArtifact);

            // Return the updated artifact component (Streamable)
            return updatedArtifact;
          },
        },
      },
    });

    return streamableUI.value;
  } catch (error) {
    streamableUI.done(
      <ErrorDisplay
        error={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
    throw error;
  }
}

/**
 * Create streamable values for progressive data loading with AI SDK v5 compatibility
 */
export function createProgressiveDataStream<T>(): {
  stream: StreamableValue<T>;
  update: (value: Partial<T>) => void;
  append: (value: Partial<T>) => void;
  done: (finalValue?: T) => void;
  error: (error: Error) => void;
  value: StreamableValue<T>;
} {
  const stream = createStreamableValue<T>();

  return {
    stream: stream.value,
    update: (value: Partial<T>) => {
      stream.update(value as T);
    },
    append: (value: Partial<T>) => {
      stream.append(value as T);
    },
    done: (finalValue?: T) => {
      if (finalValue) {
        stream.update(finalValue);
      }
      stream.done();
    },
    error: (error: Error) => {
      stream.error(error);
    },
    value: stream.value,
  };
}

/**
 * Enhanced error handling and stream recovery with comprehensive type safety
 */
export interface StreamErrorBoundary<TFallback = any> {
  maxRetries: number;
  retryDelay: number;
  fallbackResponse?: TFallback;
  onError?: (
    error: StreamingError,
    retryCount: number,
    context: ErrorContext
  ) => void | Promise<void>;
  onRecovery?: (
    error: StreamingError,
    context: RecoveryContext
  ) => void | Promise<void>;
  onFinalFailure?: (
    error: StreamingError,
    context: ErrorContext
  ) => void | Promise<void>;
  shouldRetry?: (error: StreamingError, retryCount: number) => boolean;
  retryStrategy?: 'exponential' | 'linear' | 'custom';
  customRetryDelay?: (retryCount: number, baseDelay: number) => number;
}

// Enhanced streaming error types
export class StreamingError extends Error {
  constructor(
    message: string,
    public readonly code: StreamingErrorCode,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StreamingError';
  }
}

export type StreamingErrorCode =
  | 'STREAM_TIMEOUT'
  | 'STREAM_INTERRUPTED'
  | 'STREAM_INVALID_DATA'
  | 'STREAM_NETWORK_ERROR'
  | 'STREAM_QUOTA_EXCEEDED'
  | 'STREAM_AUTHENTICATION_ERROR'
  | 'STREAM_RATE_LIMITED'
  | 'STREAM_SERVER_ERROR'
  | 'STREAM_CLIENT_ERROR'
  | 'STREAM_UNKNOWN_ERROR';

export interface ErrorContext {
  streamId?: string;
  executionId?: string;
  toolName?: string;
  timestamp: number;
  retryCount: number;
  previousErrors?: StreamingError[];
  metadata?: Record<string, any>;
}

export interface RecoveryContext extends ErrorContext {
  recoveryMethod: 'retry' | 'fallback' | 'skip';
  recoveryAttempts: number;
}

export async function withStreamErrorBoundary<T>(
  streamFunction: () => Promise<T>,
  errorBoundary: StreamErrorBoundary<T>,
  context?: Partial<ErrorContext>
): Promise<T> {
  let retryCount = 0;
  const previousErrors: StreamingError[] = [];
  const startTime = Date.now();

  while (retryCount <= errorBoundary.maxRetries) {
    try {
      return await streamFunction();
    } catch (originalError) {
      // Convert to StreamingError with proper classification
      const streamingError = classifyStreamingError(originalError);
      const errorContext: ErrorContext = {
        ...context,
        timestamp: Date.now(),
        retryCount,
        previousErrors: [...previousErrors],
        metadata: {
          ...context?.metadata,
          totalElapsed: Date.now() - startTime,
          originalErrorType: originalError?.constructor?.name,
        },
      };

      previousErrors.push(streamingError);

      // Check if should retry
      const shouldRetry = errorBoundary.shouldRetry
        ? errorBoundary.shouldRetry(streamingError, retryCount)
        : isRetryableError(streamingError);

      // Notify error handler
      try {
        await errorBoundary.onError?.(streamingError, retryCount, errorContext);
      } catch (handlerError) {
        console.warn('Error handler threw exception:', handlerError);
      }

      // Final retry attempt or non-retryable error
      if (retryCount >= errorBoundary.maxRetries || !shouldRetry) {
        if (errorBoundary.fallbackResponse !== undefined) {
          const recoveryContext: RecoveryContext = {
            ...errorContext,
            recoveryMethod: 'fallback',
            recoveryAttempts: 1,
          };

          try {
            await errorBoundary.onRecovery?.(streamingError, recoveryContext);
          } catch (recoveryError) {
            console.warn('Recovery handler threw exception:', recoveryError);
          }

          return errorBoundary.fallbackResponse;
        }

        // Notify final failure
        try {
          await errorBoundary.onFinalFailure?.(streamingError, errorContext);
        } catch (finalFailureError) {
          console.warn(
            'Final failure handler threw exception:',
            finalFailureError
          );
        }

        throw streamingError;
      }

      // Calculate retry delay
      let delay: number;
      if (errorBoundary.customRetryDelay) {
        delay = errorBoundary.customRetryDelay(
          retryCount,
          errorBoundary.retryDelay
        );
      } else {
        switch (errorBoundary.retryStrategy || 'exponential') {
          case 'exponential':
            delay = errorBoundary.retryDelay * 2 ** retryCount;
            break;
          case 'linear':
            delay = errorBoundary.retryDelay * (retryCount + 1);
            break;
          case 'custom':
            delay = errorBoundary.retryDelay;
            break;
          default:
            delay = errorBoundary.retryDelay * 2 ** retryCount;
        }
      }

      // Add jitter to prevent thundering herd
      const jitter = delay * 0.1 * Math.random();
      const finalDelay = Math.min(delay + jitter, 60_000); // Cap at 1 minute

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
      retryCount++;
    }
  }

  throw new StreamingError(
    'Unexpected error in stream boundary',
    'STREAM_UNKNOWN_ERROR',
    { retryCount, maxRetries: errorBoundary.maxRetries }
  );
}

/**
 * Classify errors into streaming error types
 */
function classifyStreamingError(error: any): StreamingError {
  if (error instanceof StreamingError) {
    return error;
  }

  const message = error?.message || 'Unknown error';
  const errorString = message.toLowerCase();

  let code: StreamingErrorCode;

  if (errorString.includes('timeout') || errorString.includes('timed out')) {
    code = 'STREAM_TIMEOUT';
  } else if (
    errorString.includes('network') ||
    errorString.includes('connection')
  ) {
    code = 'STREAM_NETWORK_ERROR';
  } else if (
    errorString.includes('rate limit') ||
    errorString.includes('too many requests')
  ) {
    code = 'STREAM_RATE_LIMITED';
  } else if (
    errorString.includes('auth') ||
    errorString.includes('unauthorized')
  ) {
    code = 'STREAM_AUTHENTICATION_ERROR';
  } else if (
    errorString.includes('quota') ||
    errorString.includes('limit exceeded')
  ) {
    code = 'STREAM_QUOTA_EXCEEDED';
  } else if (
    errorString.includes('invalid') ||
    errorString.includes('malformed')
  ) {
    code = 'STREAM_INVALID_DATA';
  } else if (
    errorString.includes('interrupted') ||
    errorString.includes('aborted')
  ) {
    code = 'STREAM_INTERRUPTED';
  } else if (error?.status >= 500) {
    code = 'STREAM_SERVER_ERROR';
  } else if (error?.status >= 400) {
    code = 'STREAM_CLIENT_ERROR';
  } else {
    code = 'STREAM_UNKNOWN_ERROR';
  }

  return new StreamingError(
    message,
    code,
    { originalError: error },
    error instanceof Error ? error : undefined
  );
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: StreamingError): boolean {
  const retryableCodes: StreamingErrorCode[] = [
    'STREAM_TIMEOUT',
    'STREAM_NETWORK_ERROR',
    'STREAM_RATE_LIMITED',
    'STREAM_SERVER_ERROR',
    'STREAM_INTERRUPTED',
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Stream reconnection manager
 */
export class StreamReconnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isReconnecting = false;

  constructor(
    options: {
      maxReconnectAttempts?: number;
      reconnectDelay?: number;
    } = {}
  ) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
  }

  async attemptReconnection(streamFunction: () => Promise<any>): Promise<any> {
    if (this.isReconnecting) {
      throw new Error('Reconnection already in progress');
    }

    this.isReconnecting = true;

    try {
      while (this.reconnectAttempts < this.maxReconnectAttempts) {
        try {
          const result = await streamFunction();
          this.reconnectAttempts = 0; // Reset on success
          this.isReconnecting = false;
          return result;
        } catch (error) {
          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            throw new Error(
              `Failed to reconnect after ${this.maxReconnectAttempts} attempts`
            );
          }

          // Exponential backoff with jitter
          const delay =
            this.reconnectDelay *
            2 ** this.reconnectAttempts *
            (0.5 + Math.random() * 0.5);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  get isCurrentlyReconnecting() {
    return this.isReconnecting;
  }

  get currentAttempts() {
    return this.reconnectAttempts;
  }
}

/**
 * Rate limiting for streaming operations
 */
export class StreamRateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests = 10, timeWindowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Clean old requests
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.checkRateLimit(); // Re-check after waiting
      }
    }

    this.requests.push(now);
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

/**
 * Concurrent stream manager
 */
export class ConcurrentStreamManager {
  private activeStreams = new Map<string, Promise<any>>();
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async executeStream<T>(
    id: string,
    streamFunction: () => Promise<T>,
    options: {
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
    } = {}
  ): Promise<T> {
    // Wait for available slot
    while (this.activeStreams.size >= this.maxConcurrent) {
      await Promise.race(Array.from(this.activeStreams.values()));
    }

    // Add timeout wrapper
    const timeoutMs = options.timeout ?? 30_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Stream ${id} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    );

    const streamPromise = Promise.race([
      streamFunction(),
      timeoutPromise,
    ]).finally(() => {
      this.activeStreams.delete(id);
    });

    this.activeStreams.set(id, streamPromise);

    return streamPromise;
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  async waitForAll(): Promise<void> {
    await Promise.all(this.activeStreams.values());
  }

  cancelStream(id: string): boolean {
    return this.activeStreams.delete(id);
  }
}

/**
 * Stream structured data with progressive rendering and advanced error handling
 * Enhanced with AI SDK v5 Streamable interface compatibility
 */
export async function streamStructuredData<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  options: EnhancedStreamingOptions<any> & {
    errorBoundary?: StreamErrorBoundary<{
      data: StreamableValue<T>;
      ui: StreamableValue<ReactNode>;
    }>;
    rateLimiter?: StreamRateLimiter;
    reconnectionManager?: StreamReconnectionManager;
  } = {}
): Promise<{
  data: StreamableValue<T>;
  ui: ReactNode;
}> {
  const dataStream = createProgressiveDataStream<T>();
  const uiStream = createStreamableUI(
    <LoadingIndicator message="Generating structured data..." />
  );

  try {
    const model = getAIModel(options.model);

    // Stream the generation
    const result = await streamUI({
      model,
      prompt,
      temperature: options.temperature,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (!done) {
          try {
            // Try to parse partial JSON
            const partial = JSON.parse(content);
            dataStream.update(partial);
            return (
              <ArtifactPreview
                content={JSON.stringify(partial, null, 2)}
                streaming={true}
                type="json"
              />
            );
          } catch {
            // If parsing fails, just show raw content
            return <ArtifactPreview content={content} streaming={true} />;
          }
        }
        return null;
      },
      tools: {
        generateStructuredData: {
          description: 'Generate structured data matching the schema',
          inputSchema: schema,
          async *generate(data: T): AsyncGenerator<ReactNode, ReactNode, void> {
            // Yield status components instead of plain objects
            yield <ToolStatusIndicator 
              status="validating" 
              validating={true}
              message="Validating data against schema..."
            />;

            // Validate against schema
            const validation = schema.safeParse(data);
            if (!validation.success) {
              throw new Error(`Validation failed: ${validation.error.message}`);
            }

            dataStream.done(data);
            const finalResult = (
              <ArtifactViewer
                content={data}
                metadata={{ schema: schema._def, generated: true, data }}
                type="data"
              />
            );
            
            uiStream.done(finalResult);

            // Return the final component (Streamable)
            return finalResult;
          },
        },
      },
    });

    return {
      data: dataStream.stream,
      ui: uiStream.value,
    };
  } catch (error) {
    dataStream.error(error as Error);
    uiStream.done(
      <ErrorDisplay
        error={error instanceof Error ? error.message : 'Generation failed'}
      />
    );
    throw error;
  }
}

/**
 * Optimistic UI updates for streaming operations
 */
export class OptimisticUpdateManager<T = any> {
  private updates = new Map<string, T>();
  private callbacks = new Map<string, (data: T) => void>();

  addOptimisticUpdate(
    id: string,
    data: T,
    onConfirm?: (data: T) => void
  ): void {
    this.updates.set(id, data);
    if (onConfirm) {
      this.callbacks.set(id, onConfirm);
    }
  }

  confirmUpdate(id: string, finalData?: T): void {
    const optimisticData = this.updates.get(id);
    const callback = this.callbacks.get(id);

    if (callback && (finalData ?? optimisticData)) {
      callback(finalData ?? optimisticData!);
    }

    this.updates.delete(id);
    this.callbacks.delete(id);
  }

  rollbackUpdate(id: string): void {
    this.updates.delete(id);
    this.callbacks.delete(id);
  }

  getOptimisticData(id: string): T | undefined {
    return this.updates.get(id);
  }

  getAllOptimisticUpdates(): Map<string, T> {
    return new Map(this.updates);
  }
}

/**
 * Stream compression for large data sets
 */
export class StreamCompressor {
  private compressionRatio: number;

  constructor(compressionRatio = 0.7) {
    this.compressionRatio = compressionRatio;
  }

  async compressStream<T>(
    data: T[],
    keySelector: (item: T) => string = (item) => JSON.stringify(item)
  ): Promise<T[]> {
    if (data.length === 0) return data;

    const targetSize = Math.ceil(data.length * this.compressionRatio);
    if (targetSize >= data.length) return data;

    // Use sampling strategy to reduce data size
    const step = Math.ceil(data.length / targetSize);
    const compressed: T[] = [];

    for (let i = 0; i < data.length; i += step) {
      compressed.push(data[i]);
    }

    // Always include the last item
    if (compressed[compressed.length - 1] !== data[data.length - 1]) {
      compressed.push(data[data.length - 1]);
    }

    return compressed;
  }

  async decompressStream<T>(compressedData: T[]): Promise<T[]> {
    // For this implementation, decompression is just returning the data
    // In a real scenario, you might interpolate or fetch missing data
    return compressedData;
  }
}

/**
 * Memory-efficient streaming for large datasets
 */
export class MemoryEfficientStreamer<T> {
  private chunkSize: number;
  private maxMemoryUsage: number;
  private currentMemoryUsage = 0;

  constructor(chunkSize = 100, maxMemoryUsageMB = 50) {
    this.chunkSize = chunkSize;
    this.maxMemoryUsage = maxMemoryUsageMB * 1024 * 1024; // Convert to bytes
  }

  async *streamLargeDataset(
    dataGenerator: () => AsyncGenerator<T>,
    estimateItemSize: (item: T) => number = () => 1024 // Default 1KB per item
  ): AsyncGenerator<T[]> {
    const buffer: T[] = [];
    let bufferSize = 0;

    for await (const item of dataGenerator()) {
      const itemSize = estimateItemSize(item);

      // Check memory limits
      if (
        this.currentMemoryUsage + itemSize > this.maxMemoryUsage &&
        buffer.length > 0
      ) {
        yield [...buffer];
        buffer.length = 0;
        bufferSize = 0;
        this.currentMemoryUsage = 0;
      }

      buffer.push(item);
      bufferSize += itemSize;
      this.currentMemoryUsage += itemSize;

      // Yield chunks when buffer is full
      if (buffer.length >= this.chunkSize) {
        yield [...buffer];
        buffer.length = 0;
        bufferSize = 0;
        this.currentMemoryUsage = 0;
      }
    }

    // Yield remaining items
    if (buffer.length > 0) {
      yield buffer;
    }
  }
}

/**
 * Stream workflow execution with advanced error handling and optimistic updates
 */
export async function streamWorkflowExecution(
  workflow: {
    name: string;
    steps: Array<{
      id: string;
      description: string;
      action: () => Promise<any>;
      retryable?: boolean;
      timeout?: number;
    }>;
  },
  options: StreamingOptions<any> & {
    errorBoundary?: StreamErrorBoundary<{
      results: StreamableValue<any[]>;
      progress: StreamableValue<number>;
      ui: StreamableValue<ReactNode>;
    }>;
    optimisticUpdates?: boolean;
    rateLimiter?: StreamRateLimiter;
    concurrentManager?: ConcurrentStreamManager;
  } = {}
): Promise<{
  results: StreamableValue<any[]>;
  progress: StreamableValue<number>;
  ui: ReactNode;
}> {
  const uiStream = createStreamableUI(
    <LoadingIndicator message={`Starting workflow: ${workflow.name}`} />
  );
  const progressStream = createStreamableValue<number>();
  const resultsStream = createStreamableValue<any[]>();

  const totalSteps = workflow.steps.length;
  const results: any[] = [];

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const progress = ((i + 1) / totalSteps) * 100;

      // Update progress
      progressStream.update(progress);
      options.onProgress?.(progress);

      // Update UI for current step
      uiStream.update(
        <div>
          <LoadingIndicator
            message={`Step ${i + 1}/${totalSteps}: ${step.description}`}
          />
          <div>Progress: {progress.toFixed(0)}%</div>
        </div>
      );

      // Execute step
      try {
        const result = await step.action();
        results.push({ stepId: step.id, result, success: true });
        resultsStream.append(results);
      } catch (error) {
        results.push({
          stepId: step.id,
          error: error instanceof Error ? error.message : 'Step failed',
          success: false,
        });
        resultsStream.append(results);

        // Continue or fail based on workflow configuration
        if (options.model === 'strict') {
          throw error;
        }
      }
    }

    // Complete streams
    progressStream.done();
    resultsStream.done();

    // Final UI
    uiStream.done(
      <div>
        <h3>Workflow Complete: {workflow.name}</h3>
        <div>Total steps: {totalSteps}</div>
        <div>Successful: {results.filter((r) => r.success).length}</div>
        <div>Failed: {results.filter((r) => !r.success).length}</div>
      </div>
    );

    return {
      results: resultsStream.value,
      progress: progressStream.value,
      ui: uiStream.value,
    };
  } catch (error) {
    progressStream.error(error as Error);
    resultsStream.error(error as Error);
    uiStream.done(
      <ErrorDisplay
        error={`Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`}
      />
    );
    throw error;
  }
}

/**
 * Stream AI responses with tool calls and UI updates
 * Enhanced with AI SDK v5 compatibility and proper type constraints
 */
export async function streamWithTools(
  prompt: string,
  tools: Record<string, any>,
  options: EnhancedStreamingOptions = {}
): Promise<{
  result: any;
  toolCalls: StreamableValue<any[]>;
  ui: ReactNode;
}> {
  const uiStream = createStreamableUI(
    <LoadingIndicator message="Processing..." />
  );
  const toolCallsStream = createStreamableValue<any[]>();

  const toolCalls: any[] = [];
  
  // Ensure UI stream is initialized with loading state
  uiStream.update(<LoadingIndicator message="Processing..." />);

  try {
    const result = await streamUI({
      model: getAIModel(options.model),
      prompt,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (!done) {
          return <ArtifactPreview content={content} streaming={true} />;
        }
        return <ArtifactPreview content={content} streaming={false} />;
      },
      tools: Object.entries(tools).reduce(
        (acc, [name, tool]) => {
          acc[name] = {
            ...tool,
            async *generate(...args: any[]): StreamingToolGenerator {
              // Track tool call
              const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const callInfo = {
                id: callId,
                tool: name,
                args,
                timestamp: Date.now(),
                status: 'executing' as const,
                result: undefined as any,
                error: undefined as string | undefined,
              };

              toolCalls.push(callInfo);
              toolCallsStream.append(toolCalls);

              // Update UI to show tool execution
              uiStream.update(
                <div>
                  <LoadingIndicator message={`Executing tool: ${name}`} />
                  <div>Arguments: {JSON.stringify(args, null, 2)}</div>
                </div>
              );

              // Yield initial status
              yield (
                <StatusComponent
                  status="executing"
                  message={`Executing tool: ${name}`}
                />
              );

              try {
                // Execute original tool - handle both sync and async generators
                let result: any;
                if (tool.generate && typeof tool.generate === 'function') {
                  const toolResult = tool.generate(...args);
                  if (
                    toolResult &&
                    typeof toolResult[Symbol.asyncIterator] === 'function'
                  ) {
                    // Handle async generator tools
                    let finalResult: any;
                    for await (const partial of toolResult) {
                      yield (
                        <StatusComponent
                          status="processing"
                          message="Processing tool output..."
                        />
                      );
                      finalResult = partial;
                    }
                    result = finalResult;
                  } else {
                    result = await toolResult;
                  }
                } else {
                  result = await tool.generate(...args);
                }

                // Update call info
                (callInfo as any).status = 'completed';
                callInfo.result = result;
                toolCallsStream.update(toolCalls);

                // Update UI with result
                const resultComponent = (
                  <ArtifactViewer
                    content={result}
                    metadata={{ tool: name, callId }}
                    type="tool-result"
                  />
                );
                
                uiStream.update(resultComponent);

                // Return ReactNode instead of raw result
                return resultComponent;
              } catch (error) {
                (callInfo as any).status = 'failed';
                callInfo.error =
                  error instanceof Error ? error.message : 'Unknown error';
                toolCallsStream.update(toolCalls);
                throw error;
              }
            },
          };
          return acc;
        },
        {} as Record<string, any>
      ),
    });

    // Final state
    toolCallsStream.done();

    return {
      result,
      toolCalls: toolCallsStream.value,
      ui: uiStream.value,
    };
  } catch (error) {
    toolCallsStream.error(error as Error);
    uiStream.done(
      <ErrorDisplay
        error={error instanceof Error ? error.message : 'Stream failed'}
      />
    );
    throw error;
  }
}

// Advanced streaming pattern utilities

/**
 * Create a composition of multiple streaming patterns
 */
export function createStreamingComposition<T extends Record<string, any>>(
  patterns: T
): {
  compose: () => Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }>;
  abort: () => void;
  status: 'idle' | 'running' | 'completed' | 'aborted';
} {
  let status: 'idle' | 'running' | 'completed' | 'aborted' = 'idle';
  const abortController = new AbortController();

  return {
    async compose() {
      if (status !== 'idle') {
        throw new Error(`Cannot compose streaming patterns in ${status} state`);
      }

      status = 'running';

      try {
        const results = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
        const entries = Object.entries(patterns) as Array<
          [keyof T, T[keyof T]]
        >;

        await Promise.all(
          entries.map(async ([key, pattern]) => {
            if (abortController.signal.aborted) {
              throw new Error('Streaming composition aborted');
            }

            if (typeof pattern === 'function') {
              results[key] = await pattern();
            } else {
              results[key] = pattern;
            }
          })
        );

        status = 'completed';
        return results;
      } catch (error) {
        if (abortController.signal.aborted) {
          status = 'aborted';
        }
        throw error;
      }
    },

    abort() {
      if (status === 'running') {
        abortController.abort();
        status = 'aborted';
      }
    },

    get status() {
      return status;
    },
  };
}

/**
 * Create a progressive streaming pattern that yields intermediate results
 */
export function createProgressiveStreamingPattern<TInput, TOutput>(
  processor: (
    input: TInput,
    progress: (value: Partial<TOutput>) => void
  ) => Promise<TOutput>
): {
  process: (
    input: TInput
  ) => AsyncGenerator<Partial<TOutput>, TOutput, unknown>;
  abort: () => void;
} {
  const abortController = new AbortController();

  return {
    async *process(
      input: TInput
    ): AsyncGenerator<Partial<TOutput>, TOutput, unknown> {
      const progressUpdates: Partial<TOutput>[] = [];

      const progressCallback = (value: Partial<TOutput>) => {
        if (!abortController.signal.aborted) {
          progressUpdates.push(value);
        }
      };

      // Start the processor
      const resultPromise = processor(input, progressCallback);

      // Yield progress updates as they come in
      let lastYieldedIndex = 0;
      while (true) {
        if (abortController.signal.aborted) {
          throw new Error('Progressive streaming pattern aborted');
        }

        // Yield any new progress updates
        for (let i = lastYieldedIndex; i < progressUpdates.length; i++) {
          yield progressUpdates[i];
        }
        lastYieldedIndex = progressUpdates.length;

        // Check if processing is complete
        const result = await Promise.race([
          resultPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
        ]);

        if (result !== null) {
          return result;
        }
      }
    },

    abort() {
      abortController.abort();
    },
  };
}

/**
 * Create a streaming state manager for complex streaming scenarios
 */
export function createStreamingStateManager<TState extends Record<string, any>>(
  initialState: TState
): {
  getState: () => TState;
  setState: (
    updater: Partial<TState> | ((current: TState) => Partial<TState>)
  ) => void;
  subscribe: (
    listener: (state: TState, previousState: TState) => void
  ) => () => void;
  createStream: () => ReadableStream<TState>;
  reset: () => void;
} {
  let currentState = { ...initialState };
  const listeners = new Set<(state: TState, previousState: TState) => void>();
  let streamController: ReadableStreamDefaultController<TState> | null = null;

  return {
    getState() {
      return { ...currentState };
    },

    setState(updater) {
      const previousState = { ...currentState };

      if (typeof updater === 'function') {
        const updates = updater(currentState);
        currentState = { ...currentState, ...updates };
      } else {
        currentState = { ...currentState, ...updater };
      }

      // Notify listeners
      listeners.forEach((listener) => {
        try {
          listener(currentState, previousState);
        } catch (error) {
          console.error('State listener error:', error);
        }
      });

      // Update stream if active
      if (streamController) {
        try {
          streamController.enqueue({ ...currentState });
        } catch (error) {
          console.error('Stream controller error:', error);
        }
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    createStream() {
      return new ReadableStream<TState>({
        start(controller) {
          streamController = controller;
          // Send initial state
          controller.enqueue({ ...currentState });
        },

        cancel() {
          streamController = null;
        },
      });
    },

    reset() {
      const previousState = { ...currentState };
      currentState = { ...initialState };

      // Notify listeners of reset
      listeners.forEach((listener) => {
        try {
          listener(currentState, previousState);
        } catch (error) {
          console.error('State listener error during reset:', error);
        }
      });

      // Update stream if active
      if (streamController) {
        try {
          streamController.enqueue({ ...currentState });
        } catch (error) {
          console.error('Stream controller error during reset:', error);
        }
      }
    },
  };
}

// Export RSC utilities
export { streamUI, createStreamableUI, createStreamableValue };

// Advanced streaming pattern utilities are already exported above via function declarations

// Export streaming pattern types
export type StreamingComposition<T extends Record<string, any>> = ReturnType<
  typeof createStreamingComposition<T>
>;
export type ProgressiveStreamingPattern<TInput, TOutput> = ReturnType<
  typeof createProgressiveStreamingPattern<TInput, TOutput>
>;
export type StreamingStateManager<TState extends Record<string, any>> =
  ReturnType<typeof createStreamingStateManager<TState>>;

// Export unique type names to avoid conflicts
export type { StreamableArtifact as RSCStreamableArtifact };
export type { StreamingOptions as RSCStreamingOptions };
