import { type Attributes, context, trace } from '@opentelemetry/api';
import type {
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  LanguageModelUsage,
} from 'ai';
import { EventEmitter } from 'events';
import {
  distributedTracing,
  type Span,
} from '../../telemetry/distributed-tracing';
// Note: Advanced telemetry features will be implemented in separate files

// Telemetry event types
export interface AITelemetryEvent {
  id: string;
  timestamp: number;
  type:
    | 'api_call'
    | 'tool_execution'
    | 'stream'
    | 'error'
    | 'cache_hit'
    | 'cache_miss';
  operation: string;
  model: string;
  duration: number;
  success: boolean;
  metadata: {
    prompt?: string;
    response?: string;
    usage?: LanguageModelUsage;
    error?: string;
    cacheKey?: string;
    toolName?: string;
    streamChunks?: number;
    requestMetadata?: LanguageModelRequestMetadata;
    responseMetadata?: LanguageModelResponseMetadata;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
    legacy?: boolean;
    resultSize?: number;
    chunksPerSecond?: number;
    firstChunkTime?: number;
    lastChunkTime?: number;
    [key: string]: any; // Allow additional metadata
  };
}

// Metrics aggregation
export interface AIMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalDuration: number;
  averageDuration: number;
  totalTokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cacheMetrics: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  modelUsage: Map<string, number>;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
}

// User interaction tracking
export interface UserInteraction {
  userId: string;
  sessionId: string;
  timestamp: number;
  action: string;
  metadata: Record<string, any>;
}

// Performance span for detailed tracing
export interface PerformanceSpan {
  id: string;
  parentId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

/**
 * Enhanced AI Telemetry service with OpenTelemetry integration
 * Provides comprehensive monitoring with distributed tracing capabilities
 */
export class AITelemetry extends EventEmitter {
  private events: AITelemetryEvent[] = [];
  private interactions: UserInteraction[] = [];
  private spans: Map<string, PerformanceSpan> = new Map();
  private otelSpans: Map<string, Span> = new Map();
  private maxEventsSize = 10_000;
  private metricsCache: AIMetrics | null = null;
  private metricsCacheTime = 0;
  private metricsCacheTTL = 60_000; // 1 minute
  private correlationIds: Map<string, string> = new Map();

  constructor() {
    super();
    this.setupPeriodicCleanup();
    this.initializeTelemetrySystem();
  }

  /**
   * Initialize the telemetry system
   */
  private async initializeTelemetrySystem(): Promise<void> {
    // Basic telemetry is ready - advanced features will be added later
    console.log(
      '📊 Enhanced AI telemetry initialized with OpenTelemetry integration'
    );
  }

