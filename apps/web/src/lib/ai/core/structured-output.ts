import {
  generateObject,
  type LanguageModel,
  NoObjectGeneratedError,
  streamObject,
} from 'ai';
import { z } from 'zod';
import { getAIModel } from './providers';

// Constants for default values
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_STREAM_TEMPERATURE = 0.3;
const DEFAULT_ARRAY_TEMPERATURE = 0.5;
const DEFAULT_ENUM_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_ARRAY_MAX_TOKENS = 4096;
const DEFAULT_ARRAY_COUNT = 5;

// Usage statistics interface for better type safety
export interface AIUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// Enhanced result interface with proper typing
export interface StructuredResult<T> {
  object: T;
  finishReason: string;
  usage: AIUsageStats;
  success: boolean;
  error?: string;
}

// Common Zod schemas for structured outputs
export const recipeSchema = z.object({
  name: z.string().describe('Recipe name'),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe('Ingredient name'),
        amount: z.string().describe('Amount needed'),
        unit: z.string().optional().describe('Unit of measurement'),
      })
    )
    .describe('List of ingredients'),
  steps: z.array(z.string()).describe('Cooking steps in order'),
  prepTime: z.number().optional().describe('Preparation time in minutes'),
  cookTime: z.number().optional().describe('Cooking time in minutes'),
  servings: z.number().optional().describe('Number of servings'),
});

