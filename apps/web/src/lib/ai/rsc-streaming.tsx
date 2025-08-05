import { openai } from '@ai-sdk/openai';
import {
  createStreamableUI,
  createStreamableValue,
  streamUI,
} from '@ai-sdk/rsc';
import type { Tool } from 'ai';
import type { ReactNode } from 'react';
import { z } from 'zod';
import {
  type PrepareStepFunction,
  usePrepareStep,
} from '../../hooks/use-prepare-step';
import { getAIModel } from './providers';

// Type definitions for RSC streaming
export interface StreamableArtifact {
  id: string;
  type: 'code' | 'document' | 'chart' | 'data' | 'image';
  status: 'streaming' | 'complete' | 'error';
  content: any;
  metadata?: Record<string, any>;
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
          async *generate({ type, title, content, language, metadata }: { type: string; title: string; content: string; language?: string; metadata?: Record<string, any> }) {
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
          generate: async function* ({ artifactId, updates }: { artifactId: string; updates: { content?: string; metadata?: Record<string, any> } }) {
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
 * Create streamable values for progressive data loading
 */
export function createProgressiveDataStream<T>() {
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
    }
  }
}

/**
 * Enhanced error handling and stream recovery
 */
export interface StreamErrorBoundary {
  maxRetries: number
  retryDelay: number
  fallbackResponse?: any
  onError?: (error: Error, retryCount: number) => void
  onRecovery?: (error: Error) => void
}

export async function withStreamErrorBoundary<T>(
  streamFunction: () => Promise<T>,
  errorBoundary: StreamErrorBoundary
): Promise<T> {
  let retryCount = 0
  
  while (retryCount <= errorBoundary.maxRetries) {
    try {
      return await streamFunction()
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown streaming error')
      
      errorBoundary.onError?.(err, retryCount)
      
      if (retryCount === errorBoundary.maxRetries) {
        if (errorBoundary.fallbackResponse !== undefined) {
          errorBoundary.onRecovery?.(err)
          return errorBoundary.fallbackResponse
        }
        throw err
      }
      
      // Exponential backoff
      const delay = errorBoundary.retryDelay * Math.pow(2, retryCount)
      await new Promise(resolve => setTimeout(resolve, delay))
      retryCount++
    }
  }
  
  throw new Error('Unexpected error in stream boundary')
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
 */
export async function streamStructuredData<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  options: StreamingOptions<any> & {
    errorBoundary?: StreamErrorBoundary
    rateLimiter?: StreamRateLimiter
    reconnectionManager?: StreamReconnectionManager
  } = {}
) {
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
            uiStream.update(
              <ArtifactPreview 
                content={JSON.stringify(partial, null, 2)} 
                type="json"
                streaming={true}
              />
            )
          } catch {
            // If parsing fails, just show raw content
            uiStream.update(
              <ArtifactPreview content={content} streaming={true} />
            )
          }
        }
      },
      tools: {
        generateStructuredData: {
          description: 'Generate structured data matching the schema',
          parameters: schema,
          generate: async function* (data: T) {
            yield { validating: true }
            
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
    errorBoundary?: StreamErrorBoundary;
    optimisticUpdates?: boolean;
    rateLimiter?: StreamRateLimiter;
    concurrentManager?: ConcurrentStreamManager;
  } = {}
) {
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
 */
export async function streamWithTools(
  prompt: string,
  tools: Record<string, any>,
  options: StreamingOptions = {}
) {
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
          uiStream.update(
            <ArtifactPreview content={content} streaming={true} />
          )
        }
      },
      tools: Object.entries(tools).reduce((acc, [name, tool]) => {
        acc[name] = {
          ...tool,
          generate: async function* (...args: any[]) {
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

  try {
    // Execute original tool
    const result = await tool.generate(...args);

    // Update call info
    callInfo.status = 'completed';
    callInfo.result = result;
    toolCallsStream.update(toolCalls);

    // Update UI with result
    uiStream.update(
                <ArtifactViewer 
                  type="tool-result" 
                  content={result}
                  metadata={{ tool: name, callId }}
                />
              );

    return result;
  } catch (error) {
    callInfo.status = 'failed';
    callInfo.error = error instanceof Error ? error.message : 'Unknown error';
    toolCallsStream.update(toolCalls);
    throw error;
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
  type StreamableArtifact,
  type StreamingOptions,
};