  /**
   * Enhanced AI API call tracking with OpenTelemetry integration
   */
  async trackAICall(
    operation: string,
    model: string,
    execute: () => Promise<any>,
    metadata?: any
  ): Promise<any> {
    const eventId = this.generateId();
    const correlationId = distributedTracing.generateCorrelationId();
    this.correlationIds.set(eventId, correlationId);

    // Create both legacy span and OpenTelemetry span
    const legacySpan = this.startSpan(operation, {
      model,
      correlationId,
      ...metadata,
    });

    return distributedTracing.trackAIOperation(
      operation,
      this.extractProvider(model),
      model,
      async (otelSpan: Span) => {
        // Store OpenTelemetry span for reference
        this.otelSpans.set(legacySpan.id, otelSpan);

        // Add correlation attributes
        otelSpan.setAttributes({
          'ai.telemetry.event_id': eventId,
          'ai.telemetry.correlation_id': correlationId,
          'ai.telemetry.legacy_span_id': legacySpan.id,
        });

        const startTime = Date.now();

        try {
          const result = await execute();
          const duration = Date.now() - startTime;

          // Enhanced OpenTelemetry attributes
          const otelAttributes: Attributes = {
            'ai.operation.success': true,
            'ai.response.status': 'completed',
          };

          if (result.usage) {
            otelAttributes['ai.tokens.input'] = result.usage.inputTokens || 0;
            otelAttributes['ai.tokens.output'] = result.usage.outputTokens || 0;
            otelAttributes['ai.tokens.total'] =
              (result.usage.inputTokens || 0) +
              (result.usage.outputTokens || 0);
          }

          if (result.responseMetadata) {
            otelAttributes['ai.response.finish_reason'] =
              result.responseMetadata.finishReason || 'unknown';
          }

          otelSpan.setAttributes(otelAttributes);
          otelSpan.addEvent('ai.call.completed', { duration_ms: duration });

          // Metrics integration placeholder - will be enhanced with dedicated metrics system

          // Track legacy event
          this.trackEvent({
            id: eventId,
            timestamp: startTime,
            type: 'api_call',
            operation,
            model,
            duration,
            success: true,
            metadata: {
              usage: result.usage,
              responseMetadata: result.responseMetadata,
              correlationId,
              traceId: otelSpan.spanContext().traceId,
              spanId: otelSpan.spanContext().spanId,
              ...metadata,
            },
          });

          this.endSpan(legacySpan.id, 'completed');
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          // Enhanced error tracking in OpenTelemetry
          otelSpan.setAttributes({
            'ai.operation.success': false,
            'ai.response.status': 'failed',
            'ai.error.type':
              error instanceof Error ? error.constructor.name : 'UnknownError',
          });
          otelSpan.addEvent('ai.call.failed', {
            duration_ms: duration,
            error_message: errorMessage,
          });

          // Error metrics integration placeholder

          // Track legacy error event
          this.trackEvent({
            id: eventId,
            timestamp: startTime,
            type: 'error',
            operation,
            model,
            duration,
            success: false,
            metadata: {
              error: errorMessage,
              correlationId,
              traceId: otelSpan.spanContext().traceId,
              spanId: otelSpan.spanContext().spanId,
              ...metadata,
            },
          });

          this.endSpan(legacySpan.id, 'failed');
          throw error;
        } finally {
          // Cleanup span references
          this.otelSpans.delete(legacySpan.id);
          this.correlationIds.delete(eventId);
        }
      },
      {
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        inputTokens: metadata?.estimatedInputTokens,
        temperature: metadata?.temperature,
        topP: metadata?.topP,
      }
    );
  }

