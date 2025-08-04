import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Auth code expiry time (5 minutes)
const AUTH_CODE_EXPIRY = 5 * 60 * 1000;

export const storeAuthCode = mutation({
  args: {
    authCode: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + AUTH_CODE_EXPIRY;

    // Check if auth code already exists
    const existing = await ctx.db
      .query("authSessions")
      .withIndex("by_auth_code", (q) => q.eq("authCode", args.authCode))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        userEmail: args.userEmail,
        walletAddress: args.walletAddress,
        expiresAt,
        status: "pending",
      });
    } else {
      // Create new record
      await ctx.db.insert("authSessions", {
        authCode: args.authCode,
        userId: args.userId,
        userEmail: args.userEmail,
        walletAddress: args.walletAddress,
        status: "pending",
        createdAt: now,
        expiresAt,
      });
    }

    return { success: true, expiresAt };
  },
});

export const getAuthSession = query({
  args: {
    authCode: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_auth_code", (q) => q.eq("authCode", args.authCode))
      .first();

    if (!session) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (session.expiresAt < now) {
      return null;
    }

    return {
      userId: session.userId,
      userEmail: session.userEmail,
      walletAddress: session.walletAddress,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  },
});

export const markAuthCodeUsed = mutation({
  args: {
    authCode: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_auth_code", (q) => q.eq("authCode", args.authCode))
      .first();

    if (!session) {
      return { success: false, reason: "session_not_found" };
    }

    const now = Date.now();

    // Check if expired
    if (session.expiresAt < now) {
      await ctx.db.patch(session._id, { status: "expired" });
      return { success: false, reason: "session_expired" };
    }

    // Check if already used
    if (session.status === "completed") {
      return { success: false, reason: "session_already_used" };
    }

    // Mark as used
    await ctx.db.patch(session._id, {
      status: "completed",
      usedAt: now,
    });

    return { success: true };
  },
});

export const cleanupExpiredAuthSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours old

    // Find expired sessions older than 24 hours
    const expired = await ctx.db
      .query("authSessions")
      .filter((q) => 
        q.and(
          q.lt(q.field("expiresAt"), cutoffTime),
          q.neq(q.field("status"), "completed")
        )
      )
      .collect();

    let deletedCount = 0;
    for (const session of expired) {
      await ctx.db.delete(session._id);
      deletedCount++;
    }

    // Also clean up completed sessions older than 7 days
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oldCompleted = await ctx.db
      .query("authSessions")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "completed"),
          q.lt(q.field("createdAt"), sevenDaysAgo)
        )
      )
      .collect();

    for (const session of oldCompleted) {
      await ctx.db.delete(session._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});