'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  type SchemaData,
  type SchemaType,
  schemaRegistry,
  validateStructuredData,
} from '../lib/ai/core';

export interface StructuredOutputState<T = any> {
  /** Generated structured data */
  data: T | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Finish reason from AI model */
  finishReason: string | null;
  /** Token usage information */
  usage: any | null;
  /** Partial data during streaming */
  partialData: Partial<T> | null;
  /** Whether currently streaming */
  isStreaming: boolean;
}

export interface GenerateObjectOptions {
  /** AI model to use */
  model?: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Generation mode */
  mode?: 'object' | 'json';
  /** Output strategy */
  output?: 'object' | 'array' | 'enum' | 'no-schema';
  /** Whether to stream the response */
  stream?: boolean;
  /** For array generation, number of items */
  arrayCount?: number;
  /** Authorization token */
  token?: string;
}

/**
 * Hook for generating structured data using predefined schemas
 */
export function useStructuredOutput<T extends SchemaType>(schemaName: T) {
  const [state, setState] = useState<StructuredOutputState<SchemaData<T>>>({
    data: null,
    isLoading: false,
    error: null,
    finishReason: null,
    usage: null,
    partialData: null,
    isStreaming: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Get the schema for validation
  const schema = schemaRegistry[schemaName] as unknown as z.ZodSchema<
    SchemaData<T>
  >;

  const generate = useCallback(
    async (prompt: string, options: GenerateObjectOptions = {}) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isStreaming: !!options.stream,
        error: null,
        data: null,
        partialData: null,
        finishReason: null,
        usage: null,
      }));

      try {
        const { stream = false, token, ...otherOptions } = options;

        if (stream) {
          // Use streaming endpoint
          const response = await fetch('/api/ai/stream-object', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              prompt,
              schema: schemaName,
              ...otherOptions,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          // Process streaming response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter((line) => line.trim());

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);

                  if (data.type === 'partial') {
                    // Validate partial data
                    const validationResult = schema.safeParse(data.object);
                    setState((prev) => ({
                      ...prev,
                      partialData: data.object as Partial<SchemaData<T>>,
                    }));
                  } else if (data.type === 'complete') {
                    // Validate final data
                    const validationResult = validateStructuredData<
                      SchemaData<T>
                    >(data.object, schema);
                    if (!validationResult.success) {
                      throw new Error(
                        `Validation failed: ${validationResult.error}`
                      );
                    }

                    setState((prev) => ({
                      ...prev,
                      data: validationResult.data,
                      finishReason: data.finishReason,
                      usage: data.usage,
                      isLoading: false,
                      isStreaming: false,
                      partialData: null,
                    }));
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.warn('Failed to parse streaming chunk:', parseError);
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          // Use non-streaming endpoint
          const response = await fetch('/api/ai/generate-object', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              prompt,
              schema: schemaName,
              ...otherOptions,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Generation failed');
          }

          // Validate the result
          const validationResult = validateStructuredData<SchemaData<T>>(
            result.object,
            schema
          );
          if (!validationResult.success) {
            throw new Error(`Validation failed: ${validationResult.error}`);
          }

          setState((prev) => ({
            ...prev,
            data: validationResult.data,
            finishReason: result.finishReason,
            usage: result.usage,
            isLoading: false,
            isStreaming: false,
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: 'Request cancelled',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      }
    },
    [schemaName, schema]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      finishReason: null,
      usage: null,
      partialData: null,
      isStreaming: false,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    generate,
    cancel,
    reset,
  };
}

/**
 * Hook for generating structured data with custom Zod schemas
 * Note: Currently only supports predefined schemas for security
 */
export function useCustomStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  schemaName?: string
) {
  const [state, setState] = useState<StructuredOutputState<T>>({
    data: null,
    isLoading: false,
    error: null,
    finishReason: null,
    usage: null,
    partialData: null,
    isStreaming: false,
  });

  const generate = useCallback(
    async (prompt: string, options: GenerateObjectOptions = {}) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        // For now, custom schemas are not supported server-side for security
        // This would require careful validation and sandboxing
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            'Custom schemas not yet supported. Please use a predefined schema.',
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [schema, schemaName]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      finishReason: null,
      usage: null,
      partialData: null,
      isStreaming: false,
    });
  }, []);

  return {
    ...state,
    generate,
    reset,
  };
}

/**
 * Hook for generating arrays of structured data
 */
export function useStructuredArray<T extends SchemaType>(schemaName: T) {
  const [state, setState] = useState<StructuredOutputState<SchemaData<T>[]>>({
    data: null,
    isLoading: false,
    error: null,
    finishReason: null,
    usage: null,
    partialData: null,
    isStreaming: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const schema = z.array(
    schemaRegistry[schemaName] as unknown as z.ZodSchema<SchemaData<T>>
  );

  const generateArray = useCallback(
    async (
      prompt: string,
      count = 5,
      options: Omit<GenerateObjectOptions, 'arrayCount' | 'output'> = {}
    ) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isStreaming: !!options.stream,
        error: null,
        data: null,
        partialData: null,
      }));

      try {
        const { stream = false, token, ...otherOptions } = options;

        const endpoint = stream
          ? '/api/ai/stream-object'
          : '/api/ai/generate-object';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt,
            schema: schemaName,
            output: 'array',
            arrayCount: count,
            ...otherOptions,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        if (stream) {
          // Handle streaming response similar to single object
          // Implementation would be similar to above but handling arrays
          const result = await response.json();
          setState((prev) => ({
            ...prev,
            data: result.object,
            finishReason: result.finishReason,
            usage: result.usage,
            isLoading: false,
            isStreaming: false,
          }));
        } else {
          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Generation failed');
          }

          // Validate the array result
          const validationResult = validateStructuredData<SchemaData<T>[]>(
            result.object,
            schema
          );
          if (!validationResult.success) {
            throw new Error(`Validation failed: ${validationResult.error}`);
          }

          setState((prev) => ({
            ...prev,
            data: validationResult.data,
            finishReason: result.finishReason,
            usage: result.usage,
            isLoading: false,
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: 'Request cancelled',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      }
    },
    [schemaName, schema]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      finishReason: null,
      usage: null,
      partialData: null,
      isStreaming: false,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    generateArray,
    cancel,
    reset,
  };
}

// Re-export schema types for convenience
export type { SchemaType, SchemaData };
export { schemaRegistry };