  /**
   * Enhanced tool execution tracking with OpenTelemetry integration
   */
  async trackToolExecution(
    toolName: string,
    params: any,
    execute: () => Promise<any>,
    metadata?: {
      userId?: string;
      sessionId?: string;
      workflowId?: string;
      stepIndex?: number;
    }
  ): Promise<any> {
    const eventId = this.generateId();
    const correlationId = distributedTracing.generateCorrelationId();
    this.correlationIds.set(eventId, correlationId);

    return distributedTracing.trackToolExecution(
      toolName,
      async (otelSpan: Span) => {
        const startTime = Date.now();

        // Add telemetry correlation attributes
        otelSpan.setAttributes({
          'ai.telemetry.event_id': eventId,
          'ai.telemetry.correlation_id': correlationId,
          'tool.input_size': JSON.stringify(params).length,
          'tool.parameters_hash': this.hashObject(params),
        });

        try {
          const result = await execute();
          const duration = Date.now() - startTime;

          // Add success attributes
          otelSpan.setAttributes({
            'tool.execution.success': true,
            'tool.output_size':
              typeof result === 'object'
                ? JSON.stringify(result).length
                : String(result).length,
          });

          // Tool execution metrics placeholder

          // Track legacy event
          this.trackEvent({
            id: eventId,
            timestamp: startTime,
            type: 'tool_execution',
            operation: `tool:${toolName}`,
            model: 'n/a',
            duration,
            success: true,
            metadata: {
              toolName,
              correlationId,
              traceId: otelSpan.spanContext().traceId,
              spanId: otelSpan.spanContext().spanId,
              prompt: JSON.stringify(params).substring(0, 200),
              resultSize:
                typeof result === 'object'
                  ? JSON.stringify(result).length
                  : String(result).length,
            },
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          // Add error attributes
          otelSpan.setAttributes({
            'tool.execution.success': false,
            'tool.error.type':
              error instanceof Error ? error.constructor.name : 'UnknownError',
          });

          // Tool execution error metrics placeholder

          // Track legacy error event
          this.trackEvent({
            id: eventId,
            timestamp: startTime,
            type: 'tool_execution',
            operation: `tool:${toolName}`,
            model: 'n/a',
            duration,
            success: false,
            metadata: {
              toolName,
              error: errorMessage,
              correlationId,
              traceId: otelSpan.spanContext().traceId,
              spanId: otelSpan.spanContext().spanId,
              prompt: JSON.stringify(params).substring(0, 200),
            },
          });

          throw error;
        } finally {
          this.correlationIds.delete(eventId);
        }
      },
      {
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        parameters: params,
        workflowId: metadata?.workflowId,
        stepIndex: metadata?.stepIndex,
      }
    );
  }

  /**
   * Legacy synchronous tool execution tracking (deprecated but maintained for compatibility)
   */
  trackToolExecutionSync(
    toolName: string,
    params: any,
    result: any,
    duration: number,
    success: boolean,
    error?: Error
  ) {
    this.trackEvent({
      id: this.generateId(),
      timestamp: Date.now(),
      type: 'tool_execution',
      operation: `tool:${toolName}`,
      model: 'n/a',
      duration,
      success,
      metadata: {
        toolName,
        error: error?.message,
        prompt: JSON.stringify(params).substring(0, 200),
        legacy: true,
      },
    });
  }

  /**
   * Enhanced streaming response tracking with OpenTelemetry integration
   */
  trackStreaming(
    operation: string,
    model: string,
    chunks: number,
    duration: number,
    totalTokens?: number,
    metadata?: {
      userId?: string;
      sessionId?: string;
      firstChunkTime?: number;
      lastChunkTime?: number;
    }
  ) {
    const eventId = this.generateId();
    const correlationId = distributedTracing.generateCorrelationId();

    // Create a span for the streaming operation
    const otelSpan = distributedTracing.startSpan(`Stream ${operation}`, {
      kind: 1, // CLIENT
      operation: `ai.stream.${operation}`,
      aiProvider: this.extractProvider(model),
      model,
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      correlationId,
    });

    // Add streaming-specific attributes
    otelSpan.setAttributes({
      'ai.stream.chunks_total': chunks,
      'ai.stream.duration_ms': duration,
      'ai.stream.chunks_per_second': chunks / (duration / 1000),
      'ai.telemetry.event_id': eventId,
      'ai.telemetry.correlation_id': correlationId,
    });

    if (totalTokens) {
      otelSpan.setAttribute('ai.tokens.total', totalTokens);
      otelSpan.setAttribute(
        'ai.stream.tokens_per_second',
        totalTokens / (duration / 1000)
      );
    }

    if (metadata?.firstChunkTime && metadata?.lastChunkTime) {
      const streamDuration = metadata.lastChunkTime - metadata.firstChunkTime;
      otelSpan.setAttribute(
        'ai.stream.first_chunk_latency',
        metadata.firstChunkTime
      );
      otelSpan.setAttribute('ai.stream.actual_duration_ms', streamDuration);
    }

    // Add streaming events
    otelSpan.addEvent('ai.stream.started', {
      chunks_expected: chunks,
      model,
    });
    otelSpan.addEvent('ai.stream.completed', {
      chunks_received: chunks,
      total_duration_ms: duration,
    });

    // Track legacy event
    this.trackEvent({
      id: eventId,
      timestamp: Date.now(),
      type: 'stream',
      operation,
      model,
      duration,
      success: true,
      metadata: {
        streamChunks: chunks,
        usage: totalTokens
          ? { inputTokens: 0, outputTokens: totalTokens, totalTokens }
          : undefined,
        correlationId,
        traceId: otelSpan.spanContext().traceId,
        spanId: otelSpan.spanContext().spanId,
        chunksPerSecond: chunks / (duration / 1000),
        firstChunkTime: metadata?.firstChunkTime,
        lastChunkTime: metadata?.lastChunkTime,
      },
    });

    // End the OpenTelemetry span
    otelSpan.setStatus({ code: 1 }); // OK
    otelSpan.end();
  }

  /**
   * Track cache operations
   */
  trackCacheOperation(
    operation: string,
    hit: boolean,
    cacheKey: string,
    duration: number
  ) {
    this.trackEvent({
      id: this.generateId(),
      timestamp: Date.now(),
      type: hit ? 'cache_hit' : 'cache_miss',
      operation,
      model: 'cache',
      duration,
      success: true,
      metadata: { cacheKey },
    });
  }

  /**
   * Enhanced user interaction tracking with OpenTelemetry integration
   */
  trackUserInteraction(
    userId: string,
    sessionId: string,
    action: string,
    metadata: any
  ) {
    const eventId = this.generateId();
    const correlationId = distributedTracing.generateCorrelationId();

    // Create OpenTelemetry span for user interaction
    const otelSpan = distributedTracing.startSpan(`User ${action}`, {
      kind: 3, // INTERNAL
      operation: 'user.interaction',
      userId,
      sessionId,
      correlationId,
    });

    // Add user interaction attributes
    otelSpan.setAttributes({
      'user.action': action,
      'user.session.id': sessionId,
      'user.id': userId,
      'ai.telemetry.event_id': eventId,
      'ai.telemetry.correlation_id': correlationId,
      'interaction.metadata_size': JSON.stringify(metadata).length,
    });

    // Add metadata as attributes (sanitized)
    const sanitizedMetadata = this.sanitizeMetadata(metadata);
    for (const [key, value] of Object.entries(sanitizedMetadata)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        otelSpan.setAttribute(`interaction.${key}`, value);
      }
    }

    otelSpan.addEvent('user.interaction.recorded', {
      action,
      timestamp: Date.now(),
    });

    // Store interaction
    this.interactions.push({
      userId,
      sessionId,
      timestamp: Date.now(),
      action,
      metadata: {
        ...metadata,
        correlationId,
        traceId: otelSpan.spanContext().traceId,
        spanId: otelSpan.spanContext().spanId,
      },
    });

    // Emit event for real-time monitoring
    this.emit('user-interaction', {
      userId,
      sessionId,
      action,
      metadata: {
        ...metadata,
        correlationId,
        traceId: otelSpan.spanContext().traceId,
      },
    });

    // End OpenTelemetry span
    otelSpan.setStatus({ code: 1 }); // OK
    otelSpan.end();

    // Cleanup old interactions
    if (this.interactions.length > this.maxEventsSize) {
      this.interactions = this.interactions.slice(-this.maxEventsSize / 2);
    }
  }

  /**
   * Start a performance span
   */
  startSpan(
    operation: string,
    metadata: Record<string, any> = {}
  ): PerformanceSpan {
    const span: PerformanceSpan = {
      id: this.generateId(),
      operation,
      startTime: Date.now(),
      status: 'running',
      metadata,
    };

    this.spans.set(span.id, span);
    this.emit('span-start', span);
    return span;
  }

  /**
   * End a performance span
   */
  endSpan(spanId: string, status: 'completed' | 'failed') {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    this.emit('span-end', span);
  }

  /**
   * Get aggregated metrics
   */
  getMetrics(forceRefresh = false): AIMetrics {
    const now = Date.now();

    // Return cached metrics if still valid
    if (
      !forceRefresh &&
      this.metricsCache &&
      now - this.metricsCacheTime < this.metricsCacheTTL
    ) {
      return this.metricsCache;
    }

    // Calculate fresh metrics
    const metrics: AIMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      cacheMetrics: { hits: 0, misses: 0, hitRate: 0 },
      modelUsage: new Map(),
      errorRate: 0,
      p95Duration: 0,
      p99Duration: 0,
    };

    const durations: number[] = [];

    for (const event of this.events) {
      if (event.type === 'api_call' || event.type === 'tool_execution') {
        metrics.totalCalls++;
        metrics.totalDuration += event.duration;
        durations.push(event.duration);

        if (event.success) {
          metrics.successfulCalls++;
        } else {
          metrics.failedCalls++;
        }

        // Token usage
        if (event.metadata.usage) {
          metrics.totalTokens.prompt += event.metadata.usage.inputTokens || 0;
          metrics.totalTokens.completion +=
            event.metadata.usage.outputTokens || 0;
          metrics.totalTokens.total +=
            (event.metadata.usage.inputTokens || 0) +
            (event.metadata.usage.outputTokens || 0);
        }

        // Model usage
        const modelCount = metrics.modelUsage.get(event.model) || 0;
        metrics.modelUsage.set(event.model, modelCount + 1);
      }

      // Cache metrics
      if (event.type === 'cache_hit') {
        metrics.cacheMetrics.hits++;
      } else if (event.type === 'cache_miss') {
        metrics.cacheMetrics.misses++;
      }
    }

    // Calculate derived metrics
    if (metrics.totalCalls > 0) {
      metrics.averageDuration = metrics.totalDuration / metrics.totalCalls;
      metrics.errorRate = metrics.failedCalls / metrics.totalCalls;
    }

    if (metrics.cacheMetrics.hits + metrics.cacheMetrics.misses > 0) {
      metrics.cacheMetrics.hitRate =
        metrics.cacheMetrics.hits /
        (metrics.cacheMetrics.hits + metrics.cacheMetrics.misses);
    }

    // Calculate percentiles
    if (durations.length > 0) {
      durations.sort((a, b) => a - b);
      metrics.p95Duration = durations[Math.floor(durations.length * 0.95)];
      metrics.p99Duration = durations[Math.floor(durations.length * 0.99)];
    }

    // Cache the metrics
    this.metricsCache = metrics;
    this.metricsCacheTime = now;

    return metrics;
  }

