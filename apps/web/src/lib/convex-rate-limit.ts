import { api } from '../../convex/_generated/api';
import { getConvexClient } from './convex-client';

/**
 * Result from rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Timestamp (ms) when the rate limit window resets */
  resetAt: number;
  /** Number of requests made in the current time window */
  requestCountInWindow: number;
}

/**
 * Check rate limit using Convex
 */
export async function checkRateLimit(
  userId: string,
  limit = 100
): Promise<RateLimitResult> {
  try {
    const convex = getConvexClient();
    const result = await convex.mutation(api.rateLimit.checkRateLimit, {
      userId,
      limit,
    });

    return result;
  } catch (error) {
    console.error('Convex rate limit error:', error);

    // Return a conservative response on error
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: Date.now() + 3_600_000, // 1 hour from now
      requestCountInWindow: limit,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  userId: string,
  limit = 100
): Promise<Omit<RateLimitResult, 'allowed'>> {
  try {
    const convex = getConvexClient();
    const result = await convex.query(api.rateLimit.getRateLimitStatus, {
      userId,
      limit,
    });

    return result;
  } catch (error) {
    console.error('Convex rate limit status error:', error);

    return {
      limit,
      remaining: 0,
      resetAt: Date.now() + 3_600_000,
      requestCountInWindow: limit,
    };
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(userId: string): Promise<boolean> {
  try {
    const convex = getConvexClient();
    const result = await convex.mutation(api.rateLimit.resetRateLimit, {
      userId,
    });

    return result.success;
  } catch (error) {
    console.error('Convex rate limit reset error:', error);
    return false;
  }
}
