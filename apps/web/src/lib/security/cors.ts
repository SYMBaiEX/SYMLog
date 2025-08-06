import { type NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  // Production domains
  'https://symlog.ai',
  'https://www.symlog.ai',
  'https://app.symlog.ai',

  // Vercel preview URLs (pattern matching)
  /^https:\/\/symlog-.*\.vercel\.app$/,

  // Development environments
  ...(process.env.NODE_ENV === 'development'
    ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ]
    : []),
];

/**
 * Check if an origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    // RegExp pattern matching
    return allowed.test(origin);
  });
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Only set origin if it's allowed
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Create a CORS-enabled response
 */
export function createCorsResponse(
  body: any,
  init: ResponseInit,
  request: NextRequest
): NextResponse {
  const corsHeaders = getCorsHeaders(request);

  return new NextResponse(body, {
    ...init,
    headers: {
      ...init.headers,
      ...corsHeaders,
    },
  });
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsOptions(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');

  // Check if origin is allowed
  if (!(origin && isAllowedOrigin(origin))) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}

/**
 * Middleware to validate CORS on actual requests
 */
export function validateCors(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const origin = request.headers.get('origin');

  // Allow same-origin requests (no origin header)
  if (!origin) {
    return { valid: true };
  }

  // Check if origin is allowed
  if (!isAllowedOrigin(origin)) {
    return {
      valid: false,
      error: `Origin ${origin} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Get allowed origins for documentation/debugging
 */
export function getAllowedOrigins(): string[] {
  return ALLOWED_ORIGINS.filter((o) => typeof o === 'string') as string[];
}
