import { randomBytes } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getConvexClient } from '@/lib/convex-client';
import { validateCSRFToken } from '@/lib/convex-csrf';
import { extractClientInfo, logSecurityEvent } from '@/lib/logger';
import { sanitizeErrorParam } from '@/lib/security/sanitize';
import { api } from '../../../../../convex/_generated/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const clientInfo = extractClientInfo(request);

  // Handle authentication errors with validation
  if (error) {
    const sanitizedError = sanitizeErrorParam(error);

    logSecurityEvent({
      type: 'AUTH_FAILURE',
      metadata: {
        error: sanitizedError,
        originalError: error !== sanitizedError ? 'modified' : 'valid',
      },
      ...clientInfo,
    });

    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(sanitizedError)}`, request.url)
    );
  }

  // Handle successful authentication with code
  if (code) {
    try {
      // Store auth code securely in Convex instead of exposing in URL
      const sessionId = randomBytes(32).toString('hex');

      // For now, we'll use a placeholder user info until we can extract from the auth code
      const convex = getConvexClient();
      await convex.mutation(api.authSessions.storeAuthCode, {
        authCode: sessionId,
        userId: 'pending_auth_' + Date.now(),
        userEmail: 'pending@auth.com',
        walletAddress: 'pending',
      });

      // Auth code is already stored in Convex above

      logSecurityEvent({
        type: 'AUTH_SUCCESS',
        metadata: { sessionId },
        ...clientInfo,
      });

      // Redirect with session ID instead of auth code
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('session', sessionId);

      return NextResponse.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Failed to store auth code:', error);
      return NextResponse.redirect(
        new URL('/?error=auth_storage_failed', request.url)
      );
    }
  }

  // No code or error, redirect to home
  return NextResponse.redirect(new URL('/', request.url));
}

export async function POST(request: NextRequest) {
  try {
    const clientInfo = extractClientInfo(request);

    // Validate CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    const userId = request.headers.get('x-user-id') || 'anonymous';

    if (!csrfToken) {
      logSecurityEvent({
        type: 'CSRF_VALIDATION_FAILED',
        metadata: { reason: 'missing_token' },
        ...clientInfo,
      });
      return NextResponse.json(
        { error: 'CSRF token required' },
        { status: 403 }
      );
    }

    // Validate CSRF token with Convex
    const isValidToken = await validateCSRFToken(csrfToken, userId);
    if (!isValidToken) {
      logSecurityEvent({
        type: 'CSRF_VALIDATION_FAILED',
        metadata: { reason: 'invalid_token' },
        ...clientInfo,
      });
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sessionId, action } = body;

    if (action === 'exchange') {
      // Exchange session ID for auth code
      const convex = getConvexClient();
      const authSession = await convex.query(api.authSessions.getAuthSession, {
        authCode: sessionId,
      });

      if (!authSession) {
        logSecurityEvent({
          type: 'INVALID_INPUT',
          metadata: { reason: 'invalid_or_expired_session' },
          ...clientInfo,
        });

        return NextResponse.json(
          {
            error: 'Invalid or expired session',
          },
          { status: 400 }
        );
      }

      // Mark the auth code as used
      const markResult = await convex.mutation(
        api.authSessions.markAuthCodeUsed,
        {
          authCode: sessionId,
        }
      );

      if (!markResult.success) {
        logSecurityEvent({
          type: 'AUTH_FAILURE',
          metadata: { reason: markResult.reason },
          ...clientInfo,
        });

        return NextResponse.json(
          {
            error: 'Session validation failed',
          },
          { status: 400 }
        );
      }

      logSecurityEvent({
        type: 'AUTH_SUCCESS',
        metadata: { action: 'code_exchange' },
        ...clientInfo,
      });

      return NextResponse.json({
        success: true,
        message: 'Auth code retrieved',
        sessionData: authSession,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
