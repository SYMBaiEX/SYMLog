import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { logSecurityEvent, extractClientInfo } from '@/lib/logger'
import { createSessionJWT } from '@/lib/jwt-utils'
import { config } from '@/lib/config'

interface CrossmintTokenVerifyRequest {
  token: string
  walletAddress?: string
}

interface CrossmintTokenPayload {
  sub: string
  iat: number
  exp: number
  aud: string
  iss: string
  email?: string
  wallet_address?: string
  scope?: string
}

// Crossmint JWKS endpoint for proper JWT verification
const CROSSMINT_JWKS_URL = 'https://api.crossmint.com/.well-known/jwks.json'
const jwks = createRemoteJWKSet(new URL(CROSSMINT_JWKS_URL))

export async function POST(request: NextRequest) {
  try {
    const clientInfo = extractClientInfo(request)
    const body: CrossmintTokenVerifyRequest = await request.json()
    const { token, walletAddress } = body

    // Validate input
    if (!token) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        metadata: { reason: 'missing_token' },
        ...clientInfo
      })
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Missing required field: token' 
        },
        { status: 400 }
      )
    }

    // Properly verify JWT with cryptographic signature validation
    let crossmintPayload: CrossmintTokenPayload
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: 'https://api.crossmint.com',
        audience: config.get().crossmintClientKey,
      })
      crossmintPayload = payload as unknown as CrossmintTokenPayload
    } catch (error) {
      console.error('JWT verification failed:', error)
      logSecurityEvent({
        type: 'TOKEN_VERIFICATION_FAILED',
        metadata: { 
          reason: 'invalid_crossmint_token',
          error: error instanceof Error ? error.message : 'unknown'
        },
        ...clientInfo
      })
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid Crossmint token' 
        },
        { status: 400 }
      )
    }

    // Create our own session token using common JWT utilities
    const sessionToken = await createSessionJWT({
      userId: crossmintPayload.sub,
      walletAddress: walletAddress,
      type: 'crossmint_verified_session',
      metadata: {
        crossmintToken: token,
        verifiedAt: new Date().toISOString()
      }
    })

    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

    // Log successful verification
    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      userId: crossmintPayload.sub,
      metadata: { 
        action: 'crossmint_verification',
        walletAddress: walletAddress || null
      },
      ...clientInfo
    })

    return NextResponse.json({
      isValid: true,
      message: 'Crossmint token verified successfully',
      sessionToken,
      expiresAt,
      userId: crossmintPayload.sub,
      walletAddress: walletAddress || null,
      verifiedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Crossmint token verification error:', error)
    
    return NextResponse.json(
      { 
        isValid: false, 
        message: 'Internal server error during verification' 
      },
      { status: 500 }
    )
  }
}

// Handle CORS with secure origin policy using regex patterns
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  
  // Use regex patterns for more flexible matching
  const allowedOriginPatterns = [
    /^https?:\/\/localhost:(3000|3001)$/,
    /^https:\/\/(.*\.)?symlog\.app$/,
  ]
  
  // Add custom domain if configured
  const appUrl = config.get().nextPublicAppUrl
  if (appUrl) {
    try {
      const url = new URL(appUrl)
      allowedOriginPatterns.push(
        new RegExp(`^https?://${url.hostname.replace(/\./g, '\\.')}(:\\d+)?$`)
      )
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  const isAllowedOrigin = origin ? allowedOriginPatterns.some(pattern => pattern.test(origin)) : false
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}