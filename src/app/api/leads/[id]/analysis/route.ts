import { NextRequest, NextResponse } from 'next/server'
import { analyzeWebsite } from '@/lib/ai/service'
import { withErrorHandling, ForbiddenError, NotFoundError } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth'

/**
 * POST /api/leads/[id]/analysis
 * Analyze a website and generate insights using Claude AI
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

  if (!lead.websiteUrl) {
    throw new Error('Lead does not have a website URL')
  }

  // Analyze website using Claude
  const analysis = await analyzeWebsite({
    url: lead.websiteUrl,
    industry: lead.industry || undefined,
    companyDescription: lead.businessType?.name || undefined,
  })

  // Save or update website analysis
  let websiteAnalysis = await prisma.websiteAnalysis.findUnique({
    where: { leadId },
  })

  if (websiteAnalysis) {
    websiteAnalysis = await prisma.websiteAnalysis.update({
      where: { leadId },
      data: {
        overallScore: analysis.overallScore,
        performanceScore: analysis.performanceScore,
        seoScore: analysis.seoScore,
        accessibilityScore: analysis.accessibilityScore,
        designScore: analysis.designScore,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        updatedAt: new Date(),
      },
    })
  } else {
    websiteAnalysis = await prisma.websiteAnalysis.create({
      data: {
        leadId,
        overallScore: analysis.overallScore,
        performanceScore: analysis.performanceScore,
        seoScore: analysis.seoScore,
        accessibilityScore: analysis.accessibilityScore,
        designScore: analysis.designScore,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
      },
    })
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId,
      action: 'WEBSITE_ANALYSIS_COMPLETED',
      metadata: {
        analysisId: websiteAnalysis.id,
        overallScore: analysis.overallScore,
        aiGenerated: true,
      },
    },
  })

  return NextResponse.json(websiteAnalysis, { status: 201 })
})
