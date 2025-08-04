import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Initialize Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexHttpClient(convexUrl);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  current: number;
}

/**
 * Check rate limit using Convex
 */
export async function checkRateLimit(
  userId: string,
  limit: number = 100
): Promise<RateLimitResult> {
  try {
    const result = await convex.mutation(api.rateLimit.checkRateLimit, {
      userId,
      limit,
    });
    
    return result;
  } catch (error) {
    console.error("Convex rate limit error:", error);
    
    // Return a conservative response on error
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: Date.now() + 3600000, // 1 hour from now
      current: limit,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  userId: string,
  limit: number = 100
): Promise<Omit<RateLimitResult, 'allowed'>> {
  try {
    const result = await convex.query(api.rateLimit.getRateLimitStatus, {
      userId,
      limit,
    });
    
    return result;
  } catch (error) {
    console.error("Convex rate limit status error:", error);
    
    return {
      limit,
      remaining: 0,
      reset: Date.now() + 3600000,
      current: limit,
    };
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(userId: string): Promise<boolean> {
  try {
    const result = await convex.mutation(api.rateLimit.resetRateLimit, {
      userId,
    });
    
    return result.success;
  } catch (error) {
    console.error("Convex rate limit reset error:", error);
    return false;
  }
}