import { ConvexHttpClient } from 'convex/browser';

let convexClient: ConvexHttpClient | null = null;

/**
 * Get a singleton instance of ConvexHttpClient
 * This ensures we only create one client instance per application
 */
export function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    }
    convexClient = new ConvexHttpClient(convexUrl);
  }
  return convexClient;
}

/**
 * Reset the client instance (mainly for testing)
 */
export function resetConvexClient(): void {
  convexClient = null;
}
