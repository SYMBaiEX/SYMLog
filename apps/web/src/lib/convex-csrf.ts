import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Initialize Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexHttpClient(convexUrl);

/**
 * Generate a CSRF token for a user
 */
export async function generateCSRFToken(userId: string): Promise<string> {
  try {
    const result = await convex.mutation(api.csrf.generateCSRFToken, {
      userId,
    });
    
    return result.token;
  } catch (error) {
    console.error("Failed to generate CSRF token:", error);
    throw new Error("Failed to generate CSRF token");
  }
}

/**
 * Validate a CSRF token
 */
export async function validateCSRFToken(
  token: string,
  userId: string
): Promise<boolean> {
  if (!token || !userId) {
    return false;
  }

  try {
    const result = await convex.mutation(api.csrf.validateCSRFToken, {
      token,
      userId,
    });
    
    return result.valid;
  } catch (error) {
    console.error("Failed to validate CSRF token:", error);
    return false;
  }
}

/**
 * Get active CSRF tokens for a user (for debugging/admin)
 */
export async function getUserCSRFTokens(userId: string) {
  try {
    const tokens = await convex.query(api.csrf.getUserCSRFTokens, {
      userId,
    });
    
    return tokens;
  } catch (error) {
    console.error("Failed to get user CSRF tokens:", error);
    return [];
  }
}