import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Basic security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // COOP header for popup window compatibility
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  
  // Content Security Policy for Crossmint and Convex
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://staging.crossmint.com https://www.crossmint.com https://signers.crossmint.com https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://*.gstatic.com data: https:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://staging.crossmint.com https://www.crossmint.com https://signers.crossmint.com https://*.convex.cloud wss://*.convex.cloud",
    "frame-src 'self' https://staging.crossmint.com https://www.crossmint.com https://signers.crossmint.com",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
}