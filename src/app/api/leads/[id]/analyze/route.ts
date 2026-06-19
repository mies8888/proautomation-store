import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { analyzeWebsite } from '@/services/analyzerEngine'
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

  if (!(await hasSufficientCredits(session.user.id, COST.WEBSITE_ANALYSIS))) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id }
    })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.websiteUrl) return NextResponse.json({ error: 'Lead has no website' }, { status: 400 })

    await deductCredits(session.user.id, COST.WEBSITE_ANALYSIS, "WEBSITE_ANALYSIS", `Analyzed ${lead.websiteUrl}`)

    // Delete old analysis if exists
    await prisma.websiteAnalysis.deleteMany({
      where: { leadId: lead.id }
    })

    const analysisResult = await analyzeWebsite(lead.websiteUrl)

    const analysis = await prisma.websiteAnalysis.create({
      data: {
        leadId: lead.id,
        ...analysisResult
      }
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: lead.id,
        action: 'WEBSITE_ANALYZED',
        metadata: { overallScore: analysisResult.overallScore }
      }
    })

    // Update lead scores based on analysis
    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        websiteWeaknessScore: 100 - analysisResult.overallScore,
        leadScore: Math.min(100, lead.leadScore + Math.floor((100 - analysisResult.overallScore) / 2))
      }
    })

    return NextResponse.json(analysis)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
