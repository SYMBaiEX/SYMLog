// distributed-tracing.test.ts - Comprehensive tests for distributed tracing service
// Tests August 2025 OpenTelemetry integration patterns and AI-specific tracing

import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  Mock,
  test,
  vi,
} from 'vitest';
import {
  DistributedTracingService,
  distributedTracing,
} from '../distributed-tracing';

// Mock OpenTelemetry APIs
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => mockTracer),
    getActiveSpan: vi.fn(() => mockSpan),
    setSpan: vi.fn(() => mockContext),
  },
  context: {
    active: vi.fn(() => mockContext),
  },
  propagation: {
    extract: vi.fn(() => mockContext),
    inject: vi.fn(),
  },
  SpanKind: {
    CLIENT: 1,
    SERVER: 2,
    INTERNAL: 3,
    PRODUCER: 4,
    CONSUMER: 5,
  },
  SpanStatusCode: {
    UNSET: 0,
    OK: 1,
    ERROR: 2,
  },
}));

// Mock OpenTelemetry tracer and span
const mockSpan = {
  spanContext: vi.fn(() => ({
    traceId: 'test-trace-id-123',
    spanId: 'test-span-id-456',
    traceFlags: 1,
  })),
  setAttributes: vi.fn(),
  setAttribute: vi.fn(),
  addEvent: vi.fn(),
  setStatus: vi.fn(),
  end: vi.fn(),
  recordException: vi.fn(),
};

const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
  startActiveSpan: vi.fn((name, options, fn) => {
    if (typeof fn === 'function') {
      return fn(mockSpan);
    }
    return mockSpan;
  }),
};

const mockContext = {
  active: vi.fn(() => mockContext),
};

