import { act, renderHook } from '@testing-library/react';
import type { CoreMessage, LanguageModel, Tool } from 'ai';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { usePrepareStep } from '../use-prepare-step';

// Mock AI SDK components
const mockModel: LanguageModel = {
  specificationVersion: 'v1',
  modelId: 'test-model',
  provider: 'test-provider',
} as any;

const mockMessages: CoreMessage[] = [
  { role: 'user', content: 'Hello world' },
  { role: 'assistant', content: 'Hi there!' },
];

const mockTools: Record<string, Tool> = {
  testTool: {
    type: 'function',
    function: {
      name: 'testTool',
      description: 'A test tool',
      parameters: { type: 'object', properties: {} },
    },
  } as any,
  codeTool: {
    type: 'function',
    function: {
      name: 'codeTool',
      description: 'Generate code',
      parameters: { type: 'object', properties: {} },
    },
  } as any,
};

describe('usePrepareStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => usePrepareStep());

      expect(result.current.createPrepareStep).toBeDefined();
      expect(result.current.configs).toBeDefined();
      expect(result.current.analyzeStepComplexity).toBeDefined();
      expect(result.current.modelConfigs).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const options = {
        tools: mockTools,
        enableIntelligentSwitching: true,
        debug: true,
        maxContextWindow: 8192,
      };

      const { result } = renderHook(() => usePrepareStep(options));

      expect(result.current.options.enableIntelligentSwitching).toBe(true);
      expect(result.current.options.debug).toBe(true);
      expect(result.current.options.maxContextWindow).toBe(8192);
    });
  });

  describe('Step complexity analysis', () => {
    it('should analyze simple queries correctly', () => {
      const { result } = renderHook(() => usePrepareStep());

      const simpleMessages: CoreMessage[] = [
        { role: 'user', content: 'What is 2+2?' },
      ];

      const complexity = result.current.analyzeStepComplexity(
        simpleMessages,
        0,
        []
      );

      expect(complexity.taskType).toBe('simple');
      expect(complexity.score).toBeLessThan(3);
      expect(complexity.isMultiStep).toBe(false);
      expect(complexity.hasToolInteraction).toBe(false);
    });

    it('should analyze technical queries correctly', () => {
      const { result } = renderHook(() => usePrepareStep());

      const technicalMessages: CoreMessage[] = [
        {
          role: 'user',
          content:
            'Write a function to implement quicksort algorithm in TypeScript',
        },
      ];

      const complexity = result.current.analyzeStepComplexity(
        technicalMessages,
        0,
        []
      );

      expect(complexity.taskType).toBe('technical');
      expect(complexity.score).toBeGreaterThan(3);
    });

    it('should analyze creative queries correctly', () => {
      const { result } = renderHook(() => usePrepareStep());

      const creativeMessages: CoreMessage[] = [
        {
          role: 'user',
          content:
            'Create a story about a magical world with dragons and wizards',
        },
      ];

      const complexity = result.current.analyzeStepComplexity(
        creativeMessages,
        0,
        []
      );

      expect(complexity.taskType).toBe('creative');
      expect(complexity.score).toBeGreaterThan(2);
    });

    it('should consider step history in complexity analysis', () => {
      const { result } = renderHook(() => usePrepareStep());

      const messages: CoreMessage[] = [
        { role: 'user', content: 'Continue our discussion' },
      ];

      const previousSteps = Array(5)
        .fill(null)
        .map((_, i) => ({
          stepType: 'continue' as const,
          text: `Step ${i} response`,
          finishReason: 'stop' as const,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        }));

      const complexity = result.current.analyzeStepComplexity(
        messages,
        5,
        previousSteps
      );

      expect(complexity.isMultiStep).toBe(true);
      expect(complexity.score).toBeGreaterThan(1); // Should be higher due to conversation length
    });
  });

  describe('Model configuration selection', () => {
    it('should select lightweight config for simple tasks', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'balanced',
        })
      );

      const simpleComplexity = {
        score: 2,
        taskType: 'simple' as const,
        isMultiStep: false,
        hasToolInteraction: false,
      };

      const config = result.current.selectModelConfig(simpleComplexity);

      expect(config.description).toContain('efficient');
      expect(config.temperature).toBeLessThan(0.5);
    });

    it('should select creative config for complex tasks', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'balanced',
        })
      );

      const complexComplexity = {
        score: 8,
        taskType: 'creative' as const,
        isMultiStep: true,
        hasToolInteraction: true,
      };

      const config = result.current.selectModelConfig(complexComplexity);

      expect(config.description).toContain('Creative');
      expect(config.temperature).toBeGreaterThan(0.7);
    });

    it('should select precise config for technical tasks', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'accuracy',
        })
      );

      const technicalComplexity = {
        score: 6,
        taskType: 'technical' as const,
        isMultiStep: false,
        hasToolInteraction: true,
      };

      const config = result.current.selectModelConfig(technicalComplexity);

      expect(config.description).toContain('Precise');
      expect(config.temperature).toBeLessThan(0.3);
    });
  });

  describe('Message compression', () => {
    it('should not compress when under limit', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          maxContextWindow: 10,
        })
      );

      const shortMessages: CoreMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const compressed = result.current.compressMessages(shortMessages, 5);

      expect(compressed).toEqual(shortMessages);
    });

    it('should compress when over limit', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          enableMessageCompression: true,
          maxContextWindow: 5,
        })
      );

      const longMessages: CoreMessage[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Message ${i}`,
        }));

      const compressed = result.current.compressMessages(longMessages, 5);

      expect(compressed.length).toBeLessThanOrEqual(5);
      expect(compressed[compressed.length - 1]).toEqual(
        longMessages[longMessages.length - 1]
      );
    });

    it('should preserve system messages during compression', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          enableMessageCompression: true,
        })
      );

      const messagesWithSystem: CoreMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
            content: `Message ${i}`,
          })),
      ];

      const compressed = result.current.compressMessages(messagesWithSystem, 5);

      expect(compressed[0].role).toBe('system');
      expect(compressed[0].content).toBe('You are a helpful assistant');
    });
  });

  describe('Tool selection', () => {
    it('should limit tools for simple queries', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          tools: mockTools,
        })
      );

      const simpleComplexity = {
        score: 2,
        taskType: 'simple' as const,
        isMultiStep: false,
        hasToolInteraction: false,
      };

      const activeTools = result.current.selectActiveTools(
        simpleComplexity,
        0,
        mockTools
      );

      expect(activeTools.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize code tools for technical tasks', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          tools: mockTools,
        })
      );

      const technicalComplexity = {
        score: 6,
        taskType: 'technical' as const,
        isMultiStep: false,
        hasToolInteraction: true,
      };

      const activeTools = result.current.selectActiveTools(
        technicalComplexity,
        0,
        mockTools
      );

      expect(activeTools).toContain('codeTool');
    });

    it('should use all tools for creative tasks', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          tools: mockTools,
        })
      );

      const creativeComplexity = {
        score: 7,
        taskType: 'creative' as const,
        isMultiStep: true,
        hasToolInteraction: true,
      };

      const activeTools = result.current.selectActiveTools(
        creativeComplexity,
        0,
        mockTools
      );

      expect(activeTools.length).toBe(Object.keys(mockTools).length);
    });
  });

  describe('PrepareStep function creation', () => {
    it('should create a basic prepareStep function', () => {
      const { result } = renderHook(() => usePrepareStep());

      const prepareStep = result.current.createPrepareStep();

      expect(prepareStep).toBeDefined();
      expect(typeof prepareStep).toBe('function');
    });

    it('should create prepareStep with custom configuration', () => {
      const { result } = renderHook(() => usePrepareStep());

      const customConfig = {
        temperature: 0.5,
        maxTokens: 1024,
        system: 'Custom system prompt',
      };

      const prepareStep = result.current.createPrepareStep(customConfig);
      const stepConfig = prepareStep({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(stepConfig.temperature).toBe(0.5);
      expect(stepConfig.maxTokens).toBe(1024);
      expect(stepConfig.system).toBe('Custom system prompt');
    });

    it('should apply intelligent step preparation', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          enableIntelligentSwitching: true,
          tools: mockTools,
        })
      );

      const prepareStep = result.current.createPrepareStep();
      const stepConfig = prepareStep({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: [{ role: 'user', content: 'Write a complex algorithm' }],
      });

      expect(stepConfig.temperature).toBeDefined();
      expect(stepConfig.maxTokens).toBeDefined();
      expect(stepConfig.system).toBeDefined();
      expect(stepConfig.activeTools).toBeDefined();
    });
  });

  describe('Predefined configurations', () => {
    it('should provide predefined simple configuration', () => {
      const { result } = renderHook(() => usePrepareStep());

      const simpleConfig = result.current.configs.simple;
      const stepConfig = simpleConfig({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(stepConfig.temperature).toBe(0.3);
      expect(stepConfig.maxTokens).toBe(1024);
      expect(stepConfig.system).toContain('concise');
    });

    it('should provide predefined code configuration', () => {
      const { result } = renderHook(() => usePrepareStep());

      const codeConfig = result.current.configs.code;
      const stepConfig = codeConfig({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(stepConfig.temperature).toBe(0.1);
      expect(stepConfig.maxTokens).toBe(2048);
      expect(stepConfig.system).toContain('programmer');
    });

    it('should provide predefined creative configuration', () => {
      const { result } = renderHook(() => usePrepareStep());

      const creativeConfig = result.current.configs.creative;
      const stepConfig = creativeConfig({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(stepConfig.temperature).toBe(0.9);
      expect(stepConfig.maxTokens).toBe(4096);
      expect(stepConfig.system).toContain('creative');
    });
  });

  describe('Step metrics and utilities', () => {
    it('should calculate step metrics correctly', () => {
      const { result } = renderHook(() => usePrepareStep());

      const steps = [
        {
          stepType: 'initial' as const,
          text: 'Response 1',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          finishReason: 'stop' as const,
        },
        {
          stepType: 'tool-result' as const,
          text: 'Response 2',
          usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
          finishReason: 'stop' as const,
          toolCalls: [{ toolCallId: '1', toolName: 'testTool', args: {} }],
        },
      ];

      const metrics = result.current.getStepMetrics(steps);

      expect(metrics.totalSteps).toBe(2);
      expect(metrics.averageTokensPerStep).toBe(175);
      expect(metrics.toolCallCount).toBe(1);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.lastStepType).toBe('tool-result');
    });

    it('should detect when model switch is needed', () => {
      const { result } = renderHook(() => usePrepareStep());

      const stepsWithErrors = Array(5)
        .fill(null)
        .map((_, i) => ({
          stepType: 'continue' as const,
          text: `Response ${i}`,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          finishReason: i < 3 ? ('error' as const) : ('stop' as const),
        }));

      const highComplexity = {
        score: 8,
        taskType: 'technical' as const,
        isMultiStep: true,
        hasToolInteraction: true,
      };

      const shouldSwitch = result.current.shouldTriggerModelSwitch(
        stepsWithErrors,
        highComplexity
      );

      expect(shouldSwitch).toBe(true);
    });
  });

  describe('Debug mode', () => {
    it('should log debug information when enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePrepareStep({
          debug: true,
        })
      );

      const prepareStep = result.current.createPrepareStep();
      prepareStep({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'PrepareStep Analysis:',
        expect.objectContaining({
          stepNumber: 0,
          complexity: expect.any(Object),
          selectedConfig: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not log when debug is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePrepareStep({
          debug: false,
        })
      );

      const prepareStep = result.current.createPrepareStep();
      prepareStep({
        steps: [],
        stepNumber: 0,
        model: mockModel,
        messages: mockMessages,
      });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Model selection strategies', () => {
    it('should follow performance strategy', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'performance',
        })
      );

      const highComplexity = {
        score: 8,
        taskType: 'general' as const,
        isMultiStep: true,
        hasToolInteraction: true,
      };

      const config = result.current.selectModelConfig(highComplexity);
      expect(config.description).toContain('Creative'); // Should use creative for high complexity
    });

    it('should follow cost strategy', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'cost',
        })
      );

      const mediumComplexity = {
        score: 5,
        taskType: 'general' as const,
        isMultiStep: false,
        hasToolInteraction: false,
      };

      const config = result.current.selectModelConfig(mediumComplexity);
      expect(config.description).toContain('efficient'); // Should prefer lightweight for cost
    });

    it('should follow accuracy strategy', () => {
      const { result } = renderHook(() =>
        usePrepareStep({
          modelSelectionStrategy: 'accuracy',
        })
      );

      const technicalComplexity = {
        score: 6,
        taskType: 'technical' as const,
        isMultiStep: false,
        hasToolInteraction: true,
      };

      const config = result.current.selectModelConfig(technicalComplexity);
      expect(config.description).toContain('Precise'); // Should use precise for technical tasks
    });
  });
});
