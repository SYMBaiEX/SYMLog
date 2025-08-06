import pino from 'pino';
import { config } from './config';

// Create logger instance
const logger = pino({
  level: config.get().logLevel,
  // Only use pretty transport in development
  ...(config.isDevelopment() && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Security event types
export type SecurityEventType =
  | 'AUTH_ATTEMPT'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'TOKEN_VERIFICATION_FAILED'
  | 'CSRF_VALIDATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT'
  | 'SUSPICIOUS_ACTIVITY'
  | 'WALLET_VERIFICATION_ATTEMPT'
  | 'WALLET_VERIFICATION_SUCCESS'
  | 'WALLET_VERIFICATION_FAILED'
  | 'UNAUTHORIZED_TOOL_ACCESS'
  | 'VALIDATION_FAILED'
  | 'SECURITY_VIOLATION';

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Log security-related events
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logData = {
    category: 'SECURITY',
    type: event.type,
    userId: event.userId || 'anonymous',
    ip: event.ip || 'unknown',
    userAgent: event.userAgent || 'unknown',
    timestamp: new Date().toISOString(),
    ...event.metadata,
  };

  // Log at appropriate level based on event type
  switch (event.type) {
    case 'AUTH_SUCCESS':
    case 'WALLET_VERIFICATION_SUCCESS':
      logger.info(logData, `Security event: ${event.type}`);
      break;
    case 'AUTH_FAILURE':
    case 'TOKEN_VERIFICATION_FAILED':
    case 'CSRF_VALIDATION_FAILED':
    case 'WALLET_VERIFICATION_FAILED':
      logger.warn(logData, `Security warning: ${event.type}`);
      break;
    case 'RATE_LIMIT_EXCEEDED':
    case 'SUSPICIOUS_ACTIVITY':
      logger.error(logData, `Security alert: ${event.type}`);
      break;
    default:
      logger.info(logData, `Security event: ${event.type}`);
  }
}

/**
 * Log API errors
 */
export function logAPIError(
  endpoint: string,
  error: unknown,
  context?: Record<string, any>
): void {
  const errorData = {
    category: 'API_ERROR',
    endpoint,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (error instanceof Error) {
    logger.error(
      {
        ...errorData,
        error: error.message,
        stack: error.stack,
      },
      `API error in ${endpoint}: ${error.message}`
    );
  } else {
    logger.error(
      {
        ...errorData,
        error: String(error),
      },
      `API error in ${endpoint}`
    );
  }
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
): void {
  logger.info(
    {
      category: 'PERFORMANCE',
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
    `Performance: ${operation} took ${duration}ms`
  );
}

/**
 * Log general errors
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, any>
): void {
  const errorData = {
    category: 'ERROR',
    context,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  if (error instanceof Error) {
    logger.error(
      {
        ...errorData,
        error: error.message,
        stack: error.stack,
      },
      `Error in ${context}: ${error.message}`
    );
  } else {
    logger.error(
      {
        ...errorData,
        error: String(error),
      },
      `Error in ${context}`
    );
  }
}

/**
 * Extract client info from request
 */
export function extractClientInfo(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  return {
    ip:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') || // Cloudflare
      null,
    userAgent: request.headers.get('user-agent'),
  };
}

export default logger;
