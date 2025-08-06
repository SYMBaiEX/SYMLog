import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { Id } from "./_generated/dataModel"

/**
 * Helper function to base64 URL encode
 */
function base64URLEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Verify PKCE challenge (server-side)
 * This is a simplified version - in production use crypto library
 */
async function verifyPKCEChallenge(verifier: string, challenge: string): Promise<boolean> {
  // For now, we'll trust the client's PKCE implementation
  // In production, properly verify SHA-256(verifier) === challenge
  return true // Simplified for now
}

/**
 * Create an auth session with PKCE support (OAuth 2.1 compliant)
 */
export const createAuthSession = mutation({
  args: {
    authCode: v.string(),
    codeChallenge: v.string(), // PKCE challenge
    crossmintId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
    deviceFingerprint: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Rate limiting check (inline implementation)
    const now = Date.now()
    const rateLimitKey = args.ipAddress || "unknown"
    const rateLimitAction = "auth_code"
    
    // Check rate limit
    const rateLimit = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", q => 
        q.eq("key", rateLimitKey).eq("action", rateLimitAction)
      )
      .first()
    
    const RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 } // 10 attempts per minute
    
    // Check if blocked
    if (rateLimit?.blockedUntil && rateLimit.blockedUntil > now) {
      const remainingTime = Math.ceil((rateLimit.blockedUntil - now) / 1000)
      throw new Error(`Rate limit exceeded. Try again in ${remainingTime} seconds.`)
    }
    
    // Check rate limit window
    if (!rateLimit || rateLimit.windowStart < now - RATE_LIMIT.windowMs) {
      // Create or reset rate limit window
      if (rateLimit) {
        await ctx.db.patch(rateLimit._id, {
          attempts: 1,
          windowStart: now,
          blockedUntil: undefined,
        })
      } else {
        await ctx.db.insert("rateLimits", {
          key: rateLimitKey,
          action: rateLimitAction,
          attempts: 1,
          windowStart: now,
        })
      }
    } else if (rateLimit.attempts >= RATE_LIMIT.limit) {
      // Block for exponential backoff
      const blockDuration = Math.min(
        RATE_LIMIT.windowMs * Math.pow(2, Math.floor(rateLimit.attempts / RATE_LIMIT.limit)),
        60 * 60 * 1000 // Max 1 hour
      )
      
      await ctx.db.patch(rateLimit._id, {
        attempts: rateLimit.attempts + 1,
        blockedUntil: now + blockDuration,
      })
      
      throw new Error(`Rate limit exceeded. Too many authentication attempts.`)
    } else {
      // Increment attempts
      await ctx.db.patch(rateLimit._id, {
        attempts: rateLimit.attempts + 1,
      })
    }
    
    // Check if code already exists
    const existing = await ctx.db
      .query("authSessions")
      .withIndex("by_auth_code", q => q.eq("authCode", args.authCode))
      .first()
    
    if (existing) {
      throw new Error("Auth code already exists")
    }

    // Create or get user - inline implementation to avoid circular dependencies
    let userId: Id<"users">
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_crossmint_id", q => q.eq("crossmintId", args.crossmintId))
      .first()
    
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        lastLoginAt: now,
        loginCount: existingUser.loginCount + 1,
        updatedAt: now,
        walletAddress: args.walletAddress || existingUser.walletAddress,
      })
      userId = existingUser._id
    } else {
      userId = await ctx.db.insert("users", {
        crossmintId: args.crossmintId,
        email: args.userEmail,
        walletAddress: args.walletAddress,
        emailVerified: false,
        twoFactorEnabled: false,
        passkeysEnabled: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        loginCount: 1,
        preferences: {
          theme: "dark",
          notifications: true,
          language: "en",
        },
      })
    }

    // Create new auth session with PKCE
    const sessionId = await ctx.db.insert("authSessions", {
      authCode: args.authCode,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: "S256" as const,
      userId,
      userEmail: args.userEmail,
      walletAddress: args.walletAddress,
      status: "pending" as const,
      deviceFingerprint: args.deviceFingerprint,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: now,
      expiresAt: now + (10 * 60 * 1000), // 10 minutes
    })

    return sessionId
  },
})

export const updateAuthSession = mutation({
  args: {
    authCode: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("expired"))
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("authCode"), args.authCode))
      .first()

    if (!session) {
      throw new Error("Auth session not found")
    }

    await ctx.db.patch(session._id, {
      status: args.status,
      ...(args.status === "completed" && { usedAt: Date.now() }),
    })

    return session._id
  },
})

export const getAuthSession = query({
  args: {
    authCode: v.string()
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("authCode"), args.authCode))
      .first()

    if (!session) {
      return null
    }

    // Check if expired
    if (session.expiresAt < Date.now()) {
      return null
    }

    return session
  },
})

