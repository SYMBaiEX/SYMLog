import { tool } from 'ai'
import { z } from 'zod'
import type { 
  Artifact, 
  CodeArtifact, 
  DocumentArtifact, 
  SpreadsheetArtifact,
  ImageArtifact,
  ChartArtifact,
  DataArtifact 
} from '@/types/artifacts'

// Enhanced constants for tool system
const TOOL_EXECUTION_TIMEOUT = 30000 // 30 seconds
const MAX_TOOL_RETRIES = 3
const MAX_WORKFLOW_STEPS = 10
const VALIDATION_RETRY_DELAY = 1000 // 1 second

// Enhanced tool result interface
interface EnhancedToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
  executionTime?: number
  retryCount?: number
  validationErrors?: string[]
  metadata?: Record<string, any>
}

// Tool execution context
interface ToolExecutionContext {
  userId?: string
  sessionId?: string
  previousResults?: any[]
  timeout?: number
  retryCount?: number
}

// Tool validation interface
interface ToolValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

// Helper function to generate secure artifact ID
function generateSecureArtifactId(): string {
  const timestamp = Date.now()
  const random = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID().substr(0, 8)
    : Math.random().toString(36).substr(2, 8)
  return `artifact-${timestamp}-${random}`
}

// Enhanced error handling for tools
class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly retryCount: number = 0,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

// Tool validation utilities
class ToolValidator {
  static validateCodeArtifact(input: any): ToolValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    if (!input.title || input.title.length < 3) {
      errors.push('Title must be at least 3 characters long')
    }

    if (!input.content || input.content.length < 10) {
      errors.push('Code content must be at least 10 characters long')
    }

    if (input.language && !['javascript', 'typescript', 'python', 'sql', 'html', 'css', 'json'].includes(input.language)) {
      warnings.push(`Language '${input.language}' might not be fully supported`)
    }

    // Check for potential security issues
    if (input.content && /eval\s*\(|new\s+Function\s*\(|document\.write/i.test(input.content)) {
      warnings.push('Code contains potentially unsafe patterns')
    }

    // Suggest improvements
    if (input.runnable && !input.dependencies?.length) {
      suggestions.push('Consider specifying dependencies for runnable code')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  static validateChartData(data: any): ToolValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    if (!data.labels || !Array.isArray(data.labels)) {
      errors.push('Chart data must include labels array')
    }

    if (!data.datasets || !Array.isArray(data.datasets)) {
      errors.push('Chart data must include datasets array')
    }

    if (data.datasets?.length > 10) {
      warnings.push('Chart has many datasets, consider simplifying for better readability')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }
}

// Tool execution wrapper with retry logic
async function executeWithRetry<T>(
  toolName: string,
  execution: () => Promise<T>,
  context: ToolExecutionContext = {}
): Promise<EnhancedToolResult<T>> {
  const startTime = Date.now()
  let lastError: Error | undefined
  const maxRetries = context.retryCount ?? MAX_TOOL_RETRIES

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Apply timeout if specified
      const timeoutPromise = context.timeout
        ? new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), context.timeout)
          )
        : null

      const executionPromise = execution()
      const result = timeoutPromise 
        ? await Promise.race([executionPromise, timeoutPromise])
        : await executionPromise

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        retryCount: attempt,
        metadata: {
          toolName,
          userId: context.userId,
          sessionId: context.sessionId
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on validation errors
      if (lastError.message.includes('validation') || attempt === maxRetries) {
        break
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, VALIDATION_RETRY_DELAY * Math.pow(2, attempt)))
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
      originalError: lastError?.stack
    }
  }
}

