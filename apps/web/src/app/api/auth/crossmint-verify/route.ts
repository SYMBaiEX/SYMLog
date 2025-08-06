import { type NextRequest, NextResponse } from 'next/server';
import { extractClientInfo } from '@/lib/logger';
import { authService } from '@/services/auth.service';

interface CrossmintTokenVerifyRequest {
  token: string;
  walletAddress?: string;
}

export async function POST(request: NextRequest) {
  try {
    const clientInfo = extractClientInfo(request);
    const body: CrossmintTokenVerifyRequest = await request.json();
    const { token, walletAddress } = body;

    // Use auth service to verify token and create session
    const result = await authService.verifyCrossmintToken(
      token,
      walletAddress,
      clientInfo
    );

    if (!result.isValid) {
      return NextResponse.json(
        {
          isValid: false,
          message: result.message,
        },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json(result);
  } catch (error) {
    console.error('Crossmint token verification error:', error);

    return NextResponse.json(
      {
        isValid: false,
        message: 'Internal server error during verification',
      },
      { status: 500 }
    );
  }
}

// Handle CORS with secure origin policy
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Use regex patterns for more flexible matching
  const allowedOriginPatterns = [
    /^https?:\/\/localhost:(3000|3001)$/,
    /^https:\/\/(.*\.)?symlog\.app$/,
  ];

  const isAllowedOrigin = origin
    ? allowedOriginPatterns.some((pattern) => pattern.test(origin))
    : false;

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin && origin ? origin : '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
