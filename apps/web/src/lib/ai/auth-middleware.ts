import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

interface UserSession {
  userId: string
  walletAddress?: string
  email?: string
}

export async function validateChatAuth(request: NextRequest): Promise<UserSession | null> {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    
    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error('JWT_SECRET not configured properly')
      return null
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)

    // Validate it's a Crossmint verified session
    if (payload.type !== 'crossmint_verified_session') {
      return null
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && now > Number(payload.exp)) {
      return null
    }

    // Return user session data
    return {
      userId: payload.userId as string,
      walletAddress: payload.walletAddress as string | undefined,
      email: payload.email as string | undefined,
    }
  } catch (error) {
    console.error('Auth validation error:', error)
    return null
  }
}

// Rate limiting tracker (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const hourInMs = 60 * 60 * 1000
  const maxRequests = parseInt(process.env.AI_RATE_LIMIT_PER_USER_PER_HOUR || '100')

  const userLimit = rateLimitMap.get(userId)
  
  // If no record or expired, create new
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + hourInMs,
    })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  // Check if limit exceeded
  if (userLimit.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  // Increment count
  userLimit.count++
  rateLimitMap.set(userId, userLimit)
  
  return { allowed: true, remaining: maxRequests - userLimit.count }
}

export function createAuthenticatedResponse(
  response: Response,
  remaining: number
): Response {
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', process.env.AI_RATE_LIMIT_PER_USER_PER_HOUR || '100')
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  return response
}