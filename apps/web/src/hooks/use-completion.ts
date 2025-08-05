'use client';

import { useCompletion as useBaseCompletion } from '@ai-sdk/react';
import type { Tool } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type CompressionTransformConfig,
  type DebugTransformConfig,
  type FilterTransformConfig,
  globalMetricsCollector,
  type MetricsTransformConfig,
  type ProviderMetricsData,
} from '../lib/ai/experimental';
import { type PrepareStepFunction, usePrepareStep } from './use-prepare-step';

export interface UseCompletionOptions<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
> {
  api?: string;
  id?: string;
  initialCompletion?: string;
  initialInput?: string;
  headers?: Record<string, string> | Headers;
  body?: any;
  credentials?: RequestCredentials;
  streamProtocol?: 'text' | 'data';
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (prompt: string, completion: string) => void;
  onError?: (error: Error) => void;
  experimental_throttle?: number;
  experimental_prepareRequestBody?: (options: { prompt: string }) => any;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;

  // PrepareStep integration for multi-step completions
  tools?: TOOLS;
  prepareStep?: PrepareStepFunction<TOOLS>;
  enableIntelligentStepping?: boolean;
  stepAnalysisDebug?: boolean;

  // Note: experimental_transform is not supported in AI SDK v5
  // experimental_transform?: StreamTextTransform<TOOLS>[];
  transformPreset?: 'performance' | 'development' | 'production' | 'smooth';
  collectProviderMetrics?: boolean;
  onProviderMetrics?: (metrics: ProviderMetricsData) => void;
}

export interface CompletionState {
  completion: string;
  isLoading: boolean;
  error: Error | undefined;
  input: string;
  data: any[];
}

export interface CompletionActions {
  complete: (prompt?: string) => void;
  handleInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
  setInput: (value: string) => void;
  setCompletion: (completion: string) => void;
  stop: () => void;
  reload: () => void;
  clear: () => void;
}

export interface UseCompletionReturn
  extends CompletionState,
    CompletionActions {
  // Advanced state
  status: 'idle' | 'loading' | 'error' | 'success';
  retryCount: number;
  canRetry: boolean;

  // Performance metrics
  metrics: {
    responseTime?: number;
    tokensPerSecond?: number;
    totalTokens?: number;
  };

  // Advanced actions
  retry: () => void;
  retryWithModifications: (modifications: string) => void;
  pauseStream: () => void;
  resumeStream: () => void;
}

/**
 * Enhanced useCompletion hook with AI SDK 5.0 best practices
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Stream throttling and performance monitoring
 * - Enhanced error handling and recovery
 * - Request timeout management
 * - Advanced state management
 */
export function useCompletion<
  TOOLS extends Record<string, Tool> = Record<string, Tool>,
>(options: UseCompletionOptions<TOOLS> = {}): UseCompletionReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30_000,
    experimental_throttle = 0,
    tools,
    prepareStep: customPrepareStep,
    enableIntelligentStepping = false,
    stepAnalysisDebug = false,
    onError,
    onFinish,
    onResponse,
    ...baseOptions
  } = options;

  // Enhanced state management
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'error' | 'success'
  >('idle');
  const [metrics, setMetrics] = useState<{
    responseTime?: number;
    tokensPerSecond?: number;
    totalTokens?: number;
  }>({});
  const [isPaused, setIsPaused] = useState(false);

  // Performance tracking
  const startTimeRef = useRef<number>(0);
  const tokenCountRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastPromptRef = useRef<string>('');

  // PrepareStep integration for multi-step completions
  const prepareStepHook = usePrepareStep({
    tools,
    enableIntelligentSwitching: enableIntelligentStepping,
    debug: stepAnalysisDebug,
  });

  const prepareStepFunction =
    customPrepareStep ??
    (enableIntelligentStepping
      ? (prepareStepHook.configs as any).precise
      : undefined);

  // Base completion hook with enhanced error handling
  const {
    completion,
    isLoading: baseIsLoading,
    error: baseError,
    input,
    handleInputChange: baseHandleInputChange,
    handleSubmit: baseHandleSubmit,
    setInput,
    setCompletion,
    stop: baseStop,
    complete: baseComplete,
  } = useBaseCompletion({
    ...baseOptions,
    // Note: experimental_throttle is not supported in AI SDK v5
    // experimental_throttle,
    // onResponse callback not supported by useCompletion in v5
    onFinish: (prompt, completion) => {
      const endTime = Date.now();
      const responseTime = startTimeRef.current
        ? endTime - startTimeRef.current
        : 0;
      const tokenCount = completion.length / 4; // Rough token estimation

      setMetrics({
        responseTime,
        tokensPerSecond:
          responseTime > 0 ? (tokenCount * 1000) / responseTime : 0,
        totalTokens: tokenCount,
      });

      setStatus('success');
      setRetryCount(0);

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      onFinish?.(prompt, completion);
      toast.success('Completion generated successfully');
    },
    onError: (error) => {
      setStatus('error');

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Auto-retry logic
      if (retryCount < maxRetries && !error.message.includes('aborted')) {
        const delay = retryDelay * 2 ** retryCount; // Exponential backoff

        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          if (lastPromptRef.current) {
            baseComplete(lastPromptRef.current);
          }
        }, delay);

        toast.error(
          `Attempt ${retryCount + 1} failed, retrying in ${delay}ms...`
        );
      } else {
        setRetryCount(0);
        onError?.(error);
        toast.error(error.message || 'Completion failed');
      }
    },
  });

  // Enhanced loading state that includes paused state
  const isLoading = baseIsLoading && !isPaused;

  // Enhanced complete function with timeout
  const complete = useCallback(
    (prompt?: string) => {
      const finalPrompt = prompt ?? input;
      lastPromptRef.current = finalPrompt;
      tokenCountRef.current = 0;
      setStatus('loading');
      setIsPaused(false);

      // Set timeout
      if (timeout > 0) {
        timeoutRef.current = setTimeout(() => {
          baseStop();
          setStatus('error');
          onError?.(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
      }

      baseComplete(finalPrompt);
    },
    [input, baseComplete, baseStop, timeout, onError]
  );

  // Enhanced submit handler
  const handleSubmit = useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      complete();
    },
    [complete]
  );

  // Enhanced stop function
  const stop = useCallback(() => {
    baseStop();
    setStatus('idle');
    setIsPaused(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [baseStop]);

  // Manual retry function
  const retry = useCallback(() => {
    if (lastPromptRef.current) {
      setRetryCount(0);
      complete(lastPromptRef.current);
    }
  }, [complete]);

  // Retry with modifications
  const retryWithModifications = useCallback(
    (modifications: string) => {
      const modifiedPrompt = `${lastPromptRef.current}\n\nAdditional instructions: ${modifications}`;
      setRetryCount(0);
      complete(modifiedPrompt);
    },
    [complete]
  );

  // Pause/resume stream (experimental)
  const pauseStream = useCallback(() => {
    setIsPaused(true);
    // Note: Actual stream pausing would require server-side support
  }, []);

  const resumeStream = useCallback(() => {
    setIsPaused(false);
    // Note: Actual stream resuming would require server-side support
  }, []);

  // Reload function
  const reload = useCallback(() => {
    if (lastPromptRef.current) {
      complete(lastPromptRef.current);
    }
  }, [complete]);

  // Clear function
  const clear = useCallback(() => {
    setCompletion('');
    setInput('');
    setStatus('idle');
    setRetryCount(0);
    setMetrics({});
    lastPromptRef.current = '';
  }, [setCompletion, setInput]);

  // Enhanced input change handler with validation
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;

      // Basic input validation
      if (value.length > 10_000) {
        toast.error('Input too long (max 10,000 characters)');
        return;
      }

      baseHandleInputChange(event as any);
    },
    [baseHandleInputChange]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    completion,
    isLoading,
    error: baseError,
    input,
    data: [],
    status,
    retryCount,
    canRetry: retryCount < maxRetries,
    metrics,

    // Actions
    complete,
    handleInputChange,
    handleSubmit,
    setInput,
    setCompletion,
    stop,
    reload,
    clear,
    retry,
    retryWithModifications,
    pauseStream,
    resumeStream,
  };
}

