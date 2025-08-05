import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';

// In production, use Redis or a database for token storage
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of csrfTokens.entries()) {
      if (value.expires < now) {
        csrfTokens.delete(key);
      }
    }
  },
  60 * 60 * 1000
); // Every hour

export function generateCSRFToken(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  csrfTokens.set(`${userId}:${token}`, { token, expires });

  return token;
}

export function validateCSRFToken(
  token: string | null,
  userId?: string
): boolean {
  if (!token) return false;

  // If userId is provided, check specific token
  if (userId) {
    const key = `${userId}:${token}`;
    const stored = csrfTokens.get(key);

    if (!stored || stored.expires < Date.now()) {
      csrfTokens.delete(key);
      return false;
    }

    // Token is valid, remove it (one-time use)
    csrfTokens.delete(key);
    return true;
  }

  // Check if token exists for any user (less secure, but needed when userId not available)
  for (const [key, value] of csrfTokens.entries()) {
    if (key.endsWith(`:${token}`) && value.expires > Date.now()) {
      csrfTokens.delete(key);
      return true;
    }
  }

  return false;
}

export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Check header first (preferred)
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) return headerToken;

  // Check body for form submissions
  // This would need to be parsed from the body in the actual handler
  return null;
}

// Helper to add CSRF token to response headers
export function addCSRFTokenToResponse(headers: Headers, token: string): void {
  headers.set('X-CSRF-Token', token);
}
