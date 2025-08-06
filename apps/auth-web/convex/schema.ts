import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  
  // Enhanced auth sessions with PKCE support (OAuth 2.1 compliant)
  authSessions: defineTable({
    authCode: v.string(),
    // PKCE fields (mandatory for OAuth 2.1)
    codeChallenge: v.string(),
    codeChallengeMethod: v.literal("S256"), // SHA-256 only for security
    // User linkage
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("sessions")),
    userEmail: v.string(),
    walletAddress: v.string(),
    // Status tracking
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("expired")),
    // Security metadata
    deviceFingerprint: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_auth_code", ["authCode"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  // User accounts for persistent authentication
  users: defineTable({
    // Identity
    crossmintId: v.string(),
    email: v.string(),
    walletAddress: v.optional(v.string()),
    
    // Profile
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    
    // Security
    emailVerified: v.boolean(),
    twoFactorEnabled: v.boolean(),
    passkeysEnabled: v.boolean(),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    lastLoginAt: v.number(),
    loginCount: v.number(),
    
    // Preferences
    preferences: v.optional(v.object({
      theme: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
      language: v.optional(v.string()),
    }))
  }).index("by_crossmint_id", ["crossmintId"])
    .index("by_email", ["email"])
    .index("by_wallet", ["walletAddress"]),

  // Session management with refresh tokens
  sessions: defineTable({
    userId: v.id("users"),
    
    // Tokens
    accessToken: v.string(), // JWT, 15 min expiry
    refreshToken: v.string(), // Opaque token, 30 days
    accessTokenExpiresAt: v.number(),
    refreshTokenExpiresAt: v.number(),
    
    // Device Information
    deviceId: v.string(),
    deviceName: v.optional(v.string()),
    deviceType: v.string(), // desktop, mobile, web
    platform: v.string(), // windows, macos, linux, ios, android
    userAgent: v.optional(v.string()),
    ipAddress: v.string(),
    
    // Security Status
    isActive: v.boolean(),
    revokedAt: v.optional(v.number()),
    revokedReason: v.optional(v.string()),
    
    // Timestamps
    createdAt: v.number(),
    lastActivityAt: v.number(),
    refreshedAt: v.optional(v.number()),
  }).index("by_access_token", ["accessToken"])
    .index("by_refresh_token", ["refreshToken"])
    .index("by_user", ["userId"])
    .index("by_device", ["deviceId"])
    .index("by_active", ["isActive"]),

  // Rate limiting for security
  rateLimits: defineTable({
    key: v.string(), // IP address or userId
    action: v.string(), // login, refresh, auth_code, etc
    attempts: v.number(),
    windowStart: v.number(),
    blockedUntil: v.optional(v.number()),
  }).index("by_key_action", ["key", "action"])
    .index("by_window", ["windowStart"]),

  // Audit logs for security and compliance
  auditLogs: defineTable({
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("sessions")),
    action: v.string(), // login, logout, token_refresh, auth_failed, etc
    resource: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"])
    .index("by_session", ["sessionId"]),

  // Passkey credentials (for future WebAuthn support)
  passkeys: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    counter: v.number(),
    deviceType: v.optional(v.string()),
    backupEligible: v.boolean(),
    backupState: v.boolean(),
  }).index("by_user", ["userId"])
    .index("by_credential", ["credentialId"]),
});
