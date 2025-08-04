import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { randomBytes } from "crypto";

// CSRF token expiry time (24 hours)
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

export const generateCSRFToken = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate a random token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    const now = Date.now();
    const expiresAt = now + CSRF_TOKEN_EXPIRY;

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
    const oneHourAgo = now - (60 * 60 * 1000);
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