describe('DistributedTracingService', () => {
  let tracingService: DistributedTracingService;

  beforeEach(() => {
    tracingService = new DistributedTracingService('test-service');
    vi.clearAllMocks();
  });

  describe('Span Management', () => {
    test('should create spans with AI-specific attributes', () => {
      const span = tracingService.startSpan('AI Operation', {
        operation: 'chat-completion',
        aiProvider: 'openai',
        model: 'gpt-4.1-nano',
        userId: 'test-user',
        sessionId: 'test-session',
        correlationId: 'test-correlation',
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'AI Operation',
        expect.any(Object)
      );
      expect(span.setAttributes).toHaveBeenCalledWith({
        'ai.operation': 'chat-completion',
        'ai.provider': 'openai',
        'ai.model': 'gpt-4.1-nano',
        'user.id': 'test-user',
        'session.id': 'test-session',
        'correlation.id': 'test-correlation',
        'service.name': 'test-service',
        'service.version': '1.0.0',
      });
    });

    test('should set appropriate span kinds based on operation type', () => {
      // HTTP operation should be CLIENT
      tracingService.startSpan('HTTP Request', { operation: 'http.call' });
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({ kind: SpanKind.CLIENT })
      );

      // Tool operation should be INTERNAL
      tracingService.startSpan('Tool Execution', { operation: 'tool.execute' });
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'Tool Execution',
        expect.objectContaining({ kind: SpanKind.INTERNAL })
      );
    });

    test('should create active spans with automatic context management', () => {
      const mockExecute = vi.fn().mockReturnValue('test-result');

      const result = tracingService.startActiveSpan(
        'Active Operation',
        { operation: 'test', aiProvider: 'test-provider' },
        mockExecute
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(mockSpan);
      expect(result).toBe('test-result');
    });

    test('should handle async operations in active spans', async () => {
      const mockAsyncExecute = vi.fn().mockResolvedValue('async-result');

      const result = await tracingService.startActiveSpan(
        'Async Operation',
        { operation: 'async-test' },
        mockAsyncExecute
      );

      expect(mockAsyncExecute).toHaveBeenCalledWith(mockSpan);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('async-result');
    });

    test('should handle errors in active spans', async () => {
      const testError = new Error('Test error');
      const mockFailingExecute = vi.fn().mockRejectedValue(testError);

      await expect(
        tracingService.startActiveSpan(
          'Failing Operation',
          { operation: 'failing-test' },
          mockFailingExecute
        )
      ).rejects.toThrow('Test error');

      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'error.type': 'Error',
          'error.message': 'Test error',
          'error.handled': true,
        })
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error',
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('Context Propagation', () => {
    test('should get current span from active context', () => {
      const span = tracingService.getCurrentSpan();
      expect(trace.getActiveSpan).toHaveBeenCalled();
      expect(span).toBe(mockSpan);
    });

    test('should get current trace context', () => {
      const ctx = tracingService.getCurrentContext();
      expect(context.active).toHaveBeenCalled();
      expect(ctx).toBe(mockContext);
    });

    test('should create child spans with parent context', () => {
      const childSpan = tracingService.createChildSpan('Child Operation');

      expect(trace.getTracer).toHaveBeenCalledWith('test-service', '1.0.0');
      expect(childSpan).toBeDefined();
    });

    test('should extract context from HTTP headers', () => {
      const headers = {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'rojo=00f067aa0ba902b7,congo=t61rcWkgMzE',
      };

      const extractedContext =
        tracingService.extractContextFromHeaders(headers);
      expect(extractedContext).toBeDefined();
    });

    test('should inject context into HTTP headers', () => {
      const headers = {};
      const injectedHeaders = tracingService.injectContextIntoHeaders(headers);

      expect(injectedHeaders).toBeDefined();
      expect(typeof injectedHeaders).toBe('object');
    });
  });

  describe('AI Operation Tracking', () => {
    test('should track AI operations with comprehensive attributes', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: 'AI response',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await tracingService.trackAIOperation(
        'chat-completion',
        'openai',
        'gpt-4.1-nano',
        mockExecute,
        {
          userId: 'test-user',
          sessionId: 'test-session',
          inputTokens: 100,
          outputTokens: 50,
          temperature: 0.7,
          topP: 0.9,
        }
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'AI chat-completion',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          operation: 'ai.chat-completion',
          aiProvider: 'openai',
          model: 'gpt-4.1-nano',
          userId: 'test-user',
          sessionId: 'test-session',
        }),
        expect.any(Function)
      );

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'ai.tokens.input',
        100
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'ai.tokens.output',
        50
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('ai.temperature', 0.7);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('ai.top_p', 0.9);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('ai.operation.start');
      expect(mockSpan.addEvent).toHaveBeenCalledWith('ai.operation.complete', {
        duration_ms: expect.any(Number),
      });

      expect(result).toEqual({
        content: 'AI response',
        usage: { inputTokens: 100, outputTokens: 50 },
      });
    });

    test('should track AI operation failures with timing', async () => {
      const mockError = new Error('AI service unavailable');
      const mockExecute = vi.fn().mockRejectedValue(mockError);

      await expect(
        tracingService.trackAIOperation(
          'text-generation',
          'anthropic',
          'claude-3-opus',
          mockExecute
        )
      ).rejects.toThrow('AI service unavailable');

      expect(mockSpan.addEvent).toHaveBeenCalledWith('ai.operation.start');
      expect(mockSpan.addEvent).toHaveBeenCalledWith('ai.operation.failed', {
        duration_ms: expect.any(Number),
      });
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'ai.operation.duration_ms',
        expect.any(Number)
      );
    });
  });

  describe('Tool Execution Tracking', () => {
    test('should track tool execution with workflow context', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValue({ success: true, output: 'tool-result' });

      const result = await tracingService.trackToolExecution(
        'create-artifact',
        mockExecute,
        {
          userId: 'test-user',
          sessionId: 'test-session',
          parameters: { type: 'code', language: 'typescript' },
          workflowId: 'workflow-123',
          stepIndex: 2,
        }
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'Tool create-artifact',
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          operation: 'tool.execute',
          toolName: 'create-artifact',
          userId: 'test-user',
          sessionId: 'test-session',
        }),
        expect.any(Function)
      );

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'tool.parameters',
        JSON.stringify({ type: 'code', language: 'typescript' })
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'workflow.id',
        'workflow-123'
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('workflow.step', 2);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('tool.execution.start');
      expect(mockSpan.addEvent).toHaveBeenCalledWith('tool.execution.complete');

      expect(result).toEqual({ success: true, output: 'tool-result' });
    });

    test('should track tool execution failures', async () => {
      const mockError = new Error('Tool configuration invalid');
      const mockExecute = vi.fn().mockRejectedValue(mockError);

      await expect(
        tracingService.trackToolExecution('failing-tool', mockExecute)
      ).rejects.toThrow('Tool configuration invalid');

      expect(mockSpan.addEvent).toHaveBeenCalledWith('tool.execution.failed');
    });
  });

  describe('HTTP Request Tracking', () => {
    test('should track HTTP requests with semantic conventions', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValue({ status: 200, data: 'response' });

      const result = await tracingService.trackHttpRequest(
        'POST',
        'https://api.openai.com/v1/chat/completions',
        mockExecute,
        {
          headers: { 'Content-Type': 'application/json' },
          userAgent: 'SymLog-AI/1.0',
          userId: 'test-user',
          sessionId: 'test-session',
        }
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'HTTP POST',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          attributes: expect.objectContaining({
            'http.method': 'POST',
            'http.url': 'https://api.openai.com/v1/chat/completions',
            'user_agent.original': 'SymLog-AI/1.0',
            'user.id': 'test-user',
            'session.id': 'test-session',
          }),
        }),
        expect.any(Function)
      );

      expect(result).toEqual({ status: 200, data: 'response' });
    });

    test('should handle HTTP errors with status codes', async () => {
      const httpError = new Error('Rate limit exceeded');
      (httpError as any).status = 429;
      const mockExecute = vi.fn().mockRejectedValue(httpError);

      await expect(
        tracingService.trackHttpRequest(
          'GET',
          'https://api.test.com/data',
          mockExecute
        )
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'http.status_code',
        429
      );
    });
  });

  describe('Error Handling', () => {
    test('should record different error types correctly', () => {
      const errorCases = [
        { error: new Error('Standard error'), expectedType: 'Error' },
        { error: 'String error', expectedType: 'StringError' },
        { error: { custom: 'object' }, expectedType: 'UnknownError' },
        { error: null, expectedType: 'UnknownError' },
      ];

      errorCases.forEach(({ error, expectedType }) => {
        vi.clearAllMocks();
        tracingService.recordError(mockSpan, error);

        expect(mockSpan.setAttributes).toHaveBeenCalledWith(
          expect.objectContaining({
            'error.type': expectedType,
            'error.handled': true,
          })
        );
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
          code: SpanStatusCode.ERROR,
          message: expect.any(String),
        });
      });
    });

    test('should record exceptions with stack traces', () => {
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error\n    at test:1:1';

      tracingService.recordError(mockSpan, error);

      expect(mockSpan.recordException).toHaveBeenCalledWith({
        name: 'Error',
        message: 'Test error with stack',
        stack: 'Error: Test error\n    at test:1:1',
      });
    });
  });

  describe('Utility Functions', () => {
    test('should generate correlation IDs', () => {
      const correlationId = tracingService.generateCorrelationId();

      expect(correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/);
      expect(correlationId.length).toBeGreaterThan(10);
    });

    test('should create trace links for cross-service correlation', () => {
      const traceLink = tracingService.createTraceLink(
        'http',
        'external-service'
      );

      expect(traceLink).toBe(
        'test-trace-id-123-test-span-id-456-http-external-service'
      );
    });

    test('should return null trace link when no active span', () => {
      vi.mocked(trace.getActiveSpan).mockReturnValue(undefined);

      const traceLink = tracingService.createTraceLink('database', 'postgres');

      expect(traceLink).toBeNull();
    });

    test('should flush pending spans', async () => {
      await tracingService.flush();

      // Should end any active span
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('Advanced Features', () => {
    test('should set and add events to current span', () => {
      tracingService.setCurrentSpanAttributes({ 'custom.attribute': 'value' });
      tracingService.addCurrentSpanEvent('custom.event', { eventData: 'test' });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'custom.attribute': 'value',
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith('custom.event', {
        eventData: 'test',
      });
    });

    test('should handle operations when no active span exists', () => {
      vi.mocked(trace.getActiveSpan).mockReturnValue(undefined);

      // Should not throw errors
      tracingService.setCurrentSpanAttributes({ test: 'value' });
      tracingService.addCurrentSpanEvent('test.event');

      // Span methods should not be called
      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });
  });

  describe('Global Instance', () => {
    test('should provide singleton distributed tracing instance', () => {
      expect(distributedTracing).toBeInstanceOf(DistributedTracingService);
      expect(distributedTracing).toBeDefined();
    });

    test('should export convenience functions', () => {
      const {
        startSpan,
        startActiveSpan,
        getCurrentSpan,
        getCurrentContext,
        createChildSpan,
        setCurrentSpanAttributes,
        addCurrentSpanEvent,
        recordError,
        generateCorrelationId,
        trackHttpRequest,
        trackAIOperation,
        trackToolExecution,
        createTraceLink,
        flush,
      } = require('../distributed-tracing');

      // All convenience functions should be available
      expect(typeof startSpan).toBe('function');
      expect(typeof startActiveSpan).toBe('function');
      expect(typeof getCurrentSpan).toBe('function');
      expect(typeof getCurrentContext).toBe('function');
      expect(typeof createChildSpan).toBe('function');
      expect(typeof setCurrentSpanAttributes).toBe('function');
      expect(typeof addCurrentSpanEvent).toBe('function');
      expect(typeof recordError).toBe('function');
      expect(typeof generateCorrelationId).toBe('function');
      expect(typeof trackHttpRequest).toBe('function');
      expect(typeof trackAIOperation).toBe('function');
      expect(typeof trackToolExecution).toBe('function');
      expect(typeof createTraceLink).toBe('function');
      expect(typeof flush).toBe('function');
    });
  });
});

describe('Integration Scenarios', () => {
  test('should handle complete AI workflow with multiple operations', async () => {
    const tracingService = new DistributedTracingService('integration-test');

    // Simulate a complete AI workflow
    const result = await tracingService.trackAIOperation(
      'chat-completion',
      'openai',
      'gpt-4.1-nano',
      async (aiSpan) => {
        // Add workflow context
        aiSpan.setAttribute('workflow.type', 'code-generation');
        aiSpan.addEvent('workflow.started');

        // Simulate tool execution within AI operation
        const toolResult = await tracingService.trackToolExecution(
          'analyze-code',
          async (toolSpan) => {
            toolSpan.setAttribute('code.language', 'typescript');
            toolSpan.addEvent('analysis.started');

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 10));

            toolSpan.addEvent('analysis.completed');
            return { complexity: 'medium', issues: [] };
          },
          { stepIndex: 1 }
        );

        aiSpan.addEvent('tool.completed', {
          toolResult: JSON.stringify(toolResult),
        });

        return {
          content: 'Generated code based on analysis',
          usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
          toolResults: [toolResult],
        };
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBe('Generated code based on analysis');
    expect(result.toolResults[0]).toEqual({ complexity: 'medium', issues: [] });
  });

  test('should maintain correlation across async operations', async () => {
    const correlationId = distributedTracing.generateCorrelationId();

    // Start parent operation
    const parentResult = await distributedTracing.startActiveSpan(
      'Parent Operation',
      { correlationId },
      async (parentSpan) => {
        parentSpan.setAttribute('operation.type', 'parent');

        // Start child operation
        const childResult = await distributedTracing.trackAIOperation(
          'child-ai-call',
          'openai',
          'gpt-4.1-nano',
          async (childSpan) => {
            childSpan.setAttribute('operation.type', 'child');
            childSpan.setAttribute('correlation.id', correlationId);

            return { childData: 'success' };
          }
        );

        return { parentData: 'complete', child: childResult };
      }
    );

    expect(parentResult).toEqual({
      parentData: 'complete',
      child: { childData: 'success' },
    });
  });

  test('should handle error propagation across operation boundaries', async () => {
    await expect(
      distributedTracing.trackAIOperation(
        'failing-operation',
        'anthropic',
        'claude-3-opus',
        async (aiSpan) => {
          aiSpan.addEvent('operation.started');

          // Simulate nested tool that fails
          await distributedTracing.trackToolExecution(
            'failing-tool',
            async (toolSpan) => {
              toolSpan.addEvent('tool.processing');
              throw new Error('Tool execution failed');
            }
          );
        }
      )
    ).rejects.toThrow('Tool execution failed');

    // Both AI operation and tool execution spans should have recorded the error
    expect(mockSpan.recordException).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.ERROR })
    );
  });
});
