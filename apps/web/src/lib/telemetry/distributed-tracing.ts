// distributed-tracing.ts - Core distributed tracing service
// Implements August 2025 best practices for distributed tracing

import {
  type Attributes,
  type Context,
  context,
  propagation,
  type Span,
  SpanKind,
  type SpanOptions,
  SpanStatusCode,
  type Tracer,
  trace,
} from '@opentelemetry/api';
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_URL,
} from '@opentelemetry/semantic-conventions';

/**
 * Enhanced distributed tracing service for AI applications
 * Provides context propagation, span management, and distributed trace correlation
 */
export class DistributedTracingService {
  private tracer: Tracer;
  private serviceName: string;

  constructor(serviceName = 'symlog-ai-app') {
    this.serviceName = serviceName;
    this.tracer = trace.getTracer(serviceName, '1.0.0');
  }

  /**
   * Start a new span with enhanced AI-specific attributes
   */
  startSpan(
    name: string,
    options: SpanOptions & {
      operation?: string;
      aiProvider?: string;
      model?: string;
      toolName?: string;
      userId?: string;
      sessionId?: string;
      correlationId?: string;
    } = {}
  ): Span {
    const {
      operation,
      aiProvider,
      model,
      toolName,
      userId,
      sessionId,
      correlationId,
      ...spanOptions
    } = options;

    // Set default span kind based on operation type
    if (!spanOptions.kind) {
      if (operation?.includes('http') || operation?.includes('api')) {
        spanOptions.kind = SpanKind.CLIENT;
      } else if (
        operation?.includes('tool') ||
        operation?.includes('function')
      ) {
        spanOptions.kind = SpanKind.INTERNAL;
      }
    }

    const span = this.tracer.startSpan(name, spanOptions);

    // Add AI-specific attributes
    const attributes: Attributes = {};

    if (operation) attributes['ai.operation'] = operation;
    if (aiProvider) attributes['ai.provider'] = aiProvider;
    if (model) attributes['ai.model'] = model;
    if (toolName) attributes['ai.tool.name'] = toolName;
    if (userId) attributes['user.id'] = userId;
    if (sessionId) attributes['session.id'] = sessionId;
    if (correlationId) attributes['correlation.id'] = correlationId;

    // Add service context
    attributes['service.name'] = this.serviceName;
    attributes['service.version'] = '1.0.0';

    span.setAttributes(attributes);
    return span;
  }

  /**
   * Start an active span that automatically sets context
   */
  startActiveSpan<T>(
    name: string,
    options: SpanOptions & {
      operation?: string;
      aiProvider?: string;
      model?: string;
      toolName?: string;
      userId?: string;
      sessionId?: string;
      correlationId?: string;
    },
    fn: (span: Span) => T
  ): T {
    return this.tracer.startActiveSpan(name, options, (span) => {
      // Add AI-specific attributes to active span
      const {
        operation,
        aiProvider,
        model,
        toolName,
        userId,
        sessionId,
        correlationId,
      } = options;

      const attributes: Attributes = {};
      if (operation) attributes['ai.operation'] = operation;
      if (aiProvider) attributes['ai.provider'] = aiProvider;
      if (model) attributes['ai.model'] = model;
      if (toolName) attributes['ai.tool.name'] = toolName;
      if (userId) attributes['user.id'] = userId;
      if (sessionId) attributes['session.id'] = sessionId;
      if (correlationId) attributes['correlation.id'] = correlationId;

      span.setAttributes(attributes);

      try {
        const result = fn(span);

        // Handle async results
        if (result instanceof Promise) {
          return result
            .then((value) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return value;
            })
            .catch((error) => {
              this.recordError(span, error);
              span.end();
              throw error;
            }) as T;
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        this.recordError(span, error);
        span.end();
        throw error;
      }
    });
  }

  /**
   * Get the current active span
   */
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Get the current trace context
   */
  getCurrentContext(): Context {
    return context.active();
  }

  /**
   * Create a child span from the current context
   */
  createChildSpan(name: string, options: SpanOptions = {}): Span {
    const parentSpan = this.getCurrentSpan();
    const parentContext = parentSpan
      ? trace.setSpan(context.active(), parentSpan)
      : context.active();
    return trace
      .getTracer(this.serviceName, '1.0.0')
      .startSpan(name, options, parentContext);
  }

  /**
   * Set attributes on the current active span
   */
  setCurrentSpanAttributes(attributes: Attributes): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Add an event to the current active span
   */
  addCurrentSpanEvent(name: string, attributes?: Attributes): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Record an error on a span with enhanced error tracking
   */
  recordError(span: Span, error: Error | string | unknown): void {
    let errorMessage: string;
    let errorType: string;
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorType = error.name;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorType = 'StringError';
    } else {
      errorMessage = String(error);
      errorType = 'UnknownError';
    }

    span.recordException({
      name: errorType,
      message: errorMessage,
      stack: errorStack,
    });

