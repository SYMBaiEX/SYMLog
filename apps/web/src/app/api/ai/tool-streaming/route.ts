import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, validateChatAuth } from '@/lib/ai/core';
import {
  executeToolWithStreaming,
  toolStreamingManager,
} from '@/lib/ai/streaming';
// Error handling imports removed - not available
import { config } from '@/lib/config';
import { tokenReservationService } from '@/lib/convex-token-limits';
import { extractClientInfo, logAPIError, logSecurityEvent } from '@/lib/logger';
import type {
  MultiStepToolContext,
  ToolStreamingOptions,
  ToolStreamingSSEMessage,
} from '@/types/tool-streaming';

// Allow streaming responses up to 60 seconds for complex tool executions
export const maxDuration = 60;

// Request validation schema
const toolStreamingRequestSchema = z.object({
  toolName: z.string().min(1).max(100),
  input: z.unknown(),
  options: z
    .object({
      enableInputStreaming: z.boolean().optional(),
      enableProgressStreaming: z.boolean().optional(),
      enableOutputStreaming: z.boolean().optional(),
      inputChunkSize: z.number().min(64).max(8192).optional(),
      outputChunkSize: z.number().min(64).max(8192).optional(),
      progressUpdateInterval: z.number().min(100).max(5000).optional(),
      maxRetries: z.number().min(0).max(5).optional(),
      timeout: z.number().min(1000).max(120_000).optional(),
      cacheStrategy: z.enum(['none', 'input', 'output', 'both']).optional(),
      compressionEnabled: z.boolean().optional(),
      validationLevel: z.enum(['none', 'basic', 'strict']).optional(),
    })
    .optional(),
  context: z
    .object({
      workflowId: z.string().optional(),
      stepIndex: z.number().optional(),
      totalSteps: z.number().optional(),
      previousResults: z.array(z.unknown()).optional(),
      dependencies: z.array(z.string()).optional(),
      parallelExecution: z.boolean().optional(),
    })
    .optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

type ToolStreamingRequest = z.infer<typeof toolStreamingRequestSchema>;

export async function POST(req: NextRequest) {
  try {
    // Validate authentication
    const userSession = await validateChatAuth(req);
    if (!userSession) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Check rate limiting with enhanced limits for tool streaming
    const { allowed, remaining } = await checkRateLimit(userSession.userId);

    if (!allowed) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: userSession.userId,
        metadata: { endpoint: '/api/ai/tool-streaming' },
        ...extractClientInfo(req),
      });

      return createErrorResponse('Rate limit exceeded', 429, {
        'X-RateLimit-Limit': (config.get().rateLimitMaxRequests * 2).toString(),
        'X-RateLimit-Remaining': '0',
        'Retry-After': '3600',
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = toolStreamingRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        userId: userSession.userId,
        metadata: {
          endpoint: '/api/ai/tool-streaming',
          errors: validationResult.error.issues,
        },
        ...extractClientInfo(req),
      });

      return createErrorResponse(
        `Invalid request: ${validationResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const {
      toolName,
      input,
      options = {},
      context,
      userId,
      sessionId,
    } = validationResult.data;

    // Validate tool exists and is accessible
    const availableTools = [
      'createCodeArtifact',
      'createDocumentArtifact',
      'createChartArtifact',
      'createSpreadsheetArtifact',
      'createImageArtifact',
      'createDataArtifact',
      'executeWorkflow',
      'generateStructuredOutput',
      'createArtifactWithRepair',
    ];

    if (!availableTools.includes(toolName)) {
      logSecurityEvent({
        type: 'UNAUTHORIZED_TOOL_ACCESS',
        userId: userSession.userId,
        metadata: { toolName, availableTools },
        ...extractClientInfo(req),
      });

      return createErrorResponse(
        `Tool '${toolName}' not found or not accessible`,
        404
      );
    }

    // Reserve tokens for tool execution
    const estimatedTokenUsage = estimateToolTokenUsage(toolName, input);
    const reservation = await tokenReservationService.reserveTokens(
      userSession.userId,
      [], // No messages for tool streaming
      [] // No attachments
    );

    if (!reservation.success) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: userSession.userId,
        metadata: {
          reason: 'daily_token_limit',
          currentUsage: reservation.currentUsage,
          requestedTokens: estimatedTokenUsage,
        },
        ...extractClientInfo(req),
      });

      return createErrorResponse('Daily token limit exceeded', 429, {
        'X-Token-Limit': reservation.limit?.toString() || '0',
        'X-Token-Used': reservation.currentUsage?.toString() || '0',
        'Retry-After': '86400', // 24 hours
      });
    }

    // Enhanced streaming options with security constraints
    const streamingOptions: ToolStreamingOptions = {
      enableInputStreaming: options.enableInputStreaming ?? true,
      enableProgressStreaming: options.enableProgressStreaming ?? true,
      enableOutputStreaming: options.enableOutputStreaming ?? true,
      inputChunkSize: Math.min(options.inputChunkSize || 1024, 4096), // Cap at 4KB
      outputChunkSize: Math.min(options.outputChunkSize || 2048, 8192), // Cap at 8KB
      progressUpdateInterval: Math.max(
        options.progressUpdateInterval || 500,
        100
      ), // Min 100ms
      maxRetries: Math.min(options.maxRetries || 3, 3), // Cap at 3 retries
      timeout: Math.min(options.timeout || 60_000, 120_000), // Cap at 2 minutes
      cacheStrategy: options.cacheStrategy || 'both',
      compressionEnabled: options.compressionEnabled ?? true,
      validationLevel: options.validationLevel || 'basic',
    };

    // Multi-step context if provided
    const multiStepContext: MultiStepToolContext | undefined = context
      ? {
          workflowId: context.workflowId || `workflow_${Date.now()}`,
          stepIndex: context.stepIndex || 0,
          totalSteps: context.totalSteps || 1,
          previousResults: context.previousResults || [],
          dependencies: context.dependencies || [],
          parallelExecution: context.parallelExecution ?? false,
        }
      : undefined;

    // Log tool execution start
    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      userId: userSession.userId,
      metadata: {
        toolName,
        inputSize: JSON.stringify(input).length,
        hasContext: !!multiStepContext,
        options: streamingOptions,
      },
      ...extractClientInfo(req),
    });

    // Execute tool with streaming
    const { executionId, stream } = await executeToolWithStreaming(
      toolName,
      input,
      streamingOptions
    );

    // Create Server-Sent Events response
    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Send initial connection established event
        sendSSEMessage(controller, {
          id: `init_${Date.now()}`,
          event: 'input-start',
          data: {
            toolName,
            executionId,
            timestamp: Date.now(),
            payload: {
              executionId,
              toolName,
              userId: userSession.userId,
              options: streamingOptions,
            },
          },
        });

        // Process the tool streaming messages
        const reader = stream.getReader();

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                // Send final close event
                sendSSEMessage(controller, {
                  id: `close_${Date.now()}`,
                  event: 'end',
                  data: {
                    toolName,
                    executionId,
                    timestamp: Date.now(),
                    payload: { reason: 'completed' },
                  },
                });
                break;
              }

              // Forward the streaming message as SSE
              sendSSEMessage(controller, value);
            }
          } catch (error) {
            // Handle streaming errors
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'Unknown streaming error';

            logAPIError('Tool streaming error', {
              toolName,
              executionId,
              userId: userSession.userId,
              error: errorMessage,
            });

            sendSSEMessage(controller, {
              id: `error_${Date.now()}`,
              event: 'error',
              data: {
                toolName,
                executionId,
                timestamp: Date.now(),
                payload: {
                  type: 'stream-error',
                  message: errorMessage,
                  retryable: true,
                },
              },
            });
          } finally {
            reader.releaseLock();
            controller.close();

            // Log completion
            logSecurityEvent({
              type: 'AUTH_SUCCESS',
              userId: userSession.userId,
              metadata: { toolName, executionId },
              ...extractClientInfo(req),
            });
          }
        };

        processStream();
      },

      cancel() {
        // Handle client disconnect
        toolStreamingManager.cancelToolExecution(
          executionId,
          'Client disconnected'
        );

        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          userId: userSession.userId,
          metadata: { toolName, executionId, reason: 'client_disconnect' },
          ...extractClientInfo(req),
        });
      },
    });

    // Return Server-Sent Events response
    return new Response(sseStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Execution-ID': executionId,
        'X-Tool-Name': toolName,
        'X-RateLimit-Remaining': remaining.toString(),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logAPIError('Tool streaming API error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      url: req.url,
    });

    // Return error response
    return createErrorResponse('Internal server error', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Helper function to send SSE messages
function sendSSEMessage(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: ToolStreamingSSEMessage
): void {
  try {
    const sseData = formatSSEMessage(message);
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(sseData));
  } catch (error) {
    console.error('Failed to send SSE message:', error);
  }
}

// Format message as Server-Sent Events
function formatSSEMessage(message: ToolStreamingSSEMessage): string {
  let sseMessage = '';

  if (message.id) {
    sseMessage += `id: ${message.id}\n`;
  }

  if (message.event) {
    sseMessage += `event: ${message.event}\n`;
  }

  if (message.retry) {
    sseMessage += `retry: ${message.retry}\n`;
  }

  // Format data as JSON
  const dataString = JSON.stringify(message.data);

  // Split long data across multiple data lines if needed
  const dataLines = dataString.match(/.{1,1000}/g) || [dataString];
  for (const line of dataLines) {
    sseMessage += `data: ${line}\n`;
  }

  sseMessage += '\n'; // Empty line terminates the message

  return sseMessage;
}

// Estimate token usage for different tools
function estimateToolTokenUsage(toolName: string, input: unknown): number {
  const inputSize = JSON.stringify(input).length;
  const baseTokens = Math.ceil(inputSize / 4); // ~4 chars per token

  // Tool-specific multipliers based on complexity
  const toolMultipliers: Record<string, number> = {
    createCodeArtifact: 3.0, // Code generation is token-intensive
    createDocumentArtifact: 2.0,
    createChartArtifact: 1.5,
    createSpreadsheetArtifact: 1.5,
    createImageArtifact: 1.0,
    createDataArtifact: 1.0,
    executeWorkflow: 4.0, // Multi-step can be very expensive
    generateStructuredOutput: 2.5,
    createArtifactWithRepair: 3.5, // Includes retry logic
  };

  const multiplier = toolMultipliers[toolName] || 2.0;
  return Math.ceil(baseTokens * multiplier);
}

// Create standardized error response
function createErrorResponse(
  message: string,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...headers,
      },
    }
  );
}
