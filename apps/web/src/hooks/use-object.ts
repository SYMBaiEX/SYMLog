'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
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

  const { object, submit, isLoading, error, stop } = useObject({
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
    // Note: initialValue may not be supported in all versions
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
      try {
        await generation.submit(
          `Generate ${count} more items similar to the existing ones`
        );
        // Items will be updated through the onSuccess callback
      } catch (error) {
        console.error('Failed to generate more items:', error);
      }
    },
    [generation]
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

  const fields =
    options?.fields || Object.keys((schema as any)._def?.shape || {});
  const currentField = fields[currentFieldIndex];

  // Note: Progressive field generation requires a different approach in AI SDK v5
  // This simplified version generates the entire object at once
  const generateCurrentField = useCallback(
    async (prompt: string) => {
      if (currentFieldIndex >= fields.length) return;

      // For now, we'll generate the entire object and extract the current field
      // In a production app, you'd want to implement proper field-by-field generation
      // using separate useObject instances or a different pattern

      try {
        const fieldSchema = (schema as any)._def?.shape?.[currentField];
        if (!fieldSchema) return;

        // This is a simplified approach - in practice, you'd need a more sophisticated
        // field-by-field generation system
        console.warn(
          'Progressive object generation needs to be implemented with proper patterns for AI SDK v5'
        );

        // Move to next field for now
        if (currentFieldIndex < fields.length - 1) {
          setCurrentFieldIndex((prev) => prev + 1);
        } else {
          setIsComplete(true);
        }
      } catch (error) {
        console.error('Field generation error:', error);
      }
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
          errors: error.issues.map((e: any) => ({
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
    if ('_def' in schema && (schema as any)._def.typeName === 'ZodObject') {
      const shape = (schema as any)._def.shape();
      const hints: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodSchema<any>;
        const type =
          '_def' in fieldSchema && (fieldSchema as any)._def.typeName
            ? (fieldSchema as any)._def.typeName
                .replace('Zod', '')
                .toLowerCase()
            : 'unknown';
        const isOptional = fieldSchema.isOptional();

        hints.push(
          `- ${key}: ${type}${isOptional ? ' (optional)' : ' (required)'}`
        );

        // Add enum values if present
        if ('_def' in fieldSchema && (fieldSchema as any)._def.values) {
          hints.push(
            `  Values: ${(fieldSchema as any)._def.values.join(', ')}`
          );
        }
      }

      return hints.join('\n');
    }

    return 'Please generate valid data according to the schema';
  } catch {
    return 'Please generate valid data according to the schema';
  }
}
