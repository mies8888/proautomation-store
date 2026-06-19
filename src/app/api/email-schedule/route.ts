import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import SimpleJobQueue from '@/lib/jobs/email-queue'
import { z } from 'zod'

const ScheduleEmailSchema = z.object({
  leadId: z.string(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().email().optional(),
  templateId: z.string().optional(),
  scheduledTime: z.string().datetime().optional(), // Accept both scheduledTime and scheduledFor
  scheduledFor: z.string().datetime().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'custom']).optional(),
  recurrenceEndDate: z.string().datetime().optional(),
  sequenceId: z.string().optional()
})

/**
 * POST - Schedule email to send at specific time
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const scheduleData = ScheduleEmailSchema.parse(body)

  // Support both scheduledTime and scheduledFor field names
  const scheduledTimeStr = scheduleData.scheduledTime || scheduleData.scheduledFor
  if (!scheduledTimeStr) {
    throw new AppError(400, 'scheduledTime or scheduledFor is required', 'MISSING_TIME')
  }

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: scheduleData.leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You do not have permission to schedule for this lead')
  }

  // Validate scheduled time is in the future
  const scheduledTime = new Date(scheduledTimeStr)
  if (scheduledTime <= new Date()) {
    throw new AppError(400, 'Scheduled time must be in the future', 'INVALID_SCHEDULE_TIME')
  }

  // Parse recurrence end date if provided
  let recurrenceEndDate: Date | undefined
  if (scheduleData.recurrence && scheduleData.recurrence !== 'none' && scheduleData.recurrenceEndDate) {
    recurrenceEndDate = new Date(scheduleData.recurrenceEndDate)
    if (isNaN(recurrenceEndDate.getTime())) {
      throw new AppError(400, 'Invalid recurrence end date', 'INVALID_RECURRENCE_DATE')
    }
    if (recurrenceEndDate <= scheduledTime) {
      throw new AppError(400, 'Recurrence end date must be after scheduled time', 'INVALID_RECURRENCE_END')
    }
  }

  // Create scheduled email record in activity log
  const scheduledEmail = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: scheduleData.leadId,
      action: 'EMAIL_SCHEDULED',
      metadata: {
        to: scheduleData.to,
        subject: scheduleData.subject,
        body: scheduleData.body,
        cc: scheduleData.cc,
        templateId: scheduleData.templateId,
        scheduledFor: scheduledTime.toISOString(),
        recurrence: scheduleData.recurrence || 'none',
        recurrenceEndDate: recurrenceEndDate?.toISOString() || null,
        sequenceId: scheduleData.sequenceId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        retries: 0,
        lastAttempt: null,
        nextAttempt: scheduledTime.toISOString()
      }
    }
  })

  // Add job to queue
  try {
    const queue = SimpleJobQueue.initialize()
    await queue.addJob(scheduledEmail.id, scheduledTime, {
      leadId: scheduleData.leadId,
      to: scheduleData.to,
      cc: scheduleData.cc,
      subject: scheduleData.subject,
      body: scheduleData.body,
      recurrence: scheduleData.recurrence || 'none',
      recurrenceEndDate
    })
    console.log(`[Email Schedule] Added job for email ${scheduledEmail.id}`)
  } catch (jobErr) {
    console.error('[Email Schedule] Failed to add job to queue:', jobErr)
    // Don't fail the request if job queue fails - it will be processed later
  }

  return NextResponse.json({
    success: true,
    scheduled: {
      id: scheduledEmail.id,
      status: 'PENDING',
      scheduledFor: scheduledTime.toISOString(),
      recurrence: scheduleData.recurrence || 'none'
    }
  }, { status: 201 })
})

/**
 * GET - List scheduled emails
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')
  const status = searchParams.get('status') || 'PENDING'

  let where: any = {
    userId: session.user.id,
    action: 'EMAIL_SCHEDULED'
  }

  if (leadId) {
    where.leadId = leadId
  }

  // Get scheduled emails
  const scheduled = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return NextResponse.json({
    scheduled: scheduled
      .filter(s => (s.metadata as any).status === status)
      .map(s => {
        const meta = s.metadata as any
        return {
          id: s.id,
          leadId: s.leadId,
          to: meta.to,
          subject: meta.subject,
          scheduledFor: meta.scheduledFor,
          recurrence: meta.recurrence,
          status: meta.status,
          createdAt: s.createdAt
        }
      })
  })
})

/**
 * PUT - Update scheduled email or cancel
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('id')

  if (!scheduleId) {
    throw new AppError(400, 'Schedule ID is required', 'MISSING_SCHEDULE_ID')
  }

  const body = await req.json()
  const { action, scheduledFor, recurrence } = z.object({
    action: z.enum(['cancel', 'reschedule', 'pause']),
    scheduledFor: z.string().datetime().optional(),
    recurrence: z.enum(['none', 'daily', 'weekly']).optional()
  }).parse(body)

  // Get scheduled email
  const scheduled = await prisma.activityLog.findUnique({
    where: { id: scheduleId }
  })

  if (!scheduled || scheduled.userId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this schedule')
  }

  const metadata = scheduled.metadata as any

  if (action === 'cancel') {
    metadata.status = 'CANCELLED'
    metadata.cancelledAt = new Date().toISOString()
  } else if (action === 'reschedule' && scheduledFor) {
    const newTime = new Date(scheduledFor)
    if (newTime <= new Date()) {
      throw new AppError(400, 'New scheduled time must be in the future', 'INVALID_SCHEDULE_TIME')
    }
    metadata.scheduledFor = newTime.toISOString()
    metadata.nextAttempt = newTime.toISOString()
  } else if (action === 'pause') {
    metadata.status = 'PAUSED'
    metadata.pausedAt = new Date().toISOString()
  }

  if (recurrence) {
    metadata.recurrence = recurrence
  }

  const updated = await prisma.activityLog.update({
    where: { id: scheduleId },
    data: { metadata }
  })

  return NextResponse.json({
    success: true,
    scheduled: {
      id: updated.id,
      status: metadata.status,
      scheduledFor: metadata.scheduledFor
    }
  })
})

/**
 * DELETE - Remove scheduled email
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('id')

  if (!scheduleId) {
    return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
  }

  const scheduled = await prisma.activityLog.findUnique({
    where: { id: scheduleId }
  })

  if (!scheduled || scheduled.userId !== session.user.id) {
    return NextResponse.json({ error: 'You do not have access to this schedule' }, { status: 403 })
  }

  // Soft delete by marking as cancelled
  await prisma.activityLog.update({
    where: { id: scheduleId },
    data: {
      metadata: {
        ...(scheduled.metadata as any),
        status: 'DELETED',
        deletedAt: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({ success: true })
}
