// experimental-features.test.ts - Comprehensive tests for AI SDK v5 experimental features
// Tests the complete experimental feature set including step continuation, message parts,
// structured output, and dynamic tool control

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { z } from 'zod';
import {
  ExperimentalAI,
  experimentalAI,
  type MessagePart,
  type EnhancedMessage,
  createCompressionTransform,
  createMetricsTransform,
  createDebugTransform,
  createFilterTransform,
  ProviderMetricsCollector,
} from '../experimental';

// Mock AI SDK functions
const mockGenerateText = mock(() =>
  Promise.resolve({
    text: 'Generated text',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    steps: [
      {
        text: 'Step 1 text',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
      },
    ],
  })
);

const mockStreamText = mock(() =>
  Promise.resolve({
    textStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Streaming ' };
      yield { type: 'text-delta', textDelta: 'text' };
    })(),
    experimental_partialOutputStream: (async function* () {
      yield { partial: 'data' };
    })(),
  })
);

const mockGenerateObject = mock(() =>
  Promise.resolve({
    object: { name: 'Test', value: 42 },
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  })
);

// Mock modules before imports
vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  generateObject: mockGenerateObject,
  stepCountIs: (count: number) => ({ type: 'step-count', count }),
  Output: {
    text: () => ({ type: 'text' }),
    object: (config: any) => ({ type: 'object', ...config }),
  },
  smoothStream: (config: any) => ({ type: 'transform', config }),
}));

vi.mock('../providers', () => ({
  getAIModel: (model?: string) => ({ modelId: model || 'default', provider: 'test' }),
}));

vi.mock('../telemetry', () => ({
  aiTelemetry: {
    trackAICall: mock(async (name: string, model: string, fn: Function) => {
      return await fn();
    }),
  },
}));

vi.mock('../tools/enhanced-tools', () => ({
  enhancedArtifactTools: {
    tool1: { execute: async () => 'result1' },
    tool2: { execute: async () => 'result2' },
  },
}));

