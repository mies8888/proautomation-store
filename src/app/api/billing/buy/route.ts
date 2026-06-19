import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from '@/lib/db/prisma'
import { createCheckoutSession } from '@/services/stripe'
import { z } from 'zod'
import { withErrorHandling, ForbiddenError, AppError } from '@/lib/errors/handler'

const BuyCreditSchema = z.object({
  credits: z.number().int().min(10).max(10000),
  redirectUrl: z.string().url().optional(),
})

/**
 * POST /api/billing/buy
 * Create a Stripe checkout session for credit purchase
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    throw new ForbiddenError('Not authenticated')
  }

  // Parse request
  const body = await req.json()
  const data = BuyCreditSchema.parse(body)

  // Get protocol and host for redirect URLs
  const protocol = req.headers.get('x-forwarded-proto') || 'http'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const baseUrl = `${protocol}://${host}`

  try {
    // Create checkout session
    const checkoutSession = await createCheckoutSession({
      userId: session.user.id,
      email: session.user.email,
      credits: data.credits,
      successUrl: data.redirectUrl ? `${baseUrl}${data.redirectUrl}?session_id={CHECKOUT_SESSION_ID}` : `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: data.redirectUrl ? `${baseUrl}${data.redirectUrl}?payment=cancelled` : `${baseUrl}/dashboard?payment=cancelled`,
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'CHECKOUT_SESSION_CREATED',
        metadata: {
          sessionId: checkoutSession.id,
          credits: data.credits,
        },
      },
    })

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error) {
    throw new AppError(
      500,
      error instanceof Error ? error.message : 'Failed to create checkout session',
      'CHECKOUT_FAILED'
    )
  }
})
