import { streamText, convertToCoreMessages, type CoreMessage } from 'ai'
import { NextRequest } from 'next/server'
import { getAIModel, systemPrompts } from '@/lib/ai/providers'
import { validateChatAuth, checkRateLimit, createAuthenticatedResponse } from '@/lib/ai/auth-middleware'
import { artifactTools } from '@/lib/ai/tools/artifact-tools'
import type { FileAttachment } from '@/types/attachments'
import { processAttachmentsForAI, addAttachmentsToMessage } from '@/lib/ai/multimodal'

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
    const { allowed, remaining } = checkRateLimit(userSession.userId)
    if (!allowed) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': process.env.AI_RATE_LIMIT_PER_USER_PER_HOUR || '100',
          'X-RateLimit-Remaining': '0',
          'Retry-After': '3600', // 1 hour in seconds
        }
      })
    }

    // Parse request body
    const { messages, model: requestedModel, systemPromptType = 'default', attachments = [] } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', { status: 400 })
    }

    // Get the appropriate system prompt
    const baseSystemPrompt = systemPrompts[systemPromptType as keyof typeof systemPrompts] || systemPrompts.default
    
    // Process attachments for the latest message if they exist
    const processedMessages = convertToCoreMessages(messages)
    let attachmentSystemPrompt = ''
    
    if (attachments && attachments.length > 0) {
      // Get the last user message (most recent)
      const lastMessageIndex = processedMessages.length - 1
      if (lastMessageIndex >= 0 && processedMessages[lastMessageIndex].role === 'user') {
        const lastMessage = processedMessages[lastMessageIndex]
        const { systemPrompt: attachmentContext } = processAttachmentsForAI(attachments, '')
        attachmentSystemPrompt = attachmentContext
        
        // Add attachments to the message
        processedMessages[lastMessageIndex] = addAttachmentsToMessage(lastMessage, attachments)
      }
    }
    
    // Add user context to system prompt
    const contextualSystemPrompt = `${baseSystemPrompt}

Current user context:
- User ID: ${userSession.userId}
- Wallet Address: ${userSession.walletAddress || 'Not connected'}
- Email: ${userSession.email || 'Not provided'}${attachmentSystemPrompt}`

    // Stream the response
    const result = streamText({
      model: getAIModel(requestedModel),
      system: contextualSystemPrompt,
      messages: processedMessages,
      // maxTokens: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST || '2000') as any,
      temperature: 0.7,
      tools: artifactTools,
      onFinish: async ({ usage, finishReason }) => {
        // Analytics would be implemented with a service like PostHog or Mixpanel
        // Usage data: usage.totalTokens, usage.promptTokens, usage.completionTokens
        // Finish reason: finishReason (stop, length, content-filter, tool-calls, error, other)
      },
    })

    // Convert to UI message stream response with rate limit headers
    const response = result.toUIMessageStreamResponse()
    return createAuthenticatedResponse(response, remaining)

  } catch (error) {
    console.error('Chat API error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return new Response('AI service not configured', { status: 503 })
      }
      if (error.message.includes('rate limit')) {
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
    process.env.NEXT_PUBLIC_APP_DOMAIN ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}` : null
  ].filter(Boolean)
  
  const isAllowedOrigin = allowedOrigins.includes(origin || '')
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}