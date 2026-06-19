import Stripe from 'stripe'

/**
 * Initialize Stripe client
 */
export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Use default API version
    })
  : null

/**
 * Stripe configuration
 */
export const STRIPE_CONFIG = {
  // Product IDs
  productStandard: process.env.STRIPE_PRODUCT_STANDARD || 'prod_standard',
  productPro: process.env.STRIPE_PRODUCT_PRO || 'prod_pro',

  // Price IDs
  priceStandard: process.env.STRIPE_PRICE_STANDARD || 'price_standard',
  pricePro: process.env.STRIPE_PRICE_PRO || 'price_pro',

  // Credit amounts
  creditAmounts: {
    tiny: 10,      // $1 - 10 credits
    small: 50,     // $5 - 50 credits
    medium: 100,   // $10 - 100 credits
    large: 500,    // $49 - 500 credits
    xlarge: 1000,  // $99 - 1000 credits
  },

  // Currency
  currency: 'usd' as const,
}

/**
 * Calculate credit amount from price
 */
export function getPriceForCredits(credits: number): number {
  // Base rate: $0.10 per credit for purchases
  // Bulk discounts available
  if (credits >= 1000) return 99 // $0.099 per credit
  if (credits >= 500) return 49  // $0.098 per credit
  if (credits >= 100) return 10  // $0.10 per credit
  if (credits >= 50) return 5    // $0.10 per credit
  if (credits >= 10) return 1    // $0.10 per credit
  return Math.ceil(credits * 0.1)
}

/**
 * Format amount for Stripe (cents)
 */
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Create a checkout session for credit purchase
 */
export async function createCheckoutSession(options: {
  userId: string
  email: string
  credits: number
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) throw new Error('Stripe not configured')
  const priceInDollars = getPriceForCredits(options.credits)
  const amountInCents = formatAmountForStripe(priceInDollars)

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: STRIPE_CONFIG.currency,
          product_data: {
            name: `${options.credits} Credits`,
            description: `Purchase ${options.credits} credits for ProAutomation Store`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: options.email,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      userId: options.userId,
      credits: options.credits.toString(),
    },
  })

  return session
}

/**
 * Create a subscription checkout session
 */
export async function createSubscriptionCheckoutSession(options: {
  userId: string
  email: string
  plan: 'standard' | 'pro'
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) throw new Error('Stripe not configured')
  const priceId = options.plan === 'standard' ? STRIPE_CONFIG.priceStandard : STRIPE_CONFIG.pricePro

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    customer_email: options.email,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      userId: options.userId,
      plan: options.plan,
    },
  })

  return session
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(intentId: string): Promise<Stripe.PaymentIntent> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.paymentIntents.retrieve(intentId)
}

/**
 * Retrieve a charge
 */
export async function getCharge(chargeId: string): Promise<Stripe.Charge> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.charges.retrieve(chargeId)
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
  if (!stripe) throw new Error('Stripe is not configured')
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  })

  return customers.data[0] || null
}

/**
 * Create or get customer
 */
export async function getOrCreateCustomer(options: {
  userId: string
  email: string
  name?: string
}): Promise<Stripe.Customer> {
  if (!stripe) throw new Error('Stripe is not configured')
  // Try to find existing customer
  const existing = await getCustomerByEmail(options.email)
  if (existing) {
    return existing
  }

  // Create new customer
  return stripe.customers.create({
    email: options.email,
    name: options.name,
    metadata: {
      userId: options.userId,
    },
  })
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  body: string | Buffer,
  signature: string
): boolean {
  if (!stripe) throw new Error('Stripe is not configured')
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
    stripe.webhooks.constructEvent(body, signature, secret)
    return true
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

/**
 * Parse webhook event
 */
export function parseWebhookEvent(
  body: string | Buffer,
  signature: string
): Stripe.Event | null {
  try {
    if (!stripe) return null
    const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
    return stripe.webhooks.constructEvent(body, signature, secret)
  } catch (error) {
    console.error('Failed to parse webhook event:', error)
    return null
  }
}

/**
 * Handle checkout session completed event
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = session.metadata?.userId
    const credits = parseInt(session.metadata?.credits || '0', 10)

    if (!userId || !credits) {
      return {
        success: false,
        error: 'Missing userId or credits in metadata',
      }
    }

    // Return success - caller will handle database updates
    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Handle payment intent failed event
 */
export async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = paymentIntent.metadata?.userId
    const error = paymentIntent.last_payment_error

    console.log(`Payment failed for user ${userId}:`, error)

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Retrieve subscription
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.subscriptions.retrieve(subscriptionId)
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediate: boolean = false
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: !immediate,
  })
}

/**
 * Get refund status
 */
export async function getRefund(refundId: string): Promise<Stripe.Refund> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.refunds.retrieve(refundId)
}

/**
 * Create refund
 */
export async function createRefund(options: {
  chargeId?: string
  paymentIntentId?: string
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}): Promise<Stripe.Refund> {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe.refunds.create({
    charge: options.chargeId,
    payment_intent: options.paymentIntentId,
    amount: options.amount ? formatAmountForStripe(options.amount) : undefined,
    reason: options.reason,
    metadata: options.metadata,
  })
}