export const personSchema = z.object({
  name: z.string().describe('Full name'),
  age: z.number().optional().describe('Age in years'),
  email: z.string().email().optional().describe('Email address'),
  occupation: z.string().optional().describe('Job title or profession'),
  location: z
    .object({
      city: z.string(),
      country: z.string(),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
    .optional()
    .describe('Location information'),
});

export const eventSchema = z.object({
  title: z.string().describe('Event title'),
  description: z.string().describe('Event description'),
  startDate: z.string().datetime().describe('Start date and time'),
  endDate: z.string().datetime().describe('End date and time'),
  location: z.string().optional().describe('Event location'),
  attendees: z.array(z.string()).optional().describe('List of attendee names'),
  tags: z.array(z.string()).optional().describe('Event tags or categories'),
});

export const articleSchema = z.object({
  title: z.string().describe('Article title'),
  summary: z.string().describe('Brief summary'),
  content: z.string().describe('Full article content'),
  author: z.string().describe('Author name'),
  publishedAt: z.string().datetime().optional().describe('Publication date'),
  tags: z.array(z.string()).optional().describe('Article tags'),
  wordCount: z.number().optional().describe('Article word count'),
});

export const taskSchema = z.object({
  id: z.string().optional().describe('Task ID'),
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Task priority'),
  status: z
    .enum(['todo', 'in_progress', 'completed', 'cancelled'])
    .describe('Task status'),
  dueDate: z.string().datetime().optional().describe('Due date'),
  assignee: z.string().optional().describe('Assigned person'),
  tags: z.array(z.string()).optional().describe('Task tags'),
});

export const contactSchema = z.object({
  name: z.string().describe('Contact name'),
  email: z.string().email().optional().describe('Email address'),
  phone: z.string().optional().describe('Phone number'),
  company: z.string().optional().describe('Company name'),
  position: z.string().optional().describe('Job position'),
  notes: z.string().optional().describe('Additional notes'),
  social: z
    .object({
      linkedin: z.string().url().optional(),
      twitter: z.string().url().optional(),
      github: z.string().url().optional(),
    })
    .optional()
    .describe('Social media profiles'),
});

// Output strategies (removed 'no-schema' to avoid conflicts with Zod schemas)
export type OutputStrategy = 'object' | 'array' | 'enum';

// Input sanitization constants
const MAX_PROMPT_LENGTH = 8000;
const SENTENCE_BOUNDARY_CHARS = '.!?\n';
const WORD_BOUNDARY_CHARS = ' \t';
const SANITIZATION_PATTERNS = {
  HTML_TAGS: /<[^>]*>/g,
  CURLY_BRACES: /[{}]/g,
  INJECTION_PATTERNS: /\b(eval|function|script|javascript|vbscript)\b/gi,
};

// Smart truncation that preserves sentence boundaries
function smartTruncate(
  text: string,
  maxLength: number
): { truncated: string; wasTruncated: boolean } {
  if (text.length <= maxLength) {
    return { truncated: text, wasTruncated: false };
  }

  // Try to find the last sentence boundary before maxLength
  let cutoff = maxLength;
  for (let i = maxLength - 1; i >= Math.max(0, maxLength - 200); i--) {
    if (SENTENCE_BOUNDARY_CHARS.includes(text[i])) {
      cutoff = i + 1;
      break;
    }
  }

  // If no sentence boundary found, try word boundary
  if (cutoff === maxLength) {
    for (let i = maxLength - 1; i >= Math.max(0, maxLength - 50); i--) {
      if (WORD_BOUNDARY_CHARS.includes(text[i])) {
        cutoff = i;
        break;
      }
    }
  }

  return {
    truncated: text.substring(0, cutoff).trim(),
    wasTruncated: true,
  };
}

// Input sanitization function to prevent prompt injection
function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  // Enhanced sanitization with injection prevention
  const sanitized = prompt
    .replace(SANITIZATION_PATTERNS.HTML_TAGS, '') // Remove HTML tags
    .replace(SANITIZATION_PATTERNS.CURLY_BRACES, '') // Remove curly braces that might interfere with system prompts
    .replace(SANITIZATION_PATTERNS.INJECTION_PATTERNS, '') // Remove potential injection keywords
    .trim();

  // Smart truncation that preserves context
  const { truncated, wasTruncated } = smartTruncate(
    sanitized,
    MAX_PROMPT_LENGTH
  );

  if (wasTruncated) {
    console.warn(
      `Prompt intelligently truncated from ${sanitized.length} to ${truncated.length} characters at natural boundary`
    );
  }

  return truncated;
}

// Validation result interface for consistency
interface ValidationResult<T> {
  isValid: boolean;
  value: T;
  error?: string;
}

// Validate mode parameter at runtime with consistent error handling
function validateMode(mode?: string): 'object' | 'json' {
  const result = validateModeResult(mode);
  if (!result.isValid) {
    throw new Error(result.error!);
  }
  return result.value;
}

// Internal validation with result object
function validateModeResult(
  mode?: string
): ValidationResult<'object' | 'json'> {
  if (!mode) {
    return { isValid: true, value: 'json' };
  }

  if (mode !== 'object' && mode !== 'json') {
    return {
      isValid: false,
      value: 'json',
      error: `Invalid mode: ${mode}. Must be 'object' or 'json'`,
    };
  }

  return { isValid: true, value: mode as 'object' | 'json' };
}

// Validate output parameter at runtime with consistent error handling
function validateOutput(output?: string): OutputStrategy {
  const result = validateOutputResult(output);
  if (!result.isValid) {
    throw new Error(result.error!);
  }
  return result.value;
}

// Internal validation with result object
function validateOutputResult(
  output?: string
): ValidationResult<OutputStrategy> {
  if (!output) {
    return { isValid: true, value: 'object' };
  }

  if (!['object', 'array', 'enum'].includes(output)) {
    return {
      isValid: false,
      value: 'object',
      error: `Invalid output strategy: ${output}. Must be 'object', 'array', or 'enum'`,
    };
  }

  return { isValid: true, value: output as OutputStrategy };
}

/**
 * Generate structured data using AI with type safety and security validation
 * @param params Configuration for structured data generation
 * @returns Promise resolving to structured result with proper typing
 */
export async function generateStructuredData<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  model?: string;
  temperature?: number;
  mode?: 'object' | 'json';
  output?: OutputStrategy;
}): Promise<StructuredResult<T>> {
  const {
    schema,
    prompt,
    model,
    temperature = DEFAULT_TEMPERATURE,
    mode = 'json',
    output = 'object',
  } = params;

  // Sanitize input prompt
  const sanitizedPrompt = sanitizePrompt(prompt);

  // Validate parameters
  const validatedMode = validateMode(mode);
  const validatedOutput = validateOutput(output);

  try {
    const result = await generateObject({
      model: getAIModel(model),
      schema,
      prompt: sanitizedPrompt,
      temperature,
      mode: validatedMode as any,
      output: validatedOutput as any,
    });

    return {
      object: result.object as T,
      finishReason: (result as any).finishReason ?? 'stop',
      usage: {
        promptTokens: result.usage?.inputTokens || 0,
        completionTokens: result.usage?.outputTokens || 0,
        totalTokens: result.usage?.totalTokens || 0,
        cost: (result.usage as any)?.cost,
      },
      success: true,
    };
  } catch (error) {
    return handleStructuredDataError(error, 'structured object generation');
  }
}

