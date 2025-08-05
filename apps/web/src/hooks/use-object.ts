'use client';

import { experimental_useObject } from '@ai-sdk/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

/**
 * Enhanced useObject hook with error handling and schema validation
 */
export function useStructuredGeneration<T>(
  schema: z.ZodSchema<T>,
  options?: {
    api?: string;
    onError?: (error: Error) => void;
    onSuccess?: (object: T) => void;
    initialValue?: Partial<T>;
  }
) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { object, submit, isLoading, error, stop } = experimental_useObject({
    api: options?.api || '/api/ai/generate-object',
    schema,
    onError: (error) => {
      console.error('Object generation failed:', error);
      toast.error(`Generation failed: ${error.message}`);

      // Extract validation errors if present
      if (error.message.includes('validation')) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.errors) {
            setValidationErrors(parsed.errors);
          }
        } catch {
          // Not a JSON error message
        }
      }

      options?.onError?.(error);
    },
    onFinish: ({ object, error }) => {
      if (!error && object) {
        setValidationErrors([]);
        options?.onSuccess?.(object);
        toast.success('Generated successfully!');
      }
    },
    initialValue: options?.initialValue,
  });

  // Retry with modified prompt
  const retryWithHints = useCallback(
    async (additionalContext?: string) => {
      setIsRetrying(true);
      setValidationErrors([]);

      try {
        // Modify the prompt to include hints about the schema
        const schemaHints = generateSchemaHints(schema);
        const enhancedPrompt = additionalContext
          ? `${additionalContext}\n\nPlease ensure the output matches this format:\n${schemaHints}`
          : `Please generate output matching this format:\n${schemaHints}`;

        await submit(enhancedPrompt);
      } finally {
        setIsRetrying(false);
      }
    },
    [submit, schema]
  );

  // Clear errors
  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return {
    object,
    submit,
    isLoading: isLoading || isRetrying,
    error,
    stop,
    validationErrors,
    retryWithHints,
    clearErrors,
    // Helper to check if a specific field has errors
    hasFieldError: (field: keyof T) =>
      validationErrors.some((err) => err.includes(String(field))),
    // Helper to get field-specific errors
    getFieldErrors: (field: keyof T) =>
      validationErrors.filter((err) => err.includes(String(field))),
  };
}

/**
 * Hook for generating arrays of structured data
 */
export function useStructuredArray<T>(
  itemSchema: z.ZodSchema<T>,
  options?: {
    api?: string;
    minItems?: number;
    maxItems?: number;
    onItemGenerated?: (item: T, index: number) => void;
  }
) {
  const [items, setItems] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const arraySchema = z
    .array(itemSchema)
    .min(options?.minItems || 1)
    .max(options?.maxItems || 10);

  const generation = useStructuredGeneration(arraySchema, {
    api: options?.api,
    onSuccess: (array) => {
      setItems(array);
      // Call item callback for each item
      array.forEach((item, index) => {
        options?.onItemGenerated?.(item, index);
      });
    },
  });

  // Generate more items
  const generateMore = useCallback(
    async (count = 1) => {
      const newGeneration = await generation.submit(
        `Generate ${count} more items similar to the existing ones`
      );

      if (newGeneration) {
        const newItems = [...items, ...newGeneration];
        setItems(newItems);
        setCurrentIndex(items.length);
      }
    },
    [generation, items]
  );

  // Remove item
  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update item
  const updateItem = useCallback((index: number, updates: Partial<T>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }, []);

  return {
    items,
    currentIndex,
    isLoading: generation.isLoading,
    error: generation.error,
    submit: generation.submit,
    generateMore,
    removeItem,
    updateItem,
    clear: () => setItems([]),
    // Pagination helpers
    hasNext: currentIndex < items.length - 1,
    hasPrevious: currentIndex > 0,
    next: () => setCurrentIndex((prev) => Math.min(prev + 1, items.length - 1)),
    previous: () => setCurrentIndex((prev) => Math.max(prev - 1, 0)),
    currentItem: items[currentIndex],
  };
}

/**
 * Hook for progressive object building
 */
export function useProgressiveObject<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  options?: {
    api?: string;
    fields: Array<keyof T>;
    onFieldComplete?: (field: keyof T, value: any) => void;
  }
) {
  const [partialObject, setPartialObject] = useState<Partial<T>>({});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const fields = options?.fields || Object.keys(schema.shape || {});
  const currentField = fields[currentFieldIndex];

  // Generate value for current field
  const generateCurrentField = useCallback(
    async (prompt: string) => {
      if (currentFieldIndex >= fields.length) return;

      const fieldSchema = (schema.shape as any)?.[currentField];
      if (!fieldSchema) return;

      const generation = useStructuredGeneration(
        z.object({ [currentField]: fieldSchema }),
        {
          api: options?.api,
          onSuccess: (result) => {
            const value = result[currentField as keyof typeof result];
            setPartialObject((prev) => ({ ...prev, [currentField]: value }));
            options?.onFieldComplete?.(currentField, value);

            // Move to next field
            if (currentFieldIndex < fields.length - 1) {
              setCurrentFieldIndex((prev) => prev + 1);
            } else {
              setIsComplete(true);
            }
          },
        }
      );

      await generation.submit(prompt);
    },
    [currentField, currentFieldIndex, fields, schema, options]
  );

  // Skip current field
  const skipField = useCallback(() => {
    if (currentFieldIndex < fields.length - 1) {
      setCurrentFieldIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentFieldIndex, fields.length]);

  // Go to specific field
  const goToField = useCallback(
    (fieldIndex: number) => {
      if (fieldIndex >= 0 && fieldIndex < fields.length) {
        setCurrentFieldIndex(fieldIndex);
        setIsComplete(false);
      }
    },
    [fields.length]
  );

  // Validate partial object
  const validate = useCallback(() => {
    try {
      schema.parse(partialObject);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return {
        valid: false,
        errors: [{ field: 'unknown', message: 'Validation failed' }],
      };
    }
  }, [partialObject, schema]);

  return {
    partialObject,
    currentField,
    currentFieldIndex,
    totalFields: fields.length,
    isComplete,
    generateCurrentField,
    skipField,
    goToField,
    validate,
    progress:
      ((currentFieldIndex + (isComplete ? 1 : 0)) / fields.length) * 100,
    reset: () => {
      setPartialObject({});
      setCurrentFieldIndex(0);
      setIsComplete(false);
    },
  };
}

// Helper function to generate schema hints
function generateSchemaHints(schema: z.ZodSchema<any>): string {
  try {
    if (schema._def.typeName === 'ZodObject') {
      const shape = schema._def.shape();
      const hints: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodSchema<any>;
        const type = fieldSchema._def.typeName.replace('Zod', '').toLowerCase();
        const isOptional = fieldSchema.isOptional();

        hints.push(
          `- ${key}: ${type}${isOptional ? ' (optional)' : ' (required)'}`
        );

        // Add enum values if present
        if (fieldSchema._def.values) {
          hints.push(`  Values: ${fieldSchema._def.values.join(', ')}`);
        }
      }

      return hints.join('\n');
    }

    return 'Please generate valid data according to the schema';
  } catch {
    return 'Please generate valid data according to the schema';
  }
}
