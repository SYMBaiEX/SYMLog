import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { DB_OPERATIONS, EXPIRY_TIMES, TIME_CONSTANTS } from './constants';

// Auth sessions have a short expiry (5 minutes) for security,
// but cleanup runs daily to avoid excessive database operations.
// Expired sessions are automatically ignored when queried.

export const storeAuthCode = mutation({
  args: {
    authCode: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (!args.authCode || args.authCode.trim().length === 0) {
      throw new Error('Auth code is required');
    }
    if (!args.userId || args.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
    if (!(args.userEmail && args.userEmail.includes('@'))) {
      throw new Error('Valid email is required');
    }
    if (!args.walletAddress || args.walletAddress.trim().length === 0) {
      throw new Error('Wallet address is required');
    }
    const now = Date.now();
    const expiresAt = now + EXPIRY_TIMES.AUTH_CODE;

    // Check if auth code already exists
    const existing = await ctx.db
      .query('authSessions')
      .withIndex('by_auth_code', (q) => q.eq('authCode', args.authCode))
      .first();

    if (existing) {
      // Update existing record - log this for security monitoring
      console.log('Auth code update detected', {
        previousUserId: existing.userId,
        newUserId: args.userId,
        timestamp: now,
      });

      await ctx.db.patch(existing._id, {
        userId: args.userId,
        userEmail: args.userEmail,
        walletAddress: args.walletAddress,
        expiresAt,
        status: 'pending',
      });
    } else {
      // Create new record
      await ctx.db.insert('authSessions', {
        authCode: args.authCode,
        userId: args.userId,
        userEmail: args.userEmail,
        walletAddress: args.walletAddress,
        status: 'pending',
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
      .query('authSessions')
      .withIndex('by_auth_code', (q) => q.eq('authCode', args.authCode))
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
    // Validate input
    if (!args.authCode || args.authCode.trim().length === 0) {
      throw new Error('Auth code is required');
    }
    const session = await ctx.db
      .query('authSessions')
      .withIndex('by_auth_code', (q) => q.eq('authCode', args.authCode))
      .first();

    if (!session) {
      return { success: false, reason: 'session_not_found' };
    }

    const now = Date.now();

    // Check if expired
    if (session.expiresAt < now) {
      await ctx.db.patch(session._id, { status: 'expired' });
      return { success: false, reason: 'session_expired' };
    }

    // Check if already used
    if (session.status === 'completed') {
      return { success: false, reason: 'session_already_used' };
    }

    // Mark as used
    await ctx.db.patch(session._id, {
      status: 'completed',
      usedAt: now,
    });

    return { success: true };
  },
});

export const cleanupExpiredAuthSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - EXPIRY_TIMES.EXPIRED_SESSION_CLEANUP; // 24 hours old
    let deletedCount = 0;

    // Process expired sessions in batches
    let hasMoreExpired = true;
    while (hasMoreExpired) {
      const expired = await ctx.db
        .query('authSessions')
        .filter((q) =>
          q.and(
            q.lt(q.field('expiresAt'), cutoffTime),
            q.neq(q.field('status'), 'completed')
          )
        )
        .take(DB_OPERATIONS.BATCH_SIZE);

      if (expired.length === 0) {
        hasMoreExpired = false;
        break;
      }

      for (const session of expired) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }

      if (expired.length < DB_OPERATIONS.BATCH_SIZE) {
        hasMoreExpired = false;
      }
    }

    // Also clean up completed sessions older than 1 day for security
    const oneDayAgo = now - EXPIRY_TIMES.COMPLETED_SESSION_RETENTION;
    let hasMoreCompleted = true;
    while (hasMoreCompleted) {
      const oldCompleted = await ctx.db
        .query('authSessions')
        .filter((q) =>
          q.and(
            q.eq(q.field('status'), 'completed'),
            q.lt(q.field('createdAt'), oneDayAgo)
          )
        )
        .take(DB_OPERATIONS.BATCH_SIZE);

      if (oldCompleted.length === 0) {
        hasMoreCompleted = false;
        break;
      }

      for (const session of oldCompleted) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }

      if (oldCompleted.length < DB_OPERATIONS.BATCH_SIZE) {
        hasMoreCompleted = false;
      }
    }

    return { deletedCount };
  },
});
