/**
 * Convex-based CSRF token management
 * This module provides async versions of CSRF functions using Convex
 */

import type { NextRequest } from 'next/server';
import { api } from '../../../convex/_generated/api';
import { getConvexClient } from '../convex-client';

/**
 * Generate a CSRF token for a user (async version)
 */
export async function generateCSRFTokenAsync(userId: string): Promise<string> {
  const convex = getConvexClient();

  try {
    const result = await convex.mutation(api.csrf.generateCSRFToken, {
      userId,
    });

    return result.token;
  } catch (error) {
    console.error('Failed to generate CSRF token:', error);
    throw new Error('Failed to generate CSRF token');
  }
}

/**
 * Validate a CSRF token (async version)
 */
export async function validateCSRFTokenAsync(
  token: string | null,
  userId?: string
): Promise<boolean> {
  if (!token) return false;

  // For Convex, we need a userId
  if (!userId) {
    console.warn('validateCSRFTokenAsync requires userId for Convex storage');
    return false;
  }

  const convex = getConvexClient();

  try {
    const result = await convex.mutation(api.csrf.validateCSRFToken, {
      token,
      userId,
    });

    return result.valid;
  } catch (error) {
    console.error('Failed to validate CSRF token:', error);
    return false;
  }
}

/**
 * Get CSRF token from request (same as original, no async needed)
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Check header first (preferred)
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) return headerToken;

  // Check body for form submissions
  // This would need to be parsed from the body in the actual handler
  return null;
}

/**
 * Helper to add CSRF token to response headers
 */
export function addCSRFTokenToResponse(headers: Headers, token: string): void {
  headers.set('X-CSRF-Token', token);
}
