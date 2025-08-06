import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { createHash } from "crypto"

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
 * Verify PKCE challenge (server-side) - Production implementation
 */
async function verifyPKCEChallenge(verifier: string, challenge: string): Promise<boolean> {
  try {
    // Verify verifier length (43-128 characters per RFC 7636)
    if (verifier.length < 43 || verifier.length > 128) {
      return false
    }
    
    // Verify verifier contains only allowed characters
    const allowedChars = /^[A-Za-z0-9._~-]+$/
    if (!allowedChars.test(verifier)) {
      return false
    }
    
    // Create SHA-256 hash of verifier
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    
    // Convert to base64url (no padding)
    const hashArray = new Uint8Array(hashBuffer)
    let binary = ''
    for (let i = 0; i < hashArray.byteLength; i++) {
      binary += String.fromCharCode(hashArray[i])
    }
    const computedChallenge = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    
    // Constant-time comparison to prevent timing attacks
    if (computedChallenge.length !== challenge.length) {
      return false
    }
    
    let result = 0
    for (let i = 0; i < computedChallenge.length; i++) {
      result |= computedChallenge.charCodeAt(i) ^ challenge.charCodeAt(i)
    }
    
    return result === 0
  } catch (error) {
    console.error('PKCE verification error:', error)
    return false
  }
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
    // Rate limiting check
    if (args.ipAddress) {
      const { checkRateLimit } = await import("./rateLimiting")
      await checkRateLimit(ctx, {
        key: args.ipAddress,
        action: "auth_code",
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

    // Create or get user
    const { createOrUpdateUser } = await import("./users")
    const userId = await createOrUpdateUser(ctx, {
      crossmintId: args.crossmintId,
      email: args.userEmail,
      walletAddress: args.walletAddress,
    })

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
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
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
    // Rate limiting check
    if (args.ipAddress) {
      const { checkRateLimit } = await import("./rateLimiting")
      await checkRateLimit(ctx, {
        key: args.ipAddress,
        action: "login",
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
        timestamp: Date.now(),
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
        timestamp: Date.now(),
        success: false,
        errorMessage: "PKCE verification failed",
      })
      throw new Error("PKCE verification failed - invalid code verifier")
    }

    // Check if expired
    if (session.expiresAt < Date.now()) {
      await ctx.db.patch(session._id, { status: "expired" as const })
      
      await ctx.db.insert("auditLogs", {
        userId: session.userId,
        action: "auth_code_expired",
        ipAddress: args.ipAddress || "unknown",
        timestamp: Date.now(),
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
        timestamp: Date.now(),
        success: false,
        errorMessage: "Authentication code already used",
      })
      
      throw new Error("Authentication code has already been used")
    }

    // Create user session with tokens
    const { createSession } = await import("./sessions")
    const userSession = await createSession(ctx, {
      userId: session.userId!,
      deviceId: args.deviceId || "unknown",
      deviceName: args.deviceName,
      deviceType: args.deviceType || "web",
      platform: args.platform || "unknown",
      userAgent: args.userAgent,
      ipAddress: args.ipAddress || session.ipAddress || "unknown",
    })

    // Mark auth session as completed
    await ctx.db.patch(session._id, {
      status: "completed" as const,
      usedAt: Date.now(),
      userSessionId: userSession.sessionId,
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
      timestamp: Date.now(),
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
        await ctx.db.patch(session._id, { status: "expired" })
      }
    }

    return expiredSessions.length
  },
})