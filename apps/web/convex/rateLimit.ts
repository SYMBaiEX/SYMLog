import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { DB_OPERATIONS, EXPIRY_TIMES, RATE_LIMIT_DEFAULTS } from './constants';

export const checkRateLimit = mutation({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? RATE_LIMIT_DEFAULTS.DEFAULT_LIMIT;
    const now = Date.now();
    const windowStart = now - EXPIRY_TIMES.RATE_LIMIT_WINDOW;

    // Get all rate limit entries for this user in the current window
    const entries = await ctx.db
      .query('rateLimits')
      .withIndex('by_user_and_timestamp', (q) =>
        q.eq('userId', args.userId).gte('timestamp', windowStart)
      )
      .collect();

    const requestCount = entries.length;
    const remaining = Math.max(0, limit - requestCount);
    const isAllowed = requestCount < limit;

    // If allowed, record this request
    // Note: We intentionally record after checking to ensure accurate counting
    // This prevents the current request from being counted in its own limit check
    if (isAllowed) {
      await ctx.db.insert('rateLimits', {
        userId: args.userId,
        timestamp: now,
        expiresAt: now + EXPIRY_TIMES.RATE_LIMIT_WINDOW,
      });
    }

    return {
      allowed: isAllowed,
      limit,
      remaining,
      resetAt: windowStart + EXPIRY_TIMES.RATE_LIMIT_WINDOW,
      requestCountInWindow: requestCount,
    };
  },
});

export const resetRateLimit = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete all rate limit entries for this user
    const entries = await ctx.db
      .query('rateLimits')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    return { success: true };
  },
});

export const getRateLimitStatus = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? RATE_LIMIT_DEFAULTS.DEFAULT_LIMIT;
    const now = Date.now();
    const windowStart = now - EXPIRY_TIMES.RATE_LIMIT_WINDOW;

    const entries = await ctx.db
      .query('rateLimits')
      .withIndex('by_user_and_timestamp', (q) =>
        q.eq('userId', args.userId).gte('timestamp', windowStart)
      )
      .collect();

    const requestCount = entries.length;
    const remaining = Math.max(0, limit - requestCount);

    return {
      limit,
      remaining,
      resetAt: windowStart + EXPIRY_TIMES.RATE_LIMIT_WINDOW,
      requestCountInWindow: requestCount,
    };
  },
});

// Cleanup function to be called by scheduled job
export const cleanupExpiredRateLimits = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let deletedCount = 0;
    let hasMore = true;

    // Process deletions in batches to handle large datasets efficiently
    while (hasMore) {
      // Find a batch of expired entries
      const expired = await ctx.db
        .query('rateLimits')
        .withIndex('by_expiry', (q) => q.lte('expiresAt', now))
        .take(DB_OPERATIONS.BATCH_SIZE);

      if (expired.length === 0) {
        hasMore = false;
      }

      // Delete the batch
      for (const entry of expired) {
        await ctx.db.delete(entry._id);
        deletedCount++;
      }

      // If we got less than full batch size, we're done
      if (expired.length < DB_OPERATIONS.BATCH_SIZE) {
        hasMore = false;
      }
    }

    return { deletedCount };
  },
});
