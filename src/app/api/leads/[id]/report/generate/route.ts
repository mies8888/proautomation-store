import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { generateOpportunityReport } from '@/services/reportGenerator'
import { COST, hasSufficientCredits, deductCredits } from '@/services/billing'
import { rateLimit } from '@/lib/security/rateLimiter'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const rate = await rateLimit(`rate-limit:${ip}`, 10)
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const params = await props.params;
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasSufficientCredits(session.user.id, COST.REPORT_GENERATION))) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: { websiteAnalysis: true }
    })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.websiteAnalysis) return NextResponse.json({ error: 'Website must be analyzed first' }, { status: 400 })

    await deductCredits(session.user.id, COST.REPORT_GENERATION, "REPORT_GENERATION", `Pitch report for ${lead.companyName}`)

    const markdownContent = await generateOpportunityReport(lead.companyName, {
      overallScore: lead.websiteAnalysis.overallScore,
      performanceScore: lead.websiteAnalysis.performanceScore,
      seoScore: lead.websiteAnalysis.seoScore,
      accessibilityScore: lead.websiteAnalysis.accessibilityScore,
      designScore: lead.websiteAnalysis.designScore,
      weaknesses: lead.websiteAnalysis.weaknesses as string[],
      opportunities: lead.websiteAnalysis.opportunities as string[]
    })

    const report = await prisma.opportunityReport.upsert({
      where: { leadId: lead.id },
      update: {
        contentMarkdown: markdownContent,
        status: 'COMPLETED'
      },
      create: {
        leadId: lead.id,
        contentMarkdown: markdownContent,
        status: 'COMPLETED'
      }
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: lead.id,
        action: 'REPORT_GENERATED',
        metadata: { reportId: report.id }
      }
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
