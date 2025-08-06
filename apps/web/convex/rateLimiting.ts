import { v } from "convex/values"
import { mutation, query, type MutationCtx } from "./_generated/server"

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  login: { limit: 5, windowMs: 60 * 1000 }, // 5 attempts per minute
  auth_code: { limit: 10, windowMs: 60 * 1000 }, // 10 attempts per minute
  token_refresh: { limit: 20, windowMs: 60 * 1000 }, // 20 refreshes per minute
  password_reset: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  api_general: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
}

/**
 * Check rate limit for an action (internal function)
 */
export const checkRateLimit = async (
  ctx: MutationCtx,
  args: {
    key: string // IP address or userId
    action: string // Action being rate limited
  }
): Promise<void> => {
    const config = RATE_LIMITS[args.action as keyof typeof RATE_LIMITS] || RATE_LIMITS.api_general
    const now = Date.now()
    
    // Find existing rate limit record
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", (q) => 
        q.eq("key", args.key).eq("action", args.action)
      )
      .first()
    
    // Check if blocked
    if (record?.blockedUntil && record.blockedUntil > now) {
      const remainingTime = Math.ceil((record.blockedUntil - now) / 1000)
      throw new Error(`Rate limit exceeded. Try again in ${remainingTime} seconds.`)
    }
    
    // No existing record or window expired
    if (!record || record.windowStart < now - config.windowMs) {
      // Create new rate limit window
      if (record) {
        await ctx.db.patch(record._id, {
          attempts: 1,
          windowStart: now,
          blockedUntil: undefined,
        })
      } else {
        await ctx.db.insert("rateLimits", {
          key: args.key,
          action: args.action,
          attempts: 1,
          windowStart: now,
        })
      }
      
      return
    }
    
    // Check if limit exceeded
    if (record.attempts >= config.limit) {
      // Block for exponential backoff time
      const blockDuration = Math.min(
        config.windowMs * Math.pow(2, Math.floor(record.attempts / config.limit)),
        60 * 60 * 1000 // Max 1 hour
      )
      
      await ctx.db.patch(record._id, {
        attempts: record.attempts + 1,
        blockedUntil: now + blockDuration,
      })
      
      // Log rate limit violation
      await ctx.db.insert("auditLogs", {
        action: "rate_limit_exceeded",
        ipAddress: args.key.includes('.') ? args.key : "unknown",
        timestamp: now,
        success: false,
        metadata: {
          action: args.action,
          attempts: record.attempts + 1,
          blockedUntil: now + blockDuration,
        },
      })
      
      throw new Error(`Rate limit exceeded. Too many ${args.action} attempts.`)
    }
    
    // Increment attempts
    await ctx.db.patch(record._id, {
      attempts: record.attempts + 1,
    })
}

/**
 * Reset rate limit for a specific key and action
 */
export const resetRateLimit = mutation({
  args: {
    key: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", q => 
        q.eq("key", args.key).eq("action", args.action)
      )
      .first()
    
    if (record) {
      await ctx.db.delete(record._id)
    }
    
    return { success: true }
  },
})

/**
 * Get current rate limit status
 */
export const getRateLimitStatus = query({
  args: {
    key: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const config = RATE_LIMITS[args.action as keyof typeof RATE_LIMITS] || RATE_LIMITS.api_general
    const now = Date.now()
    
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", q => 
        q.eq("key", args.key).eq("action", args.action)
      )
      .first()
    
    if (!record) {
      return {
        attempts: 0,
        limit: config.limit,
        remaining: config.limit,
        resetAt: null,
        blocked: false,
      }
    }
    
    // Check if blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        attempts: record.attempts,
        limit: config.limit,
        remaining: 0,
        resetAt: record.blockedUntil,
        blocked: true,
      }
    }
    
    // Check if window expired
    if (record.windowStart < now - config.windowMs) {
      return {
        attempts: 0,
        limit: config.limit,
        remaining: config.limit,
        resetAt: null,
        blocked: false,
      }
    }
    
    return {
      attempts: record.attempts,
      limit: config.limit,
      remaining: Math.max(0, config.limit - record.attempts),
      resetAt: record.windowStart + config.windowMs,
      blocked: false,
    }
  },
})

/**
 * Clean up old rate limit records (can be called periodically)
 */
export const cleanupOldRateLimits = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    
    // Find old records
    const oldRecords = await ctx.db
      .query("rateLimits")
      .withIndex("by_window", q => q.lt("windowStart", oneHourAgo))
      .collect()
    
    // Delete records that are no longer needed
    for (const record of oldRecords) {
      // Only delete if not currently blocked
      if (!record.blockedUntil || record.blockedUntil < now) {
        await ctx.db.delete(record._id)
      }
    }
    
    return {
      cleaned: oldRecords.length,
    }
  },
})

/**
 * Block an IP or user immediately
 */
export const blockKey = mutation({
  args: {
    key: v.string(),
    action: v.string(),
    duration: v.number(), // Block duration in milliseconds
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const blockedUntil = now + args.duration
    
    // Find or create rate limit record
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", q => 
        q.eq("key", args.key).eq("action", args.action)
      )
      .first()
    
    if (record) {
      await ctx.db.patch(record._id, {
        blockedUntil,
      })
    } else {
      await ctx.db.insert("rateLimits", {
        key: args.key,
        action: args.action,
        attempts: 0,
        windowStart: now,
        blockedUntil,
      })
    }
    
    // Log the block
    await ctx.db.insert("auditLogs", {
      action: "key_blocked",
      ipAddress: args.key.includes('.') ? args.key : "unknown",
      timestamp: now,
      success: true,
      metadata: {
        action: args.action,
        duration: args.duration,
        reason: args.reason,
        blockedUntil,
      },
    })
    
    return {
      success: true,
      blockedUntil,
    }
  },
})