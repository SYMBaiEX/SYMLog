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
} from '@/types/artifacts';
import type {
  StreamingToolDefinition,
  ToolExecutionProgress,
  ToolStreamingOptions,
} from '@/types/tool-streaming';
import { codeValidator } from '../code-validator';
import { getAIModel } from '../providers';
import {
  executeToolWithProgress,
  type ProgressStreamController,
} from '../streaming-progress';

// Enhanced constants for tool system
const TOOL_EXECUTION_TIMEOUT = 30_000; // 30 seconds
const MAX_TOOL_RETRIES = 3;
const MAX_WORKFLOW_STEPS = 10;
const VALIDATION_RETRY_DELAY = 1000; // 1 second

// Enhanced tool result interface
interface EnhancedToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime?: number;
  retryCount?: number;
  validationErrors?: string[];
  metadata?: Record<string, any>;
}

// Tool execution context
interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  previousResults?: any[];
  timeout?: number;
  retryCount?: number;
  progressCallback?: (progress: ToolExecutionProgress) => void;
  signal?: AbortSignal;
  workflowContext?: any;
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
class ToolExecutionError extends Error {
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

// Tool validation utilities
class ToolValidator {
  static validateCodeArtifact(input: any): ToolValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!input.title || input.title.length < 3) {
      errors.push('Title must be at least 3 characters long');
    }

    if (!input.content || input.content.length < 10) {
      errors.push('Code content must be at least 10 characters long');
    }

    if (
      input.language &&
      ![
        'javascript',
        'typescript',
        'python',
        'sql',
        'html',
        'css',
        'json',
      ].includes(input.language)
    ) {
      warnings.push(
        `Language '${input.language}' might not be fully supported`
      );
    }

