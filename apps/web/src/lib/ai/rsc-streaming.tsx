import { openai } from '@ai-sdk/openai';
import {
  createStreamableUI,
  createStreamableValue,
  streamUI,
  type StreamableValue,
  type Streamable,
} from '@ai-sdk/rsc';
import type { Tool } from 'ai';
import type { ReactNode } from 'react';
import { z } from 'zod';
import {
  type PrepareStepFunction,
  usePrepareStep,
} from '../../hooks/use-prepare-step';
import { getAIModel } from './providers';

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

// Proper AsyncGenerator type for streaming tools compatible with AI SDK v5
export type StreamingToolGenerator<TResult = any> = AsyncGenerator<
  StreamableToolResult, 
  TResult, 
  void
>;

// AI SDK v5 Streamable compatibility wrapper
export type StreamableCompatible<T> = T extends Streamable ? T : StreamableValue<T>;

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
  maxTokens?: number;
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

/**
 * Stream artifact generation with real-time UI updates
 */
export async function streamingArtifactGeneration<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
>(prompt: string, options: StreamingOptions<TOOLS> = {}) {
  const streamableUI = createStreamableUI();

  // Show initial loading state
  streamableUI.update(<LoadingIndicator message="Processing your request..." />);

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
              maxTokens: 4096,
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
      maxTokens: options.maxTokens,
      prepareStep: prepareStepFunction,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (!done) {
          streamableUI.update(
            <ArtifactPreview content={content} streaming={true} />
          );
          options.onPartial?.(content);
        }
      },
      tools: {
        createArtifact: {
          description: 'Create an interactive artifact',
          parameters: z.object({
            type: z.enum(['code', 'document', 'chart', 'data', 'image']),
            title: z.string(),
            content: z.string(),
            language: z.string().optional(),
            metadata: z.record(z.any()).optional(),
          }),
          generate: async function* ({ type, title, content, language, metadata }: { 
            type: string; 
            title: string; 
            content: string; 
            language?: string; 
            metadata?: Record<string, any> 
          }): StreamingToolGenerator<{
            artifactId: string;
            type: string;
            title: string;
            created: boolean;
          }> {
            // Stream the artifact creation process
            streamableUI.update(
              <LoadingIndicator message={`Creating ${type} artifact: ${title}...`} />
            );
            
            yield {
              status: 'processing',
              message: 'Validating content...'
            };

            // Simulate processing steps
            yield {
              status: 'formatting',
              message: 'Formatting artifact...'
            };

            // Final artifact
            streamableUI.done(
              <ArtifactViewer 
                type={type} 
                content={content}
                metadata={{ ...metadata, title, language }}
              />
            );

            return {
              artifactId: `artifact_${Date.now()}`,
              type,
              title,
              created: true
            };
          }
        },
        updateArtifact: {
          description: 'Update an existing artifact',
          parameters: z.object({
            artifactId: z.string(),
            updates: z.object({
              content: z.string().optional(),
              metadata: z.record(z.any()).optional(),
            })
          }),
          generate: async function* ({ artifactId, updates }: { 
            artifactId: string; 
            updates: { content?: string; metadata?: Record<string, any> } 
          }): StreamingToolGenerator<{ updated: boolean; artifactId: string }> {
            streamableUI.update(
              <LoadingIndicator message="Updating artifact..." />
            );
            
            yield {
              status: 'updating',
              artifactId
            };

            // In a real implementation, this would update the actual artifact
            streamableUI.done(
              <ArtifactViewer 
                type="updated" 
                content={updates.content || 'Updated content'}
                metadata={{ artifactId, ...updates.metadata }}
              />
            );

            return { updated: true, artifactId };
          }
        }
      }
    });

    return streamableUI.value;
  } catch (error) {
    streamableUI.done(
      <ErrorDisplay error={error instanceof Error ? error.message : 'Unknown error'} />
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
    stream,
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
    value: stream.value
  }
}

/**
 * Enhanced error handling and stream recovery with comprehensive type safety
 */
