import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { DB_OPERATIONS, EXPIRY_TIMES, TIME_CONSTANTS } from './constants';

// Generate cryptographically secure random token
function generateSecureToken(): string {
  // Convex runtime supports crypto.getRandomValues for secure random generation
  // This is safe to use in Convex functions
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export const generateCSRFToken = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate input
    if (!args.userId || args.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
    // Generate a random token
    const token = generateSecureToken();

    const now = Date.now();
    const expiresAt = now + EXPIRY_TIMES.CSRF_TOKEN;

    // Store the token
    await ctx.db.insert('csrfTokens', {
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
      return { valid: false, reason: 'token_required' };
    }
    if (!args.userId || args.userId.trim().length === 0) {
      return { valid: false, reason: 'user_id_required' };
    }
    const now = Date.now();

    // Find the token
    const tokenRecord = await ctx.db
      .query('csrfTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    if (!tokenRecord) {
      return { valid: false, reason: 'invalid_token' };
    }

    // Check if expired
    if (tokenRecord.expiresAt < now) {
      await ctx.db.delete(tokenRecord._id);
      return { valid: false, reason: 'invalid_token' };
    }

    // Check if already used
    if (tokenRecord.used) {
      return { valid: false, reason: 'invalid_token' };
    }

    // Check if token belongs to the user
    if (tokenRecord.userId !== args.userId) {
      return { valid: false, reason: 'invalid_token' };
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
    let deletedCount = 0;

    // Process expired tokens in batches
    let hasMoreExpired = true;
    while (hasMoreExpired) {
      const expired = await ctx.db
        .query('csrfTokens')
        .withIndex('by_expiry', (q) => q.lte('expiresAt', now))
        .take(DB_OPERATIONS.BATCH_SIZE);

      if (expired.length === 0) {
        hasMoreExpired = false;
        break;
      }

      for (const token of expired) {
        await ctx.db.delete(token._id);
        deletedCount++;
      }

      if (expired.length < DB_OPERATIONS.BATCH_SIZE) {
        hasMoreExpired = false;
      }
    }

    // Also clean up used tokens older than 1 hour in batches
    const oneHourAgo = now - TIME_CONSTANTS.HOUR;
    let hasMoreUsed = true;
    while (hasMoreUsed) {
      const usedTokens = await ctx.db
        .query('csrfTokens')
        .filter((q) =>
          q.and(
            q.eq(q.field('used'), true),
            q.lt(q.field('expiresAt'), oneHourAgo)
          )
        )
        .take(DB_OPERATIONS.BATCH_SIZE);

      if (usedTokens.length === 0) {
        hasMoreUsed = false;
        break;
      }

      for (const token of usedTokens) {
        await ctx.db.delete(token._id);
        deletedCount++;
      }

      if (usedTokens.length < DB_OPERATIONS.BATCH_SIZE) {
        hasMoreUsed = false;
      }
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
      .query('csrfTokens')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gt(q.field('expiresAt'), now))
      .collect();

    return tokens.map((t) => ({
      token: t.token,
      expiresAt: t.expiresAt,
      used: t.used,
    }));
  },
});
