import { PublicKey } from '@solana/web3.js';
import { type NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { validateChatAuth } from '@/lib/ai/core';
import { extractClientInfo, logSecurityEvent } from '@/lib/logger';
import {
  createCorsResponse,
  handleCorsOptions,
  validateCors,
} from '@/lib/security/cors';

interface WalletVerifyRequest {
  walletAddress: string;
  message: string; // Base64 encoded message
  signature: string; // Base64 encoded signature
}

export async function POST(request: NextRequest) {
  try {
    const clientInfo = extractClientInfo(request);

    // Validate CORS
    const corsValidation = validateCors(request);
    if (!corsValidation.valid) {
      logSecurityEvent({
        type: 'API_ERROR' as any,
        metadata: {
          reason: corsValidation.error,
          origin: request.headers.get('origin'),
        },
        ...clientInfo,
      });
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Validate authentication
    const userSession = await validateChatAuth(request);
    if (!userSession) {
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        metadata: { reason: 'unauthorized' },
        ...clientInfo,
      });
      return createCorsResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
        request
      );
    }

    const body: WalletVerifyRequest = await request.json();
    const { walletAddress, message, signature } = body;

    // Validate input
    if (!(walletAddress && message && signature)) {
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        userId: userSession.userId,
        metadata: { reason: 'missing_fields' },
        ...clientInfo,
      });
      return createCorsResponse(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
        request
      );
    }

    try {
      // Decode base64 values
      const messageBytes = Buffer.from(message, 'base64');
      const signatureBytes = Buffer.from(signature, 'base64');

      // Verify the wallet address is valid
      const publicKey = new PublicKey(walletAddress);

      // Verify the signature
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      if (!verified) {
        logSecurityEvent({
          type: 'WALLET_VERIFICATION_FAILED',
          userId: userSession.userId,
          metadata: {
            reason: 'invalid_signature',
            walletAddress,
          },
          ...clientInfo,
        });
        return createCorsResponse(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
          request
        );
      }

      // Parse the message to verify it's recent and for this service
      const messageText = new TextDecoder().decode(messageBytes);
      const messageLines = messageText.split('\n');

      // Extract timestamp from message
      const timestampLine = messageLines.find((line) =>
        line.includes('Timestamp:')
      );
      if (timestampLine) {
        const timestamp = timestampLine.split('Timestamp:')[1].trim();
        const messageTime = new Date(timestamp).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // Check if message is recent (within 5 minutes)
        if (now - messageTime > fiveMinutes) {
          logSecurityEvent({
            type: 'WALLET_VERIFICATION_FAILED',
            userId: userSession.userId,
            metadata: {
              reason: 'expired_signature',
              walletAddress,
              messageAge: now - messageTime,
            },
            ...clientInfo,
          });
          return createCorsResponse(
            JSON.stringify({ error: 'Signature expired' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
            request
          );
        }
      }

      // Verify the message is for SYMLog
      if (!messageText.includes('SYMLog')) {
        logSecurityEvent({
          type: 'WALLET_VERIFICATION_FAILED',
          userId: userSession.userId,
          metadata: {
            reason: 'invalid_message_context',
            walletAddress,
          },
          ...clientInfo,
        });
        return createCorsResponse(
          JSON.stringify({ error: 'Invalid message context' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
          request
        );
      }

      // Store verification status (in production, use database)
      // For now, we just log the successful verification
      logSecurityEvent({
        type: 'WALLET_VERIFICATION_SUCCESS',
        userId: userSession.userId,
        metadata: {
          walletAddress,
          messagePreview: messageText.substring(0, 50) + '...',
        },
        ...clientInfo,
      });

      return createCorsResponse(
        JSON.stringify({
          success: true,
          message: 'Wallet verified successfully',
          walletAddress,
          verifiedAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
        request
      );
    } catch (error) {
      console.error('Wallet verification error:', error);

      logSecurityEvent({
        type: 'WALLET_VERIFICATION_FAILED',
        userId: userSession.userId,
        metadata: {
          reason: 'verification_error',
          error: error instanceof Error ? error.message : 'unknown',
        },
        ...clientInfo,
      });

      return createCorsResponse(
        JSON.stringify({ error: 'Verification failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
        request
      );
    }
  } catch (error) {
    console.error('Wallet verify endpoint error:', error);
    return createCorsResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
      request
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}
