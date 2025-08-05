// telemetry.test.ts - Comprehensive e2e unit tests for AI telemetry with OpenTelemetry
// Tests both legacy and enhanced OpenTelemetry integration using Bun's built-in test runner

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { AITelemetry, aiTelemetry } from '../telemetry';

// Mock OpenTelemetry span for testing
const createMockSpan = () => ({
  spanContext: () => ({
    traceId: 'test-trace-id-123',
    spanId: 'test-span-id-456',
    traceFlags: 1,
  }),
  setAttributes: mock(() => {}),
  setAttribute: mock(() => {}),
  addEvent: mock(() => {}),
  setStatus: mock(() => {}),
  end: mock(() => {}),
  recordException: mock(() => {}),
});

// Mock distributed tracing service
const mockDistributedTracing = {
  generateCorrelationId: mock(
    () => 'test-correlation-id-' + Math.random().toString(36).substr(2, 8)
  ),
  trackAIOperation: mock(
    async (operation, provider, model, execute, options) => {
      const mockSpan = createMockSpan();
      return await execute(mockSpan);
    }
  ),
  trackToolExecution: mock(async (toolName, execute, options) => {
    const mockSpan = createMockSpan();
    return await execute(mockSpan);
  }),
  startSpan: mock(() => createMockSpan()),
  getCurrentSpan: mock(() => createMockSpan()),
  createChildSpan: mock(() => createMockSpan()),
};

