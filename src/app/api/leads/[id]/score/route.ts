import { NextRequest, NextResponse } from 'next/server'
import { scoreLead } from '@/lib/ai/service'
import { withErrorHandling, ForbiddenError, NotFoundError } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth'

/**
 * POST /api/leads/[id]/score
 * Generate lead scores using Claude AI
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

  // Generate lead scores using Claude
  const scores = await scoreLead({
    companyName: lead.companyName,
    industry: lead.industry || undefined,
    country: lead.country || undefined,
    website: lead.websiteUrl || undefined,
    description: lead.businessType?.name || undefined,
    websiteAnalysis: lead.websiteAnalysis ? { overallScore: lead.websiteAnalysis.overallScore } : undefined,
  })

  // Update lead with scores
  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      fitScore: scores.fitScore,
      contactabilityScore: scores.contactabilityScore,
      urgencyScore: scores.urgencyScore,
      revenuePotentialScore: scores.revenuePotentialScore,
      conversionProbabilityScore: scores.conversionProbabilityScore,
      dataQualityScore: scores.dataQualityScore,
      confidenceScore: scores.confidenceScore,
      // Calculate overall lead score as weighted average
      leadScore: Math.round(
        (scores.fitScore * 0.2 +
          scores.contactabilityScore * 0.15 +
          scores.urgencyScore * 0.1 +
          scores.revenuePotentialScore * 0.2 +
          scores.conversionProbabilityScore * 0.2 +
          scores.dataQualityScore * 0.1 +
          scores.confidenceScore * 0.05) /
          100
      ),
    },
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId,
      action: 'LEAD_SCORED',
      metadata: {
        leadScore: updatedLead.leadScore,
        fitScore: scores.fitScore,
        recommendation: scores.recommendation,
        aiGenerated: true,
      },
    },
  })

  return NextResponse.json(
    {
      lead: updatedLead,
      scores,
    },
    { status: 201 }
  )
})
