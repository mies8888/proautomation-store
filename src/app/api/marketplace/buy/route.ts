import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { 
  withErrorHandling,
  validateRequest,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from '@/lib/errors/handler'
import { BuyLeadSchema } from '@/lib/validation/schemas'
import { hasSufficientCredits } from '@/services/billing'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, BuyLeadSchema)

  // Fetch listing with all details
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: data.listingId },
    include: { lead: true, seller: true }
  })

  if (!listing) {
    throw new NotFoundError('Marketplace listing')
  }

  if (listing.status !== 'ACTIVE') {
    throw new ValidationError('This listing is no longer available')
  }

  if (listing.sellerId === session.user.id) {
    throw new ForbiddenError('You cannot purchase your own lead')
  }

  if (!(await hasSufficientCredits(session.user.id, listing.askingPrice))) {
    throw new ValidationError('Insufficient credits to complete this purchase')
  }

  // Execute atomic transaction
  await prisma.$transaction(async (tx) => {
    // 1. Verify buyer still has credits
    const buyer = await tx.user.findUnique({ where: { id: session.user.id } })
    if (!buyer || buyer.credits < listing.askingPrice) {
      throw new ValidationError('Insufficient funds during transaction')
    }

    // 2. Deduct from buyer
    await tx.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: listing.askingPrice } }
    })
    await tx.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -listing.askingPrice,
        reason: 'MARKETPLACE_BUY',
        description: `Purchased lead: ${listing.lead.companyName}`
      }
    })

    // 3. Add to seller
    await tx.user.update({
      where: { id: listing.sellerId },
      data: { credits: { increment: listing.askingPrice } }
    })
    await tx.creditTransaction.create({
      data: {
        userId: listing.sellerId,
        amount: listing.askingPrice,
        reason: 'MARKETPLACE_SELL',
        description: `Sold lead: ${listing.lead.companyName}`
      }
    })

    // 4. Transfer Lead Ownership
    await tx.lead.update({
      where: { id: listing.leadId },
      data: { ownerUserId: session.user.id }
    })

    // 5. Mark Listing as SOLD
    await tx.marketplaceListing.update({
      where: { id: listing.id },
      data: { status: 'SOLD' }
    })

    // 6. Log activity for buyer
    await tx.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: listing.leadId,
        action: 'LEAD_PURCHASED',
        metadata: {
          price: listing.askingPrice,
          sellerId: listing.sellerId,
          companyName: listing.lead.companyName
        }
      }
    })

    // 7. Log activity for seller
    await tx.activityLog.create({
      data: {
        userId: listing.sellerId,
        leadId: listing.leadId,
        action: 'LEAD_SOLD',
        metadata: {
          price: listing.askingPrice,
          buyerId: session.user.id,
          companyName: listing.lead.companyName
        }
      }
    })
  })

  return NextResponse.json({
    success: true,
    leadId: listing.leadId,
    price: listing.askingPrice,
    message: 'Lead purchased successfully'
  })
})
