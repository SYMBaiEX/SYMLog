import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logSecurityEvent } from '@/lib/logger';
import { getCorsHeaders, isAllowedOrigin } from '@/lib/security/cors';

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');

    // For OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      if (!(origin && isAllowedOrigin(origin))) {
        logSecurityEvent({
          type: 'API_ERROR' as any,
          metadata: {
            origin,
            path: request.nextUrl.pathname,
            method: 'OPTIONS',
          },
        });
        return new NextResponse(null, { status: 403 });
      }

      return new NextResponse(null, {
        status: 200,
        headers: getCorsHeaders(request),
      });
    }

    // For actual requests, check origin
    if (origin && !isAllowedOrigin(origin)) {
      logSecurityEvent({
        type: 'API_ERROR' as any,
        metadata: {
          origin,
          path: request.nextUrl.pathname,
          method: request.method,
        },
      });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // Continue with the request
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
