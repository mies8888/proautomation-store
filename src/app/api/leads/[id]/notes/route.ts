import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/db/prisma"
import { auth } from "@/lib/auth"
import { 
  withErrorHandling, 
  validateRequest,
  ForbiddenError,
  NotFoundError 
} from '@/lib/errors/handler'
import { AddLeadNoteSchema } from '@/lib/validation/schemas'

export const POST = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, AddLeadNoteSchema)

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: params.id }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only add notes to your own leads')
  }

  const activity = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: params.id,
      action: 'NOTE_ADDED',
      metadata: { text: data.note, length: data.note.length }
    }
  })

  return NextResponse.json(activity, { status: 201 })
})
