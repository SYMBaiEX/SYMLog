# Convex Database Implementation

This directory contains the Convex implementation that replaces Redis for caching and temporary storage needs.

## Overview

We've migrated from Redis to Convex for all temporary storage needs:
- **Rate Limiting**: Application-layer rate limiting with automatic cleanup
- **CSRF Tokens**: Secure token storage with expiration and one-time use
- **Auth Sessions**: Temporary auth code storage with status tracking

## Features

### Rate Limiting (`rateLimit.ts`)
- Tracks API requests per user with a sliding window
- Configurable limits per endpoint
- Automatic cleanup of expired entries
- Atomic operations for distributed consistency

### CSRF Protection (`csrf.ts`)
- Generates secure random tokens
- One-time use validation
- 24-hour expiration
- User-specific token validation

### Auth Sessions (`authSessions.ts`)
- Stores auth codes securely
- 5-minute expiration for security
- Status tracking (pending, completed, expired)
- Automatic cleanup of old sessions

### Scheduled Cleanup (`crons.ts`)
- Hourly cleanup of expired CSRF tokens
- Daily cleanup of expired auth sessions
- Every 6 hours cleanup of rate limit entries

## Usage

### Rate Limiting
```typescript
import { checkRateLimit } from '@/lib/convex-rate-limit'

const { allowed, remaining } = await checkRateLimit(userId, 100)
if (!allowed) {
  // Handle rate limit exceeded
}
```

### CSRF Protection
```typescript
import { generateCSRFToken, validateCSRFToken } from '@/lib/convex-csrf'

// Generate token
const token = await generateCSRFToken(userId)

// Validate token
const isValid = await validateCSRFToken(token, userId)
```

### Auth Sessions
```typescript
// Store auth code
await convex.mutation(api.authSessions.storeAuthCode, {
  authCode: sessionId,
  userId,
  userEmail,
  walletAddress
})

// Retrieve session
const session = await convex.query(api.authSessions.getAuthSession, {
  authCode: sessionId
})

// Mark as used
await convex.mutation(api.authSessions.markAuthCodeUsed, {
  authCode: sessionId
})
```

## Benefits of Convex over Redis

1. **No separate infrastructure**: Convex is already used for the database
2. **Built-in scheduling**: Cron jobs for automatic cleanup
3. **Type safety**: Full TypeScript support with schema validation
4. **ACID transactions**: Atomic operations for consistency
5. **Real-time updates**: Can subscribe to changes if needed
6. **Cost effective**: No additional Redis hosting costs

## Migration Notes

- All Redis dependencies have been removed
- In-memory fallbacks are only used in development
- All rate limiting, CSRF, and auth code storage now uses Convex
- Scheduled cleanup functions ensure data doesn't grow unbounded