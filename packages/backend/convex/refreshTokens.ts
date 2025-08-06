import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { createHash, randomBytes } from "crypto"

/**
 * Generate a cryptographically secure refresh token
 */
function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Hash a refresh token for secure storage
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Create a new refresh token for a session
 */
export const createRefreshToken = mutation({
  args: {
    sessionId: v.id("authSessions"),
    expiresIn: v.optional(v.number()), // seconds, default 7 days
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new Error("Session not found")
    }

    const token = generateRefreshToken()
    const hashedToken = hashRefreshToken(token)
    const expiresIn = args.expiresIn || (7 * 24 * 60 * 60) // 7 days default
    const expiresAt = Date.now() + (expiresIn * 1000)

    // Store the hashed token
    const refreshTokenId = await ctx.db.insert("refreshTokens", {
      sessionId: args.sessionId,
      userId: session.userId!,
      tokenHash: hashedToken,
      expiresAt,
      createdAt: Date.now(),
      usedAt: null,
      revokedAt: null,
      deviceFingerprint: session.deviceFingerprint,
      ipAddress: session.ipAddress,
    })

    // Log token creation
    await ctx.db.insert("auditLogs", {
      userId: session.userId,
      sessionId: args.sessionId,
      action: "refresh_token_created",
      ipAddress: session.ipAddress || "unknown",
      timestamp: Date.now(),
      success: true,
      metadata: {
        refreshTokenId: refreshTokenId,
        expiresAt,
      },
    })

    // Return the raw token (only time it's visible)
    return {
      refreshToken: token,
      expiresAt,
      refreshTokenId,
    }
  },
})

/**
 * Rotate a refresh token (exchange old for new)
 */
export const rotateRefreshToken = mutation({
  args: {
    refreshToken: v.string(),
    deviceFingerprint: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Rate limiting check
    if (args.ipAddress) {
      const { checkRateLimit } = await import("./rateLimiting")
      await checkRateLimit(ctx, {
        key: args.ipAddress,
        action: "token_refresh",
      })
    }

    const hashedToken = hashRefreshToken(args.refreshToken)
    
    // Find the refresh token
    const refreshToken = await ctx.db
      .query("refreshTokens")
      .withIndex("by_token_hash", q => q.eq("tokenHash", hashedToken))
      .first()

    if (!refreshToken) {
      // Log failed attempt
      await ctx.db.insert("auditLogs", {
        action: "refresh_token_invalid",
        ipAddress: args.ipAddress || "unknown",
        userAgent: args.userAgent,
        timestamp: Date.now(),
        success: false,
        errorMessage: "Invalid refresh token",
      })
      throw new Error("Invalid refresh token")
    }

    // Check if token is expired
    if (refreshToken.expiresAt < Date.now()) {
      await ctx.db.patch(refreshToken._id, { revokedAt: Date.now() })
      
      await ctx.db.insert("auditLogs", {
        userId: refreshToken.userId,
        sessionId: refreshToken.sessionId,
        action: "refresh_token_expired",
        ipAddress: args.ipAddress || "unknown",
        timestamp: Date.now(),
        success: false,
        errorMessage: "Refresh token expired",
      })
      
      throw new Error("Refresh token expired")
    }

    // Check if token was already used (token reuse detection)
    if (refreshToken.usedAt) {
      // Token reuse detected - revoke entire session
      await revokeAllSessionTokens(ctx, refreshToken.sessionId)
      
      await ctx.db.insert("auditLogs", {
        userId: refreshToken.userId,
        sessionId: refreshToken.sessionId,
        action: "refresh_token_reuse_detected",
        ipAddress: args.ipAddress || "unknown",
        timestamp: Date.now(),
        success: false,
        errorMessage: "Refresh token reuse detected - session revoked",
        metadata: {
          originalTokenId: refreshToken._id,
        },
      })
      
      throw new Error("Refresh token reuse detected - session revoked")
    }

    // Check if token was revoked
    if (refreshToken.revokedAt) {
      await ctx.db.insert("auditLogs", {
        userId: refreshToken.userId,
        sessionId: refreshToken.sessionId,
        action: "refresh_token_revoked",
        ipAddress: args.ipAddress || "unknown",
        timestamp: Date.now(),
        success: false,
        errorMessage: "Refresh token was revoked",
      })
      
      throw new Error("Refresh token was revoked")
    }

    // Verify device fingerprint if provided
    if (args.deviceFingerprint && refreshToken.deviceFingerprint) {
      if (args.deviceFingerprint !== refreshToken.deviceFingerprint) {
        // Suspicious activity - revoke session
        await revokeAllSessionTokens(ctx, refreshToken.sessionId)
        
        await ctx.db.insert("auditLogs", {
          userId: refreshToken.userId,
          sessionId: refreshToken.sessionId,
          action: "device_fingerprint_mismatch",
          ipAddress: args.ipAddress || "unknown",
          timestamp: Date.now(),
          success: false,
          errorMessage: "Device fingerprint mismatch - session revoked",
        })
        
        throw new Error("Device fingerprint mismatch")
      }
    }

    // Mark old token as used
    await ctx.db.patch(refreshToken._id, { 
      usedAt: Date.now(),
      lastUsedIp: args.ipAddress,
    })

    // Create new refresh token
    const newToken = generateRefreshToken()
    const newHashedToken = hashRefreshToken(newToken)
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days

    const newRefreshTokenId = await ctx.db.insert("refreshTokens", {
      sessionId: refreshToken.sessionId,
      userId: refreshToken.userId,
      tokenHash: newHashedToken,
      expiresAt,
      createdAt: Date.now(),
      usedAt: null,
      revokedAt: null,
      deviceFingerprint: args.deviceFingerprint || refreshToken.deviceFingerprint,
      ipAddress: args.ipAddress || refreshToken.ipAddress,
      parentTokenId: refreshToken._id,
    })

    // Generate new access token (simplified - in production use proper JWT)
    const accessToken = generateAccessToken(refreshToken.userId, refreshToken.sessionId)
    const accessTokenExpiresAt = Date.now() + (15 * 60 * 1000) // 15 minutes

    // Update session with new token info
    await ctx.db.patch(refreshToken.sessionId, {
      lastRefreshedAt: Date.now(),
      currentRefreshTokenId: newRefreshTokenId,
    })

    // Log successful rotation
    await ctx.db.insert("auditLogs", {
      userId: refreshToken.userId,
      sessionId: refreshToken.sessionId,
      action: "refresh_token_rotated",
      ipAddress: args.ipAddress || "unknown",
      userAgent: args.userAgent,
      timestamp: Date.now(),
      success: true,
      metadata: {
        oldTokenId: refreshToken._id,
        newTokenId: newRefreshTokenId,
      },
    })

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken: newToken,
      refreshTokenExpiresAt: expiresAt,
      tokenType: "Bearer",
    }
  },
})

