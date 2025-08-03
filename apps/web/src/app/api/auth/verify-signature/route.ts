import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { SignJWT } from 'jose'
import nacl from 'tweetnacl'

interface VerifySignatureRequest {
  message: string
  signature: number[]
  publicKey: string
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifySignatureRequest = await request.json()
    const { message, signature, publicKey } = body

    // Validate input
    if (!message || !signature || !publicKey) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Missing required fields: message, signature, or publicKey' 
        },
        { status: 400 }
      )
    }

    // Validate public key format
    let walletPublicKey: PublicKey
    try {
      walletPublicKey = new PublicKey(publicKey)
    } catch (error) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid public key format' 
        },
        { status: 400 }
      )
    }

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message)
    
    // Convert signature array to Uint8Array
    const signatureBytes = new Uint8Array(signature)

    // Verify signature using tweetnacl
    const isValidSignature = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      walletPublicKey.toBytes()
    )

    if (!isValidSignature) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid signature' 
        },
        { status: 401 }
      )
    }

    // Parse and validate sign-in message
    const messageLines = message.split('\n')
    const messageData: Record<string, string> = {}
    
    for (const line of messageLines) {
      const colonIndex = line.indexOf(': ')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex)
        const value = line.substring(colonIndex + 2)
        messageData[key] = value
      }
    }

    // Validate message structure and content
    const requiredFields = ['domain', 'statement', 'version', 'chainId', 'nonce', 'issuedAt']
    for (const field of requiredFields) {
      if (!messageData[field]) {
        return NextResponse.json(
          { 
            isValid: false, 
            message: `Missing required field in sign-in message: ${field}` 
          },
          { status: 400 }
        )
      }
    }

    // Validate domain
    const expectedDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:3001'
    if (messageData.domain !== expectedDomain) {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid domain in sign-in message' 
        },
        { status: 400 }
      )
    }

    // Validate chain ID
    if (messageData.chainId !== 'solana:101') {
      return NextResponse.json(
        { 
          isValid: false, 
          message: 'Invalid chain ID' 
        },
        { status: 400 }
      )
    }

    // Validate expiration if present
    if (messageData.expirationTime) {
      const expirationTime = new Date(messageData.expirationTime).getTime()
      if (Date.now() > expirationTime) {
        return NextResponse.json(
          { 
            isValid: false, 
            message: 'Sign-in message has expired' 
          },
          { status: 401 }
        )
      }
    }

    // Validate not before if present
    if (messageData.notBefore) {
      const notBeforeTime = new Date(messageData.notBefore).getTime()
      if (Date.now() < notBeforeTime) {
        return NextResponse.json(
          { 
            isValid: false, 
            message: 'Sign-in message not yet valid' 
          },
          { status: 401 }
        )
      }
    }

    // Create secure session token
    const jwtSecret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default-secret-key-change-in-production'
    )

    const sessionToken = await new SignJWT({
      publicKey,
      address: publicKey,
      nonce: messageData.nonce,
      verifiedAt: new Date().toISOString(),
      type: 'verified_wallet_session'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setSubject(publicKey)
      .setAudience('symlog-app')
      .setIssuer('symlog-auth')
      .sign(jwtSecret)

    const expiresAt = Date.now() + (60 * 60 * 1000) // 1 hour

    // Log successful verification (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Wallet verification successful for: ${publicKey}`)
    }

    return NextResponse.json({
      isValid: true,
      message: 'Signature verified successfully',
      sessionToken,
      expiresAt,
      publicKey,
      verifiedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Signature verification error:', error)
    
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