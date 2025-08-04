import Redis from 'ioredis'
import { logSecurityEvent } from './logger'
import { config } from './config'

// Initialize Redis client
let redis: Redis | null = null

function getRedisClient(): Redis | null {
  const redisUrl = config.get().redisUrl
  if (!redisUrl) {
    console.warn('REDIS_URL not configured, falling back to in-memory rate limiting')
    return null
  }
  
  if (!redis) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('Redis connection failed after 3 retries')
            return null
          }
          return Math.min(times * 200, 1000)
        }
      })
      
      redis.on('error', (err) => {
        console.error('Redis error:', err)
      })
      
      redis.on('connect', () => {
        console.log('Redis connected successfully')
      })
    } catch (error) {
      console.error('Failed to initialize Redis:', error)
      return null
    }
  }
  
  return redis
}

// Fallback in-memory storage if Redis is not available
const inMemoryRateLimit = new Map<string, { count: number; resetTime: number }>()

// Clean up expired in-memory entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of inMemoryRateLimit.entries()) {
    if (value.resetTime < now) {
      inMemoryRateLimit.delete(key)
    }
  }
}, 60 * 1000) // Every minute

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
}

/**
 * Check rate limit for a user
 * @param userId - The user ID to check
 * @param limit - The maximum number of requests allowed per hour
 * @returns Rate limit result
 */
export async function checkRateLimit(
  userId: string, 
  limit: number = 100
): Promise<RateLimitResult> {
  const redisClient = getRedisClient()
  const hourInMs = 60 * 60 * 1000
  const now = Date.now()
  const windowStart = Math.floor(now / hourInMs) * hourInMs
  const key = `rate_limit:${userId}:${windowStart}`
  
  // Use Redis if available
  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline()
      pipeline.incr(key)
      pipeline.expire(key, 3600) // Expire after 1 hour
      
      const results = await pipeline.exec()
      const count = results?.[0]?.[1] as number || 0
      
      const result = {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        reset: windowStart + hourInMs
      }
      
      if (!result.allowed) {
        logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          userId,
          metadata: {
            count,
            limit,
            resetTime: new Date(result.reset).toISOString()
          }
        })
      }
      
      return result
    } catch (error) {
      console.error('Redis rate limit error:', error)
      // Fall through to in-memory implementation
    }
  }
  
  // Fallback to in-memory rate limiting
  const userLimit = inMemoryRateLimit.get(key)
  
  if (!userLimit || now > userLimit.resetTime) {
    inMemoryRateLimit.set(key, {
      count: 1,
      resetTime: windowStart + hourInMs
    })
    
    return {
      allowed: true,
      remaining: limit - 1,
      reset: windowStart + hourInMs
    }
  }
  
  // Check if limit exceeded
  if (userLimit.count >= limit) {
    logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      userId,
      metadata: {
        count: userLimit.count,
        limit,
        resetTime: new Date(userLimit.resetTime).toISOString(),
        storage: 'in-memory'
      }
    })
    
    return {
      allowed: false,
      remaining: 0,
      reset: userLimit.resetTime
    }
  }
  
  // Increment count
  userLimit.count++
  inMemoryRateLimit.set(key, userLimit)
  
  return {
    allowed: true,
    remaining: limit - userLimit.count,
    reset: userLimit.resetTime
  }
}

/**
 * Reset rate limit for a user (useful for testing or admin operations)
 */
export async function resetRateLimit(userId: string): Promise<void> {
  const redisClient = getRedisClient()
  const hourInMs = 60 * 60 * 1000
  const now = Date.now()
  const windowStart = Math.floor(now / hourInMs) * hourInMs
  const key = `rate_limit:${userId}:${windowStart}`
  
  if (redisClient) {
    try {
      await redisClient.del(key)
    } catch (error) {
      console.error('Redis reset error:', error)
    }
  }
  
  // Also clear from in-memory
  inMemoryRateLimit.delete(key)
}

/**
 * Get current rate limit status for a user without incrementing
 */
export async function getRateLimitStatus(
  userId: string,
  limit: number = 100
): Promise<RateLimitResult> {
  const redisClient = getRedisClient()
  const hourInMs = 60 * 60 * 1000
  const now = Date.now()
  const windowStart = Math.floor(now / hourInMs) * hourInMs
  const key = `rate_limit:${userId}:${windowStart}`
  
  if (redisClient) {
    try {
      const count = await redisClient.get(key)
      const currentCount = parseInt(count || '0')
      
      return {
        allowed: currentCount < limit,
        remaining: Math.max(0, limit - currentCount),
        reset: windowStart + hourInMs
      }
    } catch (error) {
      console.error('Redis status error:', error)
    }
  }
  
  // Fallback to in-memory
  const userLimit = inMemoryRateLimit.get(key)
  const currentCount = userLimit?.count || 0
  
  return {
    allowed: currentCount < limit,
    remaining: Math.max(0, limit - currentCount),
    reset: windowStart + hourInMs
  }
}