/**
 * Revoke a specific refresh token
 */
export const revokeRefreshToken = mutation({
  args: {
    refreshToken: v.string(),
    reason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hashedToken = hashRefreshToken(args.refreshToken)
    
    const refreshToken = await ctx.db
      .query("refreshTokens")
      .withIndex("by_token_hash", q => q.eq("tokenHash", hashedToken))
      .first()

    if (!refreshToken) {
      throw new Error("Refresh token not found")
    }

    await ctx.db.patch(refreshToken._id, { 
      revokedAt: Date.now(),
      revokeReason: args.reason || "manual_revocation",
    })

    await ctx.db.insert("auditLogs", {
      userId: refreshToken.userId,
      sessionId: refreshToken.sessionId,
      action: "refresh_token_revoked",
      ipAddress: args.ipAddress || "unknown",
      timestamp: Date.now(),
      success: true,
      metadata: {
        refreshTokenId: refreshToken._id,
        reason: args.reason,
      },
    })

    return { success: true }
  },
})

/**
 * Revoke all refresh tokens for a session
 */
async function revokeAllSessionTokens(ctx: any, sessionId: string) {
  const tokens = await ctx.db
    .query("refreshTokens")
    .withIndex("by_session", q => q.eq("sessionId", sessionId))
    .collect()

  for (const token of tokens) {
    if (!token.revokedAt) {
      await ctx.db.patch(token._id, { 
        revokedAt: Date.now(),
        revokeReason: "session_revoked",
      })
    }
  }

  // Also invalidate the session
  await ctx.db.patch(sessionId, { 
    status: "revoked" as const,
    revokedAt: Date.now(),
  })
}

/**
 * Clean up expired refresh tokens
 */
export const cleanupExpiredRefreshTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const expiredTokens = await ctx.db
      .query("refreshTokens")
      .filter(q => q.and(
        q.lt(q.field("expiresAt"), Date.now()),
        q.eq(q.field("revokedAt"), null)
      ))
      .collect()

    let cleaned = 0
    for (const token of expiredTokens) {
      await ctx.db.patch(token._id, { 
        revokedAt: Date.now(),
        revokeReason: "expired",
      })
      cleaned++
    }

    return { cleaned }
  },
})

/**
 * Generate access token (simplified - use proper JWT in production)
 */
function generateAccessToken(userId: string, sessionId: string): string {
  const payload = {
    userId,
    sessionId,
    iat: Date.now(),
    exp: Date.now() + (15 * 60 * 1000), // 15 minutes
  }
  
  // In production, use proper JWT signing
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

/**
 * Get all active refresh tokens for a user (for security dashboard)
 */
export const getUserRefreshTokens = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("refreshTokens")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .filter(q => q.eq(q.field("revokedAt"), null))
      .collect()

    return tokens.map(token => ({
      id: token._id,
      sessionId: token.sessionId,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.usedAt,
      deviceFingerprint: token.deviceFingerprint,
      ipAddress: token.ipAddress,
    }))
  },
})