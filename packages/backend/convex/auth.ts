import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Authentication session schema
export const createAuthSession = mutation({
  args: {
    authCode: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
    expiresAt: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('expired')
    ),
  },
  handler: async (ctx, args) => {
    // Check if code already exists
    const existing = await ctx.db
      .query('authSessions')
      .filter((q) => q.eq(q.field('authCode'), args.authCode))
      .first();

    if (existing) {
      throw new Error('Auth code already exists');
    }

    // Create new auth session
    const sessionId = await ctx.db.insert('authSessions', {
      ...args,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

export const updateAuthSession = mutation({
  args: {
    authCode: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('expired')
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('authSessions')
      .filter((q) => q.eq(q.field('authCode'), args.authCode))
      .first();

    if (!session) {
      throw new Error('Auth session not found');
    }

    await ctx.db.patch(session._id, {
      status: args.status,
      ...(args.status === 'completed' && { usedAt: Date.now() }),
    });

    return session._id;
  },
});

export const getAuthSession = query({
  args: {
    authCode: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('authSessions')
      .filter((q) => q.eq(q.field('authCode'), args.authCode))
      .first();

    if (!session) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  },
});

export const validateAuthCode = mutation({
  args: {
    authCode: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('authSessions')
      .filter((q) => q.eq(q.field('authCode'), args.authCode))
      .first();

    if (!session) {
      throw new Error('Invalid authentication code');
    }

    // Check if expired
    if (session.expiresAt < Date.now()) {
      await ctx.db.patch(session._id, { status: 'expired' });
      throw new Error('Authentication code has expired');
    }

    // Check if already used
    if (session.status === 'completed') {
      throw new Error('Authentication code has already been used');
    }

    // Mark as completed
    await ctx.db.patch(session._id, {
      status: 'completed',
      usedAt: Date.now(),
    });

    return {
      userId: session.userId,
      userEmail: session.userEmail,
      walletAddress: session.walletAddress,
    };
  },
});

// Clean up expired sessions (can be called periodically)
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const expiredSessions = await ctx.db
      .query('authSessions')
      .filter((q) => q.lt(q.field('expiresAt'), Date.now()))
      .collect();

    for (const session of expiredSessions) {
      if (session.status !== 'expired') {
        await ctx.db.patch(session._id, { status: 'expired' });
      }
    }

    return expiredSessions.length;
  },
});
