// ============================================================
// Yene QR — Simple In-Memory Rate Limiter
// ============================================================
// For production, replace with Redis-backed rate limiter.

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number   // Time window in milliseconds
  maxRequests: number // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs?: number
}

export const RATE_LIMITS = {
  login:         { windowMs: 15 * 60 * 1000, maxRequests: 5 },   // 5 attempts per 15 min
  register:      { windowMs: 60 * 60 * 1000, maxRequests: 3 },   // 3 per hour
  orderCreate:   { windowMs: 60 * 1000,      maxRequests: 10 },   // 10 per minute
  api:           { windowMs: 60 * 1000,      maxRequests: 100 },  // 100 per minute
  qrSession:     { windowMs: 60 * 1000,      maxRequests: 20 },   // 20 per minute
  twoFactor:     { windowMs: 5 * 60 * 1000,  maxRequests: 10 },   // 10 attempts per 5 min
  customerReview:   { windowMs: 60 * 1000,   maxRequests: 5 },    // 5 reviews per minute
  customerFavorite: { windowMs: 60 * 1000,   maxRequests: 30 },   // 30 favorite toggles per minute
  customerWaiterCall: { windowMs: 60 * 1000, maxRequests: 10 },   // 10 waiter calls per minute
  customerWaitlist: { windowMs: 60 * 1000,   maxRequests: 5 },    // 5 waitlist entries per minute
  customerReservation: { windowMs: 60 * 1000, maxRequests: 5 },   // 5 reservations per minute
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // No entry or expired window → start fresh
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }

  // Window is active but limit reached
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    }
  }

  // Increment counter
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

// -------------------------------------------------------
// Cleanup old entries every 5 minutes
// -------------------------------------------------------

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

// -------------------------------------------------------
// Helper: Get client IP from request
// -------------------------------------------------------

export function getClientIp(request: Request): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Fallback — this is often undefined in Next.js edge/serverless
  return 'unknown'
}
