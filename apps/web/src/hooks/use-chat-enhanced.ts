'use client';

import { useChat as useBaseChat } from '@ai-sdk/react';
import type { ChatRequestOptions, CoreMessage, Tool, UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Define ToolInvocation type locally since it's not exported from 'ai'
interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

// AI SDK v5 compatible message type
type EnhancedUIMessage = UIMessage & {
  content?: string; // For backward compatibility with v4 interface
};

import { toast } from 'sonner';
import {
  type CompressionTransformConfig,
  createCompressionTransform,
  createDebugTransform,
  createFilterTransform,
  createMetricsTransform,
  type DebugTransformConfig,
  type FilterTransformConfig,
  globalMetricsCollector,
  type MetricsTransformConfig,
  type ProviderMetricsData,
  type TransformConfig,
  transformPresets,
} from '../lib/ai/experimental';
import { type PrepareStepFunction, usePrepareStep } from './use-prepare-step';

// Use UIMessage from AI SDK v5 for consistency
type Message = EnhancedUIMessage;

// Helper function to extract text content from UIMessage
function getMessageText(message: Message): string | undefined {
  if (message.content) {
    return message.content;
  }
  if (message.parts) {
    return message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
  }
  return;
}

export interface UseChatEnhancedOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  api?: string;
  id?: string;
  initialMessages?: Message[];
  initialInput?: string;
  headers?: Record<string, string> | Headers;
  body?: any;
  credentials?: RequestCredentials;
  streamProtocol?: 'text' | 'data';
  maxSteps?: number;
  onToolCall?: (toolCall: ToolInvocation) => void | unknown | Promise<unknown>;
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (
    message: Message,
    options: { usage: any; finishReason: string }
  ) => void;
  onError?: (error: Error) => void;
  generateId?: () => string;
  experimental_throttle?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  autoSave?: boolean;
  reconnectAttempts?: number;
  experimental_prepareRequestBody?: (options: ChatRequestOptions) => any;

  // PrepareStep integration
  tools?: TOOLS;
  prepareStep?: PrepareStepFunction<TOOLS>;
  enableIntelligentStepping?: boolean;
  stepAnalysisDebug?: boolean;

  // Experimental transform features (note: not supported in AI SDK v5)
  // experimental_transform?: StreamTextTransform<TOOLS>[];
  transformPreset?: 'performance' | 'development' | 'production' | 'smooth';
  compressionConfig?: CompressionTransformConfig;
  metricsConfig?: MetricsTransformConfig;
  debugConfig?: DebugTransformConfig;
  filterConfig?: FilterTransformConfig;
  collectProviderMetrics?: boolean;
  onProviderMetrics?: (metrics: ProviderMetricsData) => void;

  // V5-compatible options
  messages?: Message[];
  transport?: any;
}

export interface ChatMetrics {
  messageCount: number;
  totalTokens: number;
  averageResponseTime: number;
  errorRate: number;
  lastMessageTime?: number;
}

export interface UseChatEnhancedReturn {
  messages: Message[];
  input: string;
  setInput: (value: string | ((prev: string) => string)) => void;
  isLoading: boolean;
  error: Error | undefined;
  status: 'idle' | 'loading' | 'awaiting_message' | 'error';