/**
 * Stream structured data generation with enhanced error handling and security
 * @param params Configuration for streaming structured data generation
 * @returns Streaming result with proper error handling
 */
export async function streamStructuredData<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  model?: string;
  temperature?: number;
  mode?: 'object' | 'json';
  output?: OutputStrategy;
  onStreamValue?: (value: any) => void;
  onFinish?: (result: {
    object: T;
    finishReason: string;
    usage: AIUsageStats;
    success: boolean;
    error?: string;
  }) => void;
  onError?: (error: StructuredResult<T>) => void;
}): Promise<{ success: boolean; stream?: any; error?: string }> {
  const {
    schema,
    prompt,
    model,
    temperature = DEFAULT_STREAM_TEMPERATURE,
    mode = 'json',
    output = 'object',
    onStreamValue,
    onFinish,
    onError,
  } = params;

  // Sanitize input prompt
  const sanitizedPrompt = sanitizePrompt(prompt);

  // Validate parameters
  const validatedMode = validateMode(mode);
  const validatedOutput = validateOutput(output);

  try {
    const result = streamObject({
      model: getAIModel(model),
      schema,
      prompt: sanitizedPrompt,
      temperature,
      mode: validatedMode as any,
      output: validatedOutput as any,
      onFinish: (result) => {
        // Provide proper typing for usage and call user callback if provided
        const typedUsage: AIUsageStats = {
          promptTokens: result.usage?.inputTokens || 0,
          completionTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
          cost: undefined, // cost is not available in LanguageModelV2Usage
        };

        onFinish?.({
          object: result.object as T,
          finishReason: 'stop',
          usage: typedUsage,
          success: true,
        });
      },
    });

    // Handle streaming values
    if (onStreamValue) {
      for await (const partialObject of result.partialObjectStream) {
        onStreamValue(partialObject);
      }
    }

    return { success: true, stream: result };
  } catch (error) {
    const errorResult = handleStructuredDataError<T>(
      error,
      'streaming structured object generation'
    );
    onError?.(errorResult);
    return { success: false, error: errorResult.error };
  }
}

/**
 * Generate array of structured objects with validation and security
 * @param params Configuration for array generation
 * @returns Promise resolving to array of structured objects
 */
export async function generateStructuredArray<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  count?: number;
  model?: string;
  temperature?: number;
}): Promise<StructuredResult<T[]>> {
  const {
    schema,
    prompt,
    count = DEFAULT_ARRAY_COUNT,
    model,
    temperature = DEFAULT_ARRAY_TEMPERATURE,
  } = params;

  // Validate count to prevent abuse
  const validatedCount = validateArrayCount(count);

  const arraySchema = z.array(schema).max(validatedCount);

  return generateStructuredData({
    schema: arraySchema,
    prompt: `${prompt}\n\nGenerate exactly ${validatedCount} items.`,
    model,
    temperature,
    output: 'array',
  });
}

/**
 * Stream array of structured objects with element-by-element processing
 * @param params Configuration for streaming array generation
 * @returns Streaming result with element-by-element processing
 */