describe('Experimental AI Features', () => {
  let experimentalInstance: ExperimentalAI;

  beforeEach(() => {
    experimentalInstance = new ExperimentalAI();
    mockGenerateText.mockReset();
    mockStreamText.mockReset();
    mockGenerateObject.mockReset();
  });

  describe('Step Continuation Support', () => {
    test('should generate with step continuation using maxSteps', async () => {
      const result = await experimentalInstance.generateWithStepContinuation(
        'Test prompt',
        {
          maxSteps: 3,
        }
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          stopWhen: { type: 'step-count', count: 3 },
        })
      );
      expect(result.text).toBe('Generated text');
    });

    test('should support custom stopWhen conditions', async () => {
      const customStopCondition = { type: 'custom', condition: 'test' };

      await experimentalInstance.generateWithStepContinuation('Test prompt', {
        stopWhen: customStopCondition,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          stopWhen: customStopCondition,
        })
      );
    });

    test('should support prepareStep callback', async () => {
      const prepareStep = mock(({ stepNumber }) => ({
        activeTools: stepNumber === 0 ? ['tool1'] : ['tool2'],
      }));

      await experimentalInstance.generateWithStepContinuation('Test prompt', {
        prepareStep,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep,
        })
      );
    });

    test('should handle onStepFinish callback', async () => {
      const onStepFinish = mock();

      await experimentalInstance.generateWithStepContinuation('Test prompt', {
        onStepFinish,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          onStepFinish,
        })
      );
    });
  });

  describe('Enhanced Message Handling', () => {
    test('should transform standard messages to enhanced format', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        {
          role: 'assistant' as const,
          content: [
            { type: 'text', text: 'Hi there!' },
            {
              type: 'tool-call',
              toolCallId: '123',
              toolName: 'weather',
              input: { location: 'SF' },
            },
          ],
        },
      ];

      const enhanced = experimentalInstance.transformToEnhancedMessages(messages);

      expect(enhanced).toHaveLength(2);
      expect(enhanced[0].parts).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(enhanced[1].parts).toHaveLength(2);
      expect(enhanced[1].parts?.[1]).toMatchObject({
        type: 'tool-call',
        toolCallId: '123',
        toolName: 'weather',
      });
    });

    test('should compress message history', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
      }));

      const compressed = experimentalInstance.compressMessageHistory(messages, {
        maxMessages: 5,
      });

      expect(compressed).toHaveLength(5);
      expect(compressed[0].content).toBe('Message 15');
      expect(compressed[4].content).toBe('Message 19');
    });

    test('should preserve system messages when compressing', () => {
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant response' },
      ];

      const compressed = experimentalInstance.compressMessageHistory(messages, {
        maxMessages: 2,
        preserveSystemMessages: true,
      });

      expect(compressed).toHaveLength(2);
      expect(compressed[0].role).toBe('system');
      expect(compressed[1].role).toBe('assistant');
    });

    test('should handle message parts in generation', async () => {
      const onMessagePart = mock();
      const enhancedMessages: EnhancedMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        steps: [
          {
            text: 'Step text',
            toolCalls: [
              {
                id: '123',
                toolName: 'testTool',
                input: { data: 'test' },
              },
            ],
            toolResults: [
              {
                toolCallId: '123',
                toolName: 'testTool',
                output: { result: 'success' },
              },
            ],
          },
        ],
      });

      await experimentalInstance.generateWithMessageParts(enhancedMessages, {
        onMessagePart,
      });

      expect(onMessagePart).toHaveBeenCalledTimes(3);
      expect(onMessagePart).toHaveBeenCalledWith({
        type: 'text',
        text: 'Step text',
      });
      expect(onMessagePart).toHaveBeenCalledWith({
        type: 'tool-call',
        toolCallId: '123',
        toolName: 'testTool',
        input: { data: 'test' },
      });
    });
  });

  describe('Structured Output Support', () => {
    test('should generate text output with experimental_output', async () => {
      const result = await experimentalInstance.generateWithStructuredOutput(
        'Generate text',
        {
          outputType: 'text',
        }
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_output: { type: 'text' },
        })
      );
    });

    test('should generate object output with schema', async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const result = await experimentalInstance.generateWithStructuredOutput(
        'Generate object',
        {
          outputType: 'object',
          schema,
        }
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_output: {
            type: 'object',
            schema,
          },
        })
      );
    });

    test('should stream with structured output', async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const stream = await experimentalInstance.streamWithStructuredOutput(
        'Stream object',
        {
          outputType: 'object',
          schema,
        }
      );

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_output: {
            type: 'object',
            schema,
          },
        })
      );
    });

    test('should handle partial output stream', async () => {
      const onPartialOutput = mock();

      const stream = await experimentalInstance.streamWithStructuredOutput(
        'Stream with partials',
        {
          outputType: 'object',
          schema: z.object({ data: z.string() }),
          onPartialOutput,
        }
      );

      // Simulate consuming the partial output stream
      if ('experimental_partialOutputStream' in stream) {
        for await (const partial of stream.experimental_partialOutputStream) {
          onPartialOutput(partial);
        }
      }

      expect(onPartialOutput).toHaveBeenCalledWith({ partial: 'data' });
    });
  });

  describe('Dynamic Tool Control', () => {
    test('should generate with dynamic tool activation', async () => {
      const tools = {
        tool1: { execute: async () => 'result1' },
        tool2: { execute: async () => 'result2' },
        tool3: { execute: async () => 'result3' },
      };

      await experimentalInstance.generateWithDynamicTools('Test prompt', {
        tools,
        initialActiveTools: ['tool1', 'tool2'],
        maxSteps: 3,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools,
          activeTools: ['tool1', 'tool2'],
          stopWhen: { type: 'step-count', count: 3 },
        })
      );
    });

    test('should support custom prepareStep for tool control', async () => {
      const prepareStep = mock(({ stepNumber }) => {
        if (stepNumber === 0) {
          return {
            activeTools: ['tool1'],
            toolChoice: { type: 'tool', toolName: 'tool1' },
          };
        }
        return { activeTools: ['tool2', 'tool3'] };
      });

      await experimentalInstance.generateWithDynamicTools('Test prompt', {
        prepareStep,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep,
        })
      );
    });

    test('should update generateWithLimitedTools to use activeTools', async () => {
      await experimentalInstance.generateWithLimitedTools('Test prompt', [
        'tool1',
        'tool2',
      ]);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTools: ['tool1', 'tool2'],
        })
      );
    });
  });

  describe('Transform Features', () => {
    test('should create compression transform', () => {
      const transform = createCompressionTransform({
        enabled: true,
        threshold: 1024,
        algorithm: 'gzip',
        level: 6,
      });

      expect(transform).toBeDefined();
      expect(typeof transform).toBe('function');
    });

    test('should create metrics transform', () => {
      const transform = createMetricsTransform({
        enabled: true,
        collectTokenMetrics: true,
        collectPerformanceMetrics: true,
        collectQualityMetrics: false,
        sampleRate: 0.5,
      });

      expect(transform).toBeDefined();
      expect(typeof transform).toBe('function');
    });

    test('should create debug transform', () => {
      const callback = mock();
      const transform = createDebugTransform({
        enabled: true,
        logLevel: 'debug',
        includeContent: true,
        includeMetadata: true,
        outputFormat: 'callback',
        callback,
      });

      expect(transform).toBeDefined();
      expect(typeof transform).toBe('function');
    });

    test('should create filter transform', () => {
      const transform = createFilterTransform({
        enabled: true,
        filters: [
          {
            type: 'content',
            pattern: /password/gi,
            action: 'replace',
            replacement: '[REDACTED]',
          },
        ],
      });

      expect(transform).toBeDefined();
      expect(typeof transform).toBe('function');
    });
  });

  describe('Provider Metrics Collection', () => {
    test('should collect and aggregate provider metrics', () => {
      const collector = new ProviderMetricsCollector({
        enabled: true,
        persistMetrics: false,
        aggregationWindow: 60_000,
        qualityThresholds: {
          coherence: 0.7,
          relevance: 0.8,
          completeness: 0.6,
        },
      });

      const metricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: Date.now(),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        quality: { coherenceScore: 0.9, relevanceScore: 0.85, completenessScore: 0.8 },
        performance: { throughput: 50, latency: 100, efficiency: 0.8 },
      };

      collector.collectMetrics(metricsData);

      const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
      expect(aggregated).toBeDefined();
      expect(aggregated?.totalRequests).toBe(1);
      expect(aggregated?.qualityScores.coherence).toBe(0.9);

      collector.destroy();
    });

    test('should generate with provider metrics collection', async () => {
      const metricsCollector = new ProviderMetricsCollector({
        enabled: true,
        persistMetrics: false,
        aggregationWindow: 60_000,
        qualityThresholds: {
          coherence: 0.7,
          relevance: 0.8,
          completeness: 0.6,
        },
      });

      await experimentalInstance.generateWithProviderMetrics('Test prompt', {
        collectMetrics: true,
        metricsCollector,
      });

      const metrics = metricsCollector.getAllProviderMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      metricsCollector.destroy();
    });
  });

  describe('Advanced Generation Features', () => {
    test('should handle custom stop conditions', async () => {
      await experimentalInstance.generateWithCustomStop(
        'Generate until stop',
        {
          keywords: ['STOP', 'END'],
          patterns: [/\[DONE\]/],
          maxLength: 1000,
          customCheck: (text) => text.includes('finished'),
        }
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          stopWhen: expect.any(Function),
        })
      );
    });

    test('should handle race generation', async () => {
      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];

      const result = await experimentalInstance.generateRace(prompts, {
        timeout: 5000,
        returnAll: false,
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    test('should handle batch generation', async () => {
      const prompts = Array.from({ length: 10 }, (_, i) => `Prompt ${i}`);
      const onBatchComplete = mock();

      const results = await experimentalInstance.generateBatch(prompts, {
        batchSize: 3,
        delayBetweenBatches: 10,
        onBatchComplete,
      });

      expect(results).toHaveLength(10);
      expect(onBatchComplete).toHaveBeenCalledTimes(4); // 10 prompts / 3 batch size = 4 batches
    });

    test('should handle fallback strategies', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('First strategy failed'))
        .mockResolvedValueOnce({
          text: 'Second strategy succeeded',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        });

      const strategies = [
        { prompt: 'Try this first', timeout: 1000 },
        { prompt: 'Try this second', timeout: 2000 },
        { prompt: 'Try this third' },
      ];

      const result = await experimentalInstance.generateWithFallbacks(
        strategies,
        { stopOnSuccess: true }
      );

      expect(result.successCount).toBe(1);
      expect(result.firstSuccess?.strategyIndex).toBe(1);
    });
  });

  describe('Stream Transforms and Presets', () => {
    test('should apply transform presets', async () => {
      await experimentalInstance.streamWithAdvancedTransforms('Test prompt', {
        preset: 'performance',
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_transform: expect.any(Array),
        })
      );
    });

    test('should stream with smoothing', async () => {
      const onChunk = mock();

      await experimentalInstance.streamWithSmoothing('Test prompt', {
        chunking: 'word',
        delayMs: 50,
        onChunk,
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_transform: expect.any(Array),
        })
      );
    });
  });

  describe('Context Window Management', () => {
    test('should manage context window with token limits', async () => {
      const context = Array.from({ length: 10 }, (_, i) => `Context item ${i}`);

      await experimentalInstance.generateWithContextManagement(
        'Test prompt',
        context,
        {
          maxContextTokens: 100,
          priorityOrder: 'newest',
        }
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Context:'),
        })
      );
    });
  });

  describe('Prompt Enhancement', () => {
    test('should enhance prompts based on level', async () => {
      await experimentalInstance.generateWithPromptEnhancement('Simple task', {
        enhancementLevel: 'aggressive',
        includeExamples: true,
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Structure your response'),
        })
      );
    });
  });
});