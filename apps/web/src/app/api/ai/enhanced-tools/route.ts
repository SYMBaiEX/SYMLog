import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  type EnhancedToolResult,
  enhancedArtifactTools,
  toolExecutionService,
} from '@/lib/ai/tools';
import { logAPIError } from '@/lib/logger';
import { generateSecureId } from '@/lib/utils/id-generator';

// API request schema for tool execution
const executeToolRequestSchema = z.object({
  toolName: z.string().min(1, 'Tool name is required'),
  parameters: z.unknown().describe('Tool parameters'),
  options: z
    .object({
      executionId: z.string().optional(),
      timeout: z.number().min(1000).max(600_000).optional(),
      retries: z.number().min(0).max(5).optional(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
});

const executeWorkflowRequestSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  steps: z
    .array(
      z.object({
        toolName: z.string(),
        parameters: z.unknown(),
        dependsOn: z.array(z.string()).optional(),
        id: z.string(),
      })
    )
    .min(1)
    .max(10),
  parallel: z.boolean().optional().default(false),
  options: z
    .object({
      timeout: z.number().min(1000).max(600_000).optional(),
      retries: z.number().min(0).max(5).optional(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
});

// API response types
interface ToolExecutionResponse {
  success: boolean;
  result?: EnhancedToolResult;
  error?: string;
  executionId?: string;
}

interface WorkflowExecutionResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  executionId?: string;
}

/**
 * POST /api/ai/enhanced-tools - Execute a single enhanced tool
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let toolName: string | undefined;

  try {
    const body = await request.json();
    const validation = executeToolRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request: ${validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        },
        { status: 400 }
      );
    }

    const { toolName: tool, parameters, options = {} } = validation.data;
    toolName = tool;

    // Check if tool exists
    if (!(toolName in enhancedArtifactTools)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tool '${toolName}' not found. Available tools: ${Object.keys(enhancedArtifactTools).join(', ')}`,
        },
        { status: 404 }
      );
    }

    // Generate execution ID if not provided
    const executionId = options.executionId || generateSecureId('exec');

    // Execute tool with enhanced error handling
    const result = await toolExecutionService.executeToolWithCancellation(
      toolName,
      parameters,
      {
        ...options,
        executionId,
      }
    );

    const response: ToolExecutionResponse = {
      success: result.success,
      result,
      executionId,
    };

    if (!result.success) {
      response.error = result.error;
    }

    return NextResponse.json(response, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    logAPIError('/api/ai/enhanced-tools', error, { method: 'POST', toolName });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/enhanced-tools - Cancel tool execution
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let executionId: string | null = null;

  try {
    const { searchParams } = new URL(request.url);
    executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        { success: false, error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    const cancelled = toolExecutionService.cancelExecution(executionId);

    return NextResponse.json({
      success: true,
      cancelled,
      message: cancelled
        ? 'Execution cancelled'
        : 'Execution not found or already completed',
    });
  } catch (error) {
    logAPIError('/api/ai/enhanced-tools', error, {
      method: 'DELETE',
      executionId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/enhanced-tools - Get tool information and active executions
 */
export async function GET(): Promise<NextResponse> {
  try {
    const availableTools = Object.keys(enhancedArtifactTools).map(
      (toolName) => {
        const tool =
          enhancedArtifactTools[toolName as keyof typeof enhancedArtifactTools];
        return {
          name: toolName,
          description: tool.description,
          // Note: In a real implementation, you'd extract parameter schema from the tool
          parametersSchema: `Schema for ${toolName}`,
        };
      }
    );

    const activeExecutions = toolExecutionService.getActiveExecutions();

    return NextResponse.json({
      success: true,
      data: {
        availableTools,
        activeExecutions,
        totalActiveExecutions: activeExecutions.length,
      },
    });
  } catch (error) {
    logAPIError('/api/ai/enhanced-tools', error, { method: 'GET' });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
