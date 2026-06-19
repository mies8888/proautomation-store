import { NextRequest, NextResponse } from 'next/server'
import { generateEmail } from '@/lib/ai/service'
import { withErrorHandling, ForbiddenError, NotFoundError, validateRequest } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth'
import SequenceScheduler from '@/services/sequencer'
import { z } from 'zod'

const GenerateEmailSchema = z.object({
  templateType: z.enum(['cold_outreach', 'follow_up', 'proposal']).optional().default('cold_outreach'),
  sequence: z.object({
    type: z.enum(['default', 'aggressive', 'nurture']).optional(),
    startImmediately: z.boolean().optional().default(true)
  }).optional()
})

type GenerateEmailInput = z.infer<typeof GenerateEmailSchema>

/**
 * POST /api/leads/[id]/email/generate
 * Generate an email draft using Claude AI, optionally with a follow-up sequence
 * 
 * Request body:
 * {
 *   "templateType": "cold_outreach",
 *   "sequence": {
 *     "type": "default",  // "default" | "aggressive" | "nurture"
 *     "startImmediately": true
 *   }
 * }
 */
export const POST = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const leadId = params.id
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError()
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      websiteAnalysis: true,
      businessType: true,
    },
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError()
  }

  // Validate request body
  const data = await validateRequest(req, GenerateEmailSchema)

  // Generate email using Claude
  const email = await generateEmail(
    {
      companyName: lead.companyName,
      industry: lead.industry || undefined,
      website: lead.websiteUrl || undefined,
      description: lead.businessType?.name || undefined,
    },
    data.templateType
  )

  // Save draft email
  const outreachEmail = await prisma.outreachEmail.create({
    data: {
      leadId,
      userId: session.user.id,
      to: lead.contactEmail || '',
      subject: email.subject,
      body: email.body,
      status: 'DRAFT',
    },
  })

  // Create follow-up sequence if requested
  let sequenceId: string | undefined
  if (data.sequence) {
    try {
      let sequenceSteps
      
      switch (data.sequence.type) {
        case 'aggressive':
          sequenceSteps = SequenceScheduler.getAggressiveSequence()
          break
        case 'nurture':
          sequenceSteps = SequenceScheduler.getNurtureSequence()
          break
        case 'default':
        default:
          sequenceSteps = SequenceScheduler.getDefaultSequence()
      }

      const sequence = await SequenceScheduler.createSequence(
        leadId,
        session.user.id,
        sequenceSteps,
        data.sequence.startImmediately
      )

      sequenceId = sequence.id
    } catch (error) {
      console.error('Error creating sequence:', error)
      // Don't fail the email generation if sequence fails
    }
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId,
      action: 'EMAIL_DRAFT_GENERATED',
      metadata: {
        emailId: outreachEmail.id,
        aiGenerated: true,
        templateType: data.templateType,
        sequenceId,
        sequenceType: data.sequence?.type
      },
    },
  })

  return NextResponse.json({
    ...outreachEmail,
    sequence: sequenceId ? { id: sequenceId, type: data.sequence?.type } : undefined
  }, { status: 201 })
})
