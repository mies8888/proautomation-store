import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/db/prisma"
import { auth } from "@/lib/auth"
import { 
  withErrorHandling, 
  validateRequest,
  ForbiddenError,
  NotFoundError 
} from '@/lib/errors/handler'
import { UpdateLeadStatusSchema } from '@/lib/validation/schemas'

export const PATCH = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, UpdateLeadStatusSchema)

  // Verify ownership
  const lead = await prisma.lead.findUnique({
    where: { id: params.id }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only update your own leads')
  }

  const updatedLead = await prisma.lead.update({
    where: { id: params.id },
    data: { status: data.status },
    include: { websiteAnalysis: true }
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: lead.id,
      action: 'STATUS_UPDATED',
      metadata: { previousStatus: lead.status, newStatus: data.status }
    }
  })

  return NextResponse.json(updatedLead)
})