export async function streamStructuredArray<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  count?: number;
  model?: string;
  temperature?: number;
  onElement?: (element: T) => void;
  onError?: (error: StructuredResult<T[]>) => void;
}): Promise<{ success: boolean; stream?: any; error?: string }> {
  const {
    schema,
    prompt,
    count = DEFAULT_ARRAY_COUNT,
    model,
    temperature = DEFAULT_ARRAY_TEMPERATURE,
    onElement,
    onError,
  } = params;

  // Validate count to prevent abuse
  const validatedCount = validateArrayCount(count);

  // Sanitize input prompt
  const sanitizedPrompt = sanitizePrompt(prompt);

  const arraySchema = z.array(schema).max(validatedCount);

  try {
    const result = streamObject({
      model: getAIModel(model),
      schema: arraySchema,
      prompt: `${sanitizedPrompt}\n\nGenerate exactly ${validatedCount} items.`,
      temperature,
      output: 'array',
    });

    // Handle element streaming
    if (onElement) {
      for await (const elements of result.elementStream) {
        // elementStream yields arrays when output is 'array', so we need to iterate through elements
        if (Array.isArray(elements)) {
          for (const element of elements) {
            onElement(element);
          }
        } else {
          // Type cast to handle the complex generic type resolution
          onElement(elements as T);
        }
      }
    }

    return { success: true, stream: result };
  } catch (error) {
    const errorResult = handleStructuredDataError<T[]>(
      error,
      'streaming array generation'
    );
    onError?.(errorResult);
    return { success: false, error: errorResult.error };
  }
}

/**
 * Generate enum value from predefined options
 * @param params Configuration for enum generation
 * @returns Promise resolving to selected enum value
 */
export async function generateEnumValue<T extends string>(params: {
  enumValues: readonly T[];
  prompt: string;
  model?: string;
  temperature?: number;
}): Promise<StructuredResult<T>> {
  const {
    enumValues,
    prompt,
    model,
    temperature = DEFAULT_ENUM_TEMPERATURE,
  } = params;

  if (!enumValues || enumValues.length === 0) {
    throw new Error('Enum values cannot be empty');
  }

  const enumSchema = z.enum(enumValues);

  return generateStructuredData({
    schema: enumSchema,
    prompt,
    model,
    temperature,
    output: 'enum',
  });
}

// Utility function to validate generated object
export function validateStructuredData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Schema registry for common patterns with validation
export const schemaRegistry = {
  recipe: recipeSchema,
  person: personSchema,
  event: eventSchema,
  article: articleSchema,
  task: taskSchema,
  contact: contactSchema,
} as const;

export type SchemaType = keyof typeof schemaRegistry;
export type SchemaData<T extends SchemaType> = z.infer<
  (typeof schemaRegistry)[T]
>;

/**
 * Get schema by name with validation
 * @param schemaName Name of the schema to retrieve
 * @returns The requested schema
 * @throws Error if schema registry is empty or schema not found
 */
export function getSchema<T extends SchemaType>(
  schemaName: T
): (typeof schemaRegistry)[T] {
  // Validate registry is not empty
  if (!schemaRegistry || Object.keys(schemaRegistry).length === 0) {
    throw new Error('Schema registry is not properly initialized');
  }

  if (!(schemaName in schemaRegistry)) {
    throw new Error(
      `Schema '${schemaName}' not found in registry. Available schemas: ${Object.keys(schemaRegistry).join(', ')}`
    );
  }

  return schemaRegistry[schemaName];
}

/**
 * Generate data using predefined schema name with enhanced validation
 * @param schemaName Name of the schema to use
 * @param prompt Input prompt for generation
 * @param options Additional generation options
 * @returns Promise resolving to generated structured data
 */
export async function generateBySchemaName<T extends SchemaType>(
  schemaName: T,
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    output?: OutputStrategy;
  }
): Promise<StructuredResult<SchemaData<T>>> {
  const schema = getSchema(schemaName);

  return generateStructuredData({
    schema: schema as any,
    prompt,
    ...options,
  }) as Promise<StructuredResult<SchemaData<T>>>;
}

// Enhanced error information interface
interface ErrorInfo {
  id: string;
  operation: string;
  originalError: unknown;
  errorType: 'NoObjectGenerated' | 'ValidationError' | 'UnknownError';
  message: string;
  details?: Record<string, any>;
}

