import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { EXPIRY_TIMES } from './constants';

interface TokenReservation {
  reserved: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  reservationId?: string;
}

/**
 * Atomically check and reserve tokens for a user
 * This prevents race conditions where multiple requests bypass limits
 */
export const reserveTokens = mutation({
  args: {
    userId: v.string(),
    estimatedTokens: v.number(), // Estimated tokens for this request
    maxDailyTokens: v.number(),
  },
  handler: async (ctx, args): Promise<TokenReservation> => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();

    // Get all token usage and reservations for today
    const usageRecords = await ctx.db
      .query('tokenUsage')
      .withIndex('by_user_and_date', (q) =>
        q.eq('userId', args.userId).gte('timestamp', dayStart)
      )
      .collect();

    // Calculate total usage including both completed and reserved tokens
    let totalUsage = 0;
    let totalReserved = 0;

    for (const record of usageRecords) {
      if (record.status === 'completed') {
        totalUsage += record.actualTokens;
      } else if (record.status === 'reserved' && record.expiresAt > now) {
        // Only count non-expired reservations
        totalReserved += record.estimatedTokens;
      }
    }

    const currentTotal = totalUsage + totalReserved;
    const remaining = args.maxDailyTokens - currentTotal;
    const canReserve = remaining >= args.estimatedTokens;

    if (canReserve) {
      // Create a reservation
      const reservationId = await ctx.db.insert('tokenUsage', {
        userId: args.userId,
        timestamp: now,
        estimatedTokens: args.estimatedTokens,
        actualTokens: 0,
        status: 'reserved',
        expiresAt: now + EXPIRY_TIMES.TOKEN_RESERVATION, // 5 minutes
      });

      return {
        reserved: true,
        currentUsage: currentTotal,
        limit: args.maxDailyTokens,
        remaining: remaining - args.estimatedTokens,
        reservationId,
      };
    }

    return {
      reserved: false,
      currentUsage: currentTotal,
      limit: args.maxDailyTokens,
      remaining: Math.max(0, remaining),
    };
  },
});

/**
 * Update a token reservation with actual usage
 */
export const completeTokenReservation = mutation({
  args: {
    reservationId: v.id('tokenUsage'),
    actualTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== 'reserved') {
      throw new Error('Reservation already completed or cancelled');
    }

    // Update the reservation with actual usage
    await ctx.db.patch(args.reservationId, {
      actualTokens: args.actualTokens,
      status: 'completed',
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Cancel a token reservation (e.g., if request fails)
 */
export const cancelTokenReservation = mutation({
  args: {
    reservationId: v.id('tokenUsage'),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);

    if (!reservation || reservation.status !== 'reserved') {
      return { success: false };
    }

    await ctx.db.patch(args.reservationId, {
      status: 'cancelled',
      cancelledAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get current token usage for a user
 */
export const getTokenUsage = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();

    const usageRecords = await ctx.db
      .query('tokenUsage')
      .withIndex('by_user_and_date', (q) =>
        q.eq('userId', args.userId).gte('timestamp', dayStart)
      )
      .collect();

    let totalUsage = 0;
    let totalReserved = 0;
    let completedRequests = 0;

    for (const record of usageRecords) {
      if (record.status === 'completed') {
        totalUsage += record.actualTokens;
        completedRequests++;
      } else if (record.status === 'reserved' && record.expiresAt > now) {
        totalReserved += record.estimatedTokens;
      }
    }

    return {
      totalUsage,
      totalReserved,
      completedRequests,
      timestamp: now,
    };
  },
});

/**
 * Clean up expired reservations
 */
export const cleanupExpiredReservations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let cancelledCount = 0;

    // Find expired reservations
    const expired = await ctx.db
      .query('tokenUsage')
      .withIndex('by_status_and_expiry', (q) =>
        q.eq('status', 'reserved').lte('expiresAt', now)
      )
      .take(100);

    // Cancel them
    for (const reservation of expired) {
      await ctx.db.patch(reservation._id, {
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: 'expired',
      });
      cancelledCount++;
    }

    return { cancelledCount };
  },
});
