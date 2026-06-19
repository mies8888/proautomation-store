import { NextRequest, NextResponse } from 'next/server'
import { detectDuplicates } from '@/lib/ai/service'
import { validateRequest, withErrorHandling, ForbiddenError } from '@/lib/errors/handler'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth'

// Schema for detecting duplicates
const DetectDuplicatesSchema = z.object({
  leadId: z.string(),
  limit: z.number().optional().default(10),
})

/**
 * POST /api/leads/duplicates
 * Detect duplicate leads using Claude AI
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError()
  }

  const data = await validateRequest(req, DetectDuplicatesSchema)

  // Get the lead to check for duplicates
  const checkLead = await prisma.lead.findUnique({
    where: { id: data.leadId },
  })

  if (!checkLead) {
    throw new Error('Lead not found')
  }

  if (checkLead.ownerUserId !== session.user.id) {
    throw new ForbiddenError()
  }

  // Get all other leads by the user (limited to avoid too many comparisons)
  const existingLeads = await prisma.lead.findMany({
    where: {
      ownerUserId: session.user.id,
      id: { not: data.leadId },
    },
    select: {
      id: true,
      companyName: true,
      websiteUrl: true,
      country: true,
      industry: true,
    },
    take: data.limit,
  })

  if (existingLeads.length === 0) {
    return NextResponse.json({ duplicates: [], leadId: data.leadId })
  }

  // Detect duplicates using Claude
  const duplicates = await detectDuplicates(
    {
      companyName: checkLead.companyName,
      website: checkLead.websiteUrl || undefined,
      country: checkLead.country || undefined,
      industry: checkLead.industry || undefined,
    },
    existingLeads.map((lead) => ({
      id: lead.id,
      companyName: lead.companyName,
      website: lead.websiteUrl || undefined,
      country: lead.country || undefined,
      industry: lead.industry || undefined,
    }))
  )

  // Log activity
  if (duplicates.length > 0) {
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: data.leadId,
        action: 'DUPLICATE_DETECTION_COMPLETED',
        metadata: {
          duplicatesFound: duplicates.length,
          duplicateIds: duplicates.map((d) => d.leadId),
        },
      },
    })
  }

  return NextResponse.json(
    {
      leadId: data.leadId,
      duplicates,
      totalChecked: existingLeads.length,
    },
    { status: 200 }
  )
})
