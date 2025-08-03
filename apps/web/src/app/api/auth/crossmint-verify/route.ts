import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

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

export async function POST(request: NextRequest) {
  try {
    const body: CrossmintTokenVerifyRequest = await request.json()
    const { token, walletAddress } = body

    // Validate input
    if (!token) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Missing required field: token' 
        },
        { status: 400 }
      )
    }

    // Validate JWT format and extract payload
    let crossmintPayload: CrossmintTokenPayload
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format - must have 3 parts')
      }
      
      const payload = JSON.parse(atob(parts[1]))
      
      // Validate required payload fields
      if (!payload.sub || !payload.iat || !payload.exp) {
        throw new Error('Missing required JWT claims')
      }
      
      crossmintPayload = payload as CrossmintTokenPayload
    } catch (error) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid Crossmint token format' 
        },
        { status: 400 }
      )
    }

    // Validate token expiration
    const now = Math.floor(Date.now() / 1000)
    if (crossmintPayload.exp && now > crossmintPayload.exp) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Crossmint token has expired' 
        },
        { status: 401 }
      )
    }

    // Validate JWT_SECRET exists and is secure
    const jwtSecretEnv = process.env.JWT_SECRET
    if (!jwtSecretEnv || jwtSecretEnv.length < 32) {
      console.error('JWT_SECRET is missing or too short. Must be at least 32 characters.')
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Server configuration error' 
        },
        { status: 500 }
      )
    }

    // Create our own session token
    const jwtSecret = new TextEncoder().encode(jwtSecretEnv)

    const sessionToken = await new SignJWT({
      userId: crossmintPayload.sub,
      walletAddress: walletAddress || null,
      crossmintToken: token,
      verifiedAt: new Date().toISOString(),
      type: 'crossmint_verified_session'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .setSubject(crossmintPayload.sub)
      .setAudience('symlog-app')
      .setIssuer('symlog-auth')
      .sign(jwtSecret)

    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

    // Log successful verification (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Crossmint token verification successful for user: ${crossmintPayload.sub}`)
    }

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

// Handle CORS with secure origin policy
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000', 
    'https://symlog.app',
    process.env.NEXT_PUBLIC_APP_DOMAIN ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}` : null
  ].filter(Boolean)
  
  const isAllowedOrigin = allowedOrigins.includes(origin || '')
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}