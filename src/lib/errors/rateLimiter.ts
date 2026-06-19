import { NextRequest, NextResponse } from 'next/server'
import { RateLimitError } from './handler'

// ============================================================================
// IN-MEMORY RATE LIMITER (MVP - for production use Redis)
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key)
      }
    }
  }

  check(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
    this.cleanup()
    const now = Date.now()

    let entry = this.store.get(key)

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs }
      this.store.set(key, entry)
    }

    const remaining = Math.max(0, limit - entry.count)
    const allowed = entry.count < limit

    if (allowed) {
      entry.count++
    }

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    }
  }
}

const limiter = new InMemoryRateLimiter()

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export const RATE_LIMITS = {
  // General API calls
  general: {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // Lead generation
  leadGeneration: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour (free tier)
  },

  // Website analysis
  websiteAnalysis: {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour (free tier)
  },

  // Email sending
  emailSending: {
    limit: 20,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours (free tier)
  },

  // Report generation
  reportGeneration: {
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours (free tier)
  },

  // Authentication attempts
  authAttempts: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // API key creation
  apiKeyCreation: {
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
}

// ============================================================================
// RATE LIMIT MIDDLEWARE
// ============================================================================

export function createRateLimiter(config: { limit: number; windowMs: number }) {
  return async (
    req: NextRequest,
    options?: { keyPrefix?: string; userIdProvider?: (req: NextRequest) => string | null },
  ) => {
    const userId = options?.userIdProvider?.(req)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Use user ID if available, fallback to IP
    const key = userId ? `user:${userId}` : `ip:${ip}`
    const prefixedKey = options?.keyPrefix ? `${options.keyPrefix}:${key}` : key

    const { allowed, remaining, resetAt } = limiter.check(prefixedKey, config.limit, config.windowMs)

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
      const response = NextResponse.json(
        {
          code: 'RATE_LIMIT',
          message: 'Too many requests. Please try again later.',
          retryAfter,
          resetAt: new Date(resetAt).toISOString(),
        },
        { status: 429 },
      )

      response.headers.set('Retry-After', retryAfter.toString())
      response.headers.set('X-RateLimit-Limit', config.limit.toString())
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', resetAt.toString())

      return response
    }

    // Return null if allowed, so middleware can continue
    // Response headers will be set by middleware helper
    return {
      allowed: true,
      remaining,
      limit: config.limit,
      resetAt,
      key: prefixedKey,
    }
  }
}

// ============================================================================
// ENDPOINT RATE LIMIT CHECKERS
// ============================================================================

export async function checkLeadGenerationRateLimit(req: NextRequest, userId: string | null) {
  const config = RATE_LIMITS.leadGeneration
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const key = userId ? `lead-gen:${userId}` : `lead-gen:ip:${ip}`

  const result = limiter.check(key, config.limit, config.windowMs)

  if (!result.allowed) {
    throw new RateLimitError(Math.ceil((result.resetAt - Date.now()) / 1000))
  }

  return result
}

export async function checkWebsiteAnalysisRateLimit(req: NextRequest, userId: string | null) {
  const config = RATE_LIMITS.websiteAnalysis
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const key = userId ? `website-analysis:${userId}` : `website-analysis:ip:${ip}`

  const result = limiter.check(key, config.limit, config.windowMs)

  if (!result.allowed) {
    throw new RateLimitError(Math.ceil((result.resetAt - Date.now()) / 1000))
  }

  return result
}

export async function checkEmailSendingRateLimit(req: NextRequest, userId: string | null) {
  const config = RATE_LIMITS.emailSending
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const key = userId ? `email-send:${userId}` : `email-send:ip:${ip}`

  const result = limiter.check(key, config.limit, config.windowMs)

  if (!result.allowed) {
    throw new RateLimitError(Math.ceil((result.resetAt - Date.now()) / 1000))
  }

  return result
}

export async function checkReportGenerationRateLimit(req: NextRequest, userId: string | null) {
  const config = RATE_LIMITS.reportGeneration
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const key = userId ? `report-gen:${userId}` : `report-gen:ip:${ip}`

  const result = limiter.check(key, config.limit, config.windowMs)

  if (!result.allowed) {
    throw new RateLimitError(Math.ceil((result.resetAt - Date.now()) / 1000))
  }

  return result
}

export async function checkGeneralRateLimit(req: NextRequest, userId: string | null) {
  const config = RATE_LIMITS.general
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const key = userId ? `general:${userId}` : `general:ip:${ip}`

  const result = limiter.check(key, config.limit, config.windowMs)

  if (!result.allowed) {
    throw new RateLimitError(Math.ceil((result.resetAt - Date.now()) / 1000))
  }

  return result
}

// ============================================================================
// RESPONSE HEADERS HELPER
// ============================================================================

export function addRateLimitHeaders(
  response: NextResponse,
  result: { allowed: boolean; remaining: number; limit: number; resetAt: number },
) {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  return response
}