// Core error processing utility
function processError(error: unknown, operation: string): ErrorInfo {
  const errorId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `ERR_${crypto.randomUUID().substr(0, 8)}`
      : `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  if (error instanceof NoObjectGeneratedError) {
    return {
      id: errorId,
      operation,
      originalError: error,
      errorType: 'NoObjectGenerated',
      message: `Failed to generate valid object during ${operation}`,
      details: { cause: error.message },
    };
  }

  if (error instanceof Error) {
    const isValidationError =
      error.message.includes('validation') || error.message.includes('schema');
    return {
      id: errorId,
      operation,
      originalError: error,
      errorType: isValidationError ? 'ValidationError' : 'UnknownError',
      message: isValidationError
        ? `Validation failed during ${operation}: ${error.message}`
        : `${operation} failed`,
      details: {
        originalMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }

  return {
    id: errorId,
    operation,
    originalError: error,
    errorType: 'UnknownError',
    message: `${operation} failed due to unknown error`,
    details: { errorValue: String(error) },
  };
}

// Environment-aware logging with cross-platform compatibility
function logError(errorInfo: ErrorInfo): void {
  const isDevelopment =
    typeof process !== 'undefined'
      ? process.env.NODE_ENV === 'development'
      : window?.location?.hostname === 'localhost';

  const logData = {
    id: errorInfo.id,
    operation: errorInfo.operation,
    type: errorInfo.errorType,
    message: errorInfo.message,
  };

  if (isDevelopment) {
    // Enhanced development logging with sensitive data filtering
    const safeDetails = errorInfo.details
      ? {
          ...errorInfo.details,
          stack: errorInfo.details.stack ? '[STACK_AVAILABLE]' : undefined,
        }
      : undefined;

    console.error(`[${errorInfo.id}] ${errorInfo.message}`, safeDetails);
  } else {
    // Production logging - minimal information
    console.info(`Operation failed: ${errorInfo.operation}`, {
      id: errorInfo.id,
      type: errorInfo.errorType,
    });
  }
}

// Centralized error handling utility
function handleStructuredDataError<T>(
  error: unknown,
  operation: string
): StructuredResult<T> {
  const errorInfo = processError(error, operation);
  logError(errorInfo);

  return {
    object: {} as T,
    finishReason: 'error',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    success: false,
    error: errorInfo.message,
  };
}

// Custom error class with proper cause support
class StructuredDataError extends Error {
  public readonly cause?: unknown;
  public readonly errorId: string;
  public readonly operation: string;

  constructor(
    message: string,
    cause?: unknown,
    errorId?: string,
    operation?: string
  ) {
    super(message);
    this.name = 'StructuredDataError';
    this.cause = cause;
    this.errorId = errorId || 'UNKNOWN';
    this.operation = operation || 'unknown';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StructuredDataError);
    }
  }
}

// Centralized error creation utility for throwing errors
function createStructuredDataError(
  error: unknown,
  operation: string
): StructuredDataError {
  const errorInfo = processError(error, operation);
  logError(errorInfo);

  return new StructuredDataError(
    errorInfo.message,
    errorInfo.originalError,
    errorInfo.id,
    errorInfo.operation
  );
}

// Array validation constants
const MIN_ARRAY_COUNT = 1;
const MAX_ARRAY_COUNT = 20;

// Validate and sanitize array count with consistent error handling
function validateArrayCount(count: number): number {
  const result = validateArrayCountResult(count);
  if (!result.isValid) {
    throw new Error(result.error!);
  }
  return result.value;
}

// Internal array count validation with result object
function validateArrayCountResult(count: number): ValidationResult<number> {
  if (typeof count !== 'number') {
    return {
      isValid: false,
      value: DEFAULT_ARRAY_COUNT,
      error: `Array count must be a number, received: ${typeof count}`,
    };
  }

  if (!Number.isInteger(count)) {
    return {
      isValid: false,
      value: Math.round(count),
      error: `Array count must be an integer, received: ${count}`,
    };
  }

  if (count < MIN_ARRAY_COUNT || count > MAX_ARRAY_COUNT) {
    return {
      isValid: false,
      value: Math.max(MIN_ARRAY_COUNT, Math.min(MAX_ARRAY_COUNT, count)),
      error: `Array count must be between ${MIN_ARRAY_COUNT} and ${MAX_ARRAY_COUNT}, received: ${count}`,
    };
  }

  return { isValid: true, value: count };
}

// Export error handling utilities for reuse
export {
  NoObjectGeneratedError,
  StructuredDataError,
  processError,
  logError,
  handleStructuredDataError,
  createStructuredDataError,
};

// Export error information type
export type { ErrorInfo };
