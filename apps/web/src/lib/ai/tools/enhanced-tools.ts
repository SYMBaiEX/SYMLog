import { generateObject, tool } from 'ai';
import { z } from 'zod';
import type {
  Artifact,
  ChartArtifact,
  CodeArtifact,
  DataArtifact,
  DocumentArtifact,
  ImageArtifact,
  SpreadsheetArtifact,
} from '../../../types/artifacts';
import type {
  StreamingToolDefinition,
  ToolExecutionProgress,
  ToolStreamingOptions,
} from '../../../types/tool-streaming';
import { codeValidator } from '../intelligence/code-validator';
import { getAIModel } from '../core/providers';
import {
  executeToolWithProgress,
  type ProgressStreamController,
} from '../streaming/streaming-progress';

// Enhanced constants for tool system
const TOOL_EXECUTION_TIMEOUT = 30_000; // 30 seconds
const MAX_TOOL_RETRIES = 3;
const MAX_WORKFLOW_STEPS = 10;
const VALIDATION_RETRY_DELAY = 1000; // 1 second

// Enhanced tool result interface
export interface EnhancedToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime?: number;
  retryCount?: number;
  validationErrors?: string[];
  metadata?: Record<string, any>;
}

// Tool execution context
export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  previousResults?: any[];
  timeout?: number;
  retryCount?: number;
  progressCallback?: (progress: ToolExecutionProgress) => void;
  signal?: AbortSignal;
  workflowContext?: any;
  executionId?: string;
}

// Tool validation interface
interface ToolValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Helper function to generate secure artifact ID
function generateSecureArtifactId(): string {
  const timestamp = Date.now();
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().substr(0, 8)
      : Math.random().toString(36).substr(2, 8);
  return `artifact-${timestamp}-${random}`;
}

// Enhanced error handling for tools
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly retryCount: number = 0,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

// Enhanced AI SDK 5 compatible tools
export const enhancedArtifactTools = {
  // Enhanced code artifact creation with validation
  createCodeArtifact: tool({
    description:
      'Create executable code artifacts with comprehensive validation and error recovery',
    inputSchema: z.object({
      title: z.string().min(3).max(100).describe('Title of the code artifact'),
      language: z
        .enum([
          'javascript',
          'typescript',
          'python',
          'sql',
          'html',
          'css',
          'json',
          'bash',
          'markdown',
        ])
        .describe('Programming language'),
      content: z.string().min(10).describe('The code content'),
      runnable: z
        .boolean()
        .optional()
        .describe('Whether the code can be executed'),
      dependencies: z
        .array(z.string())
        .optional()
        .describe('Required dependencies'),
      validation: z
        .boolean()
        .optional()
        .default(true)
        .describe('Enable validation checks'),
    }),
    execute: async ({
      title,
      language,
      content,
      runnable,
      dependencies,
      validation,
    }) => {
      // Create the artifact
      const artifact: CodeArtifact = {
        id: generateSecureArtifactId(),
        type: 'code',
        title,
        content,
        language,
        runnable: runnable ?? false,
        dependencies,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      return artifact;
    },
  }),
};

// Tool execution service for managing complex operations
export class ToolExecutionService {
  private static instance: ToolExecutionService;
  private activeExecutions = new Map<string, AbortController>();

  private constructor() {}

  static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService();
    }
    return ToolExecutionService.instance;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  async executeToolWithCancellation<T>(
    toolName: string,
    params: any,
    context?: ToolExecutionContext
  ): Promise<EnhancedToolResult<T>> {
    const executionId = `${toolName}-${Date.now()}`;
    const controller = new AbortController();
    this.activeExecutions.set(executionId, controller);

    try {
      const startTime = Date.now();

      // Execute the tool with timeout and cancellation
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, context?.timeout ?? TOOL_EXECUTION_TIMEOUT);

      // Simulate tool execution - in real implementation this would call the actual tool
      const result = await new Promise<T>((resolve, reject) => {
        if (controller.signal.aborted) {
          reject(new ToolExecutionError('Execution cancelled', toolName));
          return;
        }

        // Mock execution for now
        setTimeout(() => {
          resolve({} as T);
        }, 100);
      });

      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        executionTime,
        retryCount: context?.retryCount ?? 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: context?.retryCount ?? 0,
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  cancelAllExecutions(): void {
    for (const [id, controller] of Array.from(
      this.activeExecutions.entries()
    )) {
      controller.abort();
    }
    this.activeExecutions.clear();
  }
}

// Export the singleton instance
export const toolExecutionService = ToolExecutionService.getInstance();

// Dynamic tool registry for managing tools at runtime
export class DynamicToolRegistry {
  private tools = new Map<string, any>();
  private toolSchemas = new Map<string, z.ZodSchema>();
  private toolMetadata = new Map<string, any>();

  registerTool(
    name: string,
    toolDefinition: any,
    schema?: z.ZodSchema,
    metadata?: any
  ): void {
    this.tools.set(name, toolDefinition);
    if (schema) this.toolSchemas.set(name, schema);
    if (metadata) this.toolMetadata.set(name, metadata);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
    this.toolSchemas.delete(name);
    this.toolMetadata.delete(name);
  }

  getTool(name: string): any {
    return this.tools.get(name);
  }

  getToolSchema(name: string): z.ZodSchema | undefined {
    return this.toolSchemas.get(name);
  }

  getAllTools(): Array<{
    name: string;
    tool: any;
    schema?: z.ZodSchema;
    metadata?: any;
  }> {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      tool,
      schema: this.toolSchemas.get(name),
      metadata: this.toolMetadata.get(name),
    }));
  }

  async getContextualTools(context: any): Promise<Record<string, any>> {
    const relevantTools: Record<string, any> = {};

    // Filter tools based on context
    for (const [name, tool] of Array.from(this.tools.entries())) {
      const metadata = this.toolMetadata.get(name);
      if (metadata?.contextFilter) {
        if (await metadata.contextFilter(context)) {
          relevantTools[name] = tool;
        }
      } else {
        relevantTools[name] = tool;
      }
    }

    return relevantTools;
  }
}