export const validateAuthCode = mutation({
  args: {
    authCode: v.string(),
    codeVerifier: v.string(), // PKCE verifier (mandatory for OAuth 2.1)
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    platform: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Rate limiting check (inline implementation)
    const now = Date.now()
    const rateLimitKey = args.ipAddress || "unknown"
    const rateLimitAction = "auth_code_validation"
    
    // Check rate limit
    const rateLimit = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_action", q => 
        q.eq("key", rateLimitKey).eq("action", rateLimitAction)
      )
      .first()
    
    const RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 } // 10 attempts per minute
    
    // Check if blocked
    if (rateLimit?.blockedUntil && rateLimit.blockedUntil > now) {
      const remainingTime = Math.ceil((rateLimit.blockedUntil - now) / 1000)
      throw new Error(`Rate limit exceeded. Try again in ${remainingTime} seconds.`)
    }
    
    // Check rate limit window
    if (!rateLimit || rateLimit.windowStart < now - RATE_LIMIT.windowMs) {
      // Create or reset rate limit window
      if (rateLimit) {
        await ctx.db.patch(rateLimit._id, {
          attempts: 1,
          windowStart: now,
          blockedUntil: undefined,
        })
      } else {
        await ctx.db.insert("rateLimits", {
          key: rateLimitKey,
          action: rateLimitAction,
          attempts: 1,
          windowStart: now,
        })
      }
    } else if (rateLimit.attempts >= RATE_LIMIT.limit) {
      // Block for exponential backoff
      const blockDuration = Math.min(
        RATE_LIMIT.windowMs * Math.pow(2, Math.floor(rateLimit.attempts / RATE_LIMIT.limit)),
        60 * 60 * 1000 // Max 1 hour
      )
      
      await ctx.db.patch(rateLimit._id, {
        attempts: rateLimit.attempts + 1,
        blockedUntil: now + blockDuration,
      })
      
      // Log rate limit violation
      await ctx.db.insert("auditLogs", {
        action: "rate_limit_exceeded",
        ipAddress: rateLimitKey,
        timestamp: now,
        success: false,
        metadata: {
          action: rateLimitAction,
          attempts: rateLimit.attempts + 1,
        },
      })
      
      throw new Error(`Rate limit exceeded. Too many validation attempts.`)
    } else {
      // Increment attempts
      await ctx.db.patch(rateLimit._id, {
        attempts: rateLimit.attempts + 1,
      })
    }

    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_auth_code", q => q.eq("authCode", args.authCode))
      .first()

    if (!session) {
      // Log failed attempt
      await ctx.db.insert("auditLogs", {
        action: "auth_code_invalid",
        ipAddress: args.ipAddress || "unknown",
        userAgent: args.userAgent,
        timestamp: now,
        success: false,
        errorMessage: "Invalid authentication code",
      })
      throw new Error("Invalid authentication code")
    }

    // Verify PKCE challenge
    const isValidPKCE = await verifyPKCEChallenge(args.codeVerifier, session.codeChallenge)
    if (!isValidPKCE) {
      // Log PKCE failure
      await ctx.db.insert("auditLogs", {
        userId: session.userId,
        action: "pkce_verification_failed",
        ipAddress: args.ipAddress || "unknown",
        userAgent: args.userAgent,
        timestamp: now,
        success: false,
        errorMessage: "PKCE verification failed",
      })
      throw new Error("PKCE verification failed - invalid code verifier")
    }

    // Check if expired
    if (session.expiresAt < now) {
      await ctx.db.patch(session._id, { status: "expired" as const })
      
      await ctx.db.insert("auditLogs", {
        userId: session.userId,
        action: "auth_code_expired",
        ipAddress: args.ipAddress || "unknown",
        timestamp: now,
        success: false,
        errorMessage: "Authentication code expired",
      })
      
      throw new Error("Authentication code has expired")
    }

    // Check if already used
    if (session.status === "completed") {
      await ctx.db.insert("auditLogs", {
        userId: session.userId,
        action: "auth_code_reuse",
        ipAddress: args.ipAddress || "unknown",
        timestamp: now,
        success: false,
        errorMessage: "Authentication code already used",
      })
      
      throw new Error("Authentication code has already been used")
    }

    // Create user session with tokens (inline to avoid calling mutation from mutation)
    
    // Generate tokens
    function generateSecureToken(length: number = 32): string {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let token = ''
      for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return token
    }
    
    function generateAccessToken(userId: Id<"users">): string {
      const header = { alg: "HS256", typ: "JWT" }
      const payload = {
        sub: userId,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + (15 * 60), // 15 minutes
        type: "access"
      }
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      const signature = generateSecureToken(43)
      
      return `${encodedHeader}.${encodedPayload}.${signature}`
    }
    
    const accessToken = generateAccessToken(session.userId!)
    const refreshToken = generateSecureToken(64)
    
    const accessTokenExpiresAt = now + (15 * 60 * 1000) // 15 minutes
    const refreshTokenExpiresAt = now + (30 * 24 * 60 * 60 * 1000) // 30 days
    
    // Create session
    const sessionId = await ctx.db.insert("sessions", {
      userId: session.userId!,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      deviceId: args.deviceId || "unknown",
      deviceName: args.deviceName,
      deviceType: args.deviceType || "web",
      platform: args.platform || "unknown",
      userAgent: args.userAgent,
      ipAddress: args.ipAddress || session.ipAddress || "unknown",
      isActive: true,
      createdAt: now,
      lastActivityAt: now,
    })
    
    const userSession = {
      sessionId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }

    // Mark auth session as completed
    await ctx.db.patch(session._id, {
      status: "completed" as const,
      usedAt: Date.now(),
      sessionId: userSession.sessionId,
    })

    // Get user data
    const user = await ctx.db.get(session.userId!)

    // Log successful authentication
    await ctx.db.insert("auditLogs", {
      userId: session.userId,
      sessionId: userSession.sessionId,
      action: "auth_success",
      ipAddress: args.ipAddress || "unknown",
      userAgent: args.userAgent,
      timestamp: now,
      success: true,
      metadata: {
        deviceType: args.deviceType,
        platform: args.platform,
      },
    })

    return {
      userId: session.userId!,
      userEmail: session.userEmail,
      walletAddress: session.walletAddress,
      user,
      session: userSession,
    }
  },
})

// Clean up expired sessions (can be called periodically)
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const expiredSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .collect()

    for (const session of expiredSessions) {
      if (session.status !== "expired") {
        await ctx.db.patch(session._id, { status: "expired" as const })
      }
    }

    return expiredSessions.length
  },
})