import { NoObjectGeneratedError } from 'ai';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  createAuthenticatedResponse,
  validateChatAuth,
} from '@/lib/ai/core';
import {
  generateBySchemaName,
  generateStructuredData,
  type OutputStrategy,
  type SchemaType,
  type StructuredResult,
  schemaRegistry,
  validateStructuredData,
} from '@/lib/ai/core';
import { config } from '@/lib/config';
import { extractClientInfo, logAPIError, logSecurityEvent } from '@/lib/logger';
import { chatService } from '@/services/chat.service';

// Constants to replace magic numbers
const MAX_PROMPT_LENGTH = 10_000;
const MIN_PROMPT_LENGTH = 1;
const MAX_TOKENS_LIMIT = 8192;
const MIN_TOKENS_LIMIT = 1;
const MAX_TEMPERATURE = 2;
const MIN_TEMPERATURE = 0;
const RATE_LIMIT_RESET_TIME = 3600; // 1 hour in seconds
const MAX_LOGGED_PROMPT_LENGTH = 200;

// Request validation schema - restrict to string schemas only for security
const generateObjectRequestSchema = z.object({
  prompt: z.string().min(MIN_PROMPT_LENGTH).max(MAX_PROMPT_LENGTH),
  schema: z.string(), // Only schema names from registry for security
  model: z.string().optional(),
  temperature: z.number().min(MIN_TEMPERATURE).max(MAX_TEMPERATURE).optional(),
  maxTokens: z.number().min(MIN_TOKENS_LIMIT).max(MAX_TOKENS_LIMIT).optional(),
  responseFormat: z.enum(['object', 'json']).optional(), // Renamed from 'mode' for clarity
  outputType: z.enum(['object', 'array', 'enum']).optional(), // Renamed from 'output' and removed 'no-schema'
});

// Allow up to 30 seconds for object generation
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
          'Retry-After': RATE_LIMIT_RESET_TIME.toString(),
        },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = generateObjectRequestSchema.safeParse(body);

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

      // Safely handle error message with fallback
      const errorMessage =
        validationResult.error.issues.length > 0
          ? `Invalid request: ${validationResult.error.issues[0].message}`
          : 'Invalid request format';

      return new Response(errorMessage, { status: 400 });
    }

    const {
      prompt,
      schema,
      model,
      temperature,
      maxTokens,
      responseFormat,
      outputType,
    } = validationResult.data;

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
      // Validate schema exists in registry
      if (!(schema in schemaRegistry)) {
        return new Response(
          `Unknown schema: ${schema}. Available schemas: ${Object.keys(schemaRegistry).join(', ')}`,
          { status: 400 }
        );
      }

      // Add request timeout to prevent indefinite waiting
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 25_000); // 25 seconds, less than maxDuration
      });

      const generationPromise = generateBySchemaName(
        schema as SchemaType,
        prompt,
        {
          model,
          temperature,
          output: outputType,
        }
      );

      const result = (await Promise.race([
        generationPromise,
        timeoutPromise,
      ])) as StructuredResult<unknown>;

      // Log successful generation
      logSecurityEvent({
        type: 'AUTH_SUCCESS',
        userId: userSession.userId,
        metadata: {
          action: 'generate_object',
          schemaType: schema,
          model: model ?? 'default',
          promptLength: prompt.length,
          finishReason: result.finishReason,
          tokenUsage: result.usage,
        },
        ...extractClientInfo(req),
      });

      // Return successful response
      const response = new Response(
        JSON.stringify({
          success: true,
          object: result.object,
          finishReason: result.finishReason,
          usage: result.usage,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return createAuthenticatedResponse(response, remaining);
    } catch (error) {
      if (error instanceof NoObjectGeneratedError) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          userId: userSession.userId,
          metadata: {
            reason: 'no_object_generated',
            prompt:
              prompt.substring(0, MAX_LOGGED_PROMPT_LENGTH) +
              (prompt.length > MAX_LOGGED_PROMPT_LENGTH ? '...' : ''),
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

    logAPIError('/api/ai/generate-object', error, {
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

// Handle CORS for generate-object endpoint
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
