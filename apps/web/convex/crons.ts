import { cronJobs } from 'convex/server';
import { api } from './_generated/api';
import { CLEANUP_SCHEDULES } from './constants';

const crons = cronJobs();

// Run every hour to clean up expired CSRF tokens
crons.hourly(
  'cleanup expired CSRF tokens',
  CLEANUP_SCHEDULES.CSRF_TOKENS,
  api.csrf.cleanupExpiredCSRFTokens
);

// Run daily to clean up expired auth sessions
crons.daily(
  'cleanup expired auth sessions',
  CLEANUP_SCHEDULES.AUTH_SESSIONS,
  api.authSessions.cleanupExpiredAuthSessions
);

// Run every 6 hours to clean up expired rate limit entries
crons.interval(
  'cleanup expired rate limits',
  CLEANUP_SCHEDULES.RATE_LIMITS,
  api.rateLimit.cleanupExpiredRateLimits
);

export default crons;
