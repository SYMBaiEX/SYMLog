import { NextRequest, NextResponse } from 'next/server'
import { enhancedArtifactTools, toolExecutionService, type EnhancedToolResult } from '@/lib/ai/tools/enhanced-tools'
import { z } from 'zod'

// Workflow execution request schema
const executeWorkflowRequestSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  steps: z.array(z.object({
    toolName: z.string().min(1, 'Tool name is required'),
    parameters: z.any().describe('Tool parameters'),
    dependsOn: z.array(z.string()).optional().describe('Step IDs this depends on'),
    id: z.string().min(1, 'Step ID is required'),
  })).min(1, 'At least one step is required').max(10, 'Maximum 10 steps allowed'),
  parallel: z.boolean().optional().default(false).describe('Execute independent steps in parallel'),
  options: z.object({
    timeout: z.number().min(1000).max(600000).optional(),
    retries: z.number().min(0).max(5).optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
})

// Workflow execution response type
interface WorkflowExecutionResponse {
  success: boolean
  result?: {
    workflowName: string
    totalSteps: number
    completedSteps: number
    results: any[]
    errors?: string[]
    executedAt: number
  }
  error?: string
  executionId?: string
}

/**
 * POST /api/ai/enhanced-tools/workflow - Execute a workflow of multiple tools
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const validation = executeWorkflowRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid workflow request: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        },
        { status: 400 }
      )
    }

    const { name, steps, parallel, options = {} } = validation.data

    // Validate that all referenced tools exist
    const invalidTools = steps
      .map(step => step.toolName)
      .filter(toolName => !(toolName in enhancedArtifactTools))

    if (invalidTools.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tools in workflow: ${invalidTools.join(', ')}. Available tools: ${Object.keys(enhancedArtifactTools).join(', ')}`
        },
        { status: 400 }
      )
    }

    // Validate step dependencies
    const stepIds = new Set(steps.map(s => s.id))
    const invalidDependencies = steps
      .filter(step => step.dependsOn?.some(dep => !stepIds.has(dep)))
      .map(step => step.id)

    if (invalidDependencies.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Steps with invalid dependencies: ${invalidDependencies.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Generate execution ID
    const executionId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`

    // Execute workflow using the executeWorkflow tool
    const result = await toolExecutionService.executeToolWithCancellation(
      'executeWorkflow',
      {
        name,
        steps,
        parallel,
      },
      {
        ...options,
        executionId,
      }
    )

    const response: WorkflowExecutionResponse = {
      success: result.success,
      result: result.success ? result.data : undefined,
      executionId,
    }

    if (!result.success) {
      response.error = result.error
    }

    return NextResponse.json(response, {
      status: result.success ? 200 : 500
    })
  } catch (error) {
    console.error('Workflow execution error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/enhanced-tools/workflow - Cancel workflow execution
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('executionId')

    if (!executionId) {
      return NextResponse.json(
        { success: false, error: 'Execution ID is required' },
        { status: 400 }
      )
    }

    const cancelled = toolExecutionService.cancelExecution(executionId)

    return NextResponse.json({
      success: true,
      cancelled,
      message: cancelled ? 'Workflow execution cancelled' : 'Workflow execution not found or already completed'
    })
  } catch (error) {
    console.error('Workflow cancellation error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/enhanced-tools/workflow - Get workflow templates and examples
 */
export async function GET(): Promise<NextResponse> {
  try {
    const workflowTemplates = [
      {
        name: 'Code Documentation Workflow',
        description: 'Generate code artifact and documentation',
        steps: [
          {
            id: 'create-code',
            toolName: 'createCodeArtifact',
            parameters: {
              title: 'Example Code',
              language: 'typescript',
              content: '// Generated code here',
              runnable: true,
            },
            dependsOn: [],
          },
          {
            id: 'create-docs',
            toolName: 'createDocumentArtifact',
            parameters: {
              title: 'Code Documentation',
              format: 'markdown',
              content: '# Documentation for the code artifact',
            },
            dependsOn: ['create-code'],
          },
        ],
        parallel: false,
      },
      {
        name: 'Data Visualization Workflow',
        description: 'Create chart and accompanying documentation',
        steps: [
          {
            id: 'create-chart',
            toolName: 'createChartArtifact',
            parameters: {
              title: 'Sample Chart',
              chartType: 'bar',
              data: {
                labels: ['A', 'B', 'C'],
                datasets: [{
                  label: 'Dataset 1',
                  data: [10, 20, 30],
                }],
              },
            },
            dependsOn: [],
          },
          {
            id: 'create-analysis',
            toolName: 'createDocumentArtifact',
            parameters: {
              title: 'Chart Analysis',
              format: 'markdown',
              content: '# Analysis of the chart data',
            },
            dependsOn: ['create-chart'],
          },
        ],
        parallel: false,
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        templates: workflowTemplates,
        maxSteps: 10,
        supportedParallelExecution: true,
      }
    })
  } catch (error) {
    console.error('Get workflow templates error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}