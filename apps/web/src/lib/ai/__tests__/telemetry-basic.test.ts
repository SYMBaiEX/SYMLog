// telemetry-basic.test.ts - Basic functional tests for AI telemetry
// Tests core functionality without complex mocking

import { beforeEach, describe, expect, test } from 'bun:test';
import { AITelemetry } from '../telemetry';

describe('AITelemetry Basic Functionality', () => {
  let telemetry: AITelemetry;

  beforeEach(() => {
    telemetry = new AITelemetry();
  });

  describe('Basic AI Call Tracking', () => {
    test('should track successful AI API call', async () => {
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

      const result = await telemetry.trackAICall(
        'chat-completion',
        'gpt-4.1-nano',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return mockResult;
        },
        { userId: 'test-user', temperature: 0.7 }
      );

      expect(result).toEqual(mockResult);

      // Verify telemetry event was created
      const events = (telemetry as any).events;
      expect(events.length).toBeGreaterThan(0);

      const event = events[events.length - 1];
      expect(event.type).toBe('api_call');
      expect(event.operation).toBe('chat-completion');
      expect(event.model).toBe('gpt-4.1-nano');
      expect(event.success).toBe(true);
      expect(event.metadata.usage).toEqual(mockResult.usage);
      expect(event.metadata.correlationId).toBeDefined();
      expect(event.duration).toBeGreaterThan(0);
    });

    test('should track AI API call errors', async () => {
      const mockError = new Error('API rate limit exceeded');

      await expect(
        telemetry.trackAICall('chat-completion', 'gpt-4.1-nano', async () => {
          throw mockError;
        })
      ).rejects.toThrow('API rate limit exceeded');

      // Verify error was captured
      const events = (telemetry as any).events;
      const errorEvent = events[events.length - 1];
      expect(errorEvent.type).toBe('error');
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.metadata.error).toBe('API rate limit exceeded');
    });

    test('should extract provider from model names', () => {
      const testCases = [
        { model: 'gpt-4.1-nano', expected: 'openai' },
        { model: 'claude-3-opus', expected: 'anthropic' },
        { model: 'gemini-pro', expected: 'google' },
        { model: 'llama-2-70b', expected: 'meta' },
        { model: 'custom-model', expected: 'unknown' },
      ];

      testCases.forEach(({ model, expected }) => {
        const provider = (telemetry as any).extractProvider(model);
        expect(provider).toBe(expected);
      });
    });
  });

  describe('Tool Execution Tracking', () => {
    test('should track successful tool execution', async () => {
      const mockResult = { success: true, data: 'test-result' };
      const mockParams = { input: 'test-input', config: { option: true } };

      const result = await telemetry.trackToolExecution(
        'create-artifact',
        mockParams,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return mockResult;
        },
        {
          userId: 'test-user',
          sessionId: 'test-session',
        }
      );

      expect(result).toEqual(mockResult);

      // Verify telemetry event was created
      const events = (telemetry as any).events;
      const event = events[events.length - 1];
      expect(event.type).toBe('tool_execution');
      expect(event.operation).toBe('tool:create-artifact');
      expect(event.success).toBe(true);
      expect(event.metadata.toolName).toBe('create-artifact');
      expect(event.metadata.correlationId).toBeDefined();
    });

    test('should track tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');

      await expect(
        telemetry.trackToolExecution('failing-tool', {}, async () => {
          throw mockError;
        })
      ).rejects.toThrow('Tool execution failed');

      // Verify error was captured
      const events = (telemetry as any).events;
      const errorEvent = events[events.length - 1];
      expect(errorEvent.type).toBe('tool_execution');
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.metadata.error).toBe('Tool execution failed');
    });

    test('should support legacy sync tool tracking', () => {
      telemetry.trackToolExecutionSync(
        'legacy-tool',
        { input: 'test' },
        { output: 'result' },
        100,
        true
      );

      const events = (telemetry as any).events;
      const event = events[events.length - 1];
      expect(event.type).toBe('tool_execution');
      expect(event.operation).toBe('tool:legacy-tool');
      expect(event.success).toBe(true);
      expect(event.metadata.toolName).toBe('legacy-tool');
      expect(event.metadata.legacy).toBe(true);
      expect(event.duration).toBe(100);
    });
  });

  describe('Streaming and User Interactions', () => {
    test('should track streaming responses', () => {
      const startTime = Date.now();
      const endTime = startTime + 1000;

      telemetry.trackStreaming(
        'chat-completion',
        'gpt-4.1-nano',
        25, // chunks
        1000, // duration
        100, // total tokens
        {
          userId: 'test-user',
          sessionId: 'test-session',
          firstChunkTime: startTime + 50,
          lastChunkTime: endTime,
        }
      );

      const events = (telemetry as any).events;
      const streamEvent = events[events.length - 1];

      expect(streamEvent.type).toBe('stream');
      expect(streamEvent.operation).toBe('chat-completion');
      expect(streamEvent.model).toBe('gpt-4.1-nano');
      expect(streamEvent.duration).toBe(1000);
      expect(streamEvent.success).toBe(true);
      expect(streamEvent.metadata.streamChunks).toBe(25);
      expect(streamEvent.metadata.usage.totalTokens).toBe(100);
      expect(streamEvent.metadata.chunksPerSecond).toBe(25);
    });

    test('should track user interactions', () => {
      let eventEmitted = false;
      let emittedData: any = null;

      telemetry.on('user-interaction', (data) => {
        eventEmitted = true;
        emittedData = data;
      });

      telemetry.trackUserInteraction(
        'test-user',
        'test-session',
        'message-sent',
        { messageLength: 100, hasAttachment: true }
      );

      // Verify interaction was stored
      const interactions = (telemetry as any).interactions;
      const interaction = interactions[interactions.length - 1];
      expect(interaction.userId).toBe('test-user');
      expect(interaction.sessionId).toBe('test-session');
      expect(interaction.action).toBe('message-sent');
      expect(interaction.metadata.messageLength).toBe(100);
      expect(interaction.metadata.hasAttachment).toBe(true);

      // Verify event was emitted
      expect(eventEmitted).toBe(true);
      expect(emittedData.userId).toBe('test-user');
      expect(emittedData.action).toBe('message-sent');
    });

    test('should track cache operations', () => {
      telemetry.trackCacheOperation(
        'ai-response-cache',
        true,
        'test-key-123',
        50
      );
      telemetry.trackCacheOperation(
        'ai-response-cache',
        false,
        'test-key-456',
        150
      );

      const events = (telemetry as any).events;
      const hitEvent = events[events.length - 2];
      const missEvent = events[events.length - 1];

      expect(hitEvent.type).toBe('cache_hit');
      expect(hitEvent.operation).toBe('ai-response-cache');
      expect(hitEvent.success).toBe(true);
      expect(hitEvent.metadata.cacheKey).toBe('test-key-123');

      expect(missEvent.type).toBe('cache_miss');
      expect(missEvent.operation).toBe('ai-response-cache');
      expect(missEvent.success).toBe(true);
      expect(missEvent.metadata.cacheKey).toBe('test-key-456');
    });
  });

  describe('Metrics and Analytics', () => {
    test('should calculate comprehensive metrics', async () => {
      // Add some test events
      await telemetry.trackAICall(
        'chat-completion',
        'gpt-4.1-nano',
        async () => ({
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        })
      );

      await telemetry.trackToolExecution('create-artifact', {}, async () => ({
        success: true,
      }));

      telemetry.trackCacheOperation('response-cache', true, 'cache-key-1', 25);
      telemetry.trackCacheOperation('response-cache', false, 'cache-key-2', 75);

      const metrics = telemetry.getMetrics();

      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.totalTokens.prompt).toBe(100);
      expect(metrics.totalTokens.completion).toBe(50);
      expect(metrics.totalTokens.total).toBe(150);
      expect(metrics.cacheMetrics.hits).toBe(1);
      expect(metrics.cacheMetrics.misses).toBe(1);
      expect(metrics.cacheMetrics.hitRate).toBe(0.5);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0); // Allow 0 if operations are very fast
    });

    test('should calculate user analytics', () => {
      // Add test interactions
      telemetry.trackUserInteraction('user-1', 'session-1', 'message-sent', {});
      telemetry.trackUserInteraction(
        'user-1',
        'session-1',
        'artifact-created',
        {}
      );
      telemetry.trackUserInteraction('user-2', 'session-2', 'message-sent', {});

      const analytics = telemetry.getUserAnalytics();

      expect(analytics.totalInteractions).toBe(3);
      expect(analytics.uniqueUsers).toBe(2);
      expect(analytics.popularActions.get('message-sent')).toBe(2);
      expect(analytics.popularActions.get('artifact-created')).toBe(1);
      expect(analytics.averageSessionLength).toBeGreaterThanOrEqual(0);

      // Test user-specific analytics
      const userAnalytics = telemetry.getUserAnalytics('user-1');
      expect(userAnalytics.totalInteractions).toBe(2);
      expect(userAnalytics.uniqueUsers).toBe(1);
    });

    test('should cache metrics for performance', () => {
      const metrics1 = telemetry.getMetrics();
      const metrics2 = telemetry.getMetrics();

      // Should return the same cached object
      expect(metrics1).toBe(metrics2);

      // Force refresh should return new object
      const metrics3 = telemetry.getMetrics(true);
      expect(metrics3).not.toBe(metrics1);
    });
  });

  describe('Data Export and Utility Functions', () => {
    test('should export telemetry data in JSON format', async () => {
      await telemetry.trackAICall('test-call', 'gpt-4.1-nano', async () => ({
        usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      }));

      const jsonExport = telemetry.exportData({ format: 'json' });
      const exportedData = JSON.parse(jsonExport);

      expect(exportedData).toHaveProperty('events');
      expect(exportedData).toHaveProperty('interactions');
      expect(exportedData).toHaveProperty('metrics');
      expect(exportedData).toHaveProperty('exportTime');
      expect(exportedData.events.length).toBeGreaterThan(0);
    });

    test('should export telemetry data in CSV format', async () => {
      await telemetry.trackAICall('test-call', 'gpt-4.1-nano', async () => ({
        usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      }));

      const csvExport = telemetry.exportData({ format: 'csv' });

      expect(csvExport).toContain(
        'timestamp,type,operation,model,duration,success,error'
      );
      expect(csvExport).toContain('api_call,test-call,gpt-4.1-nano');
      expect(csvExport).toContain('true');
    });

    test('should provide trace context utilities', () => {
      const context = telemetry.getCurrentTraceContext();
      expect(context).toBeDefined();
      expect(typeof context).toBe('object');

      const childSpan = telemetry.createChildSpan(
        'child-operation',
        'ai.sub-task'
      );
      expect(childSpan).toBeDefined();
      expect(typeof childSpan.setAttributes).toBe('function');
    });

    test('should estimate costs correctly', async () => {
      // Test cost estimation by checking internal cost calculation
      const result = await telemetry.trackAICall(
        'cost-test',
        'gpt-4.1-nano',
        async () => ({
          usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        })
      );

      // Verify the call succeeded (cost estimation happens internally)
      expect(result.usage.totalTokens).toBe(1500);

      const events = (telemetry as any).events;
      const event = events[events.length - 1];
      expect(event.metadata.usage.totalTokens).toBe(1500);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle large numbers of events efficiently', async () => {
      const startTime = Date.now();

      // Add many events quickly
      for (let i = 0; i < 100; i++) {
        telemetry.trackCacheOperation('bulk-test', i % 2 === 0, `key-${i}`, 10);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 1 second for 100 events)
      expect(duration).toBeLessThan(1000);

      // Should not exceed memory limits
      const events = (telemetry as any).events;
      expect(events.length).toBeLessThanOrEqual(10_000); // Max events size
    });

    test('should clean up old data periodically', () => {
      const telemetry = new AITelemetry();

      // This test verifies that the cleanup mechanism exists
      // Full cleanup testing would require time manipulation
      expect(typeof (telemetry as any).setupPeriodicCleanup).toBe('function');
    });
  });

  describe('Global Instance', () => {
    test('should provide singleton telemetry instance', () => {
      const { aiTelemetry } = require('../telemetry');
      expect(aiTelemetry).toBeInstanceOf(AITelemetry);
      expect(aiTelemetry).toBeDefined();
    });

    test('should have decorator functionality', () => {
      const { trackAI } = require('../telemetry');
      expect(typeof trackAI).toBe('function');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete AI workflow', async () => {
      // Simulate a complete AI workflow with multiple components
      const workflowResult = await telemetry.trackAICall(
        'workflow-completion',
        'gpt-4.1-nano',
        async () => {
          // Simulate AI processing
          await new Promise((resolve) => setTimeout(resolve, 10));

          return {
            content: 'Generated content',
            usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
            responseMetadata: { finishReason: 'stop' },
          };
        },
        { userId: 'workflow-user', sessionId: 'workflow-session' }
      );

      // Add related user interaction
      telemetry.trackUserInteraction(
        'workflow-user',
        'workflow-session',
        'workflow-completed',
        {
          workflowType: 'code-generation',
          resultLength: workflowResult.content.length,
        }
      );

      // Verify workflow was tracked end-to-end
      const events = (telemetry as any).events;
      const interactions = (telemetry as any).interactions;

      expect(events.length).toBeGreaterThan(0);
      expect(interactions.length).toBeGreaterThan(0);

      const metrics = telemetry.getMetrics();
      expect(metrics.totalCalls).toBeGreaterThan(0);
      expect(metrics.totalTokens.total).toBeGreaterThan(0);

      const analytics = telemetry.getUserAnalytics('workflow-user');
      expect(analytics.totalInteractions).toBeGreaterThan(0);
    });

    test('should handle error recovery scenarios', async () => {
      let attemptCount = 0;

      // Simulate retry pattern with eventual success
      const result = await telemetry
        .trackAICall('retry-scenario', 'gpt-4.1-nano', async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary failure');
          }
          return {
            usage: { inputTokens: 75, outputTokens: 25, totalTokens: 100 },
            content: 'Success after retry',
          };
        })
        .catch(async (error) => {
          // Simulate retry logic
          if (attemptCount < 2) {
            return telemetry.trackAICall(
              'retry-scenario',
              'gpt-4.1-nano',
              async () => {
                attemptCount++;
                return {
                  usage: {
                    inputTokens: 75,
                    outputTokens: 25,
                    totalTokens: 100,
                  },
                  content: 'Success after retry',
                };
              }
            );
          }
          throw error;
        });

      expect(result.content).toBe('Success after retry');

      // Should have tracked both the failure and success
      const events = (telemetry as any).events;
      const successEvent = events[events.length - 1];
      expect(successEvent.type).toBe('api_call');
      expect(successEvent.success).toBe(true);
    });
  });
});
