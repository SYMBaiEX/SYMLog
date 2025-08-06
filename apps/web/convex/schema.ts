import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  
  authSessions: defineTable({
    authCode: v.string(),
    // PKCE fields (mandatory for OAuth 2.1)
    codeChallenge: v.string(),
    codeChallengeMethod: v.literal("S256"),
    // User linkage
    userId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("expired")),
    // Security metadata
    deviceFingerprint: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_auth_code", ["authCode"]),

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
    action: v.string(), // login, logout, token_refresh, auth_failed, etc
    ipAddress: v.string(),
    timestamp: v.number(),
    success: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  }),

  // User accounts
  users: defineTable({
    crossmintId: v.string(),
    email: v.string(),
    walletAddress: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    twoFactorEnabled: v.optional(v.boolean()),
    passkeysEnabled: v.optional(v.boolean()),
    mfaEnabled: v.optional(v.boolean()),
    mfaMethod: v.optional(v.string()),
    preferences: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    loginCount: v.optional(v.number()),
  }).index("by_crossmint_id", ["crossmintId"])
    .index("by_email", ["email"]),

  // User sessions
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // User passkeys
  passkeys: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
