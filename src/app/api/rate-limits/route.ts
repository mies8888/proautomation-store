import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

// Rate limiting configuration (per day)
const RATE_LIMITS = {
  FREE: { daily: 50, hourly: 10 },
  PREMIUM: { daily: 500, hourly: 100 },
  ELITE: { daily: 5000, hourly: 500 }
}

const UpdateQuotaSchema = z.object({
  dailyLimit: z.number().min(1).max(10000).optional(),
  hourlyLimit: z.number().min(1).max(1000).optional()
})

/**
 * GET - Check current rate limit status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Get user's subscription tier
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    throw new AppError(404, 'User not found', 'NOT_FOUND')
  }

  // Get email quota usage
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfHour = new Date(now.getTime() - 60 * 60 * 1000)

  const dailyEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfDay }
    }
  })

  const hourlyEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfHour }
    }
  })

  // Determine tier limits
  const tier = user.role || 'USER'
  const limits = RATE_LIMITS[tier as keyof typeof RATE_LIMITS] || RATE_LIMITS.FREE
  const customLimits = user.credits > 0
    ? {
        daily: Math.floor(user.credits / 2),
        hourly: Math.floor(user.credits / 2 / 24)
      }
    : limits

  // Calculate usage percentages
  const dailyUsagePercent = (dailyEmails / customLimits.daily) * 100
  const hourlyUsagePercent = (hourlyEmails / customLimits.hourly) * 100

  // Determine status
  let status = 'OK'
  if (dailyUsagePercent >= 100 || hourlyUsagePercent >= 100) {
    status = 'EXCEEDED'
  } else if (dailyUsagePercent >= 90 || hourlyUsagePercent >= 90) {
    status = 'WARNING'
  }

  return NextResponse.json({
    quota: {
      daily: {
        used: dailyEmails,
        limit: customLimits.daily,
        remaining: Math.max(0, customLimits.daily - dailyEmails),
        percentUsed: dailyUsagePercent
      },
      hourly: {
        used: hourlyEmails,
        limit: customLimits.hourly,
        remaining: Math.max(0, customLimits.hourly - hourlyEmails),
        percentUsed: hourlyUsagePercent
      },
      tier,
      credits: user.credits,
      status,
      resetTime: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000).toISOString()
    }
  })
})

/**
 * POST - Check if email can be sent (rate limit check)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    throw new AppError(404, 'User not found', 'NOT_FOUND')
  }

  // Get current usage
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfHour = new Date(now.getTime() - 60 * 60 * 1000)

  const dailyEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfDay }
    }
  })

  const hourlyEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfHour }
    }
  })

  // Get limits
  const tier = user.role || 'USER'
  const limits = RATE_LIMITS[tier as keyof typeof RATE_LIMITS] || RATE_LIMITS.FREE
  const customLimits = user.credits > 0
    ? {
        daily: Math.floor(user.credits / 2),
        hourly: Math.floor(user.credits / 2 / 24)
      }
    : limits

  // Check if allowed
  const canSend =
    dailyEmails < customLimits.daily && hourlyEmails < customLimits.hourly

  if (!canSend) {
    const reason =
      dailyEmails >= customLimits.daily
        ? `Daily limit (${customLimits.daily}) reached`
        : `Hourly limit (${customLimits.hourly}) reached`

    return NextResponse.json(
      {
        allowed: false,
        reason,
        quota: {
          daily: { used: dailyEmails, limit: customLimits.daily },
          hourly: { used: hourlyEmails, limit: customLimits.hourly }
        }
      },
      { status: 429 }
    )
  }

  return NextResponse.json({
    allowed: true,
    quota: {
      daily: { used: dailyEmails, limit: customLimits.daily, remaining: customLimits.daily - dailyEmails - 1 },
      hourly: { used: hourlyEmails, limit: customLimits.hourly, remaining: customLimits.hourly - hourlyEmails - 1 }
    }
  })
})

/**
 * PUT - Update custom quota limits (admin only)
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Only admins can update quota limits')
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    throw new AppError(400, 'userId is required', 'MISSING_USER_ID')
  }

  const body = await req.json()
  const { dailyLimit, hourlyLimit } = UpdateQuotaSchema.parse(body)

  // Update via activity log
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'QUOTA_LIMITS_UPDATED',
      metadata: {
        targetUserId: userId,
        dailyLimit,
        hourlyLimit,
        updatedAt: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    limits: {
      daily: dailyLimit,
      hourly: hourlyLimit
    }
  })
})
