import type { NextRequest } from 'next/server';
import {
  checkRateLimit,
  createAuthenticatedResponse,
  validateChatAuth,
} from '@/lib/ai/auth-middleware';
import {
  collectResponseMetadata,
  getModelWithMetadata,
} from '@/lib/ai/providers';
import {
  createProgressStream,
  streamingProgressManager,
} from '@/lib/ai/streaming-progress';
import { toolAnalyticsService } from '@/lib/ai/tool-analytics';
import {
  enforceStructuredOutput,
  selectOptimalTool,
  toolChoiceEnforcer,
} from '@/lib/ai/tool-choice';
import {
  errorRecoveryService,
  v2ErrorHandler,
} from '@/lib/ai/v2-error-handling';
import { config } from '@/lib/config';
import { tokenReservationService } from '@/lib/convex-token-limits';
import { extractClientInfo, logAPIError, logSecurityEvent } from '@/lib/logger';
import { chatService } from '@/services/chat.service';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Validate authentication
    const userSession = await validateChatAuth(req);
    if (!userSession) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check rate limiting
    const { allowed, remaining } = await checkRateLimit(userSession.userId);
    if (!allowed) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.get().rateLimitMaxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '3600', // 1 hour in seconds
        },
      });
    }

    // Parse request body
    const {
      messages,
      model: requestedModel,
      systemPromptType = 'default',
      attachments = [],
      toolChoice,
      requireTools = false,
      streamProgress = false,
    } = await req.json();

    // Validate request
    const validation = chatService.validateRequest({
      messages,
      model: requestedModel,
      systemPromptType,
      attachments,
    });
    if (!validation.valid) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        userId: userSession.userId,
        metadata: { reason: validation.error },
        ...extractClientInfo(req),
      });
      return new Response(validation.error, { status: 400 });
    }

    // Enhanced tool choice logic
    let enhancedToolChoice = toolChoice;
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Determine if we should enforce tool usage
    if (requireTools || shouldEnforceTools(lastMessage)) {
      const outputType = inferOutputType(lastMessage);
      enhancedToolChoice = enforceStructuredOutput(
        outputType as any,
        'moderate'
      );

      logSecurityEvent({
        type: 'TOOL_CHOICE_ENFORCED',
        userId: userSession.userId,
        metadata: {
          outputType,
          toolChoice: enhancedToolChoice,
          userMessage: lastMessage.substring(0, 100), // First 100 chars for context
        },
        ...extractClientInfo(req),
      });
    } else if (!toolChoice) {
      // Smart tool recommendation
      const recommendedTool = selectOptimalTool(lastMessage);
      if (recommendedTool && shouldSuggestTool(lastMessage)) {
        enhancedToolChoice = { type: 'tool', toolName: recommendedTool };
      }
    }

    // Reserve tokens atomically to prevent concurrent bypass
    const reservation = await tokenReservationService.reserveTokens(
      userSession.userId,
      messages,
      attachments
    );

    if (!reservation.success) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: userSession.userId,
        metadata: {
          reason: 'daily_token_limit',
          currentUsage: reservation.currentUsage,
          limit: reservation.limit,
          remaining: reservation.remaining,
        },
        ...extractClientInfo(req),
      });
      return new Response(reservation.error || 'Daily token limit exceeded', {
        status: 429,
        headers: {
          'X-Token-Limit': reservation.limit.toString(),
          'X-Token-Usage': reservation.currentUsage.toString(),
          'X-Token-Remaining': reservation.remaining.toString(),
        },
      });
    }

    // Create execution tracking if analytics are enabled
    const executionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const tracker = toolAnalyticsService.trackExecution(
      'chatCompletion',
      executionId,
      {
        userId: userSession.userId,
        sessionId: req.headers.get('x-session-id') || undefined,
      },
      {
        model: requestedModel,
        messageCount: messages.length,
        systemPromptType,
        toolChoice: enhancedToolChoice,
        streamProgress,
      }
    );

    // Process chat through service with enhanced options and V2 error handling
    let result;
    try {
      // Add request metadata for V2 specification
      const requestMetadata = {
        userId: userSession.userId,
        sessionId: req.headers.get('x-session-id') || undefined,
        requestId: executionId,
        source: 'chat-api',
        features: {
          toolChoice: !!enhancedToolChoice,
          streaming: true,
          progressTracking: streamProgress,
        },
      };

      result = await errorRecoveryService.executeWithRecovery(
        async () => {
          return await chatService.processChat(
            {
              messages,
              model: requestedModel,
              systemPromptType,
              attachments,
              toolChoice: enhancedToolChoice,
              streamProgress,
              metadata: requestMetadata,
            },
            userSession,
            extractClientInfo(req),
            reservation.reservationId, // Pass reservation ID to chat service
            tracker // Pass analytics tracker
          );
        },
        {
          maxRetries: 2,
          retryDelay: 1000,
          fallbacks: [
            // Fallback 1: Try without tools
            async () => {
              logSecurityEvent({
                type: 'FALLBACK_NO_TOOLS',
                userId: userSession.userId,
                metadata: {
                  reason: 'Primary request failed, attempting without tools',
                },
                ...extractClientInfo(req),
              });
              return await chatService.processChat(
                {
                  messages,
                  model: requestedModel,
                  systemPromptType,
                  attachments,
                  toolChoice: { type: 'none' },
                  streamProgress,
                  metadata: requestMetadata,
                },
                userSession,
                extractClientInfo(req),
                reservation.reservationId,
                tracker
              );
            },
            // Fallback 2: Try with simpler model
            async () => {
              logSecurityEvent({
                type: 'FALLBACK_SIMPLE_MODEL',
                userId: userSession.userId,
                metadata: { reason: 'Falling back to simpler model' },
                ...extractClientInfo(req),
              });
              return await chatService.processChat(
                {
                  messages,
                  model: 'gpt-4o-mini', // Fallback to faster model
                  systemPromptType,
                  attachments,
                  toolChoice: enhancedToolChoice,
                  streamProgress: false,
                  metadata: requestMetadata,
                },
                userSession,
                extractClientInfo(req),
                reservation.reservationId,
                tracker
              );
            },
          ],
          onError: (error, attempt) => {
            logSecurityEvent({
              type: 'CHAT_ERROR_RETRY',
              userId: userSession.userId,
              metadata: {
                attempt,
                errorCode: error.code,
                errorMessage: error.message,
              },
              ...extractClientInfo(req),
            });
          },
        }
      );

      // Complete tracking with response metadata
      const responseMetadata = collectResponseMetadata(result);
      tracker.complete({
        success: true,
        data: result,
        executionTime: 0, // Will be calculated by tracker
        metadata: responseMetadata,
      });

      // Convert to UI message stream response with rate limit headers
      const response = result.toUIMessageStreamResponse();
      return createAuthenticatedResponse(response, remaining);
    } catch (error) {
      // Cancel reservation if chat processing fails
      if (reservation.reservationId) {
        await tokenReservationService.cancelReservation(
          reservation.reservationId
        );
      }

      // Track error with V2 error handler
      const handledError = v2ErrorHandler.handleError(error);
      tracker.error(new Error(handledError.message));

      // Log the handled error
      v2ErrorHandler.logError(handledError, {
        userId: userSession.userId,
        executionId,
        model: requestedModel,
      });

      throw error;
    }
  } catch (error) {
    const clientInfo = extractClientInfo(req);

    logAPIError('/api/chat', error, {
      ...clientInfo,
    });

    // Handle errors with V2 error handler
    const handledError = v2ErrorHandler.handleError(error);

    // Log security events for specific error types
    if (
      handledError.code === 'RATE_LIMIT' ||
      handledError.code === 'MODEL_OVERLOADED'
    ) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        metadata: {
          service: 'ai_provider',
          errorCode: handledError.code,
          details: handledError.details,
        },
        ...clientInfo,
      });
    }

    // Return appropriate error response based on error type
    const statusCode = (() => {
      switch (handledError.code) {
        case 'RATE_LIMIT':
        case 'TOO_MANY_EMBEDDINGS':
        case 'MAX_RETRIES_EXCEEDED':
          return 429;
        case 'AUTH_ERROR':
        case 'API_KEY_ERROR':
          return 401;
        case 'INVALID_ARGUMENT':
        case 'TYPE_VALIDATION_ERROR':
        case 'INVALID_TOOL_ARGUMENTS':
          return 400;
        case 'NO_SUCH_MODEL':
        case 'NO_SUCH_PROVIDER':
        case 'NO_SUCH_TOOL':
        case 'UNSUPPORTED_FUNCTIONALITY':
          return 404;
        case 'SERVER_ERROR':
        case 'MODEL_OVERLOADED':
          return 503;
        default:
          return 500;
      }
    })();

    return new Response(handledError.userMessage || 'Internal server error', {
      status: statusCode,
      headers: {
        'X-Error-Code': handledError.code || 'UNKNOWN',
        'X-Error-Retry': handledError.retry ? 'true' : 'false',
      },
    });
  }
}

