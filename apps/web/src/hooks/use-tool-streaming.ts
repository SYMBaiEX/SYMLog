'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  MultiStepToolContext,
  StreamingToolPart,
  ToolExecutionProgress,
  ToolStreamingAnalytics,
  ToolStreamingError,
  ToolStreamingOptions,
  ToolStreamingSession,
  ToolStreamingSSEMessage,
  ToolStreamingState,
  UseToolStreamingReturn,
} from '@/types/tool-streaming';

export interface UseToolStreamingProps {
  apiEndpoint?: string;
  userId?: string;
  sessionId?: string;
  onComplete?: (result: any, metadata: any) => void;
  onError?: (error: ToolStreamingError) => void;
  onProgress?: (progress: ToolExecutionProgress) => void;
  autoRetry?: boolean;
  maxRetries?: number;
  enableToasts?: boolean;
  debugMode?: boolean;
}

/**
 * Advanced React hook for tool streaming with SSE support
 *
 * Features:
 * - Real-time streaming with Server-Sent Events
 * - Fine-grained progress tracking
 * - Automatic error recovery and retry
 * - Type-safe tool parts for UI integration
 * - Comprehensive analytics and metrics
 * - Multi-step tool execution support
 */
export function useToolStreaming(
  props: UseToolStreamingProps = {}
): UseToolStreamingReturn {
  const {
    apiEndpoint = '/api/ai/tool-streaming',
    userId,
    sessionId,
    onComplete,
    onError,
    onProgress,
    autoRetry = true,
    maxRetries = 3,
    enableToasts = true,
    debugMode = false,
  } = props;

  // Core state
  const [state, setState] = useState<ToolStreamingState>('idle');
  const [input, setInput] = useState<any>(null);
  const [output, setOutput] = useState<any>(null);
  const [progress, setProgress] = useState<ToolExecutionProgress | null>(null);
  const [error, setError] = useState<ToolStreamingError | null>(null);
  const [parts, setParts] = useState<StreamingToolPart[]>([]);
  const [session, setSession] = useState<ToolStreamingSession | null>(null);
  const [analytics, setAnalytics] = useState<Partial<ToolStreamingAnalytics>>(
    {}
  );

  // Refs for cleanup and abort control
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentExecutionRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);

  // Derived state
  const isStreaming = useMemo(
    () =>
      [
        'input-parsing',
        'input-available',
        'tool-executing',
        'tool-progress',
      ].includes(state),
    [state]
  );

  const isComplete = useMemo(() => state === 'tool-complete', [state]);
  const hasError = useMemo(() => state === 'error', [state]);

  // Debug logging
  const debugLog = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        console.log(`[useToolStreaming] ${message}`, data);
      }
    },
    [debugMode]
  );

  // Handle SSE messages
  const handleSSEMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: ToolStreamingSSEMessage = JSON.parse(event.data);
        const { event: eventType, data } = message;

        debugLog(`Received SSE event: ${eventType}`, data);

        switch (eventType) {
          case 'connection-established':
            setState('idle');
            setSession(
              (prevSession) =>
                ({
                  ...prevSession,
                  id: data.payload.executionId,
                  toolName: data.payload.toolName,
                  startTime: data.timestamp,
                  lastUpdateTime: data.timestamp,
                  state: 'idle',
                  options: data.payload.options,
                  metadata: {
                    toolName: data.payload.toolName,
                    executionId: data.payload.executionId,
                    startTime: data.timestamp,
                    endTime: 0,
                    duration: 0,
                    inputSize: 0,
                    outputSize: 0,
                    cacheHit: false,
                    retryCount: 0,
                  },
                }) as ToolStreamingSession
            );
            break;

          case 'input-start':
            setState('input-parsing');
            addToolPart({
              type: 'input',
              data: { stage: 'start', schema: data.payload.inputSchema },
            });
            break;

          case 'input-delta':
            setState('input-parsing');
            addToolPart({
              type: 'input',
              data: {
                stage: 'delta',
                partialInput: data.payload.partialInput,
                progress: data.payload.progress,
              },
            });
            break;

          case 'input-available':
            setState('input-available');
            setInput(data.payload.completeInput);
            addToolPart({
              type: 'input',
              data: {
                stage: 'complete',
                input: data.payload.completeInput,
                validation: data.payload.validation,
              },
            });

            if (enableToasts && data.payload.validation?.warnings?.length > 0) {
              toast.warning(
                `Input validation warnings: ${data.payload.validation.warnings.slice(0, 2).join(', ')}`
              );
            }
            break;

          case 'execution-start':
            setState('tool-executing');
            retryCountRef.current = 0;
            addToolPart({
              type: 'progress',
              data: { stage: 'start', input: data.payload.input },
            });

            if (enableToasts) {
              toast.loading(`Executing ${data.payload.toolName}...`, {
                id: data.payload.executionId,
              });
            }
            break;

          case 'execution-progress': {
            setState('tool-progress');
            const progressData = data.payload as ToolExecutionProgress;
            setProgress(progressData);
            onProgress?.(progressData);

            addToolPart({
              type: 'progress',
              data: progressData,
            });

            // Update session
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    progress: progressData,
                    lastUpdateTime: data.timestamp,
                  }
                : null
            );
            break;
          }

          case 'execution-complete':
            setState('tool-complete');
            setOutput(data.payload.result);
            setProgress(null);

            addToolPart({
              type: 'output',
              data: data.payload.result,
            });

            // Update session with final metadata
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    output: data.payload.result,
                    metadata: {
                      ...prev.metadata,
                      ...data.payload.metadata,
                    },
                    lastUpdateTime: data.timestamp,
                  }
                : null
            );

            onComplete?.(data.payload.result, data.payload.metadata);

            if (enableToasts) {
              toast.success('Tool execution completed', {
                id: currentExecutionRef.current || undefined,
              });
            }
            break;

          case 'error': {
            const streamingError = data.payload as ToolStreamingError;
            setState('error');
            setError(streamingError);
            setProgress(null);

            addToolPart({
              type: 'error',
              data: streamingError,
            });

            onError?.(streamingError);

            // Handle retry if enabled and retryable
            if (
              autoRetry &&
              streamingError.retryable &&
              retryCountRef.current < maxRetries
            ) {
              retryCountRef.current++;

              if (enableToasts) {
                toast.error(
                  `Tool execution failed. Retrying (${retryCountRef.current}/${maxRetries})...`,
                  {
                    id: currentExecutionRef.current || undefined,
                  }
                );
              }

              setTimeout(
                () => {
                  if (input && session?.toolName) {
                    executeToolInternal(
                      session.toolName,
                      input,
                      session.options
                    );
                  }
                },
                2 ** retryCountRef.current * 1000
              ); // Exponential backoff
            } else if (enableToasts) {
              toast.error(`Tool execution failed: ${streamingError.message}`, {
                id: currentExecutionRef.current || undefined,
              });
            }
            break;
          }

          case 'stream-close':
            debugLog('Stream closed', data.payload);
            cleanupEventSource();
            break;

          case 'stream-error':
            console.error('Stream error:', data.payload);
            if (enableToasts) {
              toast.error(`Stream error: ${data.payload.message}`);
            }
            break;

          default:
            debugLog(`Unknown event type: ${eventType}`, data);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error, event.data);
      }
    },
    [
      debugLog,
      enableToasts,
      onProgress,
      onComplete,
      onError,
      autoRetry,
      maxRetries,
      input,
      session,
    ]
  );

  // Add tool part helper
  const addToolPart = useCallback(
    (
      partialPart: Omit<
        StreamingToolPart,
        'id' | 'executionId' | 'toolName' | 'timestamp'
      >
    ) => {
      const part: StreamingToolPart = {
        id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        toolName: session?.toolName || '',
        executionId: currentExecutionRef.current || '',
        timestamp: Date.now(),
        ...partialPart,
      };

      setParts((prev) => [...prev, part]);
    },
    [session?.toolName]
  );

  // Cleanup event source
  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Internal execute function
  const executeToolInternal = useCallback(
    async (
      toolName: string,
      toolInput: any,
      options: ToolStreamingOptions = {},
      context?: MultiStepToolContext
    ) => {
      try {
        // Cleanup previous execution
        cleanupEventSource();
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Reset state
        setState('idle');
        setError(null);
        setOutput(null);
        setProgress(null);
        setParts([]);

        // Create abort controller
        abortControllerRef.current = new AbortController();

        // Prepare request body
        const requestBody = {
          toolName,
          input: toolInput,
          options: {
            enableInputStreaming: true,
            enableProgressStreaming: true,
            enableOutputStreaming: true,
            compressionEnabled: true,
            validationLevel: 'basic',
            ...options,
          },
          context,
          userId,
          sessionId,
        };

        debugLog('Starting tool execution', { toolName, options });

        // Make POST request to initiate streaming
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Extract execution ID from headers
        const executionId = response.headers.get('X-Execution-ID');
        currentExecutionRef.current = executionId;

        debugLog('Tool execution initiated', { executionId });

        // Create EventSource for SSE (since fetch doesn't directly support SSE)
        // We'll use the response body as a stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Process complete SSE messages
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              let currentMessage: Partial<ToolStreamingSSEMessage> = {};

              for (const line of lines) {
                if (line.trim() === '') {
                  // Empty line indicates end of message
                  if (currentMessage.data) {
                    handleSSEMessage({
                      data: JSON.stringify(currentMessage),
                    } as MessageEvent);
                  }
                  currentMessage = {};
                } else if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  try {
                    currentMessage.data = JSON.parse(data);
                  } catch {
                    // Handle multi-line data
                    currentMessage.data = {
                      toolName: 'unknown',
                      executionId: 'unknown',
                      timestamp: Date.now(),
                      payload: data,
                    };
                  }
                } else if (line.startsWith('event: ')) {
                  currentMessage.event = line.slice(7) as any;
                } else if (line.startsWith('id: ')) {
                  currentMessage.id = line.slice(4);
                } else if (line.startsWith('retry: ')) {
                  currentMessage.retry = Number.parseInt(line.slice(7), 10);
                }
              }
            }
          } catch (error) {
            if (!abortControllerRef.current?.signal.aborted) {
              console.error('Stream processing error:', error);
              setState('error');
              setError({
                type: 'network-error',
                toolName,
                executionId: currentExecutionRef.current || '',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Stream processing failed',
                retryable: true,
                retryCount: retryCountRef.current,
                timestamp: Date.now(),
              });
            }
          } finally {
            reader.releaseLock();
          }
        };

        processStream();
      } catch (error) {
        console.error('Tool execution error:', error);

        const streamingError: ToolStreamingError = {
          type: 'network-error',
          toolName,
          executionId: currentExecutionRef.current || '',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
          retryCount: retryCountRef.current,
          originalError: error instanceof Error ? error : undefined,
          timestamp: Date.now(),
        };

        setState('error');
        setError(streamingError);
        onError?.(streamingError);

        if (enableToasts) {
          toast.error(
            `Failed to start tool execution: ${streamingError.message}`
          );
        }
      }
    },
    [
      apiEndpoint,
      userId,
      sessionId,
      handleSSEMessage,
      cleanupEventSource,
      debugLog,
      onError,
      enableToasts,
    ]
  );

  // Public execute function
  const executeTool = useCallback(
    async (
      toolName: string,
      toolInput: any,
      options?: ToolStreamingOptions
    ) => {
      setInput(toolInput);
      await executeToolInternal(toolName, toolInput, options);
    },
    [executeToolInternal]
  );

  // Cancel execution
  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    cleanupEventSource();
    setState('cancelled');

    if (enableToasts && currentExecutionRef.current) {
      toast.info('Tool execution cancelled');
    }

    debugLog('Execution cancelled');
  }, [cleanupEventSource, enableToasts, debugLog]);

  // Retry execution
  const retryExecution = useCallback(() => {
    if (session?.toolName && input) {
      retryCountRef.current = 0;
      executeToolInternal(session.toolName, input, session.options);
    }
  }, [session, input, executeToolInternal]);

  // Clear state
  const clearState = useCallback(() => {
    cancelExecution();
    setState('idle');
    setInput(null);
    setOutput(null);
    setProgress(null);
    setError(null);
    setParts([]);
    setSession(null);
    setAnalytics({});
    retryCountRef.current = 0;
    currentExecutionRef.current = null;
  }, [cancelExecution]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupEventSource();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupEventSource]);

  // Update analytics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (session) {
        const now = Date.now();
        const duration = now - session.startTime;

        setAnalytics((prev) => ({
          ...prev,
          averageExecutionTime: duration,
          successRate: isComplete ? 1 : 0,
          errorRate: hasError ? 1 : 0,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, isComplete, hasError]);

  return {
    // Core state
    state,
    isStreaming,
    isComplete,
    hasError,

    // Data
    input,
    output,
    progress,
    error,
    parts,

    // Actions
    executeTool,
    cancelExecution,
    retryExecution,
    clearState,

    // Analytics
    session,
    analytics,
  };
}

