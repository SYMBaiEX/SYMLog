// Time constants in milliseconds
export const TIME_CONSTANTS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Expiration times
export const EXPIRY_TIMES = {
  AUTH_CODE: 5 * TIME_CONSTANTS.MINUTE, // 5 minutes
  CSRF_TOKEN: 24 * TIME_CONSTANTS.HOUR, // 24 hours
  RATE_LIMIT_WINDOW: TIME_CONSTANTS.HOUR, // 1 hour
  TOKEN_RESERVATION: 5 * TIME_CONSTANTS.MINUTE, // 5 minutes for token reservation
  COMPLETED_SESSION_RETENTION: TIME_CONSTANTS.DAY, // 1 day
  EXPIRED_SESSION_CLEANUP: 24 * TIME_CONSTANTS.HOUR, // 24 hours
} as const;

// Rate limiting
export const RATE_LIMIT_DEFAULTS = {
  DEFAULT_LIMIT: 100,
  CLEANUP_INTERVAL: 6 * TIME_CONSTANTS.HOUR, // 6 hours
} as const;

// Cleanup schedules
export const CLEANUP_SCHEDULES = {
  CSRF_TOKENS: { hourUTC: 0, minuteUTC: 0 }, // Every hour
  AUTH_SESSIONS: { hourUTC: 3, minuteUTC: 0 }, // 3 AM UTC daily
  RATE_LIMITS: { hours: 6 }, // Every 6 hours
} as const;

// Database operations
export const DB_OPERATIONS = {
  BATCH_SIZE: 100, // Number of records to process in batch operations
} as const;
