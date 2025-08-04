import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { validateChatAuth } from '@/lib/ai/auth-middleware'
import { logSecurityEvent, extractClientInfo } from '@/lib/logger'

interface WalletVerifyRequest {
  walletAddress: string
  message: string // Base64 encoded message
  signature: string // Base64 encoded signature
}

export async function POST(request: NextRequest) {
  try {
    const clientInfo = extractClientInfo(request)
    
    // Validate authentication
    const userSession = await validateChatAuth(request)
    if (!userSession) {
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        metadata: { reason: 'unauthorized' },
        ...clientInfo
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body: WalletVerifyRequest = await request.json()
    const { walletAddress, message, signature } = body
    
    // Validate input
    if (!walletAddress || !message || !signature) {
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        userId: userSession.userId,
        metadata: { reason: 'missing_fields' },
        ...clientInfo
      })
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }
    
    try {
      // Decode base64 values
      const messageBytes = Buffer.from(message, 'base64')
      const signatureBytes = Buffer.from(signature, 'base64')
      
      // Verify the wallet address is valid
      const publicKey = new PublicKey(walletAddress)
      
      // Verify the signature
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      )
      
      if (!verified) {
        logSecurityEvent({
          type: 'WALLET_VERIFICATION_FAILED',
          userId: userSession.userId,
          metadata: { 
            reason: 'invalid_signature',
            walletAddress 
          },
          ...clientInfo
        })
        return NextResponse.json({ 
          error: 'Invalid signature' 
        }, { status: 400 })
      }
      
      // Parse the message to verify it's recent and for this service
      const messageText = new TextDecoder().decode(messageBytes)
      const messageLines = messageText.split('\n')
      
      // Extract timestamp from message
      const timestampLine = messageLines.find(line => line.includes('Timestamp:'))
      if (timestampLine) {
        const timestamp = timestampLine.split('Timestamp:')[1].trim()
        const messageTime = new Date(timestamp).getTime()
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000
        
        // Check if message is recent (within 5 minutes)
        if (now - messageTime > fiveMinutes) {
          logSecurityEvent({
            type: 'WALLET_VERIFICATION_FAILED',
            userId: userSession.userId,
            metadata: { 
              reason: 'expired_signature',
              walletAddress,
              messageAge: now - messageTime
            },
            ...clientInfo
          })
          return NextResponse.json({ 
            error: 'Signature expired' 
          }, { status: 400 })
        }
      }
      
      // Verify the message is for SYMLog
      if (!messageText.includes('SYMLog')) {
        logSecurityEvent({
          type: 'WALLET_VERIFICATION_FAILED',
          userId: userSession.userId,
          metadata: { 
            reason: 'invalid_message_context',
            walletAddress 
          },
          ...clientInfo
        })
        return NextResponse.json({ 
          error: 'Invalid message context' 
        }, { status: 400 })
      }
      
      // Store verification status (in production, use database)
      // For now, we just log the successful verification
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_SUCCESS',
        userId: userSession.userId,
        metadata: { 
          walletAddress,
          messagePreview: messageText.substring(0, 50) + '...'
        },
        ...clientInfo
      })
      
      return NextResponse.json({
        success: true,
        message: 'Wallet verified successfully',
        walletAddress,
        verifiedAt: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Wallet verification error:', error)
      
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        userId: userSession.userId,
        metadata: { 
          reason: 'verification_error',
          error: error instanceof Error ? error.message : 'unknown'
        },
        ...clientInfo
      })
      
      return NextResponse.json({ 
        error: 'Verification failed' 
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Wallet verify endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Handle CORS
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