export interface StreamErrorBoundary<TFallback = any> {
  maxRetries: number;
  retryDelay: number;
  fallbackResponse?: TFallback;
  onError?: (error: StreamingError, retryCount: number, context: ErrorContext) => void | Promise<void>;
  onRecovery?: (error: StreamingError, context: RecoveryContext) => void | Promise<void>;
  onFinalFailure?: (error: StreamingError, context: ErrorContext) => void | Promise<void>;
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
          originalErrorType: originalError?.constructor?.name
        }
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
            recoveryAttempts: 1
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
          console.warn('Final failure handler threw exception:', finalFailureError);
        }
        
        throw streamingError;
      }
      
      // Calculate retry delay
      let delay: number;
      if (errorBoundary.customRetryDelay) {
        delay = errorBoundary.customRetryDelay(retryCount, errorBoundary.retryDelay);
      } else {
        switch (errorBoundary.retryStrategy || 'exponential') {
          case 'exponential':
            delay = errorBoundary.retryDelay * Math.pow(2, retryCount);
            break;
          case 'linear':
            delay = errorBoundary.retryDelay * (retryCount + 1);
            break;
          case 'custom':
            delay = errorBoundary.retryDelay;
            break;
          default:
            delay = errorBoundary.retryDelay * Math.pow(2, retryCount);
        }
      }
      
      // Add jitter to prevent thundering herd
      const jitter = delay * 0.1 * Math.random();
      const finalDelay = Math.min(delay + jitter, 60000); // Cap at 1 minute
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
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
  } else if (errorString.includes('network') || errorString.includes('connection')) {
    code = 'STREAM_NETWORK_ERROR';
  } else if (errorString.includes('rate limit') || errorString.includes('too many requests')) {
    code = 'STREAM_RATE_LIMITED';
  } else if (errorString.includes('auth') || errorString.includes('unauthorized')) {
    code = 'STREAM_AUTHENTICATION_ERROR';
  } else if (errorString.includes('quota') || errorString.includes('limit exceeded')) {
    code = 'STREAM_QUOTA_EXCEEDED';
  } else if (errorString.includes('invalid') || errorString.includes('malformed')) {
    code = 'STREAM_INVALID_DATA';
  } else if (errorString.includes('interrupted') || errorString.includes('aborted')) {
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
    'STREAM_INTERRUPTED'
  ];
  
  return retryableCodes.includes(error.code);
}

/**
 * Stream reconnection manager
 */
export class StreamReconnectionManager {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isReconnecting = false
  
  constructor(options: {
    maxReconnectAttempts?: number
    reconnectDelay?: number
  } = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.reconnectDelay = options.reconnectDelay ?? 1000
  }
  
