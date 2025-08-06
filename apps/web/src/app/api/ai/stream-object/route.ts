import { NoObjectGeneratedError } from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  createAuthenticatedResponse,
  validateChatAuth,
} from '@/lib/ai/core';
import {
  type SchemaType,
  schemaRegistry,
  streamStructuredArray,
  streamStructuredData,
} from '@/lib/ai/core';
import { config } from '@/lib/config';
import { extractClientInfo, logAPIError, logSecurityEvent } from '@/lib/logger';
import { chatService } from '@/services/chat.service';

// Request validation schema
const streamObjectRequestSchema = z.object({
  prompt: z.string().min(1).max(10_000),
  schema: z.string(), // Schema name from registry (for now, custom schemas not supported)
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  mode: z.enum(['object', 'json']).optional(),
  output: z.enum(['object', 'array', 'enum']).optional(),
  stream: z.boolean().default(true),
  arrayCount: z.number().min(1).max(20).optional(), // For array generation
});

// Allow up to 60 seconds for streaming
export const maxDuration = 60;

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
          'Retry-After': '3600',
        },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = streamObjectRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        userId: userSession.userId,
        metadata: {
          reason: 'Invalid request schema',
          errors: validationResult.error.issues,
        },
        ...extractClientInfo(req),
      });
      return new Response(
        `Invalid request: ${validationResult.error.issues[0]?.message}`,
        { status: 400 }
      );
    }

    const {
      prompt,
      schema,
      model,
      temperature,
      maxTokens,
      mode,
      output,
      arrayCount,
    } = validationResult.data;

    // Validate schema exists
    if (!(schema in schemaRegistry)) {
      return new Response(
        `Unknown schema: ${schema}. Available schemas: ${Object.keys(schemaRegistry).join(', ')}`,
        { status: 400 }
      );
    }

    // Check daily token limit
    const hasTokensRemaining = await chatService.checkDailyTokenLimit(
      userSession.userId
    );
    if (!hasTokensRemaining) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: userSession.userId,
        metadata: { reason: 'daily_token_limit' },
        ...extractClientInfo(req),
      });
      return new Response('Daily token limit exceeded', { status: 429 });
    }

    try {
      // TODO: Fix type mismatch between expected properties and actual return type
      let streamResult: unknown;

      // Handle array vs object streaming
      if (output === 'array' && arrayCount) {
        // Stream array generation
        streamResult = await streamStructuredArray({
          schema: schemaRegistry[schema as SchemaType] as z.ZodSchema<unknown>,
          prompt,
          count: arrayCount,
          model,
          temperature,
        });
      } else {
        // Stream object generation
        streamResult = await streamStructuredData({
          schema: schemaRegistry[schema as SchemaType] as z.ZodSchema<unknown>,
          prompt,
          model,
          temperature,
          mode,
          output,
        });
      }

      // Create streaming response
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Stream partial objects
            for await (const partialObject of (streamResult as any).partialObjectStream) {
              const chunk =
                JSON.stringify({
                  type: 'partial',
                  object: partialObject,
                }) + '\n';

              controller.enqueue(encoder.encode(chunk));
            }

            // Get final result
            const finalResult = await (streamResult as any).object;
            const usage = await (streamResult as any).usage;
            const finishReason = await (streamResult as any).finishReason;

            // Send final result
            const finalChunk =
              JSON.stringify({
                type: 'complete',
                object: finalResult,
                finishReason,
                usage,
              }) + '\n';

            controller.enqueue(encoder.encode(finalChunk));

            // Log successful streaming
            logSecurityEvent({
              type: 'AUTH_SUCCESS',
              userId: userSession.userId,
              metadata: {
                action: 'stream_object',
                schemaType: schema,
                model: model ?? 'default',
                promptLength: prompt.length,
                finishReason,
                tokenUsage: usage,
                outputType: output ?? 'object',
              },
              ...extractClientInfo(req),
            });

            controller.close();
          } catch (error) {
            if (error instanceof NoObjectGeneratedError) {
              const errorChunk =
                JSON.stringify({
                  type: 'error',
                  error:
                    'Failed to generate object: No valid object was generated',
                }) + '\n';
              controller.enqueue(encoder.encode(errorChunk));
            } else {
              const errorChunk =
                JSON.stringify({
                  type: 'error',
                  error: 'Stream generation failed',
                }) + '\n';
              controller.enqueue(encoder.encode(errorChunk));
            }
            controller.close();
          }
        },
      });

      // Return streaming response
      const response = new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-RateLimit-Remaining': remaining.toString(),
        },
      });

      return response;
    } catch (error) {
      if (error instanceof NoObjectGeneratedError) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          userId: userSession.userId,
          metadata: {
            reason: 'no_object_generated',
            prompt: prompt.substring(0, 200) + '...',
          },
          ...extractClientInfo(req),
        });
        return new Response(
          'Failed to generate object: No valid object was generated',
          { status: 422 }
        );
      }

      throw error; // Re-throw for general error handling
    }
  } catch (error) {
    const clientInfo = extractClientInfo(req);

    logAPIError('/api/ai/stream-object', error, {
      ...clientInfo,
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return new Response('AI service not configured', { status: 503 });
      }
      if (error.message.includes('rate limit')) {
        logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          metadata: { service: 'ai_provider' },
          ...clientInfo,
        });
        return new Response('AI service rate limit exceeded', { status: 429 });
      }
    }

    return new Response('Internal server error', { status: 500 });
  }
}

// Handle CORS for stream-object endpoint
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://symlog.app',
  ];

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
