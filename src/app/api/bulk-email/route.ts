import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const BulkEmailSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100),
  templateId: z.string(),
  sendNow: z.boolean().default(false),
  scheduleTime: z.string().datetime().optional()
})

/**
 * POST - Send emails to multiple leads in bulk
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const bulkData = BulkEmailSchema.parse(body)

  // Verify user owns all leads
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: bulkData.leadIds },
      ownerUserId: session.user.id
    }
  })

  if (leads.length !== bulkData.leadIds.length) {
    throw new AppError(
      403,
      'You do not have access to all specified leads',
      'FORBIDDEN'
    )
  }

  // Get template
  const templates = {
    cold_outreach: {
      subject: 'Quick opportunity for {{companyName}}',
      body: `Hi {{contactName}},\n\nI was impressed by {{companyName}}'s work and think I could help with {{service}}.\n\nBest regards,\n{{senderName}}`
    }
  }

  const template = (templates as any)[bulkData.templateId]
  if (!template) {
    throw new AppError(400, 'Template not found', 'TEMPLATE_NOT_FOUND')
  }

  // Create bulk campaign record
  const campaign = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_EMAIL_CAMPAIGN_STARTED',
      metadata: {
        campaignName: `Bulk campaign - ${new Date().toISOString()}`,
        templateId: bulkData.templateId,
        leadCount: leads.length,
        sendNow: bulkData.sendNow,
        scheduleTime: bulkData.scheduleTime,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        results: {
          sent: 0,
          failed: 0,
          scheduled: 0
        }
      }
    }
  })

  // Create OutreachEmail records for each lead
  const emailIds: string[] = []
  const errors: Array<{ leadId: string; error: string }> = []

  for (const lead of leads) {
    try {
      const email = await prisma.outreachEmail.create({
        data: {
          leadId: lead.id,
          userId: session.user.id,
          to: lead.contactEmail || lead.companyName,
          subject: template.subject
            .replace('{{companyName}}', lead.companyName)
            .replace('{{contactName}}', lead.companyName.split(' ')[0]),
          body: template.body
            .replace('{{companyName}}', lead.companyName)
            .replace('{{contactName}}', lead.companyName.split(' ')[0])
            .replace('{{service}}', 'our services')
            .replace('{{senderName}}', session.user.name || 'Team'),
          status: bulkData.sendNow ? 'SENT' : 'SCHEDULED'
        }
      })
      emailIds.push(email.id)

      // Update campaign results
      const newStatus = bulkData.sendNow ? 'sent' : 'scheduled'
      const currentMetadata = campaign.metadata as any
      currentMetadata.results[newStatus] = (currentMetadata.results[newStatus] || 0) + 1

      await prisma.activityLog.update({
        where: { id: campaign.id },
        data: { metadata: currentMetadata }
      })
    } catch (err) {
      errors.push({
        leadId: lead.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  // Log completion
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_EMAIL_CAMPAIGN_COMPLETED',
      metadata: {
        campaignId: campaign.id,
        emailsSent: bulkData.sendNow ? emailIds.length : 0,
        emailsScheduled: bulkData.sendNow ? 0 : emailIds.length,
        errors: errors.length,
        errorDetails: errors,
        timestamp: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    campaignId: campaign.id,
    results: {
      total: leads.length,
      created: emailIds.length,
      failed: errors.length,
      status: bulkData.sendNow ? 'SENT' : 'SCHEDULED'
    },
    errors: errors.length > 0 ? errors : undefined
  }, { status: 201 })
})

/**
 * GET - List bulk campaigns
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Get campaigns
  const campaigns = await prisma.activityLog.findMany({
    where: {
      userId: session.user.id,
      action: 'BULK_EMAIL_CAMPAIGN_STARTED'
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  })

  return NextResponse.json({
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: (c.metadata as any).campaignName,
      leadCount: (c.metadata as any).leadCount,
      status: (c.metadata as any).status,
      templateId: (c.metadata as any).templateId,
      results: (c.metadata as any).results,
      createdAt: c.createdAt
    }))
  })
})

/**
 * PUT - Update campaign status (pause, resume, cancel)
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaignId')

  if (!campaignId) {
    throw new AppError(400, 'campaignId is required', 'MISSING_CAMPAIGN_ID')
  }

  const body = await req.json()
  const { status } = z.object({
    status: z.enum(['PAUSED', 'RESUMED', 'CANCELLED'])
  }).parse(body)

  // Get campaign
  const campaign = await prisma.activityLog.findUnique({
    where: { id: campaignId }
  })

  if (!campaign || campaign.userId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this campaign')
  }

  // Update campaign
  const metadata = campaign.metadata as any
  metadata.status = status
  metadata.updatedAt = new Date().toISOString()

  const updated = await prisma.activityLog.update({
    where: { id: campaignId },
    data: { metadata }
  })

  return NextResponse.json({
    success: true,
    campaign: {
      id: updated.id,
      status: metadata.status
    }
  })
})