  /**
   * Get user behavior analytics
   */
  getUserAnalytics(userId?: string): {
    totalInteractions: number;
    uniqueUsers: number;
    averageSessionLength: number;
    popularActions: Map<string, number>;
    userJourney: UserInteraction[];
  } {
    const filteredInteractions = userId
      ? this.interactions.filter((i) => i.userId === userId)
      : this.interactions;

    const analytics = {
      totalInteractions: filteredInteractions.length,
      uniqueUsers: new Set(filteredInteractions.map((i) => i.userId)).size,
      averageSessionLength: 0,
      popularActions: new Map<string, number>(),
      userJourney: filteredInteractions,
    };

    // Calculate popular actions
    for (const interaction of filteredInteractions) {
      const count = analytics.popularActions.get(interaction.action) || 0;
      analytics.popularActions.set(interaction.action, count + 1);
    }

    // Calculate average session length
    const sessions = new Map<string, { start: number; end: number }>();
    for (const interaction of filteredInteractions) {
      const session = sessions.get(interaction.sessionId) || {
        start: interaction.timestamp,
        end: interaction.timestamp,
      };
      session.end = Math.max(session.end, interaction.timestamp);
      sessions.set(interaction.sessionId, session);
    }

    if (sessions.size > 0) {
      const totalSessionTime = Array.from(sessions.values()).reduce(
        (sum, session) => sum + (session.end - session.start),
        0
      );
      analytics.averageSessionLength = totalSessionTime / sessions.size;
    }

    return analytics;
  }