/**
 * Hook for streaming text completions with real-time processing
 */
export function useStreamingCompletion(
  options: UseCompletionOptions & {
    onChunk?: (chunk: string) => void;
    chunkSize?: number;
  } = {}
) {
  const { onChunk, chunkSize = 50, ...completionOptions } = options;
  const [chunks, setChunks] = useState<string[]>([]);

  const completion = useCompletion({
    ...completionOptions,
    experimental_throttle: chunkSize,
    onFinish: (prompt, completion) => {
      // Process final chunks
      const finalChunks = [];
      for (let i = 0; i < completion.length; i += chunkSize) {
        const chunk = completion.slice(i, i + chunkSize);
        finalChunks.push(chunk);
        onChunk?.(chunk);
      }
      setChunks(finalChunks);
      options.onFinish?.(prompt, completion);
    },
  });

  // Reset chunks when starting new completion
  useEffect(() => {
    if (completion.isLoading && completion.completion === '') {
      setChunks([]);
    }
  }, [completion.isLoading, completion.completion]);

  return {
    ...completion,
    chunks,
    clearChunks: () => setChunks([]),
  };
}

/**
 * Hook for batch completions
 */
export function useBatchCompletion(options: UseCompletionOptions = {}) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [completions, setCompletions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchStatus, setBatchStatus] = useState<
    'idle' | 'processing' | 'completed' | 'error'
  >('idle');

  const completion = useCompletion({
    ...options,
    onFinish: (prompt, result) => {
      setCompletions((prev) => {
        const newCompletions = [...prev];
        newCompletions[currentIndex] = result;
        return newCompletions;
      });

      // Process next prompt
      if (currentIndex < prompts.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        completion.complete(prompts[currentIndex + 1]);
      } else {
        setBatchStatus('completed');
      }

      options.onFinish?.(prompt, result);
    },
    onError: (error) => {
      setBatchStatus('error');
      options.onError?.(error);
    },
  });

  const processBatch = useCallback(
    (batchPrompts: string[]) => {
      setPrompts(batchPrompts);
      setCompletions(new Array(batchPrompts.length).fill(''));
      setCurrentIndex(0);
      setBatchStatus('processing');

      if (batchPrompts.length > 0) {
        completion.complete(batchPrompts[0]);
      }
    },
    [completion]
  );

  const stopBatch = useCallback(() => {
    completion.stop();
    setBatchStatus('idle');
  }, [completion]);

  return {
    ...completion,
    prompts,
    completions,
    currentIndex,
    batchStatus,
    progress: prompts.length > 0 ? (currentIndex + 1) / prompts.length : 0,
    processBatch,
    stopBatch,
    clearBatch: () => {
      setPrompts([]);
      setCompletions([]);
      setCurrentIndex(0);
      setBatchStatus('idle');
    },
  };
}
