import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { config } from './config';
import { getConvexClient } from './convex-client';

/**
 * Token reservation service for preventing concurrent requests from bypassing limits
 */
export class TokenReservationService {
  private static instance: TokenReservationService;

  // Estimate tokens based on message content
  // Using rough estimate: 1 token ≈ 4 characters
  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly MIN_RESPONSE_TOKENS = 100;
  private static readonly SAFETY_MULTIPLIER = 1.2; // Add 20% safety margin

  private constructor() {}

  static getInstance(): TokenReservationService {
    if (!TokenReservationService.instance) {
      TokenReservationService.instance = new TokenReservationService();
    }
    return TokenReservationService.instance;
  }

  /**
   * Estimate tokens for a chat request
   */
  estimateTokens(messages: any[], attachments?: any[]): number {
    let totalChars = 0;

    // Count characters in messages
    for (const message of messages) {
      if (message.content) {
        totalChars += message.content.length;
      }
    }

    // Add estimate for attachments
    if (attachments && attachments.length > 0) {
      // Rough estimate: each attachment adds ~500 tokens
      totalChars +=
        attachments.length * 500 * TokenReservationService.CHARS_PER_TOKEN;
    }

    // Convert to tokens and add minimum response size
    const promptTokens = Math.ceil(
      totalChars / TokenReservationService.CHARS_PER_TOKEN
    );
    const estimatedTotal =
      (promptTokens + TokenReservationService.MIN_RESPONSE_TOKENS) *
      TokenReservationService.SAFETY_MULTIPLIER;

    return Math.ceil(estimatedTotal);
  }

  /**
   * Reserve tokens for a request
   */
  async reserveTokens(
    userId: string,
    messages: any[],
    attachments?: any[]
  ): Promise<{
    success: boolean;
    reservationId?: string;
    currentUsage: number;
    limit: number;
    remaining: number;
    error?: string;
  }> {
    try {
      const estimatedTokens = this.estimateTokens(messages, attachments);
      const maxDailyTokens = config.get().aiMaxTokensPerDay;

      const convex = getConvexClient();
      // TODO: Implement tokenLimits API in Convex schema
      // const result = await convex.mutation(api.tokenLimits.reserveTokens, {
      //   userId,
      //   estimatedTokens,
      //   maxDailyTokens,
      // });
      const result = {
        success: true,
        tokensUsed: 0,
        remainingTokens: maxDailyTokens,
        reservationId: 'stub-' + Date.now(),
        currentUsage: 0,
        limit: maxDailyTokens,
        remaining: maxDailyTokens,
      };

      if (result.success) {
        return {
          success: true,
          reservationId: result.reservationId,
          currentUsage: result.currentUsage,
          limit: result.limit,
          remaining: result.remaining,
        };
      }

      return {
        success: false,
        currentUsage: result.currentUsage,
        limit: result.limit,
        remaining: result.remaining,
        error: 'Daily token limit exceeded',
      };
    } catch (error) {
      console.error('Failed to reserve tokens:', error);
      return {
        success: false,
        currentUsage: 0,
        limit: config.get().aiMaxTokensPerDay,
        remaining: 0,
        error: 'Failed to check token limits',
      };
    }
  }

  /**
   * Complete a token reservation with actual usage
   */
  async completeReservation(
    reservationId: string,
    actualTokens: number
  ): Promise<boolean> {
    try {
      const convex = getConvexClient();
      // TODO: Implement tokenLimits API in Convex schema
      // await convex.mutation(api.tokenLimits.completeTokenReservation, {
      //   reservationId: reservationId as Id<'tokenUsage'>,
      //   actualTokens,
      // });
      return true;
    } catch (error) {
      console.error('Failed to complete token reservation:', error);
      return false;
    }
  }

  /**
   * Cancel a token reservation
   */
  async cancelReservation(reservationId: string): Promise<boolean> {
    try {
      const convex = getConvexClient();
      // TODO: Implement tokenLimits API in Convex schema
      // await convex.mutation(api.tokenLimits.cancelTokenReservation, {
      //   reservationId: reservationId as Id<'tokenUsage'>,
      // });
      return true;
    } catch (error) {
      console.error('Failed to cancel token reservation:', error);
      return false;
    }
  }

  /**
   * Get current token usage for a user
   */
  async getTokenUsage(userId: string): Promise<{
    totalUsage: number;
    totalReserved: number;
    completedRequests: number;
  }> {
    try {
      const convex = getConvexClient();
      // TODO: Implement tokenLimits API in Convex schema
      // return await convex.query(api.tokenLimits.getTokenUsage, {
      //   userId,
      // });
      return {
        totalUsage: 0,
        totalReserved: 0,
        completedRequests: 0,
      };
    } catch (error) {
      console.error('Failed to get token usage:', error);
      return {
        totalUsage: 0,
        totalReserved: 0,
        completedRequests: 0,
      };
    }
  }
}

// Export singleton instance
export const tokenReservationService = TokenReservationService.getInstance();
