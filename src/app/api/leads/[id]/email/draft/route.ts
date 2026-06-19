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
import { DraftEmailSchema } from '@/lib/validation/schemas'
import { generateColdEmail } from '@/services/emailEngine'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, DraftEmailSchema)

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    include: { opportunityReport: true }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only draft emails for your own leads')
  }

  // Generate email if AI generation is requested
  let subject = data.subject
  let body = data.body

  if (data.useAiGeneration) {
    if (!lead.opportunityReport) {
      throw new ValidationError('Must generate an opportunity report before AI email generation')
    }
    const generated = await generateColdEmail(lead, lead.opportunityReport)
    subject = generated.subject
    body = generated.body
  }

  // Create email draft
  const email = await prisma.outreachEmail.create({
    data: {
      leadId: data.leadId,
      userId: session.user.id,
      to: lead.contactEmail || '',
      subject,
      body,
      status: 'DRAFT'
    },
    include: { lead: true }
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: data.leadId,
      action: 'EMAIL_DRAFTED',
      metadata: {
        emailId: email.id,
        subject,
        useAiGeneration: data.useAiGeneration
      }
    }
  })

  return NextResponse.json(email, { status: 201 })
})