// Export additional hook for multi-step tool execution
export function useMultiStepToolStreaming(
  props: UseToolStreamingProps & {
    workflowId?: string;
    onStepComplete?: (stepIndex: number, result: any) => void;
    onWorkflowComplete?: (results: any[]) => void;
  }
) {
  const baseHook = useToolStreaming(props);
  const [stepResults, setStepResults] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  const executeWorkflowStep = useCallback(
    async (
      toolName: string,
      input: any,
      stepIndex: number,
      totalSteps: number,
      dependencies: string[] = [],
      options?: ToolStreamingOptions
    ) => {
      setCurrentStepIndex(stepIndex);
      setTotalSteps(totalSteps);

      const context: MultiStepToolContext = {
        workflowId: props.workflowId || `workflow_${Date.now()}`,
        stepIndex,
        totalSteps,
        previousResults: stepResults,
        dependencies,
        parallelExecution: false,
      };

      await baseHook.executeTool(toolName, input, options);
    },
    [baseHook, stepResults, props.workflowId]
  );

  // Handle step completion
  useEffect(() => {
    if (baseHook.isComplete && baseHook.output) {
      const newResults = [...stepResults, baseHook.output];
      setStepResults(newResults);

      props.onStepComplete?.(currentStepIndex, baseHook.output);

      if (currentStepIndex === totalSteps - 1) {
        props.onWorkflowComplete?.(newResults);
      }
    }
  }, [
    baseHook.isComplete,
    baseHook.output,
    stepResults,
    currentStepIndex,
    totalSteps,
    props,
  ]);

  return {
    ...baseHook,
    executeWorkflowStep,
    stepResults,
    currentStepIndex,
    totalSteps,
    isWorkflowComplete:
      currentStepIndex === totalSteps - 1 && baseHook.isComplete,
  };
}