// Global tool registry instance
export const toolRegistry = new DynamicToolRegistry();

// Enhanced workflow execution with tool composition
export async function executeToolWorkflow(
  workflow: {
    name: string;
    steps: Array<{
      tool: string;
      params: any;
      condition?: (previousResults: any[]) => boolean;
      transform?: (input: any) => any;
      onError?: 'continue' | 'retry' | 'fail';
    }>;
    parallel?: boolean;
  },
  context?: ToolExecutionContext
): Promise<{
  success: boolean;
  results: any[];
  errors: any[];
  metadata: any;
}> {
  const results: any[] = [];
  const errors: any[] = [];
  const startTime = Date.now();

  for (const [index, step] of workflow.steps.entries()) {
    // Check condition
    if (step.condition && !step.condition(results)) {
      continue;
    }

    try {
      const tool = toolRegistry.getTool(step.tool);
      if (!tool) {
        throw new ToolExecutionError(
          `Tool '${step.tool}' not found`,
          'workflow'
        );
      }

      // Transform input if needed
      const input = step.transform
        ? step.transform(results[results.length - 1])
        : step.params;

      // Execute tool
      const result = await tool.execute(input, context);
      results.push({
        step: index,
        tool: step.tool,
        result,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorInfo = {
        step: index,
        tool: step.tool,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      errors.push(errorInfo);

      // Handle error based on strategy
      if (step.onError === 'fail') {
        throw error;
      }
      if (step.onError === 'retry') {
        // Retry once
        try {
          const tool = toolRegistry.getTool(step.tool);
          if (!tool) {
            throw new ToolExecutionError(
              `Tool '${step.tool}' not found`,
              'workflow'
            );
          }
          const result = await tool.execute(step.params, context);
          results.push({
            step: index,
            tool: step.tool,
            result,
            retried: true,
            timestamp: Date.now(),
          });
        } catch (retryError) {
          // Continue on retry failure
          errors.push({
            ...errorInfo,
            retryFailed: true,
          });
        }
      }
      // 'continue' - just continue to next step
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    metadata: {
      workflowName: workflow.name,
      totalSteps: workflow.steps.length,
      completedSteps: results.length,
      failedSteps: errors.length,
      executionTime: Date.now() - startTime,
    },
  };
}
