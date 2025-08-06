import type { CoreMessage, LanguageModel, Tool, ToolChoice } from 'ai';
import { useCallback, useMemo } from 'react';

// AI SDK 5.0 PrepareStep types
export interface PrepareStepOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  steps: Array<StepResult<TOOLS>>;
  stepNumber: number;
  model: LanguageModel;
  messages: Array<CoreMessage>;
}

export interface StepResult<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  stepType: 'initial' | 'tool-result' | 'continue' | 'tool-call';
  text: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: keyof TOOLS;
    args: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    toolName: keyof TOOLS;
    result: unknown;
  }>;
  finishReason?:
    | 'stop'
    | 'length'
    | 'content-filter'
    | 'tool-calls'
    | 'error'
    | 'other'
    | 'unknown';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  warnings?: Array<{
    type: 'unsupported-setting' | 'tool-call-unsupported' | 'other';
    message: string;
  }>;
  experimental_providerMetadata?: Record<string, unknown>;
}

export interface PrepareStepResult<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  model?: LanguageModel;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  system?: string;
  messages?: Array<CoreMessage>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
}

export type PrepareStepFunction<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> = (
  options: PrepareStepOptions<TOOLS>
) => PrepareStepResult<TOOLS> | Promise<PrepareStepResult<TOOLS>>;

// Hook configuration
export interface UsePrepareStepOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  /** Default model to use if not overridden by prepareStep */
  defaultModel?: LanguageModel;
  /** Available tools for this conversation */
  tools?: TOOLS;
  /** Default temperature */
  defaultTemperature?: number;
  /** Default max tokens */
  defaultMaxTokens?: number;
  /** Enable intelligent model switching based on step complexity */
  enableIntelligentSwitching?: boolean;
  /** Custom model selection strategy */
  modelSelectionStrategy?: 'balanced' | 'performance' | 'cost' | 'accuracy';
  /** Maximum context window to maintain across steps */
  maxContextWindow?: number;
  /** Enable message compression for long conversations */
  enableMessageCompression?: boolean;
  /** Debug mode for step preparation */
  debug?: boolean;
}

// Predefined model configurations for different use cases
export interface PrepareStepModelConfig {
  model: LanguageModel;
  temperature: number;
  maxTokens: number;
  description: string;
  suitableFor: string[];
}

/**
 * Hook for managing AI SDK 5.0 prepareStep functionality
 * Provides intelligent step preparation with model switching, tool management, and context optimization
 */
