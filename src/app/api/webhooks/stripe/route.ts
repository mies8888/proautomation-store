import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  parseWebhookEvent,
  handleCheckoutSessionCompleted,
  handlePaymentIntentFailed,
} from '@/services/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await req.arrayBuffer()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify and parse webhook
    const event = parseWebhookEvent(Buffer.from(body), signature)

    if (!event) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionEvent(event.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailedEvent(event.data.object as Stripe.PaymentIntent)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionEvent(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.userId
    const creditsStr = session.metadata?.credits
    const credits = creditsStr ? parseInt(creditsStr, 10) : 0

    if (!userId || !credits) {
      console.error('Invalid checkout session metadata:', session.metadata)
      return
    }

    // Add credits to user
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: credits,
        },
      },
    })

    // Record credit transaction
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: credits,
        reason: 'PURCHASED',
        description: `Purchased ${credits} credits via Stripe (Session: ${session.id})`,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREDITS_PURCHASED',
        metadata: {
          amount: credits,
          sessionId: session.id,
          paymentStatus: session.payment_status,
        },
      },
    })

    console.log(`✓ Added ${credits} credits to user ${userId}`)
  } catch (error) {
    console.error('Error handling checkout session:', error)
    throw error
  }
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const userId = paymentIntent.metadata?.userId

    if (!userId) {
      console.error('Missing userId in payment intent metadata')
      return
    }

    console.log(`✓ Payment succeeded for user ${userId}`)
    // Payment is already handled in checkout.session.completed
    // This is a backup/additional event handler
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error)
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailedEvent(paymentIntent: Stripe.PaymentIntent) {
  try {
    const userId = paymentIntent.metadata?.userId
    const error = paymentIntent.last_payment_error

    if (!userId) {
      console.error('Missing userId in payment intent metadata')
      return
    }

    // Log failed payment
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'PAYMENT_FAILED',
        metadata: {
          intentId: paymentIntent.id,
          error: error?.message || 'Unknown error',
          errorCode: error?.code,
        },
      },
    })

    console.log(`✗ Payment failed for user ${userId}: ${error?.message}`)
  } catch (error) {
    console.error('Error handling payment intent failed:', error)
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    const userId = charge.metadata?.userId
    const creditsStr = charge.metadata?.credits
    const credits = creditsStr ? parseInt(creditsStr, 10) : 0

    if (!userId) {
      console.error('Missing userId in charge metadata')
      return
    }

    if (credits > 0) {
      // Deduct credits from user for refunded purchase
      await prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            decrement: credits,
          },
        },
      })

      // Record refund transaction
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: -credits,
          reason: 'REFUNDED',
          description: `Refunded ${credits} credits (Charge: ${charge.id})`,
        },
      })
    }

    // Log refund
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'PAYMENT_REFUNDED',
        metadata: {
          chargeId: charge.id,
          amount: charge.amount_refunded,
          reason: 'Refund processed',
        },
      },
    })

    console.log(`✓ Refund processed for user ${userId} (${charge.amount_refunded} cents)`)
  } catch (error) {
    console.error('Error handling charge refunded:', error)
  }
}
