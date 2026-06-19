import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import SequenceScheduler, { type SequenceStep } from '@/services/sequencer'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const CreateSequenceSchema = z.object({
  leadId: z.string(),
  sequenceType: z.enum(['default', 'aggressive', 'nurture', 'custom']),
  customSteps: z.array(z.object({
    stepNumber: z.number(),
    template: z.string(),
    delayDays: z.number(),
    subject: z.string().optional(),
    bodyOverride: z.string().optional()
  })).optional(),
  startImmediately: z.boolean().default(false)
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const data = CreateSequenceSchema.parse(body)

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new AppError(
      403,
      'You do not have permission to create sequences for this lead',
      'FORBIDDEN'
    )
  }

  let steps: SequenceStep[] = []

  if (data.sequenceType === 'default') {
    steps = SequenceScheduler.getDefaultSequence()
  } else if (data.sequenceType === 'aggressive') {
    steps = SequenceScheduler.getAggressiveSequence()
  } else if (data.sequenceType === 'nurture') {
    steps = SequenceScheduler.getNurtureSequence()
  } else if (data.sequenceType === 'custom' && data.customSteps) {
    steps = data.customSteps
  } else {
    throw new AppError(400, 'Invalid sequence type or missing custom steps', 'INVALID_SEQUENCE')
  }

  const sequence = await SequenceScheduler.createSequence(
    data.leadId,
    session.user.id,
    steps,
    data.startImmediately
  )

  return NextResponse.json({
    success: true,
    sequence
  })
})

/**
 * GET - List sequences for a lead
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')

  if (!leadId) {
    throw new AppError(400, 'leadId is required', 'MISSING_LEAD_ID')
  }

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new AppError(
      403,
      'You do not have permission to view sequences for this lead',
      'FORBIDDEN'
    )
  }

  // Get sequence activities for this lead
  const sequences = await prisma.activityLog.findMany({
    where: {
      userId: session.user.id,
      leadId,
      action: 'SEQUENCE_CREATED'
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return NextResponse.json({
    sequences: sequences.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      metadata: s.metadata
    }))
  })
})
