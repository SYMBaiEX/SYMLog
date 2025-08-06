// experimental-output.ts - Advanced structured output support for AI SDK v5
// Implements the experimental_output feature with support for text and object generation

import {
  type GenerateTextResult,
  generateText,
  type LanguageModel,
  Output,
  type StreamTextResult,
  streamText,
} from 'ai';
import { z } from 'zod';
import { getAIModel } from '../core/providers';

// Output builder types
export interface OutputBuilder<T = any> {
  type: 'text' | 'object' | 'enum' | 'array';
  schema?: z.ZodSchema<T>;
  enumValues?: readonly string[];
  transform?: (value: any) => T;
}

// Partial output handler
export type PartialOutputHandler<T> = (partial: Partial<T>) => void;

// Output stream result with partial output support
export interface OutputStreamResult<T>
  extends Omit<StreamTextResult<any, any>, 'experimental_partialOutputStream'> {
  experimental_partialOutputStream?: AsyncIterable<Partial<T>>;
}

/**
 * Advanced Output Builder for structured generation
 */
export class StructuredOutputBuilder {
  /**
   * Create a text output configuration
   */
  static text(): OutputBuilder<string> {
    return {
      type: 'text',
      transform: (value) => String(value),
    };
  }

  /**
   * Create an object output configuration with schema
   */
  static object<T>(schema: z.ZodSchema<T>): OutputBuilder<T> {
    return {
      type: 'object',
      schema,
      transform: (value) => schema.parse(value),
    };
  }

  /**
   * Create an enum output configuration
   */
  static enum<T extends readonly string[]>(
    values: T
  ): OutputBuilder<T[number]> {
    return {
      type: 'enum',
      enumValues: values,
      transform: (value) => {
        if (!values.includes(value)) {
          throw new Error(
            `Invalid enum value: ${value}. Expected one of: ${values.join(', ')}`
          );
        }
        return value;
      },
    };
  }

  /**
   * Create an array output configuration
   */
  static array<T>(itemSchema: z.ZodSchema<T>): OutputBuilder<T[]> {
    return {
      type: 'array',
      schema: itemSchema.array(),
      transform: (value) => itemSchema.array().parse(value),
    };
  }
}

/**
 * Structured Output Service for AI SDK v5
 */
export class StructuredOutputService {
  /**
   * Generate with structured output using experimental_output
   */
  async generate<T>(
    prompt: string,
    outputBuilder: OutputBuilder<T>,
    options?: {
      model?: string;
      messages?: any[];
      tools?: Record<string, any>;
      temperature?: number;
    }
  ): Promise<GenerateTextResult<any, any> & { output?: T }> {
    const model = getAIModel(options?.model);

    // Build the output configuration
    let output: any;
    if (outputBuilder.type === 'text') {
      output = Output.text();
    } else if (outputBuilder.type === 'object' && outputBuilder.schema) {
      output = Output.object({
        schema: outputBuilder.schema,
      });
    } else if (outputBuilder.type === 'enum') {
      // For enum, we use object output with enum schema
      const enumSchema = z.enum(
        outputBuilder.enumValues as [string, ...string[]]
      );
      output = Output.object({
        schema: z.object({ value: enumSchema }),
      });
    } else if (outputBuilder.type === 'array' && outputBuilder.schema) {
      output = Output.object({
        schema: z.object({ items: outputBuilder.schema }),
      });
    }

    const result = await generateText({
      model,
      prompt,
      messages: options?.messages,
      tools: options?.tools,
      temperature: options?.temperature,
      experimental_output: output,
    });

    // Transform the output if needed
    let transformedOutput: T | undefined;
    if (result.text && outputBuilder.type === 'text') {
      transformedOutput =
        outputBuilder.transform?.(result.text) ?? (result.text as T);
    } else if ('object' in result && result.object) {
      if (outputBuilder.type === 'enum') {
        const enumValue =
          result.object &&
          typeof result.object === 'object' &&
          result.object !== null &&
          'value' in result.object
            ? (result.object as any).value
            : undefined;
        transformedOutput =
          outputBuilder.transform?.(enumValue) ?? (enumValue as T | undefined);
      } else if (outputBuilder.type === 'array') {
        const arrayItems =
          result.object &&
          typeof result.object === 'object' &&
          result.object !== null &&
          'items' in result.object
            ? (result.object as any).items
            : undefined;
        transformedOutput =
          outputBuilder.transform?.(arrayItems) ??
          (arrayItems as T | undefined);
      } else {
        transformedOutput =
          outputBuilder.transform?.(result.object) ?? (result.object as T);
      }
    }

    return {
      ...result,
      output: transformedOutput,
    };
  }

