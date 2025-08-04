import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { EXPIRY_TIMES, TIME_CONSTANTS } from "./constants";

// Generate cryptographically secure random token
function generateSecureToken(): string {
  // Convex runtime supports crypto.getRandomValues for secure random generation
  // This is safe to use in Convex functions
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const generateCSRFToken = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate input
    if (!args.userId || args.userId.trim().length === 0) {
      throw new Error("User ID is required")
    }
    // Generate a random token
    const token = generateSecureToken();
    
    const now = Date.now();
    const expiresAt = now + EXPIRY_TIMES.CSRF_TOKEN;

    // Store the token
    await ctx.db.insert("csrfTokens", {
      token,
      userId: args.userId,
      expiresAt,
      used: false,
    });

    return { token, expiresAt };
  },
});

export const validateCSRFToken = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (!args.token || args.token.trim().length === 0) {
      return { valid: false, reason: "token_required" }
    }
    if (!args.userId || args.userId.trim().length === 0) {
      return { valid: false, reason: "user_id_required" }
    }
    const now = Date.now();

    // Find the token
    const tokenRecord = await ctx.db
      .query("csrfTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord) {
      return { valid: false, reason: "token_not_found" };
    }

    // Check if expired
    if (tokenRecord.expiresAt < now) {
      await ctx.db.delete(tokenRecord._id);
      return { valid: false, reason: "token_expired" };
    }

    // Check if already used
    if (tokenRecord.used) {
      return { valid: false, reason: "token_already_used" };
    }

    // Check if token belongs to the user
    if (tokenRecord.userId !== args.userId) {
      return { valid: false, reason: "token_user_mismatch" };
    }

    // Mark token as used (one-time use)
    await ctx.db.patch(tokenRecord._id, { used: true });

    return { valid: true };
  },
});

export const cleanupExpiredCSRFTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find all expired tokens
    const expired = await ctx.db
      .query("csrfTokens")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .collect();

    let deletedCount = 0;
    for (const token of expired) {
      await ctx.db.delete(token._id);
      deletedCount++;
    }

    // Also clean up used tokens older than 1 hour
    const oneHourAgo = now - TIME_CONSTANTS.HOUR;
    const usedTokens = await ctx.db
      .query("csrfTokens")
      .filter((q) => 
        q.and(
          q.eq(q.field("used"), true),
          q.lt(q.field("expiresAt"), oneHourAgo)
        )
      )
      .collect();

    for (const token of usedTokens) {
      await ctx.db.delete(token._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

export const getUserCSRFTokens = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const tokens = await ctx.db
      .query("csrfTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    return tokens.map(t => ({
      token: t.token,
      expiresAt: t.expiresAt,
      used: t.used,
    }));
  },
});