    // Check for potential security issues
    if (
      input.content &&
      /eval\s*\(|new\s+Function\s*\(|document\.write/i.test(input.content)
    ) {
      warnings.push('Code contains potentially unsafe patterns');
    }

    // Suggest improvements
    if (input.runnable && !input.dependencies?.length) {
      suggestions.push('Consider specifying dependencies for runnable code');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  static validateChartData(data: any): ToolValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!(data.labels && Array.isArray(data.labels))) {
      errors.push('Chart data must include labels array');
    }

    if (!(data.datasets && Array.isArray(data.datasets))) {
      errors.push('Chart data must include datasets array');
    }

    if (data.datasets?.length > 10) {
      warnings.push(
        'Chart has many datasets, consider simplifying for better readability'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}

// Streaming progress helper functions
class StreamingProgressHelper {
  static createProgressCallback(
    toolName: string,
    executionId: string,
    context?: ToolExecutionContext
  ): (
    stage: string,
    progress: number,
    message?: string,
    metadata?: any
  ) => void {
    return (
      stage: string,
      progress: number,
      message?: string,
      metadata?: any
    ) => {
      if (context?.progressCallback) {
        const progressData: ToolExecutionProgress = {
          toolName,
          executionId,
          stage,
          progress: Math.min(100, Math.max(0, progress)),
          message,
          estimatedTimeRemaining: StreamingProgressHelper.estimateTimeRemaining(
            progress,
            Date.now()
          ),
          metadata,
          timestamp: Date.now(),
        };
        context.progressCallback(progressData);
      }
    };
  }

  static estimateTimeRemaining(
    progress: number,
    startTime: number
  ): number | undefined {
    if (progress <= 0 || progress >= 100) return;

    const elapsed = Date.now() - startTime;
    const estimatedTotal = (elapsed / progress) * 100;
    return Math.max(0, estimatedTotal - elapsed);
  }

  static async withProgressTracking<T>(
    execution: (
      updateProgress: (
        stage: string,
        progress: number,
        message?: string,
        metadata?: any
      ) => void
    ) => Promise<T>,
    toolName: string,
    executionId: string,
    context?: ToolExecutionContext
  ): Promise<T> {
    const updateProgress = StreamingProgressHelper.createProgressCallback(
      toolName,
      executionId,
      context
    );

    // Check for abort signal
    context?.signal?.throwIfAborted();

    try {
      updateProgress('initializing', 0, 'Starting execution...');

      const result = await execution(updateProgress);

      updateProgress('complete', 100, 'Execution completed');
      return result;
    } catch (error) {
      updateProgress(
        'error',
        0,
        `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  static async delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      }
    });
  }
}

// Enhanced tool execution with streaming support
async function executeWithStreamingSupport<T>(
  toolName: string,
  execution: (
    updateProgress: (
      stage: string,
      progress: number,
      message?: string,
      metadata?: any
    ) => void
  ) => Promise<T>,
  context: ToolExecutionContext = {}
): Promise<T> {
  const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const startTime = Date.now();

  try {
    return await StreamingProgressHelper.withProgressTracking(
      execution,
      toolName,
      executionId,
      context
    );
  } catch (error) {
    // Enhanced error handling with streaming context
    if (context.signal?.aborted) {
      throw new ToolExecutionError(
        `Tool execution cancelled: ${toolName}`,
        toolName
      );
    }

    if (error instanceof ToolExecutionError) {
      throw error;
    }

    throw new ToolExecutionError(
      `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      toolName,
      0,
      error instanceof Error ? error : undefined
    );
  }
}

// Tool execution wrapper with retry logic
async function executeWithRetry<T>(
  toolName: string,
  execution: () => Promise<T>,
  context: ToolExecutionContext = {}
): Promise<EnhancedToolResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  const maxRetries = context.retryCount ?? MAX_TOOL_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Apply timeout if specified
      const timeoutPromise = context.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Tool execution timeout')),
              context.timeout
            )
          )
        : null;

      const executionPromise = execution();
      const result = timeoutPromise
        ? await Promise.race([executionPromise, timeoutPromise])
        : await executionPromise;

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        retryCount: attempt,
        metadata: {
          toolName,
          userId: context.userId,
          sessionId: context.sessionId,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (lastError.message.includes('validation') || attempt === maxRetries) {
        break;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, VALIDATION_RETRY_DELAY * 2 ** attempt)
        );
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    executionTime: Date.now() - startTime,
    retryCount: maxRetries,
    metadata: {
      toolName,
      originalError: lastError?.stack,
    },
  };
}

// Enhanced AI SDK 5 compatible tools
export const enhancedArtifactTools = {
  // Enhanced code artifact creation with validation
  createCodeArtifact: tool({
    description:
      'Create executable code artifacts with comprehensive validation and error recovery',
    parameters: z.object({
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
    execute: async (input, context = {}) => {
      return executeWithStreamingSupport(
        'createCodeArtifact',
        async (updateProgress) => {
          updateProgress(
            'initializing',
            0,
            'Starting code artifact creation...'
          )(
            // Check for abort signal
            context as ToolExecutionContext
          ).signal?.throwIfAborted();

          // Validate input if requested
          if (input.validation !== false) {
            updateProgress('validating', 20, 'Validating code input...');

            const validation = ToolValidator.validateCodeArtifact(input);
            if (!validation.isValid) {
              throw new ToolExecutionError(
                `Validation failed: ${validation.errors.join(', ')}`,
                'createCodeArtifact'
              );
            }

            // Additional code validation using the advanced validator
            if (
              input.language === 'javascript' ||
              input.language === 'typescript'
            ) {
              updateProgress(
                'validating',
                40,
                'Running advanced code analysis...'
              )(context as ToolExecutionContext).signal?.throwIfAborted();

              const codeValidation = await codeValidator.validateCode(
                input.content,
                input.language === 'typescript' ? 'typescript' : 'javascript',
                {
                  enableSecurityChecks: true,
                  enablePerformanceChecks: true,
                  enableModernizationSuggestions: true,
                  strictMode: false,
                }
              );

              // Add validation warnings as metadata
              if (
                codeValidation.warnings.length > 0 ||
                codeValidation.suggestions.length > 0
              ) {
                updateProgress(
                  'validating',
                  60,
                  `Found ${codeValidation.warnings.length} warnings, ${codeValidation.suggestions.length} suggestions`,
                  {
                    warnings: codeValidation.warnings.slice(0, 5), // Limit to first 5
                    suggestions: codeValidation.suggestions.slice(0, 5),
                  }
                );
              }
            }
          }

          updateProgress(
            'generating',
            80,
            'Creating code artifact...'
          )(context as ToolExecutionContext).signal?.throwIfAborted();

          const artifact: CodeArtifact = {
            id: generateSecureArtifactId(),
            type: 'code',
            title: input.title,
            content: input.content,
            language: input.language,
            runnable: input.runnable ?? false,
            dependencies: input.dependencies,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };

          updateProgress('finalizing', 95, 'Finalizing artifact...');

          return artifact;
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Enhanced chart creation with data validation
  createChartArtifact: tool({
    description:
      'Create interactive charts with automatic data validation and optimization',
    parameters: z.object({
      title: z.string().min(3).max(100).describe('Title of the chart'),
      chartType: z
        .enum(['line', 'bar', 'pie', 'scatter', 'area', 'doughnut', 'radar'])
        .describe('Type of chart'),
      data: z
        .object({
          labels: z.array(z.string()).describe('Chart labels'),
          datasets: z.array(
            z.object({
              label: z.string(),
              data: z.array(z.number()),
              backgroundColor: z.string().or(z.array(z.string())).optional(),
              borderColor: z.string().optional(),
            })
          ),
        })
        .describe('Chart data configuration'),
      options: z.any().optional().describe('Chart.js options configuration'),
      autoOptimize: z
        .boolean()
        .optional()
        .default(true)
        .describe('Enable automatic chart optimization'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry(
        'createChartArtifact',
        async () => {
          // Validate chart data
          const validation = ToolValidator.validateChartData(input.data);
          if (!validation.isValid) {
            throw new ToolExecutionError(
              `Chart validation failed: ${validation.errors.join(', ')}`,
              'createChartArtifact'
            );
          }

          // Auto-optimize if requested
          const optimizedData = input.data;
          let optimizedOptions = input.options || {};

          if (input.autoOptimize) {
            // Add responsive configuration
            optimizedOptions = {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top' as const,
                },
                title: {
                  display: true,
                  text: input.title,
                },
              },
              ...optimizedOptions,
            };

            // Optimize colors if not provided
            if (optimizedData.datasets.some((ds) => !ds.backgroundColor)) {
              const colors = [
                '#3B82F6',
                '#EF4444',
                '#10B981',
                '#F59E0B',
                '#8B5CF6',
                '#06B6D4',
                '#F97316',
                '#84CC16',
              ];
              optimizedData.datasets.forEach((dataset, index) => {
                if (!dataset.backgroundColor) {
                  dataset.backgroundColor = colors[index % colors.length];
                }
              });
            }
          }

          const artifact: ChartArtifact = {
            id: generateSecureArtifactId(),
            type: 'chart',
            title: input.title,
            content: JSON.stringify(
              { data: optimizedData, options: optimizedOptions },
              null,
              2
            ),
            chartType: input.chartType,
            data: optimizedData,
            options: optimizedOptions,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };

          return artifact;
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Advanced document creation with format conversion
  createDocumentArtifact: tool({
    description:
      'Create documents with automatic format conversion and content optimization',
    parameters: z.object({
      title: z.string().min(3).max(100).describe('Title of the document'),
      format: z.enum(['markdown', 'html', 'plain']).describe('Document format'),
      content: z.string().min(10).describe('The document content'),
      autoFormat: z
        .boolean()
        .optional()
        .default(true)
        .describe('Enable automatic formatting'),
      generateToc: z
        .boolean()
        .optional()
        .default(false)
        .describe('Generate table of contents'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry(
        'createDocumentArtifact',
        async () => {
          let processedContent = input.content;

          if (input.autoFormat) {
            // Add basic formatting improvements
            if (input.format === 'markdown') {
              // Ensure proper markdown formatting
              processedContent = processedContent
                .replace(/^#(?!#)/gm, '# ') // Fix H1 headers
                .replace(/^##(?!#)/gm, '## ') // Fix H2 headers
                .replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks
            }

            if (input.generateToc && input.format === 'markdown') {
              // Generate table of contents
              const headers = processedContent.match(/^#+\s+(.+)$/gm) || [];
              if (headers.length > 0) {
                const toc =
                  '## Table of Contents\n\n' +
                  headers
                    .map((header) => {
                      const level = (header.match(/#/g) || []).length;
                      const text = header.replace(/^#+\s+/, '');
                      const anchor = text
                        .toLowerCase()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '-');
                      return '  '.repeat(level - 1) + `- [${text}](#${anchor})`;
                    })
                    .join('\n') +
                  '\n\n';

                processedContent = toc + processedContent;
              }
            }
          }

          const artifact: DocumentArtifact = {
            id: generateSecureArtifactId(),
            type: 'document',
            title: input.title,
            content: processedContent,
            format: input.format,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };

          return artifact;
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Tool composition for complex workflows
  executeWorkflow: tool({
    description:
      'Execute a workflow of multiple tool calls with dependency management',
    parameters: z.object({
      name: z.string().describe('Workflow name'),
      steps: z
        .array(
          z.object({
            toolName: z.string().describe('Tool to execute'),
            parameters: z.any().describe('Tool parameters'),
            dependsOn: z
              .array(z.string())
              .optional()
              .describe('Step IDs this depends on'),
            id: z.string().describe('Unique step ID'),
          })
        )
        .max(MAX_WORKFLOW_STEPS)
        .describe('Workflow steps'),
      parallel: z
        .boolean()
        .optional()
        .default(false)
        .describe('Execute independent steps in parallel'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry(
        'executeWorkflow',
        async () => {
          const results = new Map<string, any>();
          const completed = new Set<string>();
          const errors: string[] = [];

          // Validate workflow structure
          const stepIds = new Set(input.steps.map((s) => s.id));
          for (const step of input.steps) {
            if (step.dependsOn?.some((dep) => !stepIds.has(dep))) {
              throw new ToolExecutionError(
                `Step ${step.id} has invalid dependencies`,
                'executeWorkflow'
              );
            }
          }

          // Execute steps with dependency resolution
          const executeStep = async (step: (typeof input.steps)[0]) => {
            // Wait for dependencies
            if (step.dependsOn) {
              for (const dep of step.dependsOn) {
                if (!completed.has(dep)) {
                  throw new ToolExecutionError(
                    `Dependency ${dep} not completed for step ${step.id}`,
                    'executeWorkflow'
                  );
                }
              }
            }

            try {
              // This would need to be expanded to actually call the tools
              // For now, we simulate the execution
              const stepResult = {
                stepId: step.id,
                toolName: step.toolName,
                success: true,
                data: `Executed ${step.toolName} with params: ${JSON.stringify(step.parameters, null, 2)}`,
                executedAt: Date.now(),
              };

              results.set(step.id, stepResult);
              completed.add(step.id);
              return stepResult;
            } catch (error) {
              const errorMsg = `Step ${step.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
              errors.push(errorMsg);
              throw new ToolExecutionError(errorMsg, 'executeWorkflow');
            }
          };

          // Group steps by dependency level for potential parallel execution
          const levels: Array<Array<(typeof input.steps)[0]>> = [];
          const remaining = [...input.steps];

          while (remaining.length > 0) {
            const currentLevel = remaining.filter(
              (step) =>
                !step.dependsOn ||
                step.dependsOn.every((dep) => completed.has(dep))
            );

            if (currentLevel.length === 0) {
              throw new ToolExecutionError(
                'Circular dependency detected in workflow',
                'executeWorkflow'
              );
            }

            levels.push(currentLevel);

            // Remove processed steps
            for (const step of currentLevel) {
              const index = remaining.indexOf(step);
              if (index > -1) remaining.splice(index, 1);
            }

            // Mark as completed for next level
            currentLevel.forEach((step) => completed.add(step.id));
          }

          // Reset completed set for actual execution
          completed.clear();

          // Execute levels
          for (const level of levels) {
            if (input.parallel && level.length > 1) {
              // Execute independent steps in parallel
              const levelResults = await Promise.allSettled(
                level.map((step) => executeStep(step))
              );

              levelResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                  completed.add(level[index].id);
                }
              });
            } else {
              // Execute sequentially
              for (const step of level) {
                await executeStep(step);
              }
            }
          }

          return {
            workflowName: input.name,
            totalSteps: input.steps.length,
            completedSteps: completed.size,
            results: Array.from(results.values()),
            errors: errors.length > 0 ? errors : undefined,
            executedAt: Date.now(),
          };
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Tool with required choice enforcement
  generateStructuredOutput: tool({
    description:
      'Force tool usage for structured outputs with schema validation',
    parameters: z.object({
      outputType: z
        .enum(['code', 'document', 'data', 'chart'])
        .describe('Type of output to generate'),
      requirements: z.string().describe('Requirements for the output'),
      schema: z.any().optional().describe('Optional schema for validation'),
      forceToolUsage: z
        .boolean()
        .default(true)
        .describe('Require tool usage for output'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry(
        'generateStructuredOutput',
        async () => {
          if (input.forceToolUsage) {
            // This tool would be used with toolChoice: 'required' in the streamText call
            // to force the AI to use tools for structured outputs
            return {
              type: input.outputType,
              requirements: input.requirements,
              toolRequired: true,
              nextAction: `Use ${input.outputType} creation tool`,
              timestamp: Date.now(),
            };
          }

          return {
            type: input.outputType,
            requirements: input.requirements,
            toolRequired: false,
            timestamp: Date.now(),
          };
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Enhanced tool with automatic repair
  createArtifactWithRepair: tool({
    description: 'Create artifact with automatic error recovery',
    parameters: z.object({
      type: z.enum(['code', 'document', 'chart', 'data']),
      title: z.string(),
      content: z.string(),
      language: z.string().optional(),
      options: z.any().optional(),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry(
        'createArtifactWithRepair',
        async () => {
          try {
            // Try to create the artifact based on type
            switch (input.type) {
              case 'code':
                return await enhancedArtifactTools.createCodeArtifact.execute(
                  {
                    title: input.title,
                    content: input.content,
                    language: (input.language as any) || 'javascript',
                    runnable: true,
                  },
                  context
                );

              case 'document':
                return await enhancedArtifactTools.createDocumentArtifact.execute(
                  {
                    title: input.title,
                    content: input.content,
                    format: 'markdown',
                    autoFormat: true,
                  },
                  context
                );

              case 'chart': {
                // Parse content as chart data
                const chartData = JSON.parse(input.content);
                return await enhancedArtifactTools.createChartArtifact.execute(
                  {
                    title: input.title,
                    chartType: chartData.type || 'bar',
                    data: chartData.data,
                    options: chartData.options,
                  },
                  context
                );
              }

              default:
                throw new ToolExecutionError(
                  `Unsupported artifact type: ${input.type}`,
                  'createArtifactWithRepair'
                );
            }
          } catch (error) {
            // Automatic repair attempt
            if (error instanceof Error) {
              const repairedInput = await repairToolInput(input, error);
              // Retry with repaired input
              return await this.execute(repairedInput, context);
            }
            throw error;
          }
        },
        context as ToolExecutionContext
      );
    },
  }),

  // Dynamic tool that changes based on context
  contextAwareTool: tool({
    description: 'Tool that adapts based on conversation context',
    parameters: z.object({
      action: z.string(),
      context: z.object({
        conversationType: z
          .enum(['technical', 'creative', 'analytical', 'general'])
          .optional(),
        userPreferences: z.any().optional(),
        previousActions: z.array(z.string()).optional(),
      }),
      parameters: z.any(),
    }),
    execute: async ({ action, context, parameters }) => {
      // Get contextual tools based on conversation type
      const contextualTools = await toolRegistry.getContextualTools(context);

      // Select the most appropriate tool
      let selectedTool = contextualTools[action];

      if (!selectedTool) {
        // Fallback to base tools
        selectedTool =
          enhancedArtifactTools[action as keyof typeof enhancedArtifactTools];
      }

      if (!selectedTool) {
        throw new ToolExecutionError(
          `No tool found for action '${action}' in context '${context.conversationType}'`,
          'contextAwareTool'
        );
      }

      // Execute with context-aware parameters
      return await selectedTool.execute(parameters, {
        ...context,
        adaptedForContext: true,
      });
    },
  }),

  // Composite tool that chains multiple operations
  workflowTool: tool({
    description: 'Execute a workflow of multiple tool calls',
    parameters: z.object({
      workflow: z.array(
        z.object({
          tool: z.string(),
          params: z.any(),
          waitForPrevious: z.boolean().optional(),
          useResultFromStep: z.number().optional(),
        })
      ),
      parallel: z.boolean().optional().default(false),
    }),
    execute: async ({ workflow, parallel }) => {
      const results: any[] = [];
      const errors: any[] = [];

      if (parallel) {
        // Execute independent steps in parallel
        const promises = workflow.map(async (step, index) => {
          if (step.waitForPrevious || step.useResultFromStep !== undefined) {
            return {
              index,
              skipped: true,
              reason: 'Dependencies not supported in parallel mode',
            };
          }

          try {
            const tool =
              toolRegistry.getTool(step.tool) ||
              enhancedArtifactTools[
                step.tool as keyof typeof enhancedArtifactTools
              ];

            if (!tool) {
              throw new ToolExecutionError(
                `Tool '${step.tool}' not found`,
                'workflowTool'
              );
            }

            const result = await tool.execute(step.params);
            return { index, success: true, result };
          } catch (error) {
            return {
              index,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const parallelResults = await Promise.allSettled(promises);
        parallelResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results[index] = result.value;
          } else {
            errors.push({ step: index, error: result.reason });
          }
        });
      } else {
        // Execute sequentially with dependency support
        for (let i = 0; i < workflow.length; i++) {
          const step = workflow[i];

          try {
            let params = step.params;

            // Use result from previous step if specified
            if (
              step.useResultFromStep !== undefined &&
              results[step.useResultFromStep]
            ) {
              params = results[step.useResultFromStep].result;
            }

            const tool =
              toolRegistry.getTool(step.tool) ||
              enhancedArtifactTools[
                step.tool as keyof typeof enhancedArtifactTools
              ];

            if (!tool) {
              throw new ToolExecutionError(
                `Tool '${step.tool}' not found`,
                'workflowTool'
              );
            }

            const result = await tool.execute(params);
            results.push({
              step: i,
              tool: step.tool,
              success: true,
              result,
            });
          } catch (error) {
            const errorInfo = {
              step: i,
              tool: step.tool,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
            results.push(errorInfo);
            errors.push(errorInfo);

            // Stop execution on error in sequential mode
            break;
          }
        }
      }

      return {
        workflowComplete: errors.length === 0,
        totalSteps: workflow.length,
        completedSteps: results.filter((r) => r.success).length,
        results,
        errors,
        executedAt: Date.now(),
      };
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

  async executeToolWithCancellation(
    toolName: string,
    parameters: any,
    options: {
      executionId?: string;
      timeout?: number;
      retries?: number;
      userId?: string;
      sessionId?: string;
    } = {}
  ): Promise<EnhancedToolResult> {
    const executionId =
      options.executionId ||
      `exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // Cancel any existing execution with the same ID
    if (this.activeExecutions.has(executionId)) {
      this.cancelExecution(executionId);
    }

    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    try {
      const context: ToolExecutionContext = {
        userId: options.userId,
        sessionId: options.sessionId,
        timeout: options.timeout || TOOL_EXECUTION_TIMEOUT,
        retryCount: options.retries || MAX_TOOL_RETRIES,
      };

      // Get the tool function
      const tool =
        enhancedArtifactTools[toolName as keyof typeof enhancedArtifactTools];
      if (!tool) {
        throw new ToolExecutionError(`Tool ${toolName} not found`, toolName);
      }

      // Execute with abortion check
      const result = await Promise.race([
        tool.execute(parameters, context),
        new Promise<never>((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(
              new ToolExecutionError(
                `Tool execution ${executionId} was cancelled`,
                toolName
              )
            );
          });
        }),
      ]);

      return result as EnhancedToolResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          toolName,
          executionId,
          cancelled: abortController.signal.aborted,
        },
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

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  cancelAllExecutions(): void {
    for (const [id, controller] of this.activeExecutions) {
      controller.abort();
    }
    this.activeExecutions.clear();
  }
}

// Export the singleton instance
export const toolExecutionService = ToolExecutionService.getInstance();

// Tool repair system
async function repairToolInput(input: any, error: Error): Promise<any> {
  const repairPrompt = `Fix this tool input based on the error:
Input: ${JSON.stringify(input)}
Error: ${error.message}
Return corrected input:`;

  const { object: repairedInput } = await generateObject({
    model: getAIModel(),
    prompt: repairPrompt,
    schema: z.any(),
  });

  return repairedInput;
}

// Dynamic tool registry
class DynamicToolRegistry {
  private tools = new Map<string, any>();
  private toolSchemas = new Map<string, z.ZodSchema>();
  private toolMetadata = new Map<string, any>();

  registerTool(
    name: string,
    toolDefinition: any,
    schema?: z.ZodSchema,
    metadata?: any
  ) {
    this.tools.set(name, toolDefinition);
    if (schema) this.toolSchemas.set(name, schema);
    if (metadata) this.toolMetadata.set(name, metadata);
  }

  unregisterTool(name: string) {
    this.tools.delete(name);
    this.toolSchemas.delete(name);
    this.toolMetadata.delete(name);
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  getToolSchema(name: string) {
    return this.toolSchemas.get(name);
  }

  getAllTools() {
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
    for (const [name, tool] of this.tools) {
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

// Register enhanced tools in the registry
Object.entries(enhancedArtifactTools).forEach(([name, tool]) => {
  toolRegistry.registerTool(name, tool);
});

// Advanced tool composition utilities
export const toolComposition = {
  // Create a tool with automatic repair
  createToolWithRepair: <T extends z.ZodSchema>(
    name: string,
    description: string,
    schema: T,
    execute: (input: z.infer<T>, context?: ToolExecutionContext) => Promise<any>
  ) => {
    return tool({
      description,
      parameters: schema,
      execute: async (input, context) => {
        try {
          return await execute(input, context as ToolExecutionContext);
        } catch (error) {
          if (error instanceof Error && error.message.includes('validation')) {
            // Try to repair the input
            const repairedInput = await repairToolInput(input, error);
            return await execute(
              repairedInput,
              context as ToolExecutionContext
            );
          }
          throw error;
        }
      },
    });
  },

  // Create a contextual tool that adapts based on context
  createContextualTool: (baseTools: Record<string, any>) => {
    return tool({
      description: 'Adaptive tool that changes behavior based on context',
      parameters: z.object({
        action: z.string(),
        context: z.any(),
        parameters: z.any(),
      }),
      execute: async ({ action, context, parameters }) => {
        const contextualTools = await toolRegistry.getContextualTools(context);
        const selectedTool = contextualTools[action] || baseTools[action];

        if (!selectedTool) {
          throw new ToolExecutionError(
            `Tool '${action}' not found for current context`,
            'contextualTool'
          );
        }

        return await selectedTool.execute(parameters, {
          ...context,
          isContextual: true,
        });
      },
    });
  },

  // Chain multiple tools together
  chainTools: (...tools: Array<{ name: string; params?: any }>) => {
    return tool({
      description: 'Execute multiple tools in sequence',
      parameters: z.object({
        initialInput: z.any(),
        transformers: z.array(z.function()).optional(),
      }),
      execute: async ({ initialInput, transformers = [] }) => {
        let result = initialInput;
        const results = [];

        for (let i = 0; i < tools.length; i++) {
          const { name, params } = tools[i];
          const tool = toolRegistry.getTool(name);

          if (!tool) {
            throw new ToolExecutionError(
              `Tool '${name}' not found`,
              'chainTools'
            );
          }

          // Apply transformer if provided
          if (transformers[i]) {
            result = transformers[i](result);
          }

          // Execute tool with previous result
          result = await tool.execute(params || result);
          results.push({ tool: name, result });
        }

        return {
          finalResult: result,
          intermediateResults: results,
        };
      },
    });
  },

  // Create a tool that can spawn sub-tools dynamically
  createDynamicTool: (toolGenerator: (context: any) => any) => {
    return tool({
      description: 'Dynamic tool that generates sub-tools based on context',
      parameters: z.object({
        context: z.any(),
        action: z.string(),
        parameters: z.any(),
      }),
      execute: async ({ context, action, parameters }) => {
        const generatedTool = await toolGenerator(context);

        if (!generatedTool[action]) {
          throw new ToolExecutionError(
            `Action '${action}' not available in generated tool`,
            'dynamicTool'
          );
        }

        return await generatedTool[action](parameters);
      },
    });
  },
};

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
          const tool = toolRegistry.getTool(step.tool)!;
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

// Export enhanced tool utilities
export {
  ToolValidator,
  ToolExecutionError,
  executeWithRetry,
  repairToolInput,
  type EnhancedToolResult,
  type ToolExecutionContext,
  type ToolValidation,
};