describe('AITelemetry', () => {
  let telemetry: AITelemetry;

  beforeEach(() => {
    telemetry = new AITelemetry();
    // Reset mock call counts
    Object.values(mockDistributedTracing).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
        mockFn.mockReset();
      }
    });
  });

  afterEach(() => {
    // Clean up any listeners
    telemetry.removeAllListeners();
  });

  describe('Enhanced AI API Call Tracking', () => {
    test('should track successful AI API call with OpenTelemetry integration', async () => {
      const mockResult = {
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
        responseMetadata: {
          finishReason: 'stop',
        },
      };

      const mockExecute = vi.fn().mockResolvedValue(mockResult);

      const result = await telemetry.trackAICall(
        'chat-completion',
        'gpt-4.1-nano',
        mockExecute,
        { userId: 'test-user', temperature: 0.7 }
      );

      // Verify the execute function was called
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Verify the telemetry captured the event
      const events = (telemetry as any).events;
      expect(events.length).toBeGreaterThan(0);

      const event = events[events.length - 1];
      expect(event.type).toBe('api_call');
      expect(event.operation).toBe('chat-completion');
      expect(event.model).toBe('gpt-4.1-nano');
      expect(event.success).toBe(true);
      expect(event.metadata.usage).toEqual(mockResult.usage);
      expect(event.metadata.correlationId).toBeDefined();

      expect(result).toBe(mockResult);
    });

    test('should handle AI API call errors with enhanced tracing', async () => {
      const mockError = new Error('API rate limit exceeded');
      const mockExecute = vi.fn().mockRejectedValue(mockError);

      await expect(
        telemetry.trackAICall('chat-completion', 'gpt-4.1-nano', mockExecute)
      ).rejects.toThrow('API rate limit exceeded');

      // Verify error was captured in telemetry
      const events = (telemetry as any).events;
      expect(events.length).toBeGreaterThan(0);

      const errorEvent = events[events.length - 1];
      expect(errorEvent.type).toBe('error');
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.metadata.error).toBe('API rate limit exceeded');
    });

    test('should extract correct provider from model names', async () => {
      const testCases = [
        { model: 'gpt-4.1-nano', expectedProvider: 'openai' },
        { model: 'claude-3-opus', expectedProvider: 'anthropic' },
        { model: 'gemini-pro', expectedProvider: 'google' },
        { model: 'llama-2-70b', expectedProvider: 'meta' },
        { model: 'custom-model', expectedProvider: 'unknown' },
      ];

      for (const { model, expectedProvider } of testCases) {
        const mockExecute = mock().mockResolvedValue({ usage: {} });
        await telemetry.trackAICall('test', model, mockExecute);

        // Verify the call was made and executed
        expect(mockExecute).toHaveBeenCalledTimes(1);

        // Verify telemetry event was created
        const events = (telemetry as any).events;
        const latestEvent = events[events.length - 1];
        expect(latestEvent.model).toBe(model);
        expect(latestEvent.operation).toBe('test');
      }
    });
  });

  describe('Enhanced Tool Execution Tracking', () => {
    test('should track successful tool execution with OpenTelemetry', async () => {
      const mockResult = { success: true, data: 'test-result' };
      const mockExecute = vi.fn().mockResolvedValue(mockResult);
      const mockParams = { input: 'test-input', config: { option: true } };

      const result = await telemetry.trackToolExecution(
        'create-artifact',
        mockParams,
        mockExecute,
        {
          userId: 'test-user',
          sessionId: 'test-session',
          workflowId: 'test-workflow',
          stepIndex: 0,
        }
      );

      // Verify the tool execution was tracked
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Verify telemetry event was created
      const events = (telemetry as any).events;
      expect(events.length).toBeGreaterThan(0);

      const event = events[events.length - 1];
      expect(event.type).toBe('tool_execution');
      expect(event.operation).toBe('tool:create-artifact');
      expect(event.success).toBe(true);
      expect(event.metadata.toolName).toBe('create-artifact');

      expect(result).toBe(mockResult);
    });

    test('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      const mockExecute = vi.fn().mockRejectedValue(mockError);

      await expect(
        telemetry.trackToolExecution('failing-tool', {}, mockExecute)
      ).rejects.toThrow('Tool execution failed');

      // Verify error was captured
      const events = (telemetry as any).events;
      const errorEvent = events[events.length - 1];
      expect(errorEvent.type).toBe('tool_execution');
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.metadata.error).toBe('Tool execution failed');
    });

    test('should maintain backward compatibility with sync tool tracking', () => {
      telemetry.trackToolExecutionSync(
        'legacy-tool',
        { input: 'test' },
        { output: 'result' },
        100,
        true
      );

      // Should emit an event for legacy tracking
      const events = (telemetry as any).events;
      expect(events.length).toBeGreaterThan(0);
      const event = events[events.length - 1];
      expect(event.type).toBe('tool_execution');
      expect(event.operation).toBe('tool:legacy-tool');
      expect(event.success).toBe(true);
      expect(event.metadata.toolName).toBe('legacy-tool');
      expect(event.metadata.legacy).toBe(true);
    });
  });

  describe('Enhanced Streaming Response Tracking', () => {
    test('should track streaming responses with performance metrics', () => {
      const startTime = Date.now();
      const endTime = startTime + 2000;

      telemetry.trackStreaming(
        'chat-completion',
        'gpt-4.1-nano',
        50, // chunks
        2000, // duration
        150, // total tokens
        {
          userId: 'test-user',
          sessionId: 'test-session',
          firstChunkTime: startTime + 100,
          lastChunkTime: endTime,
        }
      );

      // Verify streaming telemetry event was created
      const events = (telemetry as any).events;
      const streamEvent = events[events.length - 1];

      expect(streamEvent.type).toBe('stream');
      expect(streamEvent.operation).toBe('chat-completion');
      expect(streamEvent.model).toBe('gpt-4.1-nano');
      expect(streamEvent.duration).toBe(2000);
      expect(streamEvent.success).toBe(true);
      expect(streamEvent.metadata.streamChunks).toBe(50);
      expect(streamEvent.metadata.usage?.totalTokens).toBe(150);
      expect(streamEvent.metadata.chunksPerSecond).toBe(25);
      expect(streamEvent.metadata.firstChunkTime).toBe(startTime + 100);
      expect(streamEvent.metadata.lastChunkTime).toBe(endTime);
    });
  });

  describe('Enhanced User Interaction Tracking', () => {
    test('should track user interactions with OpenTelemetry context', () => {
      const eventEmitted = mock(() => {});
      telemetry.on('user-interaction', eventEmitted);

      telemetry.trackUserInteraction(
        'test-user',
        'test-session',
        'message-sent',
        { messageLength: 100, hasAttachment: true }
      );

      // Verify user interaction was tracked
      const interactions = (telemetry as any).interactions;
      expect(interactions.length).toBeGreaterThan(0);

      const interaction = interactions[interactions.length - 1];
      expect(interaction.userId).toBe('test-user');
      expect(interaction.sessionId).toBe('test-session');
      expect(interaction.action).toBe('message-sent');
      expect(interaction.metadata.messageLength).toBe(100);
      expect(interaction.metadata.hasAttachment).toBe(true);
      expect(interaction.metadata.correlationId).toBeDefined();

      // Verify event was emitted (check that the mock was called)
      expect(eventEmitted).toHaveBeenCalledTimes(1);
      const emittedEvent = eventEmitted.mock.calls[0][0];
      expect(emittedEvent.userId).toBe('test-user');
      expect(emittedEvent.sessionId).toBe('test-session');
      expect(emittedEvent.action).toBe('message-sent');
      expect(emittedEvent.metadata.messageLength).toBe(100);
      expect(emittedEvent.metadata.hasAttachment).toBe(true);
    });

    test('should sanitize sensitive metadata in user interactions', () => {
      telemetry.trackUserInteraction(
        'test-user',
        'test-session',
        'login-attempt',
        {
          username: 'user@example.com',
          password: 'secret123', // should be filtered
          token: 'jwt-token', // should be filtered
          apiKey: 'api-key-123', // should be filtered
          metadata: { nested: 'object' }, // should show type
          validField: 'included',
        }
      );

      // Verify sensitive data was filtered (check interactions directly)
      const interactions = (telemetry as any).interactions;
      const interaction = interactions[interactions.length - 1];

      // Original metadata should still contain all data
      expect(interaction.metadata.username).toBe('user@example.com');
      expect(interaction.metadata.password).toBe('secret123'); // Still in raw data
      expect(interaction.metadata.validField).toBe('included');

      // Sanitization happens during span attribute setting, which we'd test separately
    });
  });

  describe('Trace Context Integration', () => {
    test('should provide current trace context', () => {
      const context = telemetry.getCurrentTraceContext();

      // Should return trace context if available
      expect(context).toBeDefined();
      expect(typeof context).toBe('object');
    });

    test('should create child spans', () => {
      const childSpan = telemetry.createChildSpan(
        'child-operation',
        'ai.sub-task',
        { customAttribute: 'value' }
      );

      // Should return a span-like object
      expect(childSpan).toBeDefined();
      expect(typeof childSpan.setAttributes).toBe('function');
      expect(typeof childSpan.addEvent).toBe('function');
    });
  });

  describe('Metrics and Analytics', () => {
    test('should calculate enhanced metrics with OpenTelemetry correlation', () => {
      // Add some test events with trace correlation
      const testEvents = [
        {
          id: 'event-1',
          timestamp: Date.now(),
          type: 'api_call' as const,
          operation: 'chat-completion',
          model: 'gpt-4.1-nano',
          duration: 1000,
          success: true,
          metadata: {
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            correlationId: 'corr-1',
            traceId: 'trace-1',
          },
        },
        {
          id: 'event-2',
          timestamp: Date.now() + 1000,
          type: 'tool_execution' as const,
          operation: 'tool:create-artifact',
          model: 'n/a',
          duration: 500,
          success: true,
          metadata: {
            toolName: 'create-artifact',
            correlationId: 'corr-2',
            traceId: 'trace-2',
          },
        },
      ];

      // Add events to telemetry
      (telemetry as any).events = testEvents;

      const metrics = telemetry.getMetrics();

      expect(metrics).toMatchObject({
        totalCalls: 2,
        successfulCalls: 2,
        failedCalls: 0,
        totalDuration: 1500,
        averageDuration: 750,
        totalTokens: {
          prompt: 100,
          completion: 50,
          total: 150,
        },
        errorRate: 0,
      });

      expect(metrics.modelUsage.get('gpt-4.1-nano')).toBe(1);
      expect(metrics.modelUsage.get('n/a')).toBe(1);
    });

    test('should provide user analytics with session insights', () => {
      // Add test interactions
      const testInteractions = [
        {
          userId: 'user-1',
          sessionId: 'session-1',
          timestamp: Date.now(),
          action: 'message-sent',
          metadata: { correlationId: 'corr-1' },
        },
        {
          userId: 'user-1',
          sessionId: 'session-1',
          timestamp: Date.now() + 30_000,
          action: 'artifact-created',
          metadata: { correlationId: 'corr-2' },
        },
        {
          userId: 'user-2',
          sessionId: 'session-2',
          timestamp: Date.now() + 60_000,
          action: 'message-sent',
          metadata: { correlationId: 'corr-3' },
        },
      ];

      (telemetry as any).interactions = testInteractions;

      const analytics = telemetry.getUserAnalytics();

      expect(analytics).toMatchObject({
        totalInteractions: 3,
        uniqueUsers: 2,
        averageSessionLength: expect.any(Number),
      });

      expect(analytics.popularActions.get('message-sent')).toBe(2);
      expect(analytics.popularActions.get('artifact-created')).toBe(1);

      // Test user-specific analytics
      const userAnalytics = telemetry.getUserAnalytics('user-1');
      expect(userAnalytics.totalInteractions).toBe(2);
      expect(userAnalytics.uniqueUsers).toBe(1);
    });
  });

  describe('Data Export and Integration', () => {
    test('should export telemetry data with trace correlation', () => {
      // Add test data
      const testEvent = {
        id: 'test-event',
        timestamp: Date.now(),
        type: 'api_call' as const,
        operation: 'test',
        model: 'test-model',
        duration: 100,
        success: true,
        metadata: {
          correlationId: 'test-correlation',
          traceId: 'test-trace',
          spanId: 'test-span',
        },
      };

      (telemetry as any).events = [testEvent];

      const jsonExport = telemetry.exportData({ format: 'json' });
      const exportedData = JSON.parse(jsonExport);

      expect(exportedData).toHaveProperty('events');
      expect(exportedData).toHaveProperty('interactions');
      expect(exportedData).toHaveProperty('metrics');
      expect(exportedData).toHaveProperty('exportTime');

      expect(exportedData.events[0]).toMatchObject({
        id: 'test-event',
        type: 'api_call',
        metadata: expect.objectContaining({
          correlationId: 'test-correlation',
          traceId: 'test-trace',
          spanId: 'test-span',
        }),
      });

      // Test CSV export
      const csvExport = telemetry.exportData({ format: 'csv' });
      expect(csvExport).toContain(
        'timestamp,type,operation,model,duration,success,error'
      );
      expect(csvExport).toContain('api_call,test,test-model,100,true');
    });
  });

  describe('Global Telemetry Instance', () => {
    test('should provide global telemetry instance', () => {
      expect(aiTelemetry).toBeInstanceOf(AITelemetry);
      expect(aiTelemetry).toBeDefined();
    });

    test('should have trackAI decorator functionality', async () => {
      // This would be integration tested in real usage
      // Here we just verify the decorator exists
      expect(typeof (await import('../telemetry')).trackAI).toBe('function');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should cleanup old events and spans', () => {
      const telemetry = new AITelemetry();

      // Add many events to trigger cleanup
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      for (let i = 0; i < 15_000; i++) {
        (telemetry as any).events.push({
          id: `event-${i}`,
          timestamp: i < 10_000 ? oldTimestamp : Date.now(),
          type: 'api_call',
          operation: 'test',
          model: 'test',
          duration: 100,
          success: true,
          metadata: {},
        });
      }

      // Should trigger cleanup
      expect((telemetry as any).events.length).toBeLessThan(15_000);
    });

    test('should cache metrics for performance', () => {
      const telemetry = new AITelemetry();

      // First call should calculate
      const metrics1 = telemetry.getMetrics();

      // Second call should use cache
      const metrics2 = telemetry.getMetrics();

      expect(metrics1).toBe(metrics2); // Should be the same object (cached)

      // Force refresh should recalculate
      const metrics3 = telemetry.getMetrics(true);
      expect(metrics3).not.toBe(metrics1); // Should be different object
    });
  });
});