export function usePrepareStep<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
>(options: UsePrepareStepOptions<TOOLS> = {}) {
  const {
    defaultModel,
    tools = {} as TOOLS,
    defaultTemperature = 0.7,
    defaultMaxTokens = 2048,
    enableIntelligentSwitching = true,
    modelSelectionStrategy = 'balanced',
    maxContextWindow = 4096,
    enableMessageCompression = true,
    debug = false,
  } = options;

  // Model configurations for different scenarios
  const modelConfigs = useMemo(
    () => ({
      lightweight: {
        temperature: 0.3,
        maxTokens: 1024,
        description: 'Fast, efficient model for simple tasks',
        suitableFor: ['simple-queries', 'factual-responses', 'quick-edits'],
      },
      balanced: {
        temperature: 0.7,
        maxTokens: 2048,
        description: 'Balanced model for general-purpose tasks',
        suitableFor: ['conversations', 'explanations', 'moderate-complexity'],
      },
      creative: {
        temperature: 0.9,
        maxTokens: 4096,
        description: 'Creative model for complex, open-ended tasks',
        suitableFor: ['creative-writing', 'brainstorming', 'complex-analysis'],
      },
      precise: {
        temperature: 0.1,
        maxTokens: 2048,
        description: 'Precise model for accuracy-critical tasks',
        suitableFor: ['code-generation', 'technical-docs', 'calculations'],
      },
    }),
    []
  );

  // Analyze step complexity to determine optimal configuration
  const analyzeStepComplexity = useCallback(
    (
      messages: Array<CoreMessage>,
      stepNumber: number,
      previousSteps: Array<StepResult<TOOLS>>
    ) => {
      let complexity = 0;
      let taskType = 'general';

      // Analyze message content
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.content) {
        const content =
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : lastMessage.content.toString();

        const contentLength = content.length;
        const codePattern = /```|`[^`]+`|function|class|import|export/g;
        const creativePattern =
          /create|design|imagine|brainstorm|write|compose/gi;
        const technicalPattern =
          /analyze|calculate|compute|algorithm|data|technical/gi;
        const simplePattern =
          /^(what|who|when|where|how|is|are|can|will|should).{1,50}\?$/i;

        // Content-based complexity scoring
        complexity += Math.min(contentLength / 100, 5); // Length factor

        if (codePattern.test(content)) {
          complexity += 3;
          taskType = 'technical';
        }
        if (creativePattern.test(content)) {
          complexity += 2;
          taskType = 'creative';
        }
        if (technicalPattern.test(content)) {
          complexity += 2;
          taskType = 'analytical';
        }
        if (simplePattern.test(content)) {
          complexity -= 2;
          taskType = 'simple';
        }
      }

      // Step-based complexity
      if (stepNumber === 0) {
        complexity += 1; // Initial steps are often complex
      }
      if (previousSteps.length > 3) {
        complexity += 1; // Long conversations need more context
      }

      // Tool usage complexity
      const hasToolCalls = previousSteps.some(
        (step) => step.toolCalls?.length ?? 0 > 0
      );
      if (hasToolCalls) {
        complexity += 2;
      }

      return {
        score: Math.max(0, Math.min(10, complexity)),
        taskType,
        isMultiStep: previousSteps.length > 1,
        hasToolInteraction: hasToolCalls,
      };
    },
    []
  );

  // Select optimal model configuration based on complexity
  const selectModelConfig = useCallback(
    (complexity: ReturnType<typeof analyzeStepComplexity>) => {
      if (!enableIntelligentSwitching) {
        return modelConfigs.balanced;
      }

      switch (modelSelectionStrategy) {
        case 'performance':
          return complexity.score > 7
            ? modelConfigs.creative
            : complexity.score > 4
              ? modelConfigs.balanced
              : modelConfigs.lightweight;

        case 'cost':
          return complexity.score > 8
            ? modelConfigs.balanced
            : modelConfigs.lightweight;

        case 'accuracy':
          return complexity.taskType === 'technical'
            ? modelConfigs.precise
            : complexity.score > 6
              ? modelConfigs.creative
              : modelConfigs.balanced;

        case 'balanced':
        default:
          return complexity.score > 7
            ? modelConfigs.creative
            : complexity.score > 3
              ? modelConfigs.balanced
              : modelConfigs.lightweight;
      }
    },
    [enableIntelligentSwitching, modelSelectionStrategy, modelConfigs]
  );

  // Compress messages to fit context window
  const compressMessages = useCallback(
    (
      messages: Array<CoreMessage>,
      targetLength: number
    ): Array<CoreMessage> => {
      if (!enableMessageCompression || messages.length <= targetLength) {
        return messages;
      }

      // Always keep the system message and the last few messages
      const systemMessages = messages.filter((m) => m.role === 'system');
      const recentMessages = messages.slice(-Math.floor(targetLength * 0.7));
      const middleMessages = messages.slice(
        systemMessages.length,
        -Math.floor(targetLength * 0.7)
      );

      // Summarize middle messages if needed
      if (middleMessages.length > Math.floor(targetLength * 0.3)) {
        const summaryMessage: CoreMessage = {
          role: 'assistant',
          content: `[Conversation summary: ${middleMessages.length} messages covering various topics]`,
        };
        return [...systemMessages, summaryMessage, ...recentMessages];
      }

      return [...systemMessages, ...middleMessages, ...recentMessages];
    },
    [enableMessageCompression, maxContextWindow]
  );

  // Filter tools based on step context
  const selectActiveTools = useCallback(
    (
      complexity: ReturnType<typeof analyzeStepComplexity>,
      stepNumber: number,
      availableTools: TOOLS
    ): Array<keyof TOOLS> => {
      const toolNames = Object.keys(availableTools) as Array<keyof TOOLS>;

      // For simple queries, limit tool usage
      if (complexity.taskType === 'simple' && complexity.score < 3) {
        return toolNames.slice(0, 2); // Only first 2 tools
      }

      // For technical tasks, prioritize code-related tools
      if (complexity.taskType === 'technical') {
        return toolNames.filter(
          (name) =>
            String(name).toLowerCase().includes('code') ||
            String(name).toLowerCase().includes('analyze') ||
            String(name).toLowerCase().includes('generate')
        );
      }

      // For creative tasks, use all available tools
      if (complexity.taskType === 'creative') {
        return toolNames;
      }

      // Default: use most relevant tools based on step number
      const maxTools = Math.min(toolNames.length, stepNumber === 0 ? 5 : 3);
      return toolNames.slice(0, maxTools);
    },
    []
  );

  // Main prepareStep function factory
  const createPrepareStep = useCallback(
    <T extends TOOLS>(
      customConfig?: Partial<PrepareStepResult<T>>
    ): PrepareStepFunction<T> => {
      return ({ steps, stepNumber, model, messages }) => {
        const complexity = analyzeStepComplexity(
          messages,
          stepNumber,
          steps as StepResult<TOOLS>[]
        );
        const selectedConfig = selectModelConfig(complexity);
        const compressedMessages = compressMessages(messages, maxContextWindow);
        const activeTools = selectActiveTools(
          complexity,
          stepNumber,
          tools as T
        );

        if (debug) {
          console.log('PrepareStep Analysis:', {
            stepNumber,
            complexity,
            selectedConfig: selectedConfig.description,
            activeTools: activeTools.length,
            messageCount: messages.length,
            compressedMessageCount: compressedMessages.length,
          });
        }

        // Build step configuration
        const stepConfig: PrepareStepResult<T> = {
          // Use provided model or intelligent selection
          model: customConfig?.model ?? defaultModel,

          // Apply selected configuration
          temperature: customConfig?.temperature ?? selectedConfig.temperature,
          maxTokens: customConfig?.maxTokens ?? selectedConfig.maxTokens,

          // Tool management
          activeTools: customConfig?.activeTools ?? activeTools,
          toolChoice:
            customConfig?.toolChoice ??
            (complexity.hasToolInteraction && stepNumber > 0
              ? 'auto'
              : undefined),

          // Message and context management
          messages: customConfig?.messages ?? compressedMessages,

          // System prompt adaptation
          system:
            customConfig?.system ??
            (complexity.taskType === 'technical'
              ? 'You are a precise technical assistant. Provide accurate, detailed responses with code examples when relevant.'
              : complexity.taskType === 'creative'
                ? 'You are a creative assistant. Think outside the box and provide innovative, engaging responses.'
                : 'You are a helpful assistant. Provide clear, concise, and accurate responses.'),

          // Additional parameters
          topP: customConfig?.topP,
          topK: customConfig?.topK,
          frequencyPenalty: customConfig?.frequencyPenalty,
          presencePenalty: customConfig?.presencePenalty,
          seed: customConfig?.seed,
        };

        return stepConfig;
      };
    },
    [
      analyzeStepComplexity,
      selectModelConfig,
      compressMessages,
      selectActiveTools,
      defaultModel,
      tools,
      maxContextWindow,
      debug,
    ]
  );

  // Predefined prepareStep configurations
  const prepareStepConfigs = useMemo(
    () => ({
      // Simple query optimization
      simple: createPrepareStep({
        temperature: 0.3,
        maxTokens: 1024,
        system: 'Provide concise, direct answers to simple questions.',
      }),

      // Code generation optimization
      code: createPrepareStep({
        temperature: 0.1,
        maxTokens: 2048,
        system:
          'You are an expert programmer. Generate clean, efficient, well-documented code with proper error handling.',
      }),

      // Creative writing optimization
      creative: createPrepareStep({
        temperature: 0.9,
        maxTokens: 4096,
        system:
          'You are a creative writing assistant. Be imaginative, engaging, and original in your responses.',
      }),

      // Analysis and research optimization
      analytical: createPrepareStep({
        temperature: 0.4,
        maxTokens: 3072,
        system:
          'You are an analytical assistant. Provide thorough, well-reasoned analysis with supporting evidence.',
      }),

      // Multi-step workflow optimization
      workflow: createPrepareStep({
        temperature: 0.6,
        maxTokens: 2048,
        system:
          'You are managing a multi-step workflow. Be systematic, track progress, and ensure each step builds on the previous ones.',
      }),
    }),
    [createPrepareStep]
  );

  // Utility functions
  const getStepMetrics = useCallback((steps: Array<StepResult<TOOLS>>) => {
    return {
      totalSteps: steps.length,
      averageTokensPerStep:
        steps.reduce((acc, step) => acc + (step.usage?.totalTokens ?? 0), 0) /
        steps.length,
      toolCallCount: steps.reduce(
        (acc, step) => acc + (step.toolCalls?.length ?? 0),
        0
      ),
      errorCount: steps.filter((step) => step.finishReason === 'error').length,
      lastStepType: steps[steps.length - 1]?.stepType ?? 'initial',
    };
  }, []);

  const shouldTriggerModelSwitch = useCallback(
    (
      steps: Array<StepResult<TOOLS>>,
      currentComplexity: ReturnType<typeof analyzeStepComplexity>
    ) => {
      const metrics = getStepMetrics(steps);

      // Switch to more powerful model if:
      // - Multiple errors occurred
      // - High tool usage
      // - Increasing complexity
      return (
        metrics.errorCount > 2 ||
        metrics.toolCallCount > 5 ||
        (currentComplexity.score > 7 && metrics.totalSteps > 3)
      );
    },
    [getStepMetrics]
  );

  return {
    // Main prepareStep function factory
    createPrepareStep,

    // Predefined configurations
    configs: prepareStepConfigs,

    // Utility functions
    analyzeStepComplexity,
    selectModelConfig,
    compressMessages,
    selectActiveTools,
    getStepMetrics,
    shouldTriggerModelSwitch,

    // Configuration
    modelConfigs,
    options,
  };
}

// Export types for external use
export type { PrepareStepModelConfig as ModelConfig };
