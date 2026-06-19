import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const DraftSchema = z.object({
  leadId: z.string(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().email().optional(),
  templateId: z.string().optional()
})

/**
 * POST - Create or update email draft
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const draftData = DraftSchema.parse(body)

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: draftData.leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new AppError(403, 'You do not have permission to draft for this lead', 'FORBIDDEN')
  }

  // Create draft email record
  const draft = await prisma.outreachEmail.create({
    data: {
      leadId: draftData.leadId,
      userId: session.user.id,
      to: draftData.to,
      subject: draftData.subject,
      body: draftData.body,
      status: 'DRAFT'
    }
  })

  // Log the draft creation
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: draftData.leadId,
      action: 'EMAIL_DRAFT_CREATED',
      metadata: {
        emailId: draft.id,
        subject: draftData.subject,
        recipient: draftData.to,
        timestamp: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    draft: {
      id: draft.id,
      status: draft.status,
      createdAt: draft.createdAt
    }
  }, { status: 201 })
})

/**
 * PUT - Update draft
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const draftId = searchParams.get('id')

  if (!draftId) {
    throw new AppError(400, 'Draft ID is required', 'MISSING_DRAFT_ID')
  }

  const body = await req.json()
  const updateData = z.object({
    subject: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    to: z.string().email().optional(),
    cc: z.string().email().optional()
  }).parse(body)

  // Get the draft
  const draft = await prisma.outreachEmail.findUnique({
    where: { id: draftId },
    include: { lead: true }
  })

  if (!draft || draft.lead.ownerUserId !== session.user.id || draft.status !== 'DRAFT') {
    throw new AppError(403, 'Cannot update this draft', 'FORBIDDEN')
  }

  // Update draft
  const updated = await prisma.outreachEmail.update({
    where: { id: draftId },
    data: updateData
  })

  return NextResponse.json({
    success: true,
    draft: updated
  })
})

/**
 * GET - List drafts for a lead
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
    throw new AppError(403, 'You do not have access to this lead', 'FORBIDDEN')
  }

  // Get drafts
  const drafts = await prisma.outreachEmail.findMany({
    where: {
      userId: session.user.id,
      leadId,
      status: 'DRAFT'
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({
    drafts: drafts.map(d => ({
      id: d.id,
      to: d.to,
      subject: d.subject,
      createdAt: d.createdAt
    }))
  })
})

/**
 * DELETE - Delete draft
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const draftId = searchParams.get('id')

  if (!draftId) {
    return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 })
  }

  const draft = await prisma.outreachEmail.findUnique({
    where: { id: draftId }
  })

  if (!draft || draft.userId !== session.user.id || draft.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Cannot delete this draft' }, { status: 403 })
  }

  await prisma.outreachEmail.delete({
    where: { id: draftId }
  })

  return NextResponse.json({ success: true })
}
