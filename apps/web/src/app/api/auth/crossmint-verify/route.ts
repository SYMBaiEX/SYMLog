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
  [key: string]: any
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

    // For development, we'll trust Crossmint tokens
    // In production, you should verify the JWT signature using Crossmint's public key
    if (process.env.NODE_ENV === 'development') {
      console.log('Verifying Crossmint token:', token.substring(0, 50) + '...')
    }

    let crossmintPayload: CrossmintTokenPayload
    try {
      // In production, use Crossmint's public key to verify the JWT
      // For now, we'll decode without verification for development
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1]))
      crossmintPayload = payload
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

    // Create our own session token
    const jwtSecret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default-secret-key-change-in-production'
    )

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

// Handle CORS for development
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}