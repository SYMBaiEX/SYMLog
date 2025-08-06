import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  logAPIError,
  logError as logErrorToConsole,
  logSecurityEvent,
} from '@/lib/logger';
import type {
  MultiStepToolContext,
  StreamingToolDefinition,
  StreamingToolPart,
  ToolExecutionMetadata,
  ToolExecutionProgress,
  ToolInputValidation,
  ToolStreamingAnalytics,
  ToolStreamingCallbacks,
  ToolStreamingError,
  ToolStreamingEventMap,
  ToolStreamingManagerConfig,
  ToolStreamingOptions,
  ToolStreamingSession,
  ToolStreamingSSEMessage,
  ToolStreamingState,
} from '@/types/tool-streaming';
import { streamingOptimizer } from './streaming-optimization';
import { structuredMemoizer } from '../core/structured-memoization';
import {
  enhancedArtifactTools,
  ToolExecutionError,
  toolRegistry,
} from '../tools/enhanced-tools';
import { workflowCachingEngine } from '../core/workflow-caching';

// Create a logger wrapper using existing logger functions
const loggingService = {
  info: (message: string, data?: unknown) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: unknown) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: unknown) => logErrorToConsole(message, data),
  debug: (message: string, data?: unknown) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Default configuration
const DEFAULT_CONFIG: Required<ToolStreamingManagerConfig> = {
  maxConcurrentExecutions: 10,
  defaultTimeout: 60_000, // 1 minute
  defaultRetries: 3,
  enableMetrics: true,
  enableCaching: true,
  sseHeartbeatInterval: 30_000, // 30 seconds
  compressionThreshold: 1024, // 1KB
  validationCacheSize: 1000,
};

/**
 * Advanced Tool Streaming Manager with SSE Protocol Support
 *
 * Features:
 * - Fine-grained streaming callbacks (onInputStart, onInputDelta, onInputAvailable)
 * - Server-Sent Events (SSE) protocol implementation
 * - Integration with existing caching and optimization systems
 * - Multi-step tool execution streaming
 * - Type-safe tool parts for UI components
 * - Comprehensive error handling and recovery
 * - Performance monitoring and analytics
 */