  async attemptReconnection(streamFunction: () => Promise<any>): Promise<any> {
    if (this.isReconnecting) {
      throw new Error('Reconnection already in progress')
    }
    
    this.isReconnecting = true
    
    try {
      while (this.reconnectAttempts < this.maxReconnectAttempts) {
        try {
          const result = await streamFunction()
          this.reconnectAttempts = 0 // Reset on success
          this.isReconnecting = false
          return result
        } catch (error) {
          this.reconnectAttempts++
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            throw new Error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`)
          }
          
          // Exponential backoff with jitter
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts) * (0.5 + Math.random() * 0.5)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    } finally {
      this.isReconnecting = false
    }
  }
  
  get isCurrentlyReconnecting() {
    return this.isReconnecting
  }
  
  get currentAttempts() {
    return this.reconnectAttempts
  }
}

/**
 * Rate limiting for streaming operations
 */
export class StreamRateLimiter {
  private requests: number[] = []
  private maxRequests: number
  private timeWindow: number
  
  constructor(maxRequests: number = 10, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.timeWindow = timeWindowMs
  }
  
  async checkRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Clean old requests
    this.requests = this.requests.filter(time => now - time < this.timeWindow)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.timeWindow - (now - oldestRequest)
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.checkRateLimit() // Re-check after waiting
      }
    }
    
    this.requests.push(now)
  }
  
  getRemainingRequests(): number {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.timeWindow)
    return Math.max(0, this.maxRequests - this.requests.length)
  }
}

/**
 * Concurrent stream manager
 */
export class ConcurrentStreamManager {
  private activeStreams = new Map<string, Promise<any>>()
  private maxConcurrent: number
  
  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent
  }
  
  async executeStream<T>(
    id: string,
    streamFunction: () => Promise<T>,
    options: {
      priority?: 'high' | 'medium' | 'low'
      timeout?: number
    } = {}
  ): Promise<T> {
    // Wait for available slot
    while (this.activeStreams.size >= this.maxConcurrent) {
      await Promise.race(Array.from(this.activeStreams.values()))
    }
    
    // Add timeout wrapper
    const timeoutMs = options.timeout ?? 30000
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Stream ${id} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
    
    const streamPromise = Promise.race([
      streamFunction(),
      timeoutPromise
    ]).finally(() => {
      this.activeStreams.delete(id)
    })
    
    this.activeStreams.set(id, streamPromise)
    
    return streamPromise
  }
  
  getActiveStreamCount(): number {
    return this.activeStreams.size
  }
  
  async waitForAll(): Promise<void> {
    await Promise.all(this.activeStreams.values())
  }
  
  cancelStream(id: string): boolean {
    return this.activeStreams.delete(id)
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
    errorBoundary?: StreamErrorBoundary<{ data: StreamableValue<T>; ui: StreamableValue<ReactNode> }>
    rateLimiter?: StreamRateLimiter
    reconnectionManager?: StreamReconnectionManager
  } = {}
): Promise<{
  data: StreamableValue<T>;
  ui: StreamableValue<ReactNode>;
}> {
  const dataStream = createProgressiveDataStream<T>()
  const uiStream = createStreamableUI()

  // Initial UI
  uiStream.update(<LoadingIndicator message="Generating structured data..." />)

  try {
    const model = getAIModel(options.model)
    
    // Stream the generation
    const result = await streamUI({
      model,
      prompt,
      temperature: options.temperature,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (!done) {
          try {
            // Try to parse partial JSON
            const partial = JSON.parse(content)
            dataStream.update(partial)
            return (
              <ArtifactPreview 
                content={JSON.stringify(partial, null, 2)} 
                type="json"
                streaming={true}
              />
            )
          } catch {
            // If parsing fails, just show raw content
            return <ArtifactPreview content={content} streaming={true} />
          }
        }
        return null;
      },
      tools: {
        generateStructuredData: {
          description: 'Generate structured data matching the schema',
          parameters: schema,
          generate: async function* (data: T): StreamingToolGenerator<{ generated: boolean; data: T }> {
            yield { 
              status: 'validating',
              validating: true 
            }
            
            // Validate against schema
            const validation = schema.safeParse(data)
            if (!validation.success) {
              throw new Error(`Validation failed: ${validation.error.message}`)
            }

            dataStream.done(data)
            uiStream.done(
              <ArtifactViewer 
                type="data" 
                content={data}
                metadata={{ schema: schema._def }}
              />
            )

            return { generated: true, data }
          }
}
}
    })

return {
      data: dataStream.stream,
      ui: uiStream.value
    }
} catch (error)
{
  dataStream.error(error as Error);
  uiStream.done(
      <ErrorDisplay error={error instanceof Error ? error.message : 'Generation failed'} />
    )
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
  ui: StreamableValue<ReactNode>;
}> {
  const uiStream = createStreamableUI();
  const progressStream = createStreamableValue<number>();
  const resultsStream = createStreamableValue<any[]>();

  const totalSteps = workflow.steps.length;
  const results: any[] = [];

  // Initial UI
  uiStream.update(
    <LoadingIndicator message={`Starting workflow: ${workflow.name}`} />
  )

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      const progress = ((i + 1) / totalSteps) * 100

      // Update progress
      progressStream.update(progress)
      options.onProgress?.(progress)

      // Update UI for current step
      uiStream.update(
        <div>
          <LoadingIndicator message={`Step ${i + 1}/${totalSteps}: ${step.description}`} />
          <div>Progress: {progress.toFixed(0)}%</div>
        </div>
      )

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
        <div>Successful: {results.filter(r => r.success).length}</div>
        <div>Failed: {results.filter(r => !r.success).length}</div>
      </div>
    )

return {
      results: resultsStream.value,
      progress: progressStream.value,
      ui: uiStream.value
    }
} catch (error)
{
  progressStream.error(error as Error);
  resultsStream.error(error as Error);
  uiStream.done(
      <ErrorDisplay error={`Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`} />
    )
    throw error
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
  ui: StreamableValue<ReactNode>;
}> {
  const uiStream = createStreamableUI()
  const toolCallsStream = createStreamableValue<any[]>()
  
  const toolCalls: any[] = []

  try {
    const result = await streamUI({
      model: getAIModel(options.model),
      prompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (!done) {
          return <ArtifactPreview content={content} streaming={true} />;
        }
        return <ArtifactPreview content={content} streaming={false} />;
      },
      tools: Object.entries(tools).reduce((acc, [name, tool]) => {
        acc[name] = {
          ...tool,
          generate: async function* (...args: any[]): StreamingToolGenerator<any> {
            // Track tool call
            const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            const callInfo = {
              id: callId,
              tool: name,
              args,
              timestamp: Date.now(),
              status: 'executing' as const,
              result: undefined as any,
              error: undefined as string | undefined
            }
            
            toolCalls.push(callInfo)
            toolCallsStream.append(toolCalls)

            // Update UI to show tool execution
            uiStream.update(
              <div>
                <LoadingIndicator message={`Executing tool: ${name}`} />
                <div>Arguments: {JSON.stringify(args, null, 2)}</div>
              </div>
            )

            // Yield initial status
            yield {
              status: 'executing',
              message: `Executing tool: ${name}`
            }

            try {
              // Execute original tool - handle both sync and async generators
              let result: any
              if (tool.generate && typeof tool.generate === 'function') {
                const toolResult = tool.generate(...args)
                if (toolResult && typeof toolResult[Symbol.asyncIterator] === 'function') {
                  // Handle async generator tools
                  let finalResult: any
                  for await (const partial of toolResult) {
                    yield {
                      status: 'processing',
                      message: 'Processing tool output...'
                    }
                    finalResult = partial
                  }
                  result = finalResult
                } else {
                  result = await toolResult
                }
              } else {
                result = await tool.generate(...args)
              }

              // Update call info
              (callInfo as any).status = 'completed'
              callInfo.result = result
              toolCallsStream.update(toolCalls)

              // Update UI with result
              uiStream.update(
                <ArtifactViewer 
                  type="tool-result" 
                  content={result}
                  metadata={{ tool: name, callId }}
                />
              )

              return result
            } catch (error) {
              (callInfo as any).status = 'failed'
              callInfo.error = error instanceof Error ? error.message : 'Unknown error'
              toolCallsStream.update(toolCalls)
              throw error
            }
          }
        };
        return acc;
      }, {} as Record<string, any>)
    })

    // Final state
    toolCallsStream.done();

    return {
      result,
      toolCalls: toolCallsStream.value,
      ui: uiStream.value
    };
  } catch (error) {
    toolCallsStream.error(error as Error);
    uiStream.done(
      <ErrorDisplay error={error instanceof Error ? error.message : 'Stream failed'} />
    );
    throw error;
  }
}

// Export RSC utilities
export {
  streamUI,
  createStreamableUI,
  createStreamableValue,
};

// Export advanced streaming pattern utilities
export {
  createStreamingComposition,
  createProgressiveStreamingPattern,
  createStreamingStateManager,
};

// Export all streaming pattern types that are defined above

// Export unique type names to avoid conflicts
export type { StreamableArtifact as RSCStreamableArtifact };
export type { StreamingOptions as RSCStreamingOptions };