  /**
   * Export telemetry data
   */
  exportData(options?: {
    startTime?: number;
    endTime?: number;
    format?: 'json' | 'csv';
  }): string {
    const startTime = options?.startTime || 0;
    const endTime = options?.endTime || Date.now();
    const format = options?.format || 'json';

    const filteredEvents = this.events.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime
    );

    if (format === 'json') {
      return JSON.stringify(
        {
          events: filteredEvents,
          interactions: this.interactions.filter(
            (i) => i.timestamp >= startTime && i.timestamp <= endTime
          ),
          metrics: this.getMetrics(),
          exportTime: Date.now(),
        },
        null,
        2
      );
    }
    // CSV format
    const headers = [
      'timestamp',
      'type',
      'operation',
      'model',
      'duration',
      'success',
      'error',
    ];
    const rows = filteredEvents.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.type,
      e.operation,
      e.model,
      e.duration,
      e.success,
      e.metadata.error || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Send telemetry to external service
   */
  async sendTelemetry(endpoint: string, apiKey: string): Promise<void> {
    const data = {
      events: this.events.slice(-1000), // Last 1000 events
      metrics: this.getMetrics(),
      timestamp: Date.now(),
    };

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(data),
      });

      // Clear sent events
      this.events = this.events.slice(-100);
    } catch (error) {
      console.error('Failed to send telemetry:', error);
    }
  }

  // Private helper methods

  private trackEvent(event: AITelemetryEvent) {
    this.events.push(event);
    this.emit('event', event);

    // Cleanup if too many events
    if (this.events.length > this.maxEventsSize) {
      this.events = this.events.slice(-this.maxEventsSize / 2);
    }
  }

  /**
   * Get current OpenTelemetry trace context for correlation
   */
  getCurrentTraceContext(): {
    traceId?: string;
    spanId?: string;
    correlationId?: string;
  } {
    const currentSpan = distributedTracing.getCurrentSpan();
    if (currentSpan) {
      const spanContext = currentSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  /**
   * Create a child span from current context
   */
  createChildSpan(name: string, operation: string, metadata?: any): Span {
    return distributedTracing.createChildSpan(name, {
      operation,
      ...metadata,
    });
  }

  /**
   * Extract provider name from model string
   */
  private extractProvider(model: string): string {
    if (model.includes('gpt') || model.includes('openai')) return 'openai';
    if (model.includes('claude') || model.includes('anthropic'))
      return 'anthropic';
    if (model.includes('gemini') || model.includes('google')) return 'google';
    if (model.includes('llama') || model.includes('meta')) return 'meta';
    return 'unknown';
  }

  /**
   * Estimate cost based on model and usage (August 2025 pricing)
   */
  private estimateCost(model: string, usage?: LanguageModelUsage): number {
    if (!usage) return 0;

    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;

    // August 2025 estimated pricing per 1K tokens
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.000_15, output: 0.0006 },
      'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
      'gpt-4.1-mini': { input: 0.0002, output: 0.0008 },
      'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.000_25, output: 0.001_25 },
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-flash': { input: 0.000_075, output: 0.0003 },
    };

    // Find matching pricing
    const modelKey = Object.keys(pricing).find((key) =>
      model.toLowerCase().includes(key.toLowerCase())
    );
    if (!modelKey) {
      // Default pricing for unknown models
      return (inputTokens * 0.001 + outputTokens * 0.002) / 1000;
    }

    const modelPricing = pricing[modelKey];
    return (
      (inputTokens * modelPricing.input + outputTokens * modelPricing.output) /
      1000
    );
  }

  /**
   * Hash object for consistent identification
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitize metadata for OpenTelemetry attributes
   */
  private sanitizeMetadata(metadata: any): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Skip sensitive fields
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('key')
      ) {
        continue;
      }

      // Only include primitive types
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      } else if (value !== null && value !== undefined) {
        sanitized[key] = typeof value;
      }
    }
    return sanitized;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupPeriodicCleanup() {
    // Clean up old data every hour
    setInterval(
      () => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        // Clean up old events
        this.events = this.events.filter((e) => e.timestamp > oneHourAgo);

        // Clean up old interactions
        this.interactions = this.interactions.filter(
          (i) => i.timestamp > oneHourAgo
        );

        // Clean up completed spans
        const spansToDelete: string[] = [];
        this.spans.forEach((span, id) => {
          if (
            span.status !== 'running' &&
            span.endTime &&
            span.endTime < oneHourAgo
          ) {
            spansToDelete.push(id);
          }
        });
        spansToDelete.forEach((id) => this.spans.delete(id));
      },
      60 * 60 * 1000
    ); // Every hour
  }
}

// Global telemetry instance
export const aiTelemetry = new AITelemetry();

// Convenience decorator for telemetry
export function trackAI(operation: string) {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const model = args[0]?.model || 'unknown';
      return aiTelemetry.trackAICall(
        `${operation}:${propertyName}`,
        model,
        () => originalMethod.apply(this, args),
        { args: args.slice(0, 2) } // Only track first 2 args for privacy
      );
    };

    return descriptor;
  };
}

// Re-export types for convenience
export type {
  AITelemetryEvent as TelemetryEvent,
  AIMetrics as Metrics,
  UserInteraction as Interaction,
  PerformanceSpan as Span,
};
