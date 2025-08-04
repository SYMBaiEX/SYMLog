import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Run every hour to clean up expired CSRF tokens
crons.hourly(
  "cleanup expired CSRF tokens",
  { hourUTC: 0, minuteUTC: 0 },
  api.csrf.cleanupExpiredCSRFTokens
);

// Run daily to clean up expired auth sessions
crons.daily(
  "cleanup expired auth sessions",
  { hourUTC: 3, minuteUTC: 0 }, // 3 AM UTC
  api.authSessions.cleanupExpiredAuthSessions
);

// Run every 6 hours to clean up expired rate limit entries
crons.interval(
  "cleanup expired rate limits",
  { hours: 6 },
  api.rateLimit.cleanupExpiredRateLimits
);

export default crons;