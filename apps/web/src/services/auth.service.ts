import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import {
  createSessionJWT,
  type SessionPayload,
  verifyJWT,
} from '@/lib/jwt-utils';
import { logSecurityEvent } from '@/lib/logger';

interface CrossmintTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  email?: string;
  wallet_address?: string;
  scope?: string;
}

interface VerifyTokenResult {
  isValid: boolean;
  message: string;
  sessionToken?: string;
  expiresAt?: number;
  userId?: string;
  walletAddress?: string | null;
  verifiedAt?: string;
}

// Crossmint JWKS endpoint for proper JWT verification
const CROSSMINT_JWKS_URL = 'https://api.crossmint.com/.well-known/jwks.json';
const jwks = createRemoteJWKSet(new URL(CROSSMINT_JWKS_URL));

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Verify Crossmint token and create session
   */
  async verifyCrossmintToken(
    token: string,
    walletAddress?: string,
    clientInfo?: { ip: string | null; userAgent: string | null }
  ): Promise<VerifyTokenResult> {
    // Validate input
    if (!token) {
      logSecurityEvent({
        type: 'INVALID_INPUT',
        metadata: { reason: 'missing_token' },
        ...clientInfo,
      });
      return {
        isValid: false,
        message: 'Missing required field: token',
      };
    }

    // Verify JWT with cryptographic signature validation
    let crossmintPayload: CrossmintTokenPayload;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: 'https://api.crossmint.com',
        audience: config.get().crossmintClientKey,
      });
      crossmintPayload = payload as unknown as CrossmintTokenPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      logSecurityEvent({
        type: 'TOKEN_VERIFICATION_FAILED',
        metadata: {
          reason: 'invalid_crossmint_token',
          error: error instanceof Error ? error.message : 'unknown',
        },
        ...clientInfo,
      });
      return {
        isValid: false,
        message: 'Invalid Crossmint token',
      };
    }

    // Create session
    const sessionToken = await createSessionJWT({
      userId: crossmintPayload.sub,
      walletAddress,
      type: 'crossmint_verified_session',
      metadata: {
        crossmintToken: token,
        verifiedAt: new Date().toISOString(),
      },
    });

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store user session in database (optional)
    try {
      await this.storeUserSession({
        userId: crossmintPayload.sub,
        email: crossmintPayload.email,
        walletAddress,
        sessionToken,
        expiresAt: new Date(expiresAt),
      });
    } catch (error) {
      console.error('Failed to store user session:', error);
      // Continue - session is still valid even if DB storage fails
    }

    // Log successful verification
    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      userId: crossmintPayload.sub,
      metadata: {
        action: 'crossmint_verification',
        walletAddress: walletAddress || null,
      },
      ...clientInfo,
    });

    return {
      isValid: true,
      message: 'Crossmint token verified successfully',
      sessionToken,
      expiresAt,
      userId: crossmintPayload.sub,
      walletAddress: walletAddress || null,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Store user session in database
   */
  private async storeUserSession(data: {
    userId: string;
    email?: string;
    walletAddress?: string;
    sessionToken: string;
    expiresAt: Date;
  }): Promise<void> {
    // First, ensure user exists
    const existingUser = await db.findOne('users', { id: data.userId });

    if (existingUser) {
      // Update user info if changed
      await db.update(
        'users',
        { id: data.userId },
        {
          email: data.email || (existingUser as any).email,
          wallet_address:
            data.walletAddress || (existingUser as any).wallet_address,
          updated_at: new Date(),
        }
      );
    } else {
      // Create user if doesn't exist
      await db.insert('users', {
        id: data.userId,
        email: data.email,
        wallet_address: data.walletAddress,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Store session
    await db.insert('user_sessions', {
      user_id: data.userId,
      session_token: data.sessionToken,
      expires_at: data.expiresAt,
      created_at: new Date(),
    });
  }

  /**
   * Validate session from token
   */
  async validateSession(sessionToken: string): Promise<SessionPayload | null> {
    try {
      // First check if session exists in DB and is not expired
      const session = await db.findOne('user_sessions', {
        session_token: sessionToken,
      });

      if (session && new Date((session as any).expires_at) < new Date()) {
        // Session expired
        await db.delete('user_sessions', { session_token: sessionToken });
        return null;
      }

      // Verify JWT (will also check expiration)
      const payload = await verifyJWT(sessionToken);
      return payload;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    await db.delete('user_sessions', { session_token: sessionToken });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db.query(
      'DELETE FROM user_sessions WHERE expires_at < NOW()',
      []
    );
    return result.rowCount;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Set up periodic cleanup
if (process.env.NODE_ENV !== 'test') {
  // Clean up expired sessions every hour
  setInterval(
    async () => {
      try {
        const cleaned = await authService.cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired sessions`);
        }
      } catch (error) {
        console.error('Failed to cleanup sessions:', error);
      }
    },
    60 * 60 * 1000
  ); // 1 hour
}