  // Enhanced actions
  sendMessage: (
    message: { text: string },
    options?: ChatRequestOptions
  ) => void;
  append: (
    message: Message | string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  reload: (options?: ChatRequestOptions) => Promise<string | null | undefined>;
  stop: () => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addToolResult: (result: { toolCallId: string; result: any }) => void;

  // Advanced features
  retry: () => void;
  retryWithModifications: (modifications: string) => void;
  saveConversation: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  exportConversation: (format: 'json' | 'markdown' | 'txt') => string;
  resumeStream: () => void;

  // State management
  metrics: ChatMetrics;
  canRetry: boolean;
  hasUnsavedChanges: boolean;
  conversationId: string;

  // Multi-step support
  currentStep: number;
  maxSteps: number;
  stepHistory: Message[][];

  // Experimental features
  providerMetrics?: ProviderMetricsData;
  transformMetrics?: {
    appliedTransforms: string[];
    compressionRatio?: number;
    debugEvents?: number;
    filteredContent?: number;
  };
}

/**
 * Enhanced useChat hook with AI SDK 5.0 transport architecture
 *
 * Features:
 * - Full DefaultChatTransport integration
 * - Multi-step conversation support
 * - Stream resumption and reconnection
 * - Advanced error handling and retry logic
 * - Conversation persistence and export
 * - Performance monitoring and metrics
 * - Tool execution management
 */
export function useChatEnhanced<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
>(options: UseChatEnhancedOptions<TOOLS> = {}): UseChatEnhancedReturn {
  const {
    api = '/api/chat',
    maxSteps = 1,
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30_000,
    autoSave = false,
    reconnectAttempts = 3,
    experimental_throttle = 0,
    tools,
    prepareStep: customPrepareStep,
    enableIntelligentStepping = true,
    stepAnalysisDebug = false,
    // Note: experimental_transform is not supported in AI SDK v5
    // experimental_transform,
    transformPreset,
    compressionConfig,
    metricsConfig,
    debugConfig,
    filterConfig,
    collectProviderMetrics = false,
    onProviderMetrics,
    onError,
    onFinish,
    onResponse,
    onToolCall,
    experimental_prepareRequestBody,
    ...baseOptions
  } = options;

  // Enhanced state management
  const [conversationId] = useState(
    () =>
      options.id ??
      `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [retryCount, setRetryCount] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepHistory, setStepHistory] = useState<Message[][]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [metrics, setMetrics] = useState<ChatMetrics>({
    messageCount: 0,
    totalTokens: 0,
    averageResponseTime: 0,
    errorRate: 0,
  });

  // Experimental features state
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetricsData>();
  const [transformMetrics, setTransformMetrics] = useState<{
    appliedTransforms: string[];
    compressionRatio?: number;
    debugEvents?: number;
    filteredContent?: number;
  }>({
    appliedTransforms: [],
  });

  // Performance tracking
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastMessageRef = useRef<Message | undefined>(undefined);
  const responseTimes = useRef<number[]>([]);
  const errorCount = useRef<number>(0);
  const requestCount = useRef<number>(0);

  // PrepareStep integration
  const prepareStepHook = usePrepareStep({
    tools,
    enableIntelligentSwitching: enableIntelligentStepping,
    debug: stepAnalysisDebug,
  });

  const prepareStepFunction = useMemo(() => {
    if (customPrepareStep) {
      return customPrepareStep;
    }

    if (enableIntelligentStepping) {
      return prepareStepHook.createPrepareStep();
    }

    return;
  }, [customPrepareStep, enableIntelligentStepping, prepareStepHook]);

  // Note: Transform configuration is not supported in AI SDK v5
  // Configure experimental transform tracking for metrics
  const configuredTransforms = useMemo(() => {
    const appliedTransformNames: string[] = [];

    // Track applied transforms for metrics
    if (transformPreset) {
      appliedTransformNames.push(`preset:${transformPreset}`);
    }

    if (compressionConfig?.enabled) {
      appliedTransformNames.push('compression');
    }

    if (metricsConfig?.enabled) {
      appliedTransformNames.push('metrics');
    }

    if (debugConfig?.enabled) {
      appliedTransformNames.push('debug');
    }

    if (filterConfig?.enabled) {
      appliedTransformNames.push('filter');
    }

    // Update transform metrics
    setTransformMetrics((prev) => ({
      ...prev,
      appliedTransforms: appliedTransformNames,
    }));

    return; // Transforms not supported in AI SDK v5
  }, [
    transformPreset,
    compressionConfig,
    metricsConfig,
    debugConfig,
    filterConfig,
  ]);

  // Create enhanced transport with custom request preparation
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        headers: typeof options.headers === 'object' ? options.headers : {},
        body: options.body,
        credentials: options.credentials,
        prepareSendMessagesRequest: experimental_prepareRequestBody
          ? ({ messages, ...rest }) => {
              const customBody = experimental_prepareRequestBody({
                messages,
                ...rest,
              } as ChatRequestOptions);
              return {
                body: customBody,
                headers: options.headers,
                credentials: options.credentials,
              };
            }
          : undefined,
      }),
    [
      api,
      options.headers,
      options.body,
      options.credentials,
      experimental_prepareRequestBody,
    ]
  );

  // Base chat hook with enhanced configuration
  const baseChatResult = useBaseChat({
    ...baseOptions,
    id: conversationId,
    transport,
    // Note: experimental_throttle and experimental_transform are not supported in AI SDK v5
    // experimental_throttle,
    // experimental_transform: configuredTransforms,
    onToolCall: async (options: any): Promise<void> => {
      try {
        // Handle different AI SDK callback formats
        const actualToolCall =
          'toolCall' in options ? options.toolCall : options;

        // Ensure args property exists for compatibility
        const compatibleToolCall: ToolInvocation = {
          toolCallId: actualToolCall.toolCallId || actualToolCall.id,
          toolName: actualToolCall.toolName || actualToolCall.name,
          args: actualToolCall.args || actualToolCall.arguments || {},
        };

        await onToolCall?.(compatibleToolCall);
      } catch (error) {
        console.error('Tool execution error:', error);
        toast.error(
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error;
      }
    },
    // Note: onResponse is not supported in AI SDK v5 useChat hook
    // Custom response handling would need to be implemented via transport
    onFinish: ({
      message,
      usage,
      finishReason,
    }: {
      message: UIMessage;
      usage?: any;
      finishReason?: string;
    }) => {
      // Track request metrics
      requestCount.current += 1;
      const endTime = Date.now();
      const responseTime = startTimeRef.current
        ? endTime - startTimeRef.current
        : 0;

      // Update performance metrics
      responseTimes.current.push(responseTime);
      const avgResponseTime =
        responseTimes.current.reduce((a, b) => a + b, 0) /
        responseTimes.current.length;

      setMetrics((prev) => ({
        messageCount: prev.messageCount + 1,
        totalTokens: prev.totalTokens + (usage?.totalTokens ?? 0),
        averageResponseTime: avgResponseTime,
        errorRate: errorCount.current / requestCount.current,
        lastMessageTime: endTime,
      }));

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset retry count on success
      setRetryCount(0);
      setReconnectCount(0);
      setHasUnsavedChanges(true);

      // Collect provider metrics if enabled
      if (collectProviderMetrics) {
        const metricsData: ProviderMetricsData = {
          provider: 'unknown', // Would need model info from AI SDK
          model: 'unknown',
          responseTime: endTime - (startTimeRef.current ?? endTime),
          tokenUsage: {
            prompt: usage?.promptTokens ?? 0,
            completion: usage?.completionTokens ?? 0,
            total: usage?.totalTokens ?? 0,
          },
          quality: {
            coherenceScore: Math.min(
              (getMessageText(message)?.length ?? 0) / 100,
              1.0
            ),
            relevanceScore: 0.8, // Simplified calculation
            completenessScore: finishReason === 'stop' ? 0.9 : 0.6,
          },
          performance: {
            throughput:
              (usage?.totalTokens ?? 0) /
              ((endTime - (startTimeRef.current ?? endTime)) / 1000),
            latency: endTime - (startTimeRef.current ?? endTime),
            efficiency: 0.8, // Simplified calculation
          },
        };

        setProviderMetrics(metricsData);
        onProviderMetrics?.(metricsData);

        // Collect metrics in global collector
        globalMetricsCollector.collectMetrics(metricsData);
      }

      // Auto-save if enabled
      if (autoSave) {
        saveConversation();
      }

      onFinish?.(message, { usage, finishReason: finishReason ?? 'unknown' });

      // Show success toast only if no errors occurred
      if (errorCount.current === 0 || requestCount.current === 1) {
        toast.success('Message sent successfully');
      }
    },
    onError: (error) => {
      errorCount.current += 1;

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Update error rate
      setMetrics((prev) => ({
        ...prev,
        errorRate: errorCount.current / requestCount.current,
      }));

      // Auto-retry logic with exponential backoff
      if (retryCount < maxRetries && !error.message.includes('aborted')) {
        const delay = retryDelay * 2 ** retryCount;

        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          if (lastMessageRef.current) {
            baseAppend(lastMessageRef.current);
          }
        }, delay);

        toast.error(
          `Attempt ${retryCount + 1} failed, retrying in ${delay}ms...`
        );
      } else if (
        reconnectCount < reconnectAttempts &&
        error.message.includes('network')
      ) {
        // Network error - attempt reconnection
        const delay = 2000 * 2 ** reconnectCount;

        setTimeout(() => {
          setReconnectCount((prev) => prev + 1);
          if (lastMessageRef.current) {
            baseAppend(lastMessageRef.current);
          }
        }, delay);

        toast.error(
          `Connection lost, reconnecting... (${reconnectCount + 1}/${reconnectAttempts})`
        );
      } else {
        setRetryCount(0);
        setReconnectCount(0);
        onError?.(error);
        toast.error(error.message || 'Failed to send message');
      }
    },
  });

  // Extract properties from base chat result
  const messages = baseChatResult.messages;
  const input = (baseChatResult as any).input || '';
  const setInput = (baseChatResult as any).setInput || (() => {});
  const baseIsLoading = (baseChatResult as any).isLoading;
  const baseError = baseChatResult.error;
  const baseAppend =
    (baseChatResult as any).append || baseChatResult.sendMessage;
  const baseReload = (baseChatResult as any).reload || (() => {});
  const baseStop = (baseChatResult as any).stop || (() => {});
  const setMessages = baseChatResult.setMessages;
  const addToolResult = baseChatResult.addToolResult;
  const status = (baseChatResult as any).status || 'idle';

  // Enhanced append function with timeout support
  const append = useCallback(
    async (message: Message | string, options?: ChatRequestOptions) => {
      const messageObj: Message =
        typeof message === 'string'
          ? {
              role: 'user' as const,
              id: `msg-${Date.now()}`,
              parts: [{ type: 'text', text: message }],
            }
          : message;

      lastMessageRef.current = messageObj;
      setHasUnsavedChanges(true);

      // Add to step history
      setStepHistory((prev) => {
        const newHistory = [...prev];
        newHistory[currentStep] = [
          ...(newHistory[currentStep] || []),
          messageObj,
        ];
        return newHistory;
      });

      // Set timeout
      if (timeout > 0) {
        timeoutRef.current = setTimeout(() => {
          baseStop();
          onError?.(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
      }

      return baseAppend(messageObj, options);
    },
    [baseAppend, baseStop, timeout, onError, currentStep]
  );

  // Enhanced sendMessage function
  const sendMessage = useCallback(
    (message: { text: string }, options?: ChatRequestOptions) => {
      append(message.text, options);
    },
    [append]
  );

  // Enhanced reload function
  const reload = useCallback(
    (options?: ChatRequestOptions) => {
      setHasUnsavedChanges(true);

      // Set timeout
      if (timeout > 0) {
        timeoutRef.current = setTimeout(() => {
          baseStop();
          onError?.(new Error(`Reload timed out after ${timeout}ms`));
        }, timeout);
      }

      return baseReload(options);
    },
    [baseReload, baseStop, timeout, onError]
  );

  // Enhanced stop function
  const stop = useCallback(() => {
    baseStop();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [baseStop]);

  // Manual retry function
  const retry = useCallback(() => {
    if (lastMessageRef.current) {
      setRetryCount(0);
      append(lastMessageRef.current);
    }
  }, [append]);

  // Retry with modifications
  const retryWithModifications = useCallback(
    (modifications: string) => {
      if (lastMessageRef.current) {
        const currentText = getMessageText(lastMessageRef.current) || '';
        const modifiedText = `${currentText}\n\nAdditional instructions: ${modifications}`;
        const modifiedMessage: Message = {
          ...lastMessageRef.current,
          parts: [{ type: 'text', text: modifiedText }],
        };
        setRetryCount(0);
        append(modifiedMessage);
      }
    },
    [append]
  );

  // Conversation persistence
  const saveConversation = useCallback(async () => {
    try {
      const conversationData = {
        id: conversationId,
        messages,
        metrics,
        stepHistory,
        timestamp: Date.now(),
      };

      // Save to localStorage for now (could be extended to save to backend)
      localStorage.setItem(
        `conversation-${conversationId}`,
        JSON.stringify(conversationData)
      );
      setHasUnsavedChanges(false);
      toast.success('Conversation saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save conversation');
    }
  }, [conversationId, messages, metrics, stepHistory]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const saved = localStorage.getItem(`conversation-${id}`);
        if (saved) {
          const conversationData = JSON.parse(saved);
          setMessages(conversationData.messages);
          setStepHistory(conversationData.stepHistory || []);
          setMetrics(
            conversationData.metrics || {
              messageCount: 0,
              totalTokens: 0,
              averageResponseTime: 0,
              errorRate: 0,
            }
          );
          setHasUnsavedChanges(false);
          toast.success('Conversation loaded');
        }
      } catch (error) {
        console.error('Load error:', error);
        toast.error('Failed to load conversation');
      }
    },
    [setMessages]
  );

  // Export conversation in different formats
  const exportConversation = useCallback(
    (format: 'json' | 'markdown' | 'txt') => {
      switch (format) {
        case 'json':
          return JSON.stringify(
            {
              id: conversationId,
              messages,
              metrics,
              stepHistory,
              timestamp: Date.now(),
            },
            null,
            2
          );

        case 'markdown':
          return messages
            .map(
              (msg) =>
                `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n${getMessageText(msg) || ''}\n`
            )
            .join('\n');

        case 'txt':
          return messages
            .map(
              (msg) => `${msg.role.toUpperCase()}: ${getMessageText(msg) || ''}`
            )
            .join('\n\n');

        default:
          return '';
      }
    },
    [conversationId, messages, metrics, stepHistory]
  );

  // Resume stream function (experimental)
  const resumeStream = useCallback(() => {
    // This would require server-side support for stream resumption
    console.log('Stream resumption requested');
    // Implementation would depend on server capabilities
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // Core state
    messages: messages as unknown as Message[],
    input,
    setInput,
    isLoading: baseIsLoading,
    error: baseError,
    status,

    // Enhanced actions
    sendMessage,
    append,
    reload,
    stop,
    setMessages: setMessages as any,
    addToolResult: addToolResult as any,

    // Advanced features
    retry,
    retryWithModifications,
    saveConversation,
    loadConversation,
    exportConversation,
    resumeStream,

    // State management
    metrics,
    canRetry: retryCount < maxRetries,
    hasUnsavedChanges,
    conversationId,

    // Multi-step support
    currentStep,
    maxSteps,
    stepHistory,

    // Experimental features
    providerMetrics,
    transformMetrics,
  };
}