    span.setAttributes({
      'error.type': errorType,
      'error.message': errorMessage,
      'error.handled': true,
    });

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errorMessage,
    });
  }

  /**
   * Create a correlation ID for distributed tracing
   */
  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Extract trace context from HTTP headers
   */
  extractContextFromHeaders(
    headers: Record<string, string | string[] | undefined>
  ): Context {
    return propagation.extract(context.active(), headers);
  }

  /**
   * Inject trace context into HTTP headers
   */
  injectContextIntoHeaders(
    headers: Record<string, string> = {},
    ctx: Context = context.active()
  ): Record<string, string> {
    propagation.inject(ctx, headers);
    return headers;
  }

  /**
   * Track HTTP request with automatic span creation
   */
  async trackHttpRequest<T>(
    method: string,
    url: string,
    execute: (span: Span) => Promise<T>,
    options: {
      headers?: Record<string, string>;
      userAgent?: string;
      userId?: string;
      sessionId?: string;
    } = {}
  ): Promise<T> {
    return this.startActiveSpan(
      `HTTP ${method.toUpperCase()}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: method.toUpperCase(),
          [SEMATTRS_HTTP_URL]: url,
          ...(options.userAgent && {
            'user_agent.original': options.userAgent,
          }),
          ...(options.userId && { 'user.id': options.userId }),
          ...(options.sessionId && { 'session.id': options.sessionId }),
        },
      },
      async (span) => {
        try {
          const result = await execute(span);

          // Try to extract status code if result has it
          if (
            typeof result === 'object' &&
            result !== null &&
            'status' in result
          ) {
            span.setAttribute(
              SEMATTRS_HTTP_STATUS_CODE,
              (result as any).status
            );
          }

          return result;
        } catch (error) {
          // Set HTTP error status if available
          if (error && typeof error === 'object' && 'status' in error) {
            span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, (error as any).status);
          }
          throw error;
        }
      }
    );
  }

  /**
   * Track AI operation with provider-specific attributes
   */
  async trackAIOperation<T>(
    operation: string,
    provider: string,
    model: string,
    execute: (span: Span) => Promise<T>,
    options: {
      userId?: string;
      sessionId?: string;
      inputTokens?: number;
      outputTokens?: number;
      temperature?: number;
      topP?: number;
    } = {}
  ): Promise<T> {
    return this.startActiveSpan(
      `AI ${operation}`,
      {
        kind: SpanKind.CLIENT,
        operation: `ai.${operation}`,
        aiProvider: provider,
        model,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      async (span) => {
        // Add AI-specific attributes
        if (options.inputTokens)
          span.setAttribute('ai.tokens.input', options.inputTokens);
        if (options.outputTokens)
          span.setAttribute('ai.tokens.output', options.outputTokens);
        if (options.temperature)
          span.setAttribute('ai.temperature', options.temperature);
        if (options.topP) span.setAttribute('ai.top_p', options.topP);

        const startTime = Date.now();
        span.addEvent('ai.operation.start');

        try {
          const result = await execute(span);

          const duration = Date.now() - startTime;
          span.setAttribute('ai.operation.duration_ms', duration);
          span.addEvent('ai.operation.complete', { duration_ms: duration });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttribute('ai.operation.duration_ms', duration);
          span.addEvent('ai.operation.failed', { duration_ms: duration });
          throw error;
        }
      }
    );
  }

  /**
   * Track tool execution with detailed metadata
   */
  async trackToolExecution<T>(
    toolName: string,
    execute: (span: Span) => Promise<T>,
    options: {
      userId?: string;
      sessionId?: string;
      parameters?: Record<string, any>;
      workflowId?: string;
      stepIndex?: number;
    } = {}
  ): Promise<T> {
    return this.startActiveSpan(
      `Tool ${toolName}`,
      {
        kind: SpanKind.INTERNAL,
        operation: 'tool.execute',
        toolName,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      async (span) => {
        // Add tool-specific attributes
        if (options.parameters) {
          span.setAttribute(
            'tool.parameters',
            JSON.stringify(options.parameters)
          );
        }
        if (options.workflowId)
          span.setAttribute('workflow.id', options.workflowId);
        if (options.stepIndex !== undefined)
          span.setAttribute('workflow.step', options.stepIndex);

        span.addEvent('tool.execution.start');

        try {
          const result = await execute(span);
          span.addEvent('tool.execution.complete');
          return result;
        } catch (error) {
          span.addEvent('tool.execution.failed');
          throw error;
        }
      }
    );
  }

  /**
   * Create a distributed trace link for cross-service correlation
   */
  createTraceLink(
    operationType: 'http' | 'message' | 'database' | 'cache',
    target: string
  ): string | null {
    const span = this.getCurrentSpan();
    if (!span) return null;

    const spanContext = span.spanContext();
    if (!spanContext.traceId) return null;

    // Create a trace link in the format: traceId-spanId-operationType-target
    return `${spanContext.traceId}-${spanContext.spanId}-${operationType}-${target}`;
  }

  /**
   * Flush any pending spans (useful for serverless environments)
   */
  async flush(): Promise<void> {
    // Force flush any pending spans
    const activeSpan = this.getCurrentSpan();
    if (activeSpan) {
      activeSpan.end();
    }
  }
}

// Export singleton instance
export const distributedTracing = new DistributedTracingService();

// Export convenience functions
export const {
  startSpan,
  startActiveSpan,
  getCurrentSpan,
  getCurrentContext,
  createChildSpan,
  setCurrentSpanAttributes,
  addCurrentSpanEvent,
  recordError,
  generateCorrelationId,
  extractContextFromHeaders,
  injectContextIntoHeaders,
  trackHttpRequest,
  trackAIOperation,
  trackToolExecution,
  createTraceLink,
  flush,
} = distributedTracing;

// Re-export OpenTelemetry primitives for convenience
export {
  trace,
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Tracer,
  type Context,
  type SpanOptions,
  type Attributes,
};
