/**
 * Simple in-memory rate limiter.
 * Tracks request counts per key (e.g., IP address) within a sliding window.
 *
 * NOTE: This resets on server restart and is per-instance only.
 * For production with multiple instances, use Upstash or Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent memory leaks (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check the rate limit for a key WITHOUT incrementing the counter.
 * Use this to verify whether a request is allowed before processing it.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // No entry or expired window: allowed
  if (!entry || now > entry.resetAt) {
    return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs }
  }

  const allowed = entry.count < config.maxRequests
  const remaining = Math.max(0, config.maxRequests - entry.count)

  return { allowed, remaining, resetAt: entry.resetAt }
}

/**
 * Increment the rate limit counter for a key.
 * Call this AFTER a failed attempt to record the failure.
 */
export function incrementRateLimit(
  key: string,
  config: RateLimitConfig
): void {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return
  }

  entry.count += 1
}
