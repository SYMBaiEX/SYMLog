import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { config } from './config';
import { extractClientInfo, logSecurityEvent } from './logger';

export interface SessionPayload extends JWTPayload {
  userId: string;
  walletAddress?: string;
  email?: string;
  type?: string;
}

/**
 * Get the JWT secret with validation
 */
export function getJWTSecret(): Uint8Array {
  const jwtSecret = config.getJWTSecret();
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET not configured properly');
  }
  return new TextEncoder().encode(jwtSecret);
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyJWT(
  token: string,
  request?: NextRequest
): Promise<SessionPayload | null> {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch (error) {
    if (request) {
      logSecurityEvent({
        type: 'TOKEN_VERIFICATION_FAILED',
        metadata: {
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        ...extractClientInfo(request),
      });
    }
    return null;
  }
}

/**
 * Create a new session JWT
 */
export async function createSessionJWT(payload: {
  userId: string;
  walletAddress?: string | null;
  email?: string | null;
  type?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const secret = getJWTSecret();

  return new SignJWT({
    userId: payload.userId,
    walletAddress: payload.walletAddress || undefined,
    email: payload.email || undefined,
    type: payload.type || 'session',
    ...payload.metadata,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setSubject(payload.userId)
    .setAudience('symlog-app')
    .setIssuer('symlog-auth')
    .sign(secret);
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!(authHeader && authHeader.startsWith('Bearer '))) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

/**
 * Validate session token from request
 */
export async function validateSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    logSecurityEvent({
      type: 'AUTH_FAILURE',
      metadata: { reason: 'missing_token' },
      ...extractClientInfo(request),
    });
    return null;
  }

  return verifyJWT(token, request);
}