  /**
   * Stream with structured output and partial output support
   */
  async stream<T>(
    prompt: string,
    outputBuilder: OutputBuilder<T>,
    options?: {
      model?: string;
      messages?: any[];
      tools?: Record<string, any>;
      temperature?: number;
      onPartialOutput?: PartialOutputHandler<T>;
    }
  ): Promise<OutputStreamResult<T>> {
    const model = getAIModel(options?.model);

    // Build the output configuration
    let output: any;
    if (outputBuilder.type === 'text') {
      output = Output.text();
    } else if (outputBuilder.type === 'object' && outputBuilder.schema) {
      output = Output.object({
        schema: outputBuilder.schema,
      });
    }

    const stream = await streamText({
      model,
      prompt,
      messages: options?.messages,
      tools: options?.tools,
      temperature: options?.temperature,
      experimental_output: output,
    });

    // Handle partial output streaming
    if (
      options?.onPartialOutput &&
      'experimental_partialOutputStream' in stream
    ) {
      (async () => {
        try {
          if (stream.experimental_partialOutputStream) {
            for await (const partial of stream.experimental_partialOutputStream) {
              const transformedPartial = outputBuilder.transform
                ? outputBuilder.transform(partial)
                : (partial as T);
              options.onPartialOutput?.(transformedPartial as Partial<T>);
            }
          }
        } catch (error) {
          console.error('Error in partial output stream:', error);
        }
      })();
    }

    return stream as OutputStreamResult<T>;
  }

  /**
   * Generate multiple outputs in parallel
   */
  async generateMultiple<T>(
    prompts: string[],
    outputBuilder: OutputBuilder<T>,
    options?: {
      model?: string;
      batchSize?: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<Array<{ prompt: string; output?: T; error?: string }>> {
    const batchSize = options?.batchSize || 5;
    const results: Array<{ prompt: string; output?: T; error?: string }> = [];

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (prompt) => {
          try {
            const result = await this.generate(prompt, outputBuilder, {
              model: options?.model,
            });
            return { prompt, output: result.output };
          } catch (error) {
            return {
              prompt,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      results.push(...batchResults);
      options?.onProgress?.(results.length, prompts.length);
    }

    return results;
  }
}

/**
 * Output validation utilities
 */
export class OutputValidator {
  /**
   * Validate and repair output against schema
   */
  static async validateAndRepair<T>(
    output: any,
    schema: z.ZodSchema<T>,
    options?: {
      repairFunction?: (output: any, error: z.ZodError) => any;
      maxAttempts?: number;
    }
  ): Promise<T> {
    const maxAttempts = options?.maxAttempts || 3;
    let currentOutput = output;
    let lastError: z.ZodError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return schema.parse(currentOutput);
      } catch (error) {
        if (error instanceof z.ZodError) {
          lastError = error;
          if (options?.repairFunction) {
            currentOutput = options.repairFunction(currentOutput, error);
          } else {
            // Default repair strategies
            currentOutput = OutputValidator.defaultRepair(currentOutput, error);
          }
        } else {
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to validate output after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Default repair function for common schema issues
   */
  private static defaultRepair(output: any, error: z.ZodError): any {
    const repaired = { ...output };

    for (const issue of error.issues) {
      const path = issue.path.join('.');

      switch (issue.code) {
        case 'invalid_type':
          // Try to coerce to expected type
          if (issue.expected === 'string') {
            OutputValidator.setNestedValue(
              repaired,
              path,
              String(OutputValidator.getNestedValue(output, path))
            );
          } else if (issue.expected === 'number') {
            const value = OutputValidator.getNestedValue(output, path);
            OutputValidator.setNestedValue(repaired, path, Number(value) || 0);
          } else if (issue.expected === 'boolean') {
            OutputValidator.setNestedValue(
              repaired,
              path,
              Boolean(OutputValidator.getNestedValue(output, path))
            );
          } else if (issue.expected === 'array') {
            OutputValidator.setNestedValue(repaired, path, []);
          } else if (issue.expected === 'object') {
            OutputValidator.setNestedValue(repaired, path, {});
          }
          break;

        case 'invalid_value':
          // Set to first valid enum value
          if (
            'options' in issue &&
            Array.isArray((issue as any).options) &&
            (issue as any).options.length > 0
          ) {
            OutputValidator.setNestedValue(
              repaired,
              path,
              (issue as any).options[0]
            );
          }
          break;

        case 'too_small':
          // Set minimum value
          if (
            'type' in issue &&
            issue.type === 'string' &&
            'minimum' in issue
          ) {
            OutputValidator.setNestedValue(
              repaired,
              path,
              'a'.repeat(issue.minimum as number)
            );
          } else if ('type' in issue && issue.type === 'array') {
            OutputValidator.setNestedValue(repaired, path, []);
          }
          break;

        default:
          // Remove invalid field
          OutputValidator.deleteNestedValue(repaired, path);
      }
    }

    return repaired;
  }

  private static getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      current = current?.[key];
    }
    return current;
  }

  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  private static deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return;
      current = current[keys[i]];
    }
    delete current[keys[keys.length - 1]];
  }
}

// Export singleton instance
export const structuredOutput = new StructuredOutputService();

// StructuredOutputBuilder is already exported above via class declaration