// Enhanced AI SDK 5 compatible tools
export const enhancedArtifactTools = {
  // Enhanced code artifact creation with validation
  createCodeArtifact: tool({
    description: 'Create executable code artifacts with comprehensive validation and error recovery',
    parameters: z.object({
      title: z.string().min(3).max(100).describe('Title of the code artifact'),
      language: z.enum(['javascript', 'typescript', 'python', 'sql', 'html', 'css', 'json', 'bash', 'markdown']).describe('Programming language'),
      content: z.string().min(10).describe('The code content'),
      runnable: z.boolean().optional().describe('Whether the code can be executed'),
      dependencies: z.array(z.string()).optional().describe('Required dependencies'),
      validation: z.boolean().optional().default(true).describe('Enable validation checks'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry('createCodeArtifact', async () => {
        // Validate input if requested
        if (input.validation !== false) {
          const validation = ToolValidator.validateCodeArtifact(input)
          if (!validation.isValid) {
            throw new ToolExecutionError(
              `Validation failed: ${validation.errors.join(', ')}`,
              'createCodeArtifact'
            )
          }
        }

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
        }

        return artifact
      }, context as ToolExecutionContext)
    },
  }),

  // Enhanced chart creation with data validation
  createChartArtifact: tool({
    description: 'Create interactive charts with automatic data validation and optimization',
    parameters: z.object({
      title: z.string().min(3).max(100).describe('Title of the chart'),
      chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'area', 'doughnut', 'radar']).describe('Type of chart'),
      data: z.object({
        labels: z.array(z.string()).describe('Chart labels'),
        datasets: z.array(z.object({
          label: z.string(),
          data: z.array(z.number()),
          backgroundColor: z.string().or(z.array(z.string())).optional(),
          borderColor: z.string().optional(),
        }))
      }).describe('Chart data configuration'),
      options: z.any().optional().describe('Chart.js options configuration'),
      autoOptimize: z.boolean().optional().default(true).describe('Enable automatic chart optimization'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry('createChartArtifact', async () => {
        // Validate chart data
        const validation = ToolValidator.validateChartData(input.data)
        if (!validation.isValid) {
          throw new ToolExecutionError(
            `Chart validation failed: ${validation.errors.join(', ')}`,
            'createChartArtifact'
          )
        }

        // Auto-optimize if requested
        let optimizedData = input.data
        let optimizedOptions = input.options || {}

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
                text: input.title
              }
            },
            ...optimizedOptions
          }

          // Optimize colors if not provided
          if (optimizedData.datasets.some(ds => !ds.backgroundColor)) {
            const colors = [
              '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
              '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'
            ]
            optimizedData.datasets.forEach((dataset, index) => {
              if (!dataset.backgroundColor) {
                dataset.backgroundColor = colors[index % colors.length]
              }
            })
          }
        }

        const artifact: ChartArtifact = {
          id: generateSecureArtifactId(),
          type: 'chart',
          title: input.title,
          content: JSON.stringify({ data: optimizedData, options: optimizedOptions }, null, 2),
          chartType: input.chartType,
          data: optimizedData,
          options: optimizedOptions,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        }

        return artifact
      }, context as ToolExecutionContext)
    },
  }),

  // Advanced document creation with format conversion
  createDocumentArtifact: tool({
    description: 'Create documents with automatic format conversion and content optimization',
    parameters: z.object({
      title: z.string().min(3).max(100).describe('Title of the document'),
      format: z.enum(['markdown', 'html', 'plain']).describe('Document format'),
      content: z.string().min(10).describe('The document content'),
      autoFormat: z.boolean().optional().default(true).describe('Enable automatic formatting'),
      generateToc: z.boolean().optional().default(false).describe('Generate table of contents'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry('createDocumentArtifact', async () => {
        let processedContent = input.content

        if (input.autoFormat) {
          // Add basic formatting improvements
          if (input.format === 'markdown') {
            // Ensure proper markdown formatting
            processedContent = processedContent
              .replace(/^#(?!#)/gm, '# ')  // Fix H1 headers
              .replace(/^##(?!#)/gm, '## ') // Fix H2 headers
              .replace(/\n{3,}/g, '\n\n')  // Remove excessive line breaks
          }
          
          if (input.generateToc && input.format === 'markdown') {
            // Generate table of contents
            const headers = processedContent.match(/^#+\s+(.+)$/gm) || []
            if (headers.length > 0) {
              const toc = '## Table of Contents\n\n' + 
                headers.map(header => {
                  const level = (header.match(/#/g) || []).length
                  const text = header.replace(/^#+\s+/, '')
                  const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                  return '  '.repeat(level - 1) + `- [${text}](#${anchor})`
                }).join('\n') + '\n\n'
              
              processedContent = toc + processedContent
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
        }

        return artifact
      }, context as ToolExecutionContext)
    },
  }),

  // Tool composition for complex workflows
  executeWorkflow: tool({
    description: 'Execute a workflow of multiple tool calls with dependency management',
    parameters: z.object({
      name: z.string().describe('Workflow name'),
      steps: z.array(z.object({
        toolName: z.string().describe('Tool to execute'),
        parameters: z.any().describe('Tool parameters'),
        dependsOn: z.array(z.string()).optional().describe('Step IDs this depends on'),
        id: z.string().describe('Unique step ID'),
      })).max(MAX_WORKFLOW_STEPS).describe('Workflow steps'),
      parallel: z.boolean().optional().default(false).describe('Execute independent steps in parallel'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry('executeWorkflow', async () => {
        const results = new Map<string, any>()
        const completed = new Set<string>()
        const errors: string[] = []

        // Validate workflow structure
        const stepIds = new Set(input.steps.map(s => s.id))
        for (const step of input.steps) {
          if (step.dependsOn?.some(dep => !stepIds.has(dep))) {
            throw new ToolExecutionError(
              `Step ${step.id} has invalid dependencies`,
              'executeWorkflow'
            )
          }
        }

        // Execute steps with dependency resolution
        const executeStep = async (step: typeof input.steps[0]) => {
          // Wait for dependencies
          if (step.dependsOn) {
            for (const dep of step.dependsOn) {
              if (!completed.has(dep)) {
                throw new ToolExecutionError(
                  `Dependency ${dep} not completed for step ${step.id}`,
                  'executeWorkflow'
                )
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
              executedAt: Date.now()
            }

            results.set(step.id, stepResult)
            completed.add(step.id)
            return stepResult
          } catch (error) {
            const errorMsg = `Step ${step.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            errors.push(errorMsg)
            throw new ToolExecutionError(errorMsg, 'executeWorkflow')
          }
        }

        // Group steps by dependency level for potential parallel execution
        const levels: Array<Array<typeof input.steps[0]>> = []
        const remaining = [...input.steps]

        while (remaining.length > 0) {
          const currentLevel = remaining.filter(step => 
            !step.dependsOn || step.dependsOn.every(dep => completed.has(dep))
          )

          if (currentLevel.length === 0) {
            throw new ToolExecutionError(
              'Circular dependency detected in workflow',
              'executeWorkflow'
            )
          }

          levels.push(currentLevel)
          
          // Remove processed steps
          for (const step of currentLevel) {
            const index = remaining.indexOf(step)
            if (index > -1) remaining.splice(index, 1)
          }

          // Mark as completed for next level
          currentLevel.forEach(step => completed.add(step.id))
        }

        // Reset completed set for actual execution
        completed.clear()

        // Execute levels
        for (const level of levels) {
          if (input.parallel && level.length > 1) {
            // Execute independent steps in parallel
            const levelResults = await Promise.allSettled(
              level.map(step => executeStep(step))
            )
            
            levelResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                completed.add(level[index].id)
              }
            })
          } else {
            // Execute sequentially
            for (const step of level) {
              await executeStep(step)
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
        }
      }, context as ToolExecutionContext)
    },
  }),

  // Tool with required choice enforcement  
  generateStructuredOutput: tool({
    description: 'Force tool usage for structured outputs with schema validation',
    parameters: z.object({
      outputType: z.enum(['code', 'document', 'data', 'chart']).describe('Type of output to generate'),
      requirements: z.string().describe('Requirements for the output'),
      schema: z.any().optional().describe('Optional schema for validation'),
      forceToolUsage: z.boolean().default(true).describe('Require tool usage for output'),
    }),
    execute: async (input, context = {}) => {
      return executeWithRetry('generateStructuredOutput', async () => {
        if (input.forceToolUsage) {
          // This tool would be used with toolChoice: 'required' in the streamText call
          // to force the AI to use tools for structured outputs
          return {
            type: input.outputType,
            requirements: input.requirements,
            toolRequired: true,
            nextAction: `Use ${input.outputType} creation tool`,
            timestamp: Date.now(),
          }
        }

        return {
          type: input.outputType,
          requirements: input.requirements,
          toolRequired: false,
          timestamp: Date.now(),
        }
      }, context as ToolExecutionContext)
    },
  }),
}

// Tool execution service for managing complex operations
export class ToolExecutionService {
  private static instance: ToolExecutionService
  private activeExecutions = new Map<string, AbortController>()

  private constructor() {}

  static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService()
    }
    return ToolExecutionService.instance
  }

  async executeToolWithCancellation(
    toolName: string,
    parameters: any,
    options: {
      executionId?: string
      timeout?: number
      retries?: number
      userId?: string
      sessionId?: string
    } = {}
  ): Promise<EnhancedToolResult> {
    const executionId = options.executionId || `exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
    
    // Cancel any existing execution with the same ID
    if (this.activeExecutions.has(executionId)) {
      this.cancelExecution(executionId)
    }

    const abortController = new AbortController()
    this.activeExecutions.set(executionId, abortController)

    try {
      const context: ToolExecutionContext = {
        userId: options.userId,
        sessionId: options.sessionId,
        timeout: options.timeout || TOOL_EXECUTION_TIMEOUT,
        retryCount: options.retries || MAX_TOOL_RETRIES,
      }

      // Get the tool function
      const tool = enhancedArtifactTools[toolName as keyof typeof enhancedArtifactTools]
      if (!tool) {
        throw new ToolExecutionError(`Tool ${toolName} not found`, toolName)
      }

      // Execute with abortion check
      const result = await Promise.race([
        tool.execute(parameters, context),
        new Promise<never>((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new ToolExecutionError(`Tool execution ${executionId} was cancelled`, toolName))
          })
        })
      ])

      return result as EnhancedToolResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { toolName, executionId, cancelled: abortController.signal.aborted }
      }
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId)
    if (controller) {
      controller.abort()
      this.activeExecutions.delete(executionId)
      return true
    }
    return false
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys())
  }

  cancelAllExecutions(): void {
    for (const [id, controller] of this.activeExecutions) {
      controller.abort()
    }
    this.activeExecutions.clear()
  }
}

// Export the singleton instance
export const toolExecutionService = ToolExecutionService.getInstance()

// Export enhanced tool utilities
export {
  ToolValidator,
  ToolExecutionError,
  executeWithRetry,
  type EnhancedToolResult,
  type ToolExecutionContext,
  type ToolValidation,
}