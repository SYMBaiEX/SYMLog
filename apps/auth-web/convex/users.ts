import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

/**
 * Create or update a user account
 * Called during authentication to ensure user record exists
 */
export const createOrUpdateUser = mutation({
  args: {
    crossmintId: v.string(),
    email: v.string(),
    walletAddress: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists by Crossmint ID
    const existing = await ctx.db
      .query("users")
      .withIndex("by_crossmint_id", q => q.eq("crossmintId", args.crossmintId))
      .first()
    
    if (existing) {
      // Update existing user
      await ctx.db.patch(existing._id, {
        lastLoginAt: Date.now(),
        loginCount: existing.loginCount + 1,
        updatedAt: Date.now(),
        ...(args.walletAddress && { walletAddress: args.walletAddress }),
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.avatarUrl && { avatarUrl: args.avatarUrl }),
      })
      
      // Log the login
      await ctx.db.insert("auditLogs", {
        userId: existing._id,
        action: "user_login",
        ipAddress: "unknown", // Will be populated from request context
        timestamp: Date.now(),
        success: true,
      })
      
      return existing._id
    }
    
    // Create new user
    const userId = await ctx.db.insert("users", {
      crossmintId: args.crossmintId,
      email: args.email,
      walletAddress: args.walletAddress,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      emailVerified: false,
      twoFactorEnabled: false,
      passkeysEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
      loginCount: 1,
      preferences: {
        theme: "dark",
        notifications: true,
        language: "en",
      },
    })
    
    // Log user creation
    await ctx.db.insert("auditLogs", {
      userId,
      action: "user_created",
      ipAddress: "unknown",
      timestamp: Date.now(),
      success: true,
      metadata: { email: args.email },
    })
    
    return userId
  },
})

/**
 * Get user by ID
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

/**
 * Get user by email
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email))
      .first()
  },
})

/**
 * Get user by Crossmint ID
 */
export const getUserByCrossmintId = query({
  args: { crossmintId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_crossmint_id", q => q.eq("crossmintId", args.crossmintId))
      .first()
  },
})

/**
 * Update user preferences
 */
export const updateUserPreferences = mutation({
  args: {
    userId: v.id("users"),
    preferences: v.object({
      theme: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
      language: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }
    
    await ctx.db.patch(args.userId, {
      preferences: {
        ...user.preferences,
        ...args.preferences,
      },
      updatedAt: Date.now(),
    })
    
    return { success: true }
  },
})

/**
 * Update user profile
 */
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    }
    
    if (args.displayName !== undefined) updates.displayName = args.displayName
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl
    if (args.bio !== undefined) updates.bio = args.bio
    
    await ctx.db.patch(args.userId, updates)
    
    // Log profile update
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "profile_updated",
      ipAddress: "unknown",
      timestamp: Date.now(),
      success: true,
    })
    
    return { success: true }
  },
})

/**
 * Enable two-factor authentication
 */
export const enableTwoFactor = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      twoFactorEnabled: true,
      updatedAt: Date.now(),
    })
    
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "2fa_enabled",
      ipAddress: "unknown",
      timestamp: Date.now(),
      success: true,
    })
    
    return { success: true }
  },
})

/**
 * Delete user account (GDPR compliance)
 */
export const deleteUserAccount = mutation({
  args: {
    userId: v.id("users"),
    confirmation: v.string(), // User must type "DELETE" to confirm
  },
  handler: async (ctx, args) => {
    if (args.confirmation !== "DELETE") {
      throw new Error("Invalid confirmation")
    }
    
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }
    
    // Delete all user sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect()
    
    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }
    
    // Delete all user passkeys
    const passkeys = await ctx.db
      .query("passkeys")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect()
    
    for (const passkey of passkeys) {
      await ctx.db.delete(passkey._id)
    }
    
    // Log account deletion
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "account_deleted",
      ipAddress: "unknown",
      timestamp: Date.now(),
      success: true,
      metadata: { email: user.email },
    })
    
    // Delete the user
    await ctx.db.delete(args.userId)
    
    return { success: true }
  },
})