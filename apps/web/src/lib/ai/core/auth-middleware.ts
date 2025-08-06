import { type NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { checkRateLimit as checkConvexRateLimit } from '@/lib/convex-rate-limit';
import { validateSessionFromRequest } from '@/lib/jwt-utils';
import { extractClientInfo, logSecurityEvent } from '@/lib/logger';

interface UserSession {
  userId: string;
  walletAddress?: string;
  email?: string;
}

export async function validateChatAuth(
  request: NextRequest
): Promise<UserSession | null> {
  const sessionPayload = await validateSessionFromRequest(request);

  if (!sessionPayload) {
    return null;
  }

  // Validate it's a Crossmint verified session
  if (sessionPayload.type !== 'crossmint_verified_session') {
    logSecurityEvent({
      type: 'TOKEN_VERIFICATION_FAILED',
      metadata: { reason: 'invalid_token_type' },
      ...extractClientInfo(request),
    });
    return null;
  }

  // Check token expiration (double-check even though jose already does this)
  const now = Math.floor(Date.now() / 1000);
  if (sessionPayload.exp && now > sessionPayload.exp) {
    logSecurityEvent({
      type: 'TOKEN_VERIFICATION_FAILED',
      metadata: { reason: 'token_expired' },
      ...extractClientInfo(request),
    });
    return null;
  }

  // Return user session data
  return {
    userId: sessionPayload.userId,
    walletAddress: sessionPayload.walletAddress,
    email: sessionPayload.email,
  };
}

// Use Convex-based rate limiting
export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const maxRequests = config.get().rateLimitMaxRequests;
  const result = await checkConvexRateLimit(userId, maxRequests);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
  };
}

export function createAuthenticatedResponse(
  response: Response,
  remaining: number
): Response {
  // Add rate limit headers
  response.headers.set(
    'X-RateLimit-Limit',
    config.get().rateLimitMaxRequests.toString()
  );
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  return response;
}
