import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { 
  withErrorHandling,
  validateRequest,
  ForbiddenError,
  NotFoundError,
  ConflictError
} from '@/lib/errors/handler'
import { ListLeadOnMarketplaceSchema } from '@/lib/validation/schemas'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, ListLeadOnMarketplaceSchema)

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    include: { marketplaceListing: true }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only list your own leads')
  }

  if (lead.marketplaceListing?.status === 'ACTIVE') {
    throw new ConflictError('This lead is already listed on the marketplace')
  }

  const listing = await prisma.marketplaceListing.upsert({
    where: { leadId: data.leadId },
    update: {
      askingPrice: data.askingPrice,
      status: 'ACTIVE',
      updatedAt: new Date()
    },
    create: {
      leadId: data.leadId,
      sellerId: session.user.id,
      askingPrice: data.askingPrice,
      status: 'ACTIVE'
    },
    include: { lead: true, seller: true }
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: data.leadId,
      action: 'LEAD_LISTED',
      metadata: {
        listingId: listing.id,
        askingPrice: data.askingPrice,
        description: data.description
      }
    }
  })

  return NextResponse.json(listing, { status: 201 })
})