// Handle CORS for chat endpoint
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://symlog.app',
  ];

  // Add app URL to allowed origins
  try {
    const appUrl = new URL(config.get().nextPublicAppUrl);
    allowedOrigins.push(appUrl.origin);
  } catch (e) {
    // Invalid URL, skip
  }

  const isAllowedOrigin = allowedOrigins.includes(origin ?? '');

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin ?? '') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

// Helper functions for tool choice logic

/**
 * Determine if we should enforce tool usage based on message content
 */
function shouldEnforceTools(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Keywords that suggest structured output is needed
  const structuredKeywords = [
    'create',
    'generate',
    'build',
    'make',
    'write',
    'chart',
    'graph',
    'table',
    'code',
    'function',
    'document',
    'report',
    'format',
    'visualize',
  ];

  // Check if message contains multiple structured keywords
  const keywordCount = structuredKeywords.filter((keyword) =>
    lowerMessage.includes(keyword)
  ).length;

  return (
    keywordCount >= 2 ||
    lowerMessage.includes('artifact') ||
    lowerMessage.includes('interactive') ||
    (lowerMessage.includes('create') && lowerMessage.length > 50)
  ); // Long create requests
}

/**
 * Determine if we should suggest a tool based on message content
 */
function shouldSuggestTool(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Suggest tools for specific content types
  return (
    lowerMessage.includes('show me') ||
    lowerMessage.includes('can you') ||
    lowerMessage.includes('help me') ||
    lowerMessage.includes('example') ||
    lowerMessage.includes('demo')
  );
}

/**
 * Infer output type from user message
 */
function inferOutputType(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('code') ||
    lowerMessage.includes('function') ||
    lowerMessage.includes('script') ||
    lowerMessage.includes('program')
  ) {
    return 'code';
  }

  if (
    lowerMessage.includes('chart') ||
    lowerMessage.includes('graph') ||
    lowerMessage.includes('visualize') ||
    lowerMessage.includes('plot')
  ) {
    return 'chart';
  }

  if (
    lowerMessage.includes('document') ||
    lowerMessage.includes('write') ||
    lowerMessage.includes('article') ||
    lowerMessage.includes('report')
  ) {
    return 'document';
  }

  if (
    lowerMessage.includes('data') ||
    lowerMessage.includes('json') ||
    lowerMessage.includes('csv') ||
    lowerMessage.includes('table')
  ) {
    return 'data';
  }

  if (
    lowerMessage.includes('image') ||
    lowerMessage.includes('diagram') ||
    lowerMessage.includes('picture')
  ) {
    return 'image';
  }

  return 'document'; // Default fallback
}