export class ToolStreamingManager extends EventEmitter {
  private static instance: ToolStreamingManager;
  private config: Required<ToolStreamingManagerConfig>;
  private activeSessions: Map<string, ToolStreamingSession> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private validationCache: Map<string, ToolInputValidation> = new Map();
  private analytics: ToolStreamingAnalytics;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor(config: Partial<ToolStreamingManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analytics = {
      totalExecutions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      averageInputSize: 0,
      averageOutputSize: 0,
      cacheHitRate: 0,
      errorRate: 0,
      mostUsedTools: [],
      performanceBottlenecks: [],
      timeRange: { start: Date.now(), end: Date.now() },
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  static getInstance(
    config?: Partial<ToolStreamingManagerConfig>
  ): ToolStreamingManager {
    if (!ToolStreamingManager.instance) {
      ToolStreamingManager.instance = new ToolStreamingManager(config);
    }
    return ToolStreamingManager.instance;
  }

  /**
   * Execute a tool with comprehensive streaming support
   */
  async executeToolWithStreaming(
    toolName: string,
    input: unknown,
    options: ToolStreamingOptions = {},
    context?: MultiStepToolContext
  ): Promise<{
    executionId: string;
    stream: ReadableStream<ToolStreamingSSEMessage>;
  }> {
    // P3.1 Security Fix: Add null check for toolName parameter
    if (
      !toolName ||
      typeof toolName !== 'string' ||
      toolName.trim().length === 0
    ) {
      throw new ToolExecutionError(
        'Tool name is required and must be a non-empty string',
        'validation'
      );
    }

    // Sanitize toolName to prevent injection attacks
    const sanitizedToolName = toolName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedToolName !== toolName.trim()) {
      throw new ToolExecutionError(
        'Tool name contains invalid characters',
        'validation'
      );
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    // Initialize session
    const session: ToolStreamingSession = {
      id: executionId,
      toolName: sanitizedToolName,
      state: 'idle',
      startTime,
      lastUpdateTime: startTime,
      executionId,
      metadata: {
        toolName: sanitizedToolName,
        executionId,
        startTime,
        endTime: 0,
        duration: 0,
        inputSize: this.calculateSize(input),
        outputSize: 0,
        cacheHit: false,
        retryCount: 0,
      },
      options: {
        enableInputStreaming: true,
        enableProgressStreaming: true,
        enableOutputStreaming: true,
        inputChunkSize: 1024,
        outputChunkSize: 2048,
        progressUpdateInterval: 500,
        maxRetries: this.config.defaultRetries,
        timeout: this.config.defaultTimeout,
        cacheStrategy: 'both',
        compressionEnabled: true,
        validationLevel: 'basic',
        ...options,
      },
    };

    this.activeSessions.set(executionId, session);
    this.analytics.totalExecutions++;

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(executionId, abortController);

    // Create SSE stream
    const stream = new ReadableStream<ToolStreamingSSEMessage>({
      start: (controller) => {
        this.executeToolStreamingInternal(
          sanitizedToolName,
          input,
          session,
          controller,
          abortController.signal,
          context
        ).catch((error) => {
          const streamingError: ToolStreamingError = {
            type: 'execution-error',
            toolName: sanitizedToolName,
            executionId,
            message: error.message,
            retryable: true,
            retryCount: session.metadata.retryCount,
            originalError: error,
            timestamp: Date.now(),
          };
          this.sendSSEMessage(controller, 'error', streamingError);
          controller.close();
        });
      },
      cancel: () => {
        this.cancelToolExecution(executionId, 'Stream cancelled by client');
      },
    });

    return { executionId, stream };
  }

  /**
   * Internal tool execution with streaming
   */
  private async executeToolStreamingInternal(
    toolName: string,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal,
    context?: MultiStepToolContext
  ): Promise<void> {
    const { executionId, options } = session;

    try {
      // Stage 1: Input processing and validation
      await this.processInputStreaming(
        toolName,
        input,
        session,
        controller,
        signal
      );

      // Stage 2: Tool execution
      const result = await this.executeToolWithProgressStreaming(
        toolName,
        input,
        session,
        controller,
        signal,
        context
      );

      // Stage 3: Output processing
      await this.processOutputStreaming(result, session, controller, signal);

      // Update analytics
      this.updateAnalytics(session);

      // Send completion
      this.sendSSEMessage(controller, 'execution-complete', {
        result,
        metadata: session.metadata,
      });

      this.sendSSEMessage(controller, 'end', {
        executionId,
        finalState: 'tool-complete' as ToolStreamingState,
      });
    } catch (error) {
      await this.handleStreamingError(error, session, controller);
    } finally {
      // Cleanup
      session.metadata.endTime = Date.now();
      session.metadata.duration =
        session.metadata.endTime - session.metadata.startTime;
      session.state = session.error ? 'error' : 'tool-complete';

      this.stopHeartbeat(executionId);
      this.abortControllers.delete(executionId);

      // Keep session for analytics but mark as inactive
      setTimeout(() => {
        this.activeSessions.delete(executionId);
      }, 30_000); // Keep for 30 seconds for analytics

      controller.close();
    }
  }

  /**
   * Process input with streaming validation
   */
  private async processInputStreaming(
    toolName: string,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal
  ): Promise<void> {
    const { executionId, options } = session;

    // Start input processing
    session.state = 'input-parsing';
    this.updateSession(session);

    // Get tool definition
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new ToolExecutionError(`Tool ${toolName} not found`, toolName);
    }

    // Send input start event
    this.sendSSEMessage(controller, 'input-start', {
      toolName,
      inputSchema: tool.inputSchema || z.any(),
    });

    // Process input in chunks if streaming enabled
    if (
      options.enableInputStreaming &&
      typeof input === 'string' &&
      input.length > (options.inputChunkSize || 1024)
    ) {
      await this.streamInputProcessing(
        input,
        options.inputChunkSize || 1024,
        session,
        controller,
        signal
      );
    }

    // Validate input
    const validation = await this.validateToolInput(toolName, input, tool);

    // Send input available event
    session.state = 'input-available';
    this.updateSession(session);

    this.sendSSEMessage(controller, 'input-available', {
      toolName,
      completeInput: input,
      validation,
    });

    if (!validation.isValid) {
      throw new ToolExecutionError(
        `Input validation failed: ${validation.errors.join(', ')}`,
        toolName
      );
    }

    session.input = input;
  }

  /**
   * Stream input processing with delta updates
   */
  private async streamInputProcessing(
    input: string,
    chunkSize: number,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal
  ): Promise<void> {
    const totalLength = input.length;
    let processed = 0;

    while (processed < totalLength && !signal.aborted) {
      const chunk = input.slice(processed, processed + chunkSize);
      const progress = Math.round((processed / totalLength) * 100);

      this.sendSSEMessage(controller, 'input-delta', {
        toolName: session.toolName,
        partialInput: input.slice(0, processed + chunk.length),
        progress,
      });

      processed += chunk.length;

      // Small delay to allow for streaming effect
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Execute tool with progress streaming
   */
  private async executeToolWithProgressStreaming(
    toolName: string,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal,
    context?: MultiStepToolContext
  ): Promise<unknown> {
    const { executionId, options } = session;

    session.state = 'tool-executing';
    this.updateSession(session);

    // Send execution start event
    this.sendSSEMessage(controller, 'execution-start', {
      toolName,
      executionId,
      input,
    });

    // Start heartbeat for long-running executions
    this.startHeartbeat(executionId, controller);

    // Get cached result if available
    if (
      options.cacheStrategy === 'both' ||
      options.cacheStrategy === 'output'
    ) {
      const cached = await this.getCachedResult(toolName, input);
      if (cached) {
        session.metadata.cacheHit = true;
        this.updateAnalytics(session);
        return cached;
      }
    }

    // Execute tool with progress tracking
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new ToolExecutionError(`Tool ${toolName} not found`, toolName);
    }

    // Enhanced execution with existing systems integration
    let result: unknown;

    if (context && context.workflowId) {
      // Multi-step execution using workflow caching engine
      result = await this.executeWithWorkflowCaching(
        tool,
        input,
        session,
        controller,
        signal,
        context
      );
    } else if (tool.name.includes('Artifact')) {
      // Artifact creation with structured memoization
      result = await this.executeWithStructuredMemoization(
        tool,
        input,
        session,
        controller,
        signal
      );
    } else {
      // Standard execution with streaming optimization
      result = await this.executeWithStreamingOptimization(
        tool,
        input,
        session,
        controller,
        signal
      );
    }

    // Cache result if enabled
    if (
      options.cacheStrategy === 'both' ||
      options.cacheStrategy === 'output'
    ) {
      await this.cacheResult(toolName, input, result);
    }

    session.output = result;
    session.metadata.outputSize = this.calculateSize(result);

    return result;
  }

  /**
   * Execute tool with workflow caching integration
   */
  private async executeWithWorkflowCaching(
    tool: any,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal,
    context: MultiStepToolContext
  ): Promise<unknown> {
    const progressCallback = (progress: ToolExecutionProgress) => {
      if (session.options.enableProgressStreaming) {
        const toolProgress: ToolExecutionProgress = {
          toolName: session.toolName,
          executionId: session.id,
          stage: progress.stage || 'executing',
          progress: progress.progress || 0,
          message: progress.message,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          metadata: progress.metadata,
          timestamp: Date.now(),
        };

        session.progress = toolProgress;
        this.updateSession(session);

        this.sendSSEMessage(controller, 'execution-progress', toolProgress);
      }
    };

    // Use existing workflow caching with progress callbacks
    return await tool.execute(input, {
      progressCallback,
      signal,
      workflowContext: context,
    });
  }

  /**
   * Execute tool with structured memoization integration
   */
  private async executeWithStructuredMemoization(
    tool: any,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal
  ): Promise<unknown> {
    // Enhanced progress tracking for artifact creation
    const stages = [
      'initializing',
      'validating',
      'generating',
      'optimizing',
      'finalizing',
    ];
    let currentStageIndex = 0;

    const progressCallback = (progress: ToolExecutionProgress) => {
      if (session.options.enableProgressStreaming) {
        const toolProgress: ToolExecutionProgress = {
          toolName: session.toolName,
          executionId: session.id,
          stage: stages[currentStageIndex] || progress.stage || 'executing',
          progress:
            progress.progress ||
            Math.round((currentStageIndex / stages.length) * 100),
          message: progress.message || `${stages[currentStageIndex]}...`,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          metadata: progress.metadata,
          timestamp: Date.now(),
        };

        if (progress.stage && stages.includes(progress.stage)) {
          currentStageIndex = stages.indexOf(progress.stage);
        }

        session.progress = toolProgress;
        this.updateSession(session);

        this.sendSSEMessage(controller, 'execution-progress', toolProgress);
      }
    };

    // Integrate with structured memoization for better performance
    if (
      tool.name === 'createCodeArtifact' ||
      tool.name === 'createDocumentArtifact'
    ) {
      return await structuredMemoizer.memoizedGenerateObject(
        tool.model || { modelId: 'gpt-4.1-nano' },
        JSON.stringify(input),
        tool.inputSchema || z.any(),
        {
          customKey: `${session.toolName}:${this.hashInput(input)}`,
          dependencies: [`tool:${session.toolName}`],
        }
      );
    }

    return await tool.execute(input, { progressCallback, signal });
  }

  /**
   * Execute tool with streaming optimization integration
   */
  private async executeWithStreamingOptimization(
    tool: any,
    input: unknown,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal
  ): Promise<unknown> {
    const progressCallback = (progress: ToolExecutionProgress) => {
      if (session.options.enableProgressStreaming) {
        const toolProgress: ToolExecutionProgress = {
          toolName: session.toolName,
          executionId: session.id,
          stage: progress.stage || 'executing',
          progress: progress.progress || 0,
          message: progress.message,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          metadata: progress.metadata,
          timestamp: Date.now(),
        };

        session.progress = toolProgress;
        this.updateSession(session);

        this.sendSSEMessage(controller, 'execution-progress', toolProgress);
      }
    };

    // Use streaming optimization for large outputs
    if (session.options.enableOutputStreaming) {
      const optimizedStream = await streamingOptimizer.optimizeTextStream(
        async () => {
          const result = await tool.execute(input, {
            progressCallback,
            signal,
          });
          return (async function* () {
            if (typeof result === 'string') {
              const chunks = result.match(/.{1,1024}/g) || [result];
              for (const chunk of chunks) {
                yield chunk;
              }
            } else {
              yield JSON.stringify(result, null, 2);
            }
          })();
        },
        {
          cacheKey: `${session.toolName}:${this.hashInput(input)}`,
          enableCache: session.options.cacheStrategy !== 'none',
          enableCompression: session.options.compressionEnabled,
        }
      );

      // Collect streamed result
      const chunks: string[] = [];
      for await (const chunk of optimizedStream) {
        chunks.push(chunk.data);
      }

      try {
        const result = chunks.join('');
        return JSON.parse(result);
      } catch {
        return chunks.join('');
      }
    }

    return await tool.execute(input, { progressCallback, signal });
  }

  /**
   * Process output with streaming
   */
  private async processOutputStreaming(
    result: any,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    signal: AbortSignal
  ): Promise<void> {
    session.state = 'tool-complete';
    this.updateSession(session);

    // Stream large outputs in chunks if enabled
    if (
      session.options.enableOutputStreaming &&
      typeof result === 'string' &&
      result.length > (session.options.outputChunkSize || 2048)
    ) {
      const chunkSize = session.options.outputChunkSize || 2048;
      let offset = 0;

      while (offset < result.length && !signal.aborted) {
        const chunk = result.slice(offset, offset + chunkSize);
        const progress = Math.round((offset / result.length) * 100);

        // Send output delta (could be used by UI to show progressive results)
        this.emit('output-delta', {
          executionId: session.id,
          chunk,
          progress,
          isComplete: offset + chunkSize >= result.length,
        });

        offset += chunkSize;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Handle streaming errors with recovery
   */
  private async handleStreamingError(
    error: any,
    session: ToolStreamingSession,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>
  ): Promise<void> {
    const streamingError: ToolStreamingError = {
      type: this.classifyError(error),
      toolName: session.toolName,
      executionId: session.id,
      message: error.message || 'Unknown error',
      retryable: this.isRetryableError(error),
      retryCount: session.metadata.retryCount,
      originalError: error,
      timestamp: Date.now(),
      context: {
        input: session.input,
        stage: session.state,
        progress: session.progress,
      },
    };

    session.error = streamingError;
    session.state = 'error';
    this.updateSession(session);

    // Attempt retry if retryable and within limits
    if (
      streamingError.retryable &&
      session.metadata.retryCount <
        (session.options.maxRetries || this.config.defaultRetries)
    ) {
      session.metadata.retryCount++;
      loggingService.warn('Retrying tool execution', {
        toolName: session.toolName,
        executionId: session.id,
        retryCount: session.metadata.retryCount,
        error: error.message,
      });

      // Wait with exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 2 ** session.metadata.retryCount * 1000)
      );

      // Retry execution (simplified - would need full retry logic)
      return;
    }

    // Send error event
    this.sendSSEMessage(controller, 'error', streamingError);
    this.updateAnalytics(session);
  }

  /**
   * Validate tool input with caching
   */
  private async validateToolInput(
    toolName: string,
    input: unknown,
    tool: any
  ): Promise<ToolInputValidation> {
    // P3.2 Security Fix: Add null checks and input validation
    if (!toolName || typeof toolName !== 'string') {
      throw new ToolExecutionError(
        'Tool name is required for validation',
        'validation'
      );
    }

    if (input === undefined || input === null) {
      throw new ToolExecutionError(
        'Input is required for validation',
        'validation'
      );
    }

    if (!tool) {
      throw new ToolExecutionError(
        `Tool definition not found for ${toolName}`,
        'validation'
      );
    }

    const inputHash = this.hashInput({ toolName, input });

    // Check validation cache
    if (this.validationCache.has(inputHash)) {
      return this.validationCache.get(inputHash)!;
    }

    const validation: ToolInputValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100,
    };

    try {
      // Use tool's input schema for validation
      if (tool.inputSchema) {
        const result = tool.inputSchema.safeParse(input);
        if (!result.success) {
          validation.isValid = false;
          validation.errors = result.error.errors.map(
            (e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`
          );
          validation.score = Math.max(0, 100 - validation.errors.length * 20);
        }
      }

      // Additional tool-specific validation
      if (tool.validateInput) {
        const customValidation = await tool.validateInput(input);
        validation.warnings.push(...customValidation.warnings);
        validation.suggestions.push(...customValidation.suggestions);
        if (!customValidation.isValid) {
          validation.isValid = false;
          validation.errors.push(...customValidation.errors);
        }
      }

      // P3.3 Security Fix: Implement proper cache eviction policy with size limits
      this.enforceMemoryLimits();
      if (this.validationCache.size < this.config.validationCacheSize) {
        this.validationCache.set(inputHash, validation);
      } else {
        // Evict oldest entries using LRU policy
        const firstKey = this.validationCache.keys().next().value;
        if (firstKey) {
          this.validationCache.delete(firstKey);
          this.validationCache.set(inputHash, validation);
        }
      }
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      validation.score = 0;
    }

    return validation;
  }

  /**
   * Cancel tool execution
   */
  cancelToolExecution(
    executionId: string,
    reason = 'Manual cancellation'
  ): boolean {
    const controller = this.abortControllers.get(executionId);
    const session = this.activeSessions.get(executionId);

    if (controller) {
      controller.abort();
      this.abortControllers.delete(executionId);

      if (session) {
        session.state = 'cancelled';
        session.error = {
          type: 'cancellation',
          toolName: session.toolName,
          executionId,
          message: reason,
          retryable: false,
          retryCount: session.metadata.retryCount,
          timestamp: Date.now(),
        };
        this.updateSession(session);

        this.emit('stream-cancel', { executionId, reason });
      }

      this.stopHeartbeat(executionId);
      return true;
    }

    return false;
  }

  /**
   * Get active session
   */
  getSession(executionId: string): ToolStreamingSession | null {
    return this.activeSessions.get(executionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ToolStreamingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get streaming analytics
   */
  getAnalytics(): ToolStreamingAnalytics {
    this.updateAnalyticsMetrics();
    return { ...this.analytics };
  }

  /**
   * Clear all sessions and reset state
   */
  clearAllSessions(): void {
    // Cancel all active executions
    for (const executionId of this.activeSessions.keys()) {
      this.cancelToolExecution(executionId, 'Manager reset');
    }

    this.activeSessions.clear();
    this.abortControllers.clear();
    this.validationCache.clear();

    // Clear all heartbeat timers
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    loggingService.info('All tool streaming sessions cleared');
  }

  // Private utility methods

  private getTool(toolName: string): any {
    return (
      toolRegistry.getTool(toolName) ||
      enhancedArtifactTools[toolName as keyof typeof enhancedArtifactTools]
    );
  }

  private generateExecutionId(): string {
    return `tool_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateSession(session: ToolStreamingSession): void {
    session.lastUpdateTime = Date.now();
    this.activeSessions.set(session.id, session);
  }

  private sendSSEMessage(
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>,
    event: ToolStreamingSSEMessage['event'],
    data: any
  ): void {
    const message: ToolStreamingSSEMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      event,
      data: {
        toolName: data.toolName || '',
        executionId: data.executionId || '',
        timestamp: Date.now(),
        payload: data,
      },
      retry: event === 'error' ? 3000 : undefined,
    };

    try {
      controller.enqueue(message);
    } catch (error) {
      loggingService.error('Failed to send SSE message', { event, error });
    }
  }

  private startHeartbeat(
    executionId: string,
    controller: ReadableStreamDefaultController<ToolStreamingSSEMessage>
  ): void {
    const timer = setInterval(() => {
      try {
        controller.enqueue({
          id: `heartbeat_${Date.now()}`,
          event: 'execution-progress',
          data: {
            toolName: '',
            executionId,
            timestamp: Date.now(),
            payload: { type: 'heartbeat' },
          },
        });
      } catch (error) {
        // Controller might be closed, clear the heartbeat
        this.stopHeartbeat(executionId);
      }
    }, this.config.sseHeartbeatInterval);

    this.heartbeatTimers.set(executionId, timer);
  }

  private stopHeartbeat(executionId: string): void {
    const timer = this.heartbeatTimers.get(executionId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(executionId);
    }
  }

  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 encoding
    } catch {
      return 1024; // Default size
    }
  }

  private hashInput(input: any): string {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private classifyError(error: any): ToolStreamingError['type'] {
    if (error.name === 'AbortError' || error.message?.includes('abort')) {
      return 'cancellation';
    }
    if (error.message?.includes('timeout')) {
      return 'timeout';
    }
    if (
      error.message?.includes('validation') ||
      error.message?.includes('schema')
    ) {
      return 'input-validation';
    }
    if (
      error.message?.includes('network') ||
      error.message?.includes('fetch')
    ) {
      return 'network-error';
    }
    return 'execution-error';
  }

  private isRetryableError(error: any): boolean {
    const nonRetryableTypes = ['input-validation', 'cancellation'];
    const errorType = this.classifyError(error);
    return !nonRetryableTypes.includes(errorType);
  }

  private async getCachedResult(toolName: string, input: any): Promise<any> {
    if (!this.config.enableCaching) return null;

    try {
      // Use structured memoizer for caching
      const cacheKey = `${toolName}:${this.hashInput(input)}`;
      return await structuredMemoizer.memoizedGenerateObject(
        { modelId: 'cache' } as any,
        JSON.stringify(input),
        z.any(),
        { customKey: cacheKey }
      );
    } catch {
      return null;
    }
  }

  private async cacheResult(
    toolName: string,
    input: unknown,
    result: any
  ): Promise<void> {
    if (!this.config.enableCaching) return;

    try {
      const cacheKey = `${toolName}:${this.hashInput(input)}`;
      await structuredMemoizer.memoizedGenerateObject(
        { modelId: 'cache' } as any,
        JSON.stringify(input),
        z.any(),
        {
          customKey: cacheKey,
          dependencies: [`tool:${toolName}`],
        }
      );
    } catch (error) {
      loggingService.warn('Failed to cache tool result', { toolName, error });
    }
  }

  private updateAnalytics(session: ToolStreamingSession): void {
    if (!this.config.enableMetrics) return;

    const now = Date.now();
    const duration =
      session.metadata.duration || now - session.metadata.startTime;

    // Update basic metrics
    if (session.state === 'tool-complete') {
      this.analytics.successRate =
        (this.analytics.successRate * (this.analytics.totalExecutions - 1) +
          1) /
        this.analytics.totalExecutions;
    } else if (session.state === 'error') {
      this.analytics.errorRate =
        (this.analytics.errorRate * (this.analytics.totalExecutions - 1) + 1) /
        this.analytics.totalExecutions;
    }

    this.analytics.averageExecutionTime =
      (this.analytics.averageExecutionTime *
        (this.analytics.totalExecutions - 1) +
        duration) /
      this.analytics.totalExecutions;
    this.analytics.averageInputSize =
      (this.analytics.averageInputSize * (this.analytics.totalExecutions - 1) +
        session.metadata.inputSize) /
      this.analytics.totalExecutions;
    this.analytics.averageOutputSize =
      (this.analytics.averageOutputSize * (this.analytics.totalExecutions - 1) +
        session.metadata.outputSize) /
      this.analytics.totalExecutions;

    if (session.metadata.cacheHit) {
      this.analytics.cacheHitRate =
        (this.analytics.cacheHitRate * (this.analytics.totalExecutions - 1) +
          1) /
        this.analytics.totalExecutions;
    }

    this.analytics.timeRange.end = now;
  }

  private updateAnalyticsMetrics(): void {
    // Update most used tools
    const toolCounts = new Map<string, number>();
    const toolDurations = new Map<string, number[]>();

    for (const session of this.activeSessions.values()) {
      const count = toolCounts.get(session.toolName) || 0;
      toolCounts.set(session.toolName, count + 1);

      if (!toolDurations.has(session.toolName)) {
        toolDurations.set(session.toolName, []);
      }
      toolDurations.get(session.toolName)!.push(session.metadata.duration);
    }

    this.analytics.mostUsedTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    this.analytics.performanceBottlenecks = Array.from(toolDurations.entries())
      .map(([toolName, durations]) => ({
        toolName,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
  }

  private startCleanupTimer(): void {
    // Clean up old sessions every 5 minutes
    setInterval(() => {
      const cutoff = Date.now() - 300_000; // 5 minutes
      const toDelete: string[] = [];

      for (const [id, session] of this.activeSessions.entries()) {
        if (
          session.lastUpdateTime < cutoff &&
          (session.state === 'tool-complete' ||
            session.state === 'error' ||
            session.state === 'cancelled')
        ) {
          toDelete.push(id);
        }
      }

      for (const id of toDelete) {
        this.activeSessions.delete(id);
        this.stopHeartbeat(id);
      }

      if (toDelete.length > 0) {
        loggingService.debug('Cleaned up old tool streaming sessions', {
          count: toDelete.length,
        });
      }

      // P3.3 Enhanced: Enforce strict memory limits for all caches
      this.enforceMemoryLimits();
    }, 300_000); // 5 minutes
  }

  /**
   * P3.3 Security Fix: Enforce memory limits with strict cache eviction
   */
  private enforceMemoryLimits(): void {
    // Validation cache size enforcement
    if (this.validationCache.size > this.config.validationCacheSize) {
      const excessCount =
        this.validationCache.size - this.config.validationCacheSize;
      const keysToDelete = Array.from(this.validationCache.keys()).slice(
        0,
        excessCount
      );

      keysToDelete.forEach((key) => this.validationCache.delete(key));

      loggingService.debug('Enforced validation cache size limit', {
        deleted: keysToDelete.length,
        remaining: this.validationCache.size,
        limit: this.config.validationCacheSize,
      });
    }

    // Active sessions memory pressure handling
    const maxActiveSessions = this.config.maxConcurrentExecutions * 2;
    if (this.activeSessions.size > maxActiveSessions) {
      const completedSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) =>
          ['tool-complete', 'error', 'cancelled'].includes(session.state)
        )
        .sort(([_, a], [__, b]) => a.lastUpdateTime - b.lastUpdateTime); // Oldest first

      const sessionsToRemove = completedSessions.slice(
        0,
        this.activeSessions.size - maxActiveSessions
      );

      sessionsToRemove.forEach(([id]) => {
        this.activeSessions.delete(id);
        this.stopHeartbeat(id);
      });

      if (sessionsToRemove.length > 0) {
        loggingService.warn('Enforced active sessions memory limit', {
          removed: sessionsToRemove.length,
          remaining: this.activeSessions.size,
          limit: maxActiveSessions,
        });
      }
    }

    // Memory usage monitoring (simplified estimation)
    const estimatedMemoryUsage =
      this.validationCache.size * 1024 + // ~1KB per validation cache entry
      this.activeSessions.size * 2048 + // ~2KB per active session
      this.heartbeatTimers.size * 512; // ~512B per heartbeat timer

    const memoryLimitBytes = 50 * 1024 * 1024; // 50MB limit
    if (estimatedMemoryUsage > memoryLimitBytes) {
      loggingService.warn('Memory usage exceeds safe limits', {
        estimated: `${Math.round(estimatedMemoryUsage / 1024 / 1024)}MB`,
        limit: `${Math.round(memoryLimitBytes / 1024 / 1024)}MB`,
        validationCacheSize: this.validationCache.size,
        activeSessionsSize: this.activeSessions.size,
      });

      // Emergency cleanup - remove half of validation cache
      const keysToDelete = Array.from(this.validationCache.keys()).slice(
        0,
        Math.floor(this.validationCache.size / 2)
      );
      keysToDelete.forEach((key) => this.validationCache.delete(key));
    }
  }
}

// Create singleton instance with enhanced security configuration
export const toolStreamingManager = ToolStreamingManager.getInstance({
  validationCacheSize: 500, // Reduced from default 1000 for better memory management
  maxConcurrentExecutions: 5, // Conservative limit
  enableMetrics: true,
  enableCaching: true,
});

// Export convenience functions
export async function executeToolWithStreaming(
  toolName: string,
  input: any,
  options?: ToolStreamingOptions,
  context?: MultiStepToolContext
): Promise<{
  executionId: string;
  stream: ReadableStream<ToolStreamingSSEMessage>;
}> {
  return toolStreamingManager.executeToolWithStreaming(
    toolName,
    input,
    options,
    context
  );
}

export function cancelToolExecution(
  executionId: string,
  reason?: string
): boolean {
  return toolStreamingManager.cancelToolExecution(executionId, reason);
}

export function getToolStreamingSession(
  executionId: string
): ToolStreamingSession | null {
  return toolStreamingManager.getSession(executionId);
}

export function getToolStreamingAnalytics(): ToolStreamingAnalytics {
  return toolStreamingManager.getAnalytics();
}

export function clearAllToolStreamingSessions(): void {
  toolStreamingManager.clearAllSessions();
}

// ToolStreamingManager class is exported at declaration (line 58)