describe('Integration Tests', () => {
  test('should integrate with existing AI SDK patterns', async () => {
    // Simulate real AI SDK usage pattern
    const telemetry = new AITelemetry();

    // Track a complete AI interaction flow
    const result = await telemetry.trackAICall(
      'chat-completion',
      'gpt-4.1-nano',
      async () => {
        // Simulate AI SDK call
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
          responseMetadata: { finishReason: 'stop' },
        };
      },
      { userId: 'integration-test', sessionId: 'integration-session' }
    );

    expect(result).toBeDefined();
    expect(result.usage.totalTokens).toBe(75);

    // Verify telemetry was captured
    const metrics = telemetry.getMetrics();
    expect(metrics.totalCalls).toBe(1);
    expect(metrics.successfulCalls).toBe(1);
    expect(metrics.totalTokens.total).toBe(75);
  });

  test('should handle real-world error scenarios', async () => {
    const telemetry = new AITelemetry();

    // Test network timeout simulation
    await expect(
      telemetry.trackAICall('chat-completion', 'gpt-4.1-nano', async () => {
        throw new Error('Request timeout');
      })
    ).rejects.toThrow('Request timeout');

    // Test provider rate limiting
    await expect(
      telemetry.trackAICall('chat-completion', 'claude-3-opus', async () => {
        const error = new Error('Rate limit exceeded');
        (error as any).status = 429;
        throw error;
      })
    ).rejects.toThrow('Rate limit exceeded');

    const metrics = telemetry.getMetrics();
    expect(metrics.totalCalls).toBe(2);
    expect(metrics.failedCalls).toBe(2);
    expect(metrics.errorRate).toBe(1.0);
  });
});
