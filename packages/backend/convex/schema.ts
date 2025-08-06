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
    userSessionId: v.optional(v.id("sessions")), // Links to actual user session after auth
    userEmail: v.string(),
    walletAddress: v.string(),
    // Status tracking
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("expired"), v.literal("revoked")),
    revokedAt: v.optional(v.number()),
    currentRefreshTokenId: v.optional(v.id("refreshTokens")),
    lastRefreshedAt: v.optional(v.number()),
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
    mfaEnabled: v.boolean(),
    mfaMethod: v.optional(v.union(v.literal("totp"), v.literal("sms"), v.literal("email"))),
    
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
    sessionId: v.optional(v.union(v.id("authSessions"), v.id("sessions"))),
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

  // Enhanced refresh tokens with rotation support
  refreshTokens: defineTable({
    sessionId: v.union(v.id("authSessions"), v.id("sessions")),
    userId: v.id("users"),
    tokenHash: v.string(), // SHA-256 hash of actual token
    expiresAt: v.number(),
    createdAt: v.number(),
    usedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokeReason: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastUsedIp: v.optional(v.string()),
    parentTokenId: v.optional(v.id("refreshTokens")), // For token rotation chain
  }).index("by_token_hash", ["tokenHash"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_expires", ["expiresAt"]),

  // Multi-factor authentication configurations
  mfaConfigurations: defineTable({
    userId: v.id("users"),
    method: v.union(v.literal("totp"), v.literal("sms"), v.literal("email")),
    secret: v.optional(v.string()), // Encrypted TOTP secret
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isEnabled: v.boolean(),
    backupCodes: v.array(v.object({
      code: v.string(), // Hashed backup code
      used: v.boolean(),
      usedAt: v.optional(v.number()),
    })),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    disabledAt: v.optional(v.number()),
    backupCodesRegeneratedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_method", ["method"])
    .index("by_enabled", ["isEnabled"]),

  // Security events for monitoring threats
  securityEvents: defineTable({
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.union(v.id("authSessions"), v.id("sessions"))),
    eventType: v.union(
      v.literal("suspicious_login"),
      v.literal("multiple_failures"),
      v.literal("token_reuse"),
      v.literal("device_change"),
      v.literal("location_change"),
      v.literal("brute_force_attempt"),
      v.literal("account_lockout")
    ),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    description: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
  }).index("by_user", ["userId"])
    .index("by_severity", ["severity"])
    .index("by_timestamp", ["timestamp"])
    .index("by_resolved", ["resolved"]),

  // Crossmint Smart Wallets integration
  smartWallets: defineTable({
    userId: v.id("users"),
    crossmintId: v.string(),
    walletAddress: v.string(),
    walletType: v.union(v.literal("custodial"), v.literal("non-custodial"), v.literal("smart-wallet")),
    chainId: v.string(), // Blockchain network identifier
    isActive: v.boolean(),
    metadata: v.object({
      walletProvider: v.optional(v.string()),
      creationMethod: v.optional(v.string()),
      smartContractAddress: v.optional(v.string()),
    }),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    deactivatedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_crossmint_id", ["crossmintId"])
    .index("by_wallet_address", ["walletAddress"])
    .index("by_active", ["isActive"]),

  // Wallet transaction tracking for audit purposes
  walletTransactions: defineTable({
    userId: v.id("users"),
    smartWalletId: v.id("smartWallets"),
    transactionHash: v.string(),
    transactionType: v.union(
      v.literal("send"),
      v.literal("receive"),
      v.literal("mint"),
      v.literal("burn"),
      v.literal("swap"),
      v.literal("stake"),
      v.literal("unstake")
    ),
    amount: v.string(), // String to handle big numbers
    tokenAddress: v.optional(v.string()),
    tokenSymbol: v.optional(v.string()),
    fromAddress: v.string(),
    toAddress: v.string(),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed")),
    blockNumber: v.optional(v.number()),
    gasUsed: v.optional(v.string()),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_user", ["userId"])
    .index("by_wallet", ["smartWalletId"])
    .index("by_hash", ["transactionHash"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"]),

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
