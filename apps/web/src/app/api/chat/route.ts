import { NextRequest } from 'next/server'
import { validateChatAuth, checkRateLimit, createAuthenticatedResponse } from '@/lib/ai/auth-middleware'
import { logSecurityEvent, logAPIError, extractClientInfo } from '@/lib/logger'
import { chatService } from '@/services/chat.service'
import { config } from '@/lib/config'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    // Validate authentication
    const userSession = await validateChatAuth(req)
    if (!userSession) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Check rate limiting
    const { allowed, remaining } = await checkRateLimit(userSession.userId)
    if (!allowed) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.get().rateLimitMaxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '3600', // 1 hour in seconds
        }
      })
    }

    // Parse request body
    const { messages, model: requestedModel, systemPromptType = 'default', attachments = [] } = await req.json()

    // Validate request
    const validation = chatService.validateRequest({ messages, model: requestedModel, systemPromptType, attachments })
    if (!validation.valid) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        userId: userSession.userId,
        metadata: { reason: validation.error },
        ...extractClientInfo(req)
      })
      return new Response(validation.error, { status: 400 })
    }

    // Check daily token limit
    const hasTokensRemaining = await chatService.checkDailyTokenLimit(userSession.userId)
    if (!hasTokensRemaining) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: userSession.userId,
        metadata: { reason: 'daily_token_limit' },
        ...extractClientInfo(req)
      })
      return new Response('Daily token limit exceeded', { status: 429 })
    }

    // Process chat through service
    const result = await chatService.processChat(
      { messages, model: requestedModel, systemPromptType, attachments },
      userSession,
      extractClientInfo(req)
    )

    // Convert to UI message stream response with rate limit headers
    const response = result.toUIMessageStreamResponse()
    return createAuthenticatedResponse(response, remaining)

  } catch (error) {
    const clientInfo = extractClientInfo(req)
    
    logAPIError('/api/chat', error, {
      ...clientInfo
    })
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return new Response('AI service not configured', { status: 503 })
      }
      if (error.message.includes('rate limit')) {
        logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          metadata: { service: 'ai_provider' },
          ...clientInfo
        })
        return new Response('AI service rate limit exceeded', { status: 429 })
      }
    }
    
    return new Response('Internal server error', { status: 500 })
  }
}

// Handle CORS for chat endpoint
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://symlog.app',
  ]
  
  // Add app URL to allowed origins
  try {
    const appUrl = new URL(config.get().nextPublicAppUrl)
    allowedOrigins.push(appUrl.origin)
  } catch (e) {
    // Invalid URL, skip
  }
  
  const isAllowedOrigin = allowedOrigins.includes(origin ?? '')
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin ?? '') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}