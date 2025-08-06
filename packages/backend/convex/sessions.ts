import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

/**
 * Generate secure random tokens
 */
function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Generate JWT access token (simplified - in production use proper JWT library)
 */
function generateAccessToken(userId: string): string {
  // In production, use a proper JWT library with RS256 signing
  const header = { alg: "HS256", typ: "JWT" }
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    type: "access"
  }
  
  // Simplified encoding - use proper JWT library in production
  const encodedHeader = btoa(JSON.stringify(header))
  const encodedPayload = btoa(JSON.stringify(payload))
  const signature = generateSecureToken(43) // Simplified signature
  
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * Create a new session (internal function)
 */
export const createSession = async (
  ctx: any,
  args: {
    userId: string
    deviceId: string
    deviceName?: string
    deviceType: string
    platform: string
    userAgent?: string
    ipAddress: string
  }
) => {
    // Generate tokens
    const accessToken = generateAccessToken(args.userId)
    const refreshToken = generateSecureToken(64)
    
    // Calculate expiry times
    const now = Date.now()
    const accessTokenExpiresAt = now + (15 * 60 * 1000) // 15 minutes
    const refreshTokenExpiresAt = now + (30 * 24 * 60 * 60 * 1000) // 30 days
    
    // Create session
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      deviceType: args.deviceType,
      platform: args.platform,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      isActive: true,
      createdAt: now,
      lastActivityAt: now,
    })
    
    // Log session creation
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      sessionId,
      action: "session_created",
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: now,
      success: true,
      metadata: {
        deviceType: args.deviceType,
        platform: args.platform,
      },
    })
    
    return {
      sessionId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }
}

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = mutation({
  args: {
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Find session by refresh token
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refresh_token", q => q.eq("refreshToken", args.refreshToken))
      .first()
    
    if (!session) {
      throw new Error("Invalid refresh token")
    }
    
    if (!session.isActive) {
      throw new Error("Session is inactive")
    }
    
    const now = Date.now()
    
    if (session.refreshTokenExpiresAt < now) {
      // Mark session as expired
      await ctx.db.patch(session._id, {
        isActive: false,
        revokedAt: now,
        revokedReason: "refresh_token_expired",
      })
      throw new Error("Refresh token has expired")
    }
    
    // Generate new tokens (rotate refresh token for security)
    const newAccessToken = generateAccessToken(session.userId)
    const newRefreshToken = generateSecureToken(64)
    
    const accessTokenExpiresAt = now + (15 * 60 * 1000) // 15 minutes
    const refreshTokenExpiresAt = now + (30 * 24 * 60 * 60 * 1000) // 30 days
    
    // Update session with new tokens
    await ctx.db.patch(session._id, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      lastActivityAt: now,
      refreshedAt: now,
    })
    
    // Log token refresh
    await ctx.db.insert("auditLogs", {
      userId: session.userId,
      sessionId: session._id,
      action: "token_refreshed",
      ipAddress: session.ipAddress,
      timestamp: now,
      success: true,
    })
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }
  },
})

/**
 * Validate access token
 */
export const validateAccessToken = query({
  args: {
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_access_token", q => q.eq("accessToken", args.accessToken))
      .first()
    
    if (!session) {
      return { valid: false, reason: "token_not_found" }
    }
    
    if (!session.isActive) {
      return { valid: false, reason: "session_inactive" }
    }
    
    if (session.accessTokenExpiresAt < Date.now()) {
      return { valid: false, reason: "token_expired" }
    }
    
    // Get user data
    const user = await ctx.db.get(session.userId)
    
    return {
      valid: true,
      userId: session.userId,
      sessionId: session._id,
      user,
    }
  },
})

/**
 * Revoke session (logout)
 */
export const revokeSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    
    if (!session) {
      throw new Error("Session not found")
    }
    
    const now = Date.now()
    
    // Mark session as revoked
    await ctx.db.patch(args.sessionId, {
      isActive: false,
      revokedAt: now,
      revokedReason: args.reason || "user_logout",
    })
    
    // Log session revocation
    await ctx.db.insert("auditLogs", {
      userId: session.userId,
      sessionId: args.sessionId,
      action: "session_revoked",
      ipAddress: session.ipAddress,
      timestamp: now,
      success: true,
      metadata: { reason: args.reason || "user_logout" },
    })
    
    return { success: true }
  },
})

/**
 * Revoke all sessions for a user (security action)
 */
export const revokeAllUserSessions = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect()
    
    const now = Date.now()
    const reason = args.reason || "security_action"
    
    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        isActive: false,
        revokedAt: now,
        revokedReason: reason,
      })
    }
    
    // Log mass revocation
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "all_sessions_revoked",
      ipAddress: "system",
      timestamp: now,
      success: true,
      metadata: {
        sessionsRevoked: sessions.length,
        reason,
      },
    })
    
    return {
      success: true,
      sessionsRevoked: sessions.length,
    }
  },
})

/**
 * Get active sessions for a user
 */
export const getUserSessions = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect()
  },
})

/**
 * Clean up expired sessions (can be called periodically)
 */
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    
    // Find expired sessions
    const expiredSessions = await ctx.db
      .query("sessions")
      .filter(q => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.lt(q.field("refreshTokenExpiresAt"), now)
        )
      )
      .collect()
    
    for (const session of expiredSessions) {
      await ctx.db.patch(session._id, {
        isActive: false,
        revokedAt: now,
        revokedReason: "token_expired",
      })
    }
    
    return {
      cleanedUp: expiredSessions.length,
    }
  },
})