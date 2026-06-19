import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { stripe } from '@/services/stripe'
import { withErrorHandling, ForbiddenError } from '@/lib/errors/handler'

/**
 * GET /api/billing/checkout-session/[sessionId]
 * Get checkout session status and payment details
 */
export const GET = withErrorHandling(async (
  req: NextRequest,
  props: { params: Promise<{ sessionId: string }> }
) => {
  const params = await props.params
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  // Retrieve session from Stripe
  const checkoutSession = await stripe.checkout.sessions.retrieve(params.sessionId)

  // Verify session belongs to authenticated user
  if (checkoutSession.metadata?.userId !== session.user.id) {
    throw new ForbiddenError('This checkout session does not belong to you')
  }

  return NextResponse.json({
    id: checkoutSession.id,
    status: checkoutSession.payment_status,
    paymentStatus: checkoutSession.payment_status,
    customerEmail: checkoutSession.customer_email,
    credits: checkoutSession.metadata?.credits,
    amountTotal: checkoutSession.amount_total,
    currency: checkoutSession.currency,
    createdAt: new Date(checkoutSession.created * 1000),
    // Line items details
    lineItems: await stripe.checkout.sessions.listLineItems(params.sessionId),
  })
})