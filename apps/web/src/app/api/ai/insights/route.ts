import type { NextRequest } from 'next/server';
import { validateChatAuth } from '@/lib/ai/core';
import { extractClientInfo, logSecurityEvent } from '@/lib/logger';
import { chatService } from '@/services/chat.service';

export async function GET(req: NextRequest) {
  try {
    // Validate authentication
    const userSession = await validateChatAuth(req);
    if (!userSession) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = Number.parseInt(searchParams.get('days') || '7', 10);

    // Validate user ID matches session
    if (userId !== userSession.userId) {
      logSecurityEvent({
        type: 'API_ERROR' as any,
        userId: userSession.userId,
        metadata: { attempted_user_id: userId },
        ...extractClientInfo(req),
      });
      return new Response('Forbidden', { status: 403 });
    }

    // Get insights and recommendations
    const [insights, recommendations] = await Promise.all([
      chatService.getModelUsageInsights(userId, days),
      chatService.getModelRecommendations(userId),
    ]);

    return Response.json({
      insights,
      recommendations,
      timeRange: `${days}d`,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch AI insights:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Handle CORS for insights endpoint
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://symlog.app',
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin ?? '');

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin ?? '') : 'null',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
