import { NextRequest, NextResponse } from 'next/server'
import { generateOpportunityReport } from '@/lib/ai/service'
import { withErrorHandling, ForbiddenError, NotFoundError } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth'

/**
 * POST /api/leads/[id]/report
 * Generate an opportunity report using Claude AI
 */
export const POST = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const leadId = params.id
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError()
  }

  // Verify lead exists and belongs to user
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      businessType: true,
    },
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError()
  }

  // Generate opportunity report using Claude
  const reportMarkdown = await generateOpportunityReport({
    companyName: lead.companyName,
    website: lead.websiteUrl || undefined,
    industry: lead.industry || undefined,
    description: lead.businessType?.name || undefined,
    country: lead.country || undefined,
    city: lead.city || undefined,
  })

  // Save or update opportunity report
  let report = await prisma.opportunityReport.findUnique({
    where: { leadId },
  })

  if (report) {
    report = await prisma.opportunityReport.update({
      where: { leadId },
      data: {
        contentMarkdown: reportMarkdown,
        updatedAt: new Date(),
      },
    })
  } else {
    report = await prisma.opportunityReport.create({
      data: {
        leadId,
        contentMarkdown: reportMarkdown,
      },
    })
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId,
      action: 'OPPORTUNITY_REPORT_GENERATED',
      metadata: {
        reportId: report.id,
        aiGenerated: true,
      },
    },
  })

  return NextResponse.json(report, { status: 201 